namespace JobSearchAssistant.Domain;

public enum VacancyStatus
{
    New,
    Saved,
    Applied,
    HrContact,
    HrInterview,
    TechInterview,
    TestTask,
    Rejected,
    Offer,
    Skipped
}

public sealed class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Source { get; set; } = "hh";
    public string ExternalId { get; set; } = "";
    public string Name { get; set; } = "Unknown";
    public bool IsBlacklisted { get; set; }
    public bool IsWatched { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<Vacancy> Vacancies { get; set; } = [];
}

public sealed class Vacancy
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Source { get; set; } = "hh";
    public string SourceLabel { get; set; } = "HeadHunter";
    public string ExternalId { get; set; } = "";
    public string CanonicalFingerprint { get; set; } = "";
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string ApplyUrl { get; set; } = "";
    public string DescriptionText { get; set; } = "";
    public string SalaryText { get; set; } = "";
    public string Schedule { get; set; } = "";
    public string Experience { get; set; } = "";
    public string Country { get; set; } = "";
    public string LocationText { get; set; } = "";
    public string RemoteScope { get; set; } = "";
    public string EligibilityStatus { get; set; } = "Verify";
    public string EligibilityReason { get; set; } = "";
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset FirstSeenAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;

    public int MatchScore { get; set; }
    public string MatchLevel { get; set; } = "Skip";
    public string MatchedSkills { get; set; } = "";
    public string MissingSkills { get; set; } = "";
    public string WhyMatch { get; set; } = "";
    public bool IsRemote { get; set; }
    public bool HasExistingHhResponse { get; set; }
    public VacancyStatus Status { get; set; } = VacancyStatus.New;

    public Application? Application { get; set; }
    public List<ApplicationEvent> Events { get; set; } = [];
}

public sealed class Application
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VacancyId { get; set; }
    public Vacancy Vacancy { get; set; } = null!;
    public string ResumeExternalId { get; set; } = "";
    public string CoverLetter { get; set; } = "";
    public DateTimeOffset AppliedAt { get; set; } = DateTimeOffset.UtcNow;
    public string ExternalNegotiationId { get; set; } = "";
    public string LastError { get; set; } = "";
}

