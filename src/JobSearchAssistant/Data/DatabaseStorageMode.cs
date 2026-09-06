using Microsoft.Data.Sqlite;

namespace JobSearchAssistant.Data;

public enum DatabaseStorageMode
{
    InMemory,
    LocalSqlite,
    Postgres
}

public static class LocalSqliteDatabase
{
    public const string ApplicationFolderName = "ViolettaApplyAssistant";
    public const string DatabaseFileName = "jobassistant.db";

    public static string ResolveConnectionString(IConfiguration configuration)
    {
        var configured = configuration.GetConnectionString("Sqlite");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        var localRoot = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (string.IsNullOrWhiteSpace(localRoot)) localRoot = AppContext.BaseDirectory;

        var directory = Path.Combine(localRoot, ApplicationFolderName);
        Directory.CreateDirectory(directory);
        var databasePath = Path.Combine(directory, DatabaseFileName);

        return new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        }.ToString();
    }

    public static string Label(DatabaseStorageMode mode) => mode switch
    {
        DatabaseStorageMode.Postgres => "postgres",
        DatabaseStorageMode.LocalSqlite => "sqlite",
        _ => "in-memory"
    };

    public static bool IsPersistent(DatabaseStorageMode mode)
        => mode is DatabaseStorageMode.Postgres or DatabaseStorageMode.LocalSqlite;
}
