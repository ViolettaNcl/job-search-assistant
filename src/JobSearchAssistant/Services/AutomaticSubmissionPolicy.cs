using System.Text.RegularExpressions;
using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public static partial class AutomaticSubmissionPolicy
{
    public static bool HasSafeSeniority(string title)
        => !SeniorTitle().IsMatch(title ?? "");

    public static bool IsEntryLevelTitle(string title)
        => EntryLevelTitle().IsMatch(title ?? "");

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

    public static IReadOnlyList<Vacancy> SelectCandidates(
        IEnumerable<Vacancy> vacancies,
        int minimumScore,
        int limit,
        DateTimeOffset now,
        DateTimeOffset retryAfter,
        IReadOnlyCollection<Vacancy>? history = null)
        => vacancies
            .Where(v => CanSubmit(v, minimumScore))
            .Where(v => !v.Events.Any(e => e.Type == "AutoApplyFailed" && e.CreatedAt >= retryAfter))
            .OrderByDescending(v => ApplicationQueueService.CalculatePriorityScore(v, now) + RecruitmentLearning.CalculateBoost(v, history ?? Array.Empty<Vacancy>()))
            .ThenByDescending(v => v.MatchScore)
            .ThenByDescending(v => v.PublishedAt ?? v.FirstSeenAt)
            .ThenBy(v => v.Id)
            .Take(Math.Max(0, limit))
            .ToArray();

    [GeneratedRegex(@"\b(senior|lead|principal|staff|architect|head)\b|ведущ|руководител|главн(?:ый|ая)|архитектор", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex SeniorTitle();

    [GeneratedRegex(@"\b(junior|entry[ -]?level|graduate|intern|trainee|associate)\b|младш|начинающ|стаж[её]р|стажиров", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex EntryLevelTitle();
}
