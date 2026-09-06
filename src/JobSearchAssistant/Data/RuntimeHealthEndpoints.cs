using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Data;

public static class RuntimeHealthEndpoints
{
    public static IEndpointRouteBuilder MapRuntimeHealth(
        this IEndpointRouteBuilder endpoints,
        bool persistentDatabase,
        DatabaseBootstrapResult bootstrap)
    {
        endpoints.MapGet("/health/live", () => Results.Ok(new
        {
            status = "alive",
            utc = DateTimeOffset.UtcNow
        }));

        endpoints.MapGet("/health/ready", async (AppDbContext db, CancellationToken ct) =>
        {
            var result = await CheckReadinessAsync(db, persistentDatabase, bootstrap, ct);
            var payload = new
            {
                status = result.Ready ? "ready" : "not_ready",
                utc = DateTimeOffset.UtcNow,
                database = persistentDatabase ? "postgres" : "in-memory",
                persistent = persistentDatabase,
                schemaMode = bootstrap.Mode,
                latestMigration = bootstrap.LatestMigration,
                appliedMigrations = bootstrap.AppliedMigrations,
                databaseReachable = result.DatabaseReachable,
                appStateReady = result.AppStateReady
            };

            return result.Ready
                ? Results.Ok(payload)
                : Results.Json(payload, statusCode: StatusCodes.Status503ServiceUnavailable);
        });

        return endpoints;
    }

    public static async Task<RuntimeReadinessResult> CheckReadinessAsync(
        AppDbContext db,
        bool persistentDatabase,
        DatabaseBootstrapResult bootstrap,
        CancellationToken ct = default)
    {
        if (persistentDatabase)
        {
            try
            {
                if (!await db.Database.CanConnectAsync(ct))
                    return new RuntimeReadinessResult(false, false, false);
            }
            catch
            {
                return new RuntimeReadinessResult(false, false, false);
            }
        }

        try
        {
            var appStateReady = await db.AppStates.AsNoTracking().AnyAsync(x => x.Id == 1, ct);
            var schemaReady = !persistentDatabase ||
                              (bootstrap.Mode == "postgres-migrations" && !string.IsNullOrWhiteSpace(bootstrap.LatestMigration));
            return new RuntimeReadinessResult(schemaReady && appStateReady, true, appStateReady);
        }
        catch
        {
            return new RuntimeReadinessResult(false, persistentDatabase ? false : true, false);
        }
    }
}

public sealed record RuntimeReadinessResult(
    bool Ready,
    bool DatabaseReachable,
    bool AppStateReady);
