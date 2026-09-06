using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Data;

public sealed record DatabaseBootstrapResult(
    string Mode,
    string? LatestMigration,
    int AppliedMigrations);

public static class DatabaseBootstrapper
{
    public static async Task<DatabaseBootstrapResult> InitializeAsync(
        AppDbContext db,
        bool persistentDatabase,
        ILogger logger,
        CancellationToken ct = default)
    {
        if (!persistentDatabase)
        {
            await db.Database.EnsureCreatedAsync(ct);
            await EnsureAppStateAsync(db, ct);
            logger.LogInformation("Database initialized in non-persistent in-memory mode.");
            return new DatabaseBootstrapResult("in-memory", null, 0);
        }

        var knownMigrations = db.Database.GetMigrations().ToArray();
        if (knownMigrations.Length == 0)
            throw new InvalidOperationException("Persistent PostgreSQL is configured but no EF Core migrations are registered.");

        await db.Database.MigrateAsync(ct);
        await EnsureAppStateAsync(db, ct);

        var applied = (await db.Database.GetAppliedMigrationsAsync(ct)).ToArray();
        var latest = applied.LastOrDefault();
        logger.LogInformation(
            "PostgreSQL schema ready. Applied migrations: {AppliedCount}. Latest migration: {LatestMigration}",
            applied.Length,
            latest ?? "none");

        return new DatabaseBootstrapResult("postgres-migrations", latest, applied.Length);
    }

    private static async Task EnsureAppStateAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.AppStates.AnyAsync(x => x.Id == 1, ct)) return;
        db.AppStates.Add(new AppState { Id = 1 });
        await db.SaveChangesAsync(ct);
    }
}
