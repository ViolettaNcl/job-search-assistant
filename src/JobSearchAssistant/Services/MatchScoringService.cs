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
        ["Automated Testing"] = 5,
        ["MSTest"] = 4,
        ["xUnit"] = 4,
        ["JavaScript"] = 4,
        ["TypeScript"] = 4,
        ["React"] = 4,
        ["SignalR"] = 3,
        ["JWT"] = 3
    };

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
            if (Contains(haystack, gap) && !_candidate.CoreSkills.Contains(gap, StringComparer.OrdinalIgnoreCase))
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
        if (lowerTitle.Contains("associate software") || lowerTitle.Contains("начинающ")) score += 8;
        if (lowerTitle.Contains("qa") || lowerTitle.Contains("tester") || lowerTitle.Contains("тестиров")) score += 4;
        if (lowerTitle.Contains("implementation") || lowerTitle.Contains("application support") || lowerTitle.Contains("technical support")) score += 3;
        if (lowerTitle.Contains("contractor") || lowerTitle.Contains("b2b") || lowerTitle.Contains("freelance") || lowerTitle.Contains("фриланс"))
            score += 4;
        if (remote) score += 7;
        else score -= 20;
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
            ? "Few direct matches with Violetta's current technical stack."
            : $"Matched: {string.Join(", ", matched.Take(7))}." +
              (missing.Count > 0 ? $" Gaps to verify: {string.Join(", ", missing)}." : "");

        return new MatchResult(score, level, matched.Distinct(StringComparer.OrdinalIgnoreCase).ToArray(), missing.ToArray(), why, eligibility.Status, eligibility.Reason);
    }

    private (string Status, string Reason) EvaluateEligibility(string text, bool remote, string location, string remoteScope)
    {
        var l = $"{text} {location} {remoteScope}".ToLowerInvariant();
        var worldwide = l.Contains("worldwide") || l.Contains("anywhere") || l.Contains("global remote") || l.Contains("work from anywhere");
        var contractor = l.Contains("international contractor") || l.Contains("independent contractor") || l.Contains("contractor worldwide") || l.Contains("b2b") || l.Contains("freelance");
        var russia = l.Contains("russia") || l.Contains("росси");
        var eu = l.Contains("eu only") || l.Contains("european union") || l.Contains("eu citizen") || l.Contains("right to work in the eu") || l.Contains("must be based in the eu");
        var europe = eu || l.Contains("emea") || l.Contains("europe") || l.Contains("european time") || l.Contains("cyprus") || l.Contains("greece") || l.Contains("poland") || l.Contains("czech") || l.Contains("romania") || l.Contains("bulgaria") || l.Contains("portugal") || l.Contains("spain") || l.Contains("germany") || l.Contains("netherlands") || l.Contains("ireland") || l.Contains("malta") || l.Contains("estonia") || l.Contains("latvia") || l.Contains("lithuania");
        var sponsorship = l.Contains("visa sponsorship") || l.Contains("sponsor visa") || l.Contains("relocation support") || l.Contains("relocation package");
        var noSponsorship = l.Contains("no sponsorship") || l.Contains("cannot sponsor") || l.Contains("unable to sponsor") || l.Contains("without sponsorship");
        var usOnly = l.Contains("us only") || l.Contains("u.s. only") || l.Contains("must be based in the us") || l.Contains("must be located in the united states") || l.Contains("authorized to work in the united states") || l.Contains("us work authorization");
        var ukOnly = l.Contains("uk only") || l.Contains("must be based in the uk") || l.Contains("right to work in the uk");

        if (russia && _candidate.RussiaWorkAuthorized)
            return ("Eligible", "Russian citizen / work-authorized for Russia.");
        if (eu && _candidate.EuWorkAuthorized)
            return ("Eligible", "EU/Cyprus work authorization matches this role.");
        if (europe && _candidate.EuWorkAuthorized && !usOnly && !ukOnly)
            return ("Eligible", "European role; Violetta has EU work authorization. Confirm any country-residency/payroll restriction.");
        if (worldwide) return ("Eligible", "Remote worldwide / anywhere.");
        if (contractor) return ("Eligible", "International contractor / B2B / freelance format detected.");
        if (sponsorship && _candidate.OpenToRelocationWithVisaSponsorship) return ("Eligible", "Visa sponsorship or relocation support is mentioned.");
        if (usOnly || ukOnly) return ("Likely ineligible", "Role appears restricted to US/UK work authorization or location.");
        if (noSponsorship && !worldwide && !russia && !europe)
            return ("Likely ineligible", "Employer does not sponsor and the vacancy is not clearly within Violetta's work-authorized markets.");
        if (remote) return ("Verify", "Remote role; verify the exact countries from which the employer can hire/payroll.");
        return ("Verify", "On-site/hybrid role; work authorization is likely fine in Russia/EU, but relocation and office location must be checked.");
    }

    private static bool Contains(string text, string token)
    {
        if (token is ".NET" or "C#") return text.Contains(token, StringComparison.OrdinalIgnoreCase);
        return Regex.IsMatch(text, $@"(?<![\w]){Regex.Escape(token)}(?![\w])", RegexOptions.IgnoreCase);
    }
}
