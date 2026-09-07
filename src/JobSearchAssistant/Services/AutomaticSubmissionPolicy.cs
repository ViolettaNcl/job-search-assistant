using System.Text.RegularExpressions;
using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public static partial class AutomaticSubmissionPolicy
{
    public static bool HasSafeSeniority(string title)
        => !SeniorTitle().IsMatch(title ?? "");

    public static bool IsVerifiedEligible(Vacancy vacancy)
        => vacancy.EligibilityStatus.Equals("Eligible", StringComparison.OrdinalIgnoreCase);

    public static bool CanSubmit(Vacancy vacancy, int minimumScore)
        => vacancy.Source.Equals("hh", StringComparison.OrdinalIgnoreCase)
           && vacancy.Status == VacancyStatus.New
           && vacancy.Application is null
           && !vacancy.HasExistingHhResponse
           && vacancy.Company is not null
           && !vacancy.Company.IsBlacklisted
           && vacancy.MatchScore >= minimumScore
           && IsVerifiedEligible(vacancy)
           && HasSafeSeniority(vacancy.Title);

    [GeneratedRegex(@"\b(senior|lead|principal|staff|architect|head)\b|ведущ|руководител|главн(?:ый|ая)|архитектор", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex SeniorTitle();
}
