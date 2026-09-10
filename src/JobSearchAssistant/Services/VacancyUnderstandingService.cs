using System.Text.RegularExpressions;

namespace JobSearchAssistant.Services;

public sealed record Requirement(string Skill, string Family, string Importance, string SourceText);
public sealed record VacancyUnderstanding(string RoleFamily, string Seniority, string CareerLane,
    Requirement[] Requirements, string[] Responsibilities, int? RequiredYears, int? PreferredYears,
    bool MandatoryDegree, string ExperienceEvidence, string Location, string WorkMode,
    string[] Languages, string WorkAuthorization, string Sponsorship, string Salary,
    string EmploymentType, string Domain, string[] RedFlags, string ReasoningMode);

public sealed class VacancyUnderstandingService
{
    public VacancyUnderstanding Understand(string title, string text, bool remote, string experience = "", string location = "")
    {
        text = (text ?? "")[..Math.Min(text?.Length ?? 0, 50000)];
        var all = title + "\n" + text;
        var segments = Regex.Split(text, @"[\r\n;]+|(?<=[.!?])\s+(?=[A-ZА-Я])").Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
        var requirements = new List<Requirement>();
        var section = "Unspecified";
        int? requiredYears = null, preferredYears = null;
        foreach (var segment in segments)
        {
            if (Has(segment, @"^(nice.to.have|preferred|будет плюсом|желательно)\s*:?")) section = "Preferred";
            else if (Has(segment, @"^(requirements|must.have|required|требования|обязательно)\s*:?")) section = "Required";
            else if (Has(segment, @"^(responsibilities|benefits|обязанности|условия)\s*:?")) section = "Unspecified";
            var importance = Has(segment, @"preferred|nice.to.have|желател|будет плюсом|приветств") ? "Preferred"
                : Has(segment, @"required|must.have|mandatory|обязател|требуется") ? "Required" : section;
            foreach (var skill in SkillCatalog.Extract(segment))
                requirements.Add(new(skill, SkillCatalog.Family(skill), importance, segment.Trim()[..Math.Min(segment.Trim().Length, 600)]));
            var years = Regex.Match(segment, @"\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\+?\s*(?:years?|лет|года?|год)\b", RegexOptions.IgnoreCase);
            if (years.Success && Has(segment, @"experience|опыт|required|preferred|обязател|желател"))
            {
                var n = int.Parse(years.Groups[1].Value);
                if (importance == "Preferred") preferredYears = Math.Max(preferredYears ?? 0, n);
                else requiredYears = Math.Max(requiredYears ?? 0, n);
            }
        }
        // Title terms describe the role, not independently weighted requirements.
        if (requirements.Count == 0)
            requirements.AddRange(SkillCatalog.Extract(title).Select(s => new Requirement(s, SkillCatalog.Family(s), "Unspecified", title)));
        var unique = requirements.GroupBy(r => r.Skill).Select(g => g.OrderBy(r => r.Importance == "Required" ? 0 : r.Importance == "Unspecified" ? 1 : 2).First()).ToArray();
        var senior = !AutomaticSubmissionPolicy.HasSafeSeniority(title) || experience == "moreThan6" ? "Senior"
            : AutomaticSubmissionPolicy.IsEntryLevelTitle(title) ? "Junior" : "Unknown";
        var role = Has(title, @"\bQA\b|тестиров|quality|automation") ? "QA automation"
            : Has(title, @"implementation|внедрен") ? "Implementation"
            : Has(title, @"support|поддерж") ? "Technical support"
            : Has(title, @"developer|engineer|разработ|программист") || Has(title, @"стаж|intern") && Has(all, @"C#|\.NET|React|TypeScript|JavaScript|PHP|WPF") ? "Software engineering" : "Other";
        var technical = unique.Any(r => r.Skill is "C#" or "SQL" or "SQL Server" or "REST" or "Testing");
        var lane = role == "Software engineering" ? "primary"
            : role is "QA automation" or "Implementation" && technical ? "secondary"
            : role == "Technical support" && unique.Any(r => r.Skill is "SQL" or "SQL Server" or "REST" or "C#") ? "experimental" : "excluded";
        var degree = Has(all, @"(?:bachelor(?:'s)?|university) degree.{0,30}(?:required|mandatory)|must have (?:a )?bachelor|высшее образование.{0,24}(?:обязательно|требуется)")
            && !Has(all, @"degree.{0,20}(?:or|или).{0,24}(?:equivalent|опыт)");
        if (Has(all, @"(?:requirements|must.have|требования)[\s\S]{0,500}(?:bachelor|university degree|высшее образование)")
            && !Has(all, @"degree.{0,30}(?:preferred|equivalent|optional)|образование.{0,20}(?:желател|не обязател)")) degree = true;
        return new(role, senior, lane, unique, segments.Where(s => Has(s, @"build|develop|implement|разраб|поддерж|созда" )).Take(8).ToArray(),
            requiredYears, preferredYears, degree, experience, location,
            remote ? "Remote" : Has(all, @"hybrid|гибрид") ? "Hybrid" : "Onsite",
            new[] { "English", "Russian", "Greek", "German", "Polish", "French", "Spanish" }.Where(l => Has(all, l)).ToArray(),
            "Requires location/authorization review", Has(all, @"no sponsorship|cannot sponsor") ? "Unavailable" : Has(all, @"visa sponsorship") ? "Mentioned; verify" : "Unknown",
            "Unknown", "Unknown", "Unknown",
            (senior == "Senior" ? new[] { "Senior role" } : Array.Empty<string>()).Concat(degree ? new[] { "Mandatory degree not evidenced" } : []).ToArray(),
            "deterministic-fallback");
    }
    internal static bool Has(string text, string pattern) => Regex.IsMatch(text ?? "", pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
}
