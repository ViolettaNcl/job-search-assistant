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
}
