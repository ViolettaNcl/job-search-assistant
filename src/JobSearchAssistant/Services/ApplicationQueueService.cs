using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record ApplicationQueueItem(
    Guid VacancyId,
    string Title,
    string Company,
    string Url,
    string Source,
    string Country,
    string Location,
    int MatchScore,
    int PriorityScore,
    string Priority,
    string EligibilityStatus,
    string EligibilityReason,
    string MatchLevel,
    string MatchedSkills,
    string MissingSkills,
    string RecommendedCv,
    string RecommendedHeadline,
    string ShortMessage,
    DateTimeOffset? PublishedAt,
    DateTimeOffset FirstSeenAt);

public sealed class ApplicationQueueService(AppDbContext db, ApplicationDraftService drafts)
{
    public async Task<IReadOnlyList<ApplicationQueueItem>> GetAsync(int limit, int minimumScore, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 50);
        minimumScore = Math.Clamp(minimumScore, 50, 100);

        var rows = await db.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Where(x => x.Status == VacancyStatus.New &&
                        !x.Company.IsBlacklisted &&
                        x.MatchScore >= minimumScore &&
                        x.EligibilityStatus != "Likely ineligible")
            .OrderByDescending(x => x.MatchScore)
            .ThenByDescending(x => x.PublishedAt ?? x.FirstSeenAt)
            .Take(200)
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        return rows
            .Select(v =>
            {
                var priorityScore = CalculatePriorityScore(v, now);
                var draft = drafts.Build(v);
                return new ApplicationQueueItem(
                    v.Id,
                    v.Title,
                    v.Company.Name,
                    v.Url,
                    v.SourceLabel,
                    v.Country,
                    v.LocationText,
                    v.MatchScore,
                    priorityScore,
                    PriorityLabel(priorityScore, v.MatchScore),
                    v.EligibilityStatus,
                    v.EligibilityReason,
                    v.MatchLevel,
                    v.MatchedSkills,
                    v.MissingSkills,
                    draft.RecommendedCv,
                    draft.RecommendedHeadline,
                    draft.ShortMessage,
                    v.PublishedAt,
                    v.FirstSeenAt);
            })
            .OrderByDescending(x => x.PriorityScore)
            .ThenByDescending(x => x.MatchScore)
            .Take(limit)
            .ToArray();
    }

    internal static int CalculatePriorityScore(Vacancy vacancy, DateTimeOffset now)
    {
        var score = vacancy.MatchScore;
        var date = vacancy.PublishedAt ?? vacancy.FirstSeenAt;
        var age = now - date;

        if (age <= TimeSpan.FromDays(1)) score += 10;
        else if (age <= TimeSpan.FromDays(3)) score += 7;
        else if (age <= TimeSpan.FromDays(7)) score += 4;
        else if (age > TimeSpan.FromDays(30)) score -= 5;

        if (vacancy.EligibilityStatus.Equals("Eligible", StringComparison.OrdinalIgnoreCase)) score += 6;
        if (vacancy.Company?.IsWatched == true) score += 4;
        if (vacancy.MatchScore >= 90) score += 3;

        return Math.Clamp(score, 0, 120);
    }

    private static string PriorityLabel(int priorityScore, int matchScore)
    {
        if (priorityScore >= 100 || matchScore >= 92) return "Apply now";
        if (priorityScore >= 88 || matchScore >= 85) return "Today";
        if (matchScore >= 75) return "Apply";
        return "Review";
    }
}