public sealed class ApplicationEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VacancyId { get; set; }
    public Vacancy Vacancy { get; set; } = null!;
    public string Type { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AppState
{
    public int Id { get; set; } = 1;
    public string HhResumeId { get; set; } = "";
    public string ProtectedAccessToken { get; set; } = "";
    public string ProtectedRefreshToken { get; set; } = "";
    public DateTimeOffset? AccessTokenExpiresAt { get; set; }
    public string OAuthState { get; set; } = "";
    public string OAuthCodeVerifier { get; set; } = "";
    public DateTimeOffset? OAuthCreatedAt { get; set; }
    public bool AutoApplyEnabled { get; set; }
    public int AutoApplyMinimumScore { get; set; } = 95;
    public int DailyAutoApplyLimit { get; set; } = 3;
    public DateTimeOffset? LastCollectedAt { get; set; }
}

public sealed record CandidateProfileOptions
{
    public string Name { get; init; } = "Violetta Nicolaou";
    public string RussianName { get; init; } = "Виолетта Николаевна";
    public string GreekName { get; init; } = "Βιολέττα Νικολάου";
    public string Email { get; init; } = "violettanicolaou@gmail.com";
    public string Phone { get; init; } = "";
    public string LinkedInUrl { get; init; } = "";
    public string CurrentCountry { get; init; } = "Russia";
    public string CurrentCity { get; init; } = "Volgograd";
    public string GitHubUrl { get; init; } = "https://github.com/ViolettaNcl";
    public string CvUrl { get; init; } = "https://violetta-cv.vercel.app/";
    public string EnglishCvFileName { get; init; } = "Violetta_Nicolaou_CV_EN_v2.pdf";
    public string RussianCvFileName { get; init; } = "Violetta_Nicolaou_CV_RU_v2.pdf";
    public string Education { get; init; } = "09.02.07 Information Systems and Programming — Programmer, honours diploma, TOP Academy, July 2026";
    public string MainProjectUrl { get; init; } = "https://github.com/ViolettaNcl/DentalClinic";
    public string MainProjectSummary { get; init; } = "Independent real-client dental-practice platform built with ASP.NET Core, EF Core, SQL Server, JWT, SignalR, background jobs, Docker, testing and AI integrations.";
    public bool RussiaWorkAuthorized { get; init; } = true;
    public bool EuWorkAuthorized { get; init; } = true;
    public bool OpenToWorldwideRemote { get; init; } = true;
    public bool OpenToRelocationWithVisaSponsorship { get; init; } = false;
    public string[] Citizenships { get; init; } = ["Russia", "Cyprus / EU"];
    public string[] FluentLanguages { get; init; } = ["Russian", "English", "Greek"];
    public string[] CoreSkills { get; init; } =
    [
        "C#", ".NET", "ASP.NET Core", "Web API", "Entity Framework Core", "EF Core", "SQL Server", "SQL",
        "REST API", "REST", "LINQ", "Docker", "Git", "GitHub Actions", "Automated Testing", "MSTest", "xUnit",
        "JavaScript", "TypeScript", "React", "Next.js", "SignalR", "JWT", "WPF", "XAML"
    ];
    public string[] PreferredRoles { get; init; } =
    [
        "Junior C# Developer", "Junior .NET Developer", "Junior ASP.NET Core Developer", "Junior Backend Developer",
        "Junior Full-Stack Developer", "Associate Software Engineer", "Graduate Software Engineer", ".NET Intern",
        "Junior QA Engineer", "Junior QA Automation Engineer", "Junior Implementation Engineer", "Technical Support Engineer"
    ];
    public string[] EmploymentTypes { get; init; } = ["Full-time", "Contractor/B2B", "Freelance/Project", "Internship"];
}

public sealed record SearchOptions
{
    public string[] RussiaQueries { get; init; } =
    [
        "Junior C# Developer",
        "Junior .NET Developer",
        "C# .NET разработчик",
        ".NET разработчик",
        "ASP.NET Core разработчик",
        "Младший разработчик C#",
        "Стажер C# .NET",
        "Стажёр C# .NET",
        "Стажировка .NET"
    ];

    public string[] InternationalQueries { get; init; } =
    [
        "Junior C# Developer",
        "Junior .NET Developer",
        "C# .NET Developer",
        "ASP.NET Core Developer",
        "Backend C#",
        "Full-Stack .NET",
        ".NET Intern",
        "C# Intern",
        "Software Engineer Intern C#",
        "Graduate .NET Developer"
    ];

    public int IntervalMinutes { get; init; } = 360;
    public int MaxNewVacanciesPerRun { get; init; } = 80;
    public int MinimumTelegramScore { get; init; } = 65;
    public bool RemoteOnly { get; init; } = true;
    public bool IncludeRelocationWithVisa { get; init; } = false;
}

public sealed record TelegramOptions
{
    public string BotToken { get; init; } = "";
    public long AllowedChatId { get; init; }
}

public sealed record HhOptions
{
    public string ClientId { get; init; } = "";
    public string ClientSecret { get; init; } = "";
    public string RedirectUri { get; init; } = "http://localhost:8080/api/hh/oauth/callback";
    public string UserAgent { get; init; } = "ViolettaJobAssistant/2.0 (violettanicolaou@gmail.com)";
    public string ApiBaseUrl { get; init; } = "https://api.hh.ru";
    public bool Enabled { get; init; } = true;
}

public sealed record RemotiveOptions
{
    public bool Enabled { get; init; } = true;
    public string ApiUrl { get; init; } = "https://remotive.com/api/remote-jobs";
}

public sealed record AdzunaOptions
{
    public bool Enabled { get; init; } = false;
    public string AppId { get; init; } = "";
    public string AppKey { get; init; } = "";
    public string[] CountryCodes { get; init; } = ["gb", "de", "fr", "nl", "pl", "es", "pt", "ie"];
    public int ResultsPerPage { get; init; } = 25;
}

public sealed record SecurityOptions
{
    public string EncryptionKeyBase64 { get; init; } = "";
    public bool EnableAutomaticSubmission { get; init; }
}
