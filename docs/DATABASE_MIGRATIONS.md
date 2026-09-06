# Database migrations and production safety

The Job Search Assistant uses two database modes:

- **PostgreSQL (persistent):** EF Core migrations are applied automatically during application startup.
- **In-memory (demo/dev fallback):** `EnsureCreated` is used because there is no persistent schema to migrate.

## Why this matters

Application history now includes submissions, recruiter follow-ups, pipeline stages and outcome analytics. Recreating the database schema is no longer an acceptable production upgrade strategy.

For PostgreSQL, startup now calls `Database.MigrateAsync()` and fails fast if no migrations are registered. The `/health` response exposes the schema mode, latest applied migration and applied migration count.

## Baseline migration

`20260906130500_BaselineExistingSchema` is an idempotent baseline migration.

It supports both:

1. a fresh empty PostgreSQL database; and
2. an older Job Search Assistant database that was originally created by `EnsureCreated`.

The migration uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` and an idempotent `AppState` seed so adopting an existing database does not delete its application history.

The baseline `Down` migration intentionally performs no destructive rollback. Once real job-search data exists, an automated rollback to “no schema” would be unsafe.

## Production upgrade procedure

1. Take a PostgreSQL backup/snapshot before deploying a schema-changing release.
2. Deploy the new application version.
3. Watch startup logs for `PostgreSQL schema ready`.
4. Check `/health` and verify:
   - `persistent: true`
   - `schemaMode: postgres-migrations`
   - `latestMigration` matches the release
5. Verify the dashboard and application history before removing the backup retention point.

If migration startup fails, the application intentionally fails startup rather than serving traffic against a partially upgraded schema.

## Future schema changes

Every persistent model change should ship with a new EF Core migration. Do not return PostgreSQL startup to `EnsureCreated`, and do not edit an already-deployed migration to represent a new schema change.
