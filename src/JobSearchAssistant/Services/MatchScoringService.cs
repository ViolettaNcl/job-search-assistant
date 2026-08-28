using System.Text.RegularExpressions;
using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record MatchResult(int Score, string Level, string[] Matched, string[] Missing, string Why, string EligibilityStatus, string EligibilityReason);

public sealed class MatchScoringService(IOptions<CandidateProfileOptions> candidate)
{
    private readonly CandidateProfileOptions _candidate = candidate.Value;

    private static readonly Dictionary<string, int> Positive = new(StringComparer.OrdinalIgnoreCase)
    {
        ["C#"] = 15,
        [".NET"] = 15,
        ["ASP.NET Core"] = 15,
        ["Entity Framework Core"] = 10,
        ["EF Core"] = 10,
        ["SQL Server"] = 10,
        ["SQL"] = 8,
        ["REST API"] = 8,
        ["REST"] = 6,
        ["LINQ"] = 5,
        ["Docker"] = 5,
        ["Git"] = 4,
        ["Unit Testing"] = 5,
        ["MSTest"] = 4,
        ["JavaScript"] = 4,
        ["SignalR"] = 3,
        ["JWT"] = 3
    };

    private static readonly string[] CandidateSkills =
    [
        "C#", ".NET", "ASP.NET Core", "Entity Framework Core", "EF Core", "SQL Server", "SQL",
        "REST API", "REST", "LINQ", "Docker", "Git", "Unit Testing", "MSTest", "JavaScript",
        "SignalR", "JWT", "WPF", "XAML", "GitHub Actions"
    ];

    private static readonly string[] GapSkills =
    ["RabbitMQ", "Kafka", "Kubernetes", "Redis", "Azure", "AWS", "gRPC", "Elasticsearch"];

    public MatchResult Score(string title, string text, bool remote, string experience, string location = "", string remoteScope = "")
    {
        var haystack = $"{title}\n{text}\n{location}\n{remoteScope}";
        var matched = new List<string>();
        var missing = new List<string>();
        var score = 0;

        foreach (var (skill, weight) in Positive)
        {
            if (Contains(haystack, skill))
            {
                score += weight;
                if (!matched.Contains(skill, StringComparer.OrdinalIgnoreCase)) matched.Add(skill);
            }
        }

        foreach (var gap in GapSkills)
        {
            if (Contains(haystack, gap) && !CandidateSkills.Contains(gap, StringComparer.OrdinalIgnoreCase))
            {
                missing.Add(gap);
                score -= 3;
            }
        }

        var lowerTitle = title.ToLowerInvariant();
        if (lowerTitle.Contains("junior") || lowerTitle.Contains("entry level") || lowerTitle.Contains("entry-level") || lowerTitle.Contains("graduate") || lowerTitle.Contains("младш"))
            score += 10;
        if (lowerTitle.Contains("intern") || lowerTitle.Contains("trainee") || lowerTitle.Contains("стажер") || lowerTitle.Contains("стажёр") || lowerTitle.Contains("стажиров"))
            score += 14;
        if (lowerTitle.Contains("contractor") || lowerTitle.Contains("b2b") || lowerTitle.Contains("freelance") || lowerTitle.Contains("фриланс"))
            score += 4;
        if (remote) score += 7;
        else score -= 100;
        if (experience.Contains("noExperience", StringComparison.OrdinalIgnoreCase)) score += 8;
        if (experience.Contains("between1And3", StringComparison.OrdinalIgnoreCase)) score += 3;

        if (lowerTitle.Contains("senior") || lowerTitle.Contains("staff") || lowerTitle.Contains("principal") || lowerTitle.Contains("ведущ")) score -= 65;
        if (lowerTitle.Contains("lead") || lowerTitle.Contains("teamlead") || lowerTitle.Contains("architect")) score -= 100;
        if (Regex.IsMatch(haystack, @"\b([5-9]|1\d)\+?\s*(лет|years?)\b", RegexOptions.IgnoreCase)) score -= 50;

        var eligibility = EvaluateEligibility(haystack, remote, location, remoteScope);
        score += eligibility.Status switch
        {
            "Eligible" => 8,
            "Likely ineligible" => -35,
            _ => 0
        };

        score = Math.Clamp(score, 0, 100);
        var level = score >= 85 ? "Strong Match" : score >= 65 ? "Apply" : score >= 50 ? "Stretch" : "Skip";
        var why = matched.Count == 0
            ? "Мало прямых совпадений с основным C#/.NET стеком."
            : $"Совпадают: {string.Join(", ", matched.Take(7))}." +
              (missing.Count > 0 ? $" Дополнительно требуют: {string.Join(", ", missing)}." : "");

        return new MatchResult(score, level, matched.Distinct(StringComparer.OrdinalIgnoreCase).ToArray(), missing.ToArray(), why, eligibility.Status, eligibility.Reason);
    }

