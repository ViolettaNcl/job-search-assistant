using JobSearchAssistant.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class DatabaseBootstrapperTests
{
    [TestMethod]
    public void PostgresModel_RegistersBaselineMigration()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=jobassistant_tests;Username=test;Password=test")
            .Options;

        using var db = new AppDbContext(options);
        var migrations = db.Database.GetMigrations().ToList();

        CollectionAssert.Contains(migrations, "20260906130500_BaselineExistingSchema");
    }

    [TestMethod]
    public async Task InMemoryBootstrap_CreatesRequiredAppState()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"bootstrap-{Guid.NewGuid()}")
            .Options;

        await using var db = new AppDbContext(options);
        var result = await DatabaseBootstrapper.InitializeAsync(
            db,
            persistentDatabase: false,
            NullLogger.Instance,
            CancellationToken.None);

        Assert.AreEqual("in-memory", result.Mode);
        Assert.IsNull(result.LatestMigration);
        Assert.AreEqual(0, result.AppliedMigrations);
        Assert.IsTrue(await db.AppStates.AnyAsync(x => x.Id == 1));
    }

    [TestMethod]
    public async Task LocalSqliteBootstrap_PersistsApplicationStateAcrossContexts()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"vja-{Guid.NewGuid():N}.db");
        var connection = $"Data Source={databasePath}";

        try
        {
            var firstOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connection)
                .Options;

            await using (var first = new AppDbContext(firstOptions))
            {
                var result = await DatabaseBootstrapper.InitializeAsync(
                    first,
                    DatabaseStorageMode.LocalSqlite,
                    NullLogger.Instance,
                    CancellationToken.None);

                Assert.AreEqual("sqlite-ensure-created", result.Mode);
                Assert.IsTrue(await first.AppStates.AnyAsync(x => x.Id == 1));
                var state = await first.AppStates.SingleAsync(x => x.Id == 1);
                state.HhResumeId = "persistent-test-resume";
                await first.SaveChangesAsync();
            }

            var secondOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connection)
                .Options;

            await using (var second = new AppDbContext(secondOptions))
            {
                Assert.IsTrue(await second.Database.CanConnectAsync());
                var state = await second.AppStates.AsNoTracking().SingleAsync(x => x.Id == 1);
                Assert.AreEqual("persistent-test-resume", state.HhResumeId);
            }
        }
        finally
        {
            if (File.Exists(databasePath)) File.Delete(databasePath);
            if (File.Exists(databasePath + "-shm")) File.Delete(databasePath + "-shm");
            if (File.Exists(databasePath + "-wal")) File.Delete(databasePath + "-wal");
        }
    }
}
