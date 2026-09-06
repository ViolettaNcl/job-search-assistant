using JobSearchAssistant.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class RuntimeHealthEndpointsTests
{
    [TestMethod]
    public async Task InMemoryReadiness_IsReadyAfterBootstrap()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"readiness-{Guid.NewGuid()}")
            .Options;

        await using var db = new AppDbContext(options);
        var bootstrap = await DatabaseBootstrapper.InitializeAsync(
            db,
            persistentDatabase: false,
            NullLogger.Instance,
            CancellationToken.None);

        var result = await RuntimeHealthEndpoints.CheckReadinessAsync(
            db,
            persistentDatabase: false,
            bootstrap,
            CancellationToken.None);

        Assert.IsTrue(result.Ready);
        Assert.IsTrue(result.DatabaseReachable);
        Assert.IsTrue(result.AppStateReady);
    }

    [TestMethod]
    public async Task InMemoryReadiness_IsNotReadyWhenRequiredStateIsMissing()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"readiness-missing-{Guid.NewGuid()}")
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();
        var state = await db.AppStates.SingleAsync(x => x.Id == 1);
        db.AppStates.Remove(state);
        await db.SaveChangesAsync();

        var result = await RuntimeHealthEndpoints.CheckReadinessAsync(
            db,
            persistentDatabase: false,
            new DatabaseBootstrapResult("in-memory", null, 0),
            CancellationToken.None);

        Assert.IsFalse(result.Ready);
        Assert.IsTrue(result.DatabaseReachable);
        Assert.IsFalse(result.AppStateReady);
    }

    [TestMethod]
    public async Task LocalSqliteReadiness_IsPersistentAndReadyAfterBootstrap()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"vja-health-{Guid.NewGuid():N}.db");
        try
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite($"Data Source={databasePath}")
                .Options;

            await using var db = new AppDbContext(options);
            var bootstrap = await DatabaseBootstrapper.InitializeAsync(
                db,
                DatabaseStorageMode.LocalSqlite,
                NullLogger.Instance,
                CancellationToken.None);

            var result = await RuntimeHealthEndpoints.CheckReadinessAsync(
                db,
                DatabaseStorageMode.LocalSqlite,
                bootstrap,
                CancellationToken.None);

            Assert.AreEqual("sqlite-ensure-created", bootstrap.Mode);
            Assert.IsTrue(result.Ready);
            Assert.IsTrue(result.DatabaseReachable);
            Assert.IsTrue(result.AppStateReady);
            Assert.IsTrue(LocalSqliteDatabase.IsPersistent(DatabaseStorageMode.LocalSqlite));
            Assert.AreEqual("sqlite", LocalSqliteDatabase.Label(DatabaseStorageMode.LocalSqlite));
        }
        finally
        {
            if (File.Exists(databasePath)) File.Delete(databasePath);
            if (File.Exists(databasePath + "-shm")) File.Delete(databasePath + "-shm");
            if (File.Exists(databasePath + "-wal")) File.Delete(databasePath + "-wal");
        }
    }
}
