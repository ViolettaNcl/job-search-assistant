using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Data;

public static class RuntimeHealthEndpoints
{
    public static IEndpointRouteBuilder MapRuntimeHealth(
        this IEndpointRouteBuilder endpoints,
        bool persistentDatabase,
        DatabaseBootstrapResult bootstrap)
        => endpoints.MapRuntimeHealth(
            persistentDatabase ? DatabaseStorageMode.Postgres : DatabaseStorageMode.InMemory,
            bootstrap);

    public static IEndpointRouteBuilder MapRuntimeHealth(
        this IEndpointRouteBuilder endpoints,
        DatabaseStorageMode storageMode,
        DatabaseBootstrapResult bootstrap)
    {
        endpoints.MapGet("/health/live", () => Results.Ok(new
        {
            status = "alive",
            utc = DateTimeOffset.UtcNow
        }));

        endpoints.MapGet("/health/ready", async (AppDbContext db, CancellationToken ct) =>
        {
            var result = await CheckReadinessAsync(db, storageMode, bootstrap, ct);
            var payload = new
            {
                status = result.Ready ? "ready" : "not_ready",
                utc = DateTimeOffset.UtcNow,
                database = LocalSqliteDatabase.Label(storageMode),
                persistent = LocalSqliteDatabase.IsPersistent(storageMode),
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

    public static Task<RuntimeReadinessResult> CheckReadinessAsync(
        AppDbContext db,
        bool persistentDatabase,
        DatabaseBootstrapResult bootstrap,
        CancellationToken ct = default)
        => CheckReadinessAsync(
            db,
            persistentDatabase ? DatabaseStorageMode.Postgres : DatabaseStorageMode.InMemory,
            bootstrap,
            ct);

    public static async Task<RuntimeReadinessResult> CheckReadinessAsync(
        AppDbContext db,
        DatabaseStorageMode storageMode,
        DatabaseBootstrapResult bootstrap,
        CancellationToken ct = default)
    {
        var persistent = LocalSqliteDatabase.IsPersistent(storageMode);
        if (persistent)
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
            var schemaReady = storageMode switch
            {
                DatabaseStorageMode.Postgres => bootstrap.Mode == "postgres-migrations" &&
                                                !string.IsNullOrWhiteSpace(bootstrap.LatestMigration),
                DatabaseStorageMode.LocalSqlite => bootstrap.Mode == "sqlite-ensure-created",
                _ => true
            };
            return new RuntimeReadinessResult(schemaReady && appStateReady, true, appStateReady);
        }
        catch
        {
            return new RuntimeReadinessResult(false, persistent ? false : true, false);
        }
    }
}

public sealed record RuntimeReadinessResult(
    bool Ready,
    bool DatabaseReachable,
    bool AppStateReady);
