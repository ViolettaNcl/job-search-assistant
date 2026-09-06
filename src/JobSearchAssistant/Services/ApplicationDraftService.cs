using System.Text.RegularExpressions;
using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record ApplicationDraft(
    string Language,
    string CandidateName,
    string RecommendedHeadline,
    string RecommendedCv,
    string ShortMessage,
    string CoverLetter,
    IReadOnlyDictionary<string, string> CommonAnswers,
    string[] Emphasize,
    string[] VerifyBeforeSubmit);

public sealed class ApplicationDraftService(IOptions<CandidateProfileOptions> candidate)
{
    private readonly CandidateProfileOptions _candidate = candidate.Value;

    public ApplicationDraft Build(Vacancy vacancy)
    {
        var company = vacancy.Company?.Name ?? "the company";
        return Build(
            vacancy.Title,
            company,
            vacancy.DescriptionText,
            vacancy.Country,
            vacancy.Source,
            vacancy.MatchScore,
            Split(vacancy.MatchedSkills),
            Split(vacancy.MissingSkills));
    }

    public ApplicationDraft Build(
        string title,
        string company,
        string description,
        string country,
        string source,
        int score,
        IEnumerable<string> matched,
        IEnumerable<string> missing)
    {
        var russian = IsRussianMarket(country, source, description);
        var roleKind = ClassifyRole(title, description);
        var matchedSkills = matched.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Take(7).ToArray();
        var missingSkills = missing.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Take(5).ToArray();
        var headline = roleKind switch
        {
            "qa" => russian ? "Junior QA Engineer / .NET Developer" : "Junior QA Engineer / .NET Developer",
            "support" => russian ? "Junior Technical / Implementation Engineer" : "Junior Technical / Implementation Engineer",
            "fullstack" => russian ? "Junior Full-Stack .NET разработчик" : "Junior Full-Stack .NET Developer",
            _ => russian ? "Junior C# / .NET разработчик" : "Junior C# / .NET Developer"
        };

        var emphasize = SelectEmphasis(roleKind, matchedSkills);
        var candidateName = russian ? _candidate.RussianName : _candidate.Name;
        var cv = russian ? _candidate.RussianCvFileName : _candidate.EnglishCvFileName;
        var shortMessage = russian
            ? BuildRussianShort(company, title, roleKind, emphasize)
            : BuildEnglishShort(company, title, roleKind, emphasize);
        var coverLetter = russian
            ? BuildRussianLetter(company, title, roleKind, emphasize, missingSkills)
            : BuildEnglishLetter(company, title, roleKind, emphasize, missingSkills);

        var answers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["email"] = _candidate.Email,
            ["github"] = _candidate.GitHubUrl,
            ["portfolio"] = _candidate.CvUrl,
            ["currentLocation"] = $"{_candidate.CurrentCity}, {_candidate.CurrentCountry}",
            ["russiaWorkAuthorization"] = _candidate.RussiaWorkAuthorized ? "Yes" : "No",
            ["euWorkAuthorization"] = _candidate.EuWorkAuthorized ? "Yes" : "No",
            ["requiresSponsorshipRussia"] = _candidate.RussiaWorkAuthorized ? "No" : "Yes",
            ["languages"] = string.Join(", ", _candidate.FluentLanguages),
            ["commercialExperience"] = russian
                ? "Первый официальный developer role; есть самостоятельный real-client проект, разработанный end-to-end."
                : "Seeking first formal developer role; has an independent real-client project delivered end-to-end.",
            ["availability"] = "Ask candidate if the form requires an exact start date.",
            ["salary"] = "Use the vacancy range/local market; ask candidate if a binding exact figure is required."
        };

        var verify = new List<string>();
        if (missingSkills.Length > 0) verify.Add($"Do not claim these skills unless independently verified: {string.Join(", ", missingSkills)}.");
        if (score < 75) verify.Add("Fit score is below the normal auto-apply threshold; review before applying.");
        verify.Add("Never invent years of commercial employment, certifications, relocation commitments or legal declarations.");