    private (string Status, string Reason) EvaluateEligibility(string text, bool remote, string location, string remoteScope)
    {
        var l = $"{text} {location} {remoteScope}".ToLowerInvariant();
        var worldwide = l.Contains("worldwide") || l.Contains("anywhere") || l.Contains("global remote") || l.Contains("work from anywhere");
        var contractor = l.Contains("international contractor") || l.Contains("independent contractor") || l.Contains("contractor worldwide") || l.Contains("b2b") || l.Contains("freelance");
        var russia = l.Contains("russia") || l.Contains("росси");
        var emea = l.Contains("emea") || l.Contains("europe") || l.Contains("european time") || l.Contains("utc+") || l.Contains("utc-");
        var sponsorship = l.Contains("visa sponsorship") || l.Contains("sponsor visa") || l.Contains("relocation support") || l.Contains("relocation package");
        var noSponsorship = l.Contains("no sponsorship") || l.Contains("cannot sponsor") || l.Contains("unable to sponsor") || l.Contains("without sponsorship");
        var usOnly = l.Contains("us only") || l.Contains("u.s. only") || l.Contains("must be based in the us") || l.Contains("must be located in the united states") || l.Contains("authorized to work in the united states") || l.Contains("us work authorization");
        var ukOnly = l.Contains("uk only") || l.Contains("must be based in the uk") || l.Contains("right to work in the uk");
        var euOnly = l.Contains("eu only") || l.Contains("european union only") || l.Contains("must be based in the eu");

        if (!remote) return ("Likely ineligible", "Система настроена только на удалённую работу (Remote Only).");
        if (russia && _candidate.CurrentCountry.Equals("Russia", StringComparison.OrdinalIgnoreCase)) return ("Eligible", "Удалённая вакансия для РФ.");
        if (worldwide) return ("Eligible", "Remote worldwide / anywhere — хороший международный вариант.");
        if (contractor) return ("Eligible", "Есть признаки international contractor / B2B / freelance формата.");
        if (sponsorship && _candidate.OpenToRelocationWithVisaSponsorship) return ("Eligible", "Упомянуты visa sponsorship или relocation support.");
        if ((usOnly || ukOnly || euOnly) && !sponsorship) return ("Likely ineligible", "Вакансия ограничена локальным правом на работу/локацией; проверьте условия перед откликом.");
        if (noSponsorship && !worldwide && !_candidate.CurrentCountry.Equals(location, StringComparison.OrdinalIgnoreCase)) return ("Likely ineligible", "Работодатель явно не предоставляет sponsorship, а роль не обозначена как worldwide.");
        if (remote && (emea || string.IsNullOrWhiteSpace(remoteScope))) return ("Verify", "Remote-вакансия: нужно проверить список стран, из которых компания может нанимать.");
        if (remote) return ("Verify", "Удалённая роль, но географические ограничения найма нужно проверить.");
        return ("Likely ineligible", "Система настроена только на Remote Only.");
    }

    private static bool Contains(string text, string token)
    {
        if (token is ".NET" or "C#") return text.Contains(token, StringComparison.OrdinalIgnoreCase);
        return Regex.IsMatch(text, $@"(?<![\w]){Regex.Escape(token)}(?![\w])", RegexOptions.IgnoreCase);
    }
}
