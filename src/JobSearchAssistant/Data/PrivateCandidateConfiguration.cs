namespace JobSearchAssistant.Data;

public static class PrivateCandidateConfiguration
{
    public static void AddPrivateCandidateConfiguration(this ConfigurationManager configuration)
    {
        var localRoot = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (!string.IsNullOrWhiteSpace(localRoot))
            configuration.AddJsonFile(Path.Combine(localRoot, LocalSqliteDatabase.ApplicationFolderName,
                "candidate.private.json"), optional: true, reloadOnChange: false);
        // Existing environment overrides retain precedence. No database or browser memory is cleared.
        configuration.AddEnvironmentVariables();
    }
}