        return new ApplicationDraft(
            russian ? "ru" : "en",
            candidateName,
            headline,
            cv,
            shortMessage,
            coverLetter,
            answers,
            emphasize,
            verify.ToArray());
    }

    private string BuildRussianShort(string company, string title, string roleKind, string[] emphasize)
    {
        var focus = HumanList(emphasize.Take(4), "C#, ASP.NET Core и SQL");
        return $"Здравствуйте! Увидела вакансию «{title}» в {company} и решила откликнуться, потому что задачи близки к тому, с чем я уже работаю. Мой основной стек — {focus}. Мой главный проект DentalClinic — полноценное приложение для реальной стоматологической практики, которое я делала от backend и базы данных до тестирования и деплоя. Сейчас ищу первую сильную команду, где смогу расти как {RussianRole(roleKind)}. GitHub: {_candidate.GitHubUrl}";
    }

    private string BuildEnglishShort(string company, string title, string roleKind, string[] emphasize)
    {
        var focus = HumanList(emphasize.Take(4), "C#, ASP.NET Core and SQL");
        return $"Hi! I came across the {title} role at {company} and decided to apply because the work is close to what I have already been building. My strongest areas are {focus}. My main project, DentalClinic, is a real-client application that I worked on end-to-end, from the backend and database to testing and deployment. I am now looking for my first strong team where I can keep growing as a {EnglishRole(roleKind)}. GitHub: {_candidate.GitHubUrl}";
    }

    private string BuildRussianLetter(string company, string title, string roleKind, string[] emphasize, string[] missing)
    {
        var focus = HumanList(emphasize.Take(5), "C#, ASP.NET Core, EF Core и SQL Server");
        var gap = missing.Length == 0
            ? ""
            : $" С технологиями {HumanList(missing.Take(2), "из вакансии")}, с которыми у меня пока меньше практики, готова быстро разобраться — в отклике не хочу приписывать себе то, чего ещё не делала.";

        return $"Здравствуйте!\n\nМеня зовут {_candidate.RussianName}. Увидела вакансию «{title}» в {company} и решила откликнуться: по задачам и стеку она очень близка к тому, чем я занимаюсь сейчас.\n\nЯ закончила обучение по специальности «Информационные системы и программирование» с дипломом с отличием. Основной стек — {focus}. Мой главный проект — DentalClinic, полноценная платформа для реальной стоматологической практики: ASP.NET Core, EF Core, SQL Server, JWT, SignalR, фоновые задачи, Docker, тесты и внешние AI-интеграции. Я работала с проектом целиком — от структуры данных и backend до интерфейса, тестирования и деплоя.\n\nПонимаю, что это будет мой первый официальный developer role, поэтому ищу команду, где смогу быстро расти, получать code review и работать с реальными production-задачами.{gap}\n\nGitHub: {_candidate.GitHubUrl}\nPortfolio: {_candidate.CvUrl}\n\nБуду рада пообщаться и, если нужно, выполнить тестовое задание.\n\n{_candidate.RussianName}";
    }

    private string BuildEnglishLetter(string company, string title, string roleKind, string[] emphasize, string[] missing)
    {
        var focus = HumanList(emphasize.Take(5), "C#, ASP.NET Core, EF Core and SQL Server");
        var gap = missing.Length == 0
            ? ""
            : $" I have less hands-on experience with {HumanList(missing.Take(2), "some of the additional tools in the description")}, so I would rather be transparent about that and learn them than overstate my background.";

        return $"Hi,\n\nI am {_candidate.Name}, and I came across the {title} opening at {company}. I decided to apply because the work is very close to what I have been building recently.\n\nI graduated with an honours programming diploma in Information Systems and Programming. My strongest areas are {focus}. My main project is DentalClinic, a full application for a real dental practice built with ASP.NET Core, EF Core, SQL Server, JWT, SignalR, background jobs, Docker, automated testing and external AI integrations. I worked across the project end-to-end, including the backend, data layer, UI, testing and deployment.\n\nI am still early in my professional developer career, and I am looking for a team where I can learn quickly, receive good code review and contribute to real production work from the start.{gap}\n\nGitHub: {_candidate.GitHubUrl}\nPortfolio: {_candidate.CvUrl}\n\nI would be happy to talk through my projects or complete a technical task if useful.\n\n{_candidate.Name}";
    }

    private string[] SelectEmphasis(string roleKind, string[] matched)
    {
        var preferred = roleKind switch
        {
            "qa" => new[] { "Automated Testing", "xUnit", "REST API", "SQL", "GitHub Actions", "C#" },
            "support" => new[] { "REST API", "SQL", "Git", "C#", "Docker", "English / Greek / Russian" },
            "fullstack" => new[] { "C#", "ASP.NET Core", "EF Core", "SQL Server", "TypeScript", "React", "JavaScript" },
            _ => new[] { "C#", "ASP.NET Core", "EF Core", "SQL Server", "REST API", "Docker", "Git" }
        };

        return preferred
            .Where(x => matched.Length == 0 || matched.Contains(x, StringComparer.OrdinalIgnoreCase) || x.Contains("English", StringComparison.OrdinalIgnoreCase))
            .Concat(matched)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(7)
            .ToArray();
    }

    private static string ClassifyRole(string title, string description)
    {
        var text = $"{title} {description}".ToLowerInvariant();
        if (text.Contains("qa") || text.Contains("tester") || text.Contains("testing") || text.Contains("тестиров")) return "qa";
        if (text.Contains("implementation") || text.Contains("technical support") || text.Contains("application support") || text.Contains("поддержк")) return "support";
        if (text.Contains("full-stack") || text.Contains("full stack") || text.Contains("fullstack")) return "fullstack";
        return "backend";
    }

    private static bool IsRussianMarket(string country, string source, string description)
    {
        if (country.Contains("Russia", StringComparison.OrdinalIgnoreCase) || country.Contains("Россия", StringComparison.OrdinalIgnoreCase)) return true;
        if (source.Equals("hh", StringComparison.OrdinalIgnoreCase)) return true;
        var cyrillic = Regex.Matches(description ?? "", "[А-Яа-яЁё]").Count;
        return cyrillic > 40;
    }

    private static string[] Split(string value) => string.IsNullOrWhiteSpace(value)
        ? []
        : value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

    private static string HumanList(IEnumerable<string> items, string fallback)
    {
        var array = items.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (array.Length == 0) return fallback;
        if (array.Length == 1) return array[0];
        if (array.Length == 2) return $"{array[0]} and {array[1]}";
        return $"{string.Join(", ", array[..^1])} and {array[^1]}";
    }

    private static string RussianRole(string roleKind) => roleKind switch
    {
        "qa" => "QA-инженер",
        "support" => "technical/implementation engineer",
        "fullstack" => "Full-Stack .NET разработчик",
        _ => ".NET разработчик"
    };

    private static string EnglishRole(string roleKind) => roleKind switch
    {
        "qa" => "QA engineer",
        "support" => "technical/implementation engineer",
        "fullstack" => "full-stack .NET developer",
        _ => ".NET developer"
    };
}
