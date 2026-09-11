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
    int LearningBoost,
    string PriorityReason,
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

public sealed class ApplicationQueueService(AppDbContext db, ApplicationDraftService drafts, MatchScoringService? scoring = null)
{
    public async Task<IReadOnlyList<ApplicationQueueItem>> GetAsync(int limit, int minimumScore, CancellationToken ct)
        => await GetAsync(limit, minimumScore, null, ct);

    public async Task<IReadOnlyList<ApplicationQueueItem>> GetAsync(int limit, int minimumScore, string? source, CancellationToken ct)
        => await GetAsync(limit, minimumScore, source, false, ct);

    public async Task<IReadOnlyList<ApplicationQueueItem>> GetAsync(int limit, int minimumScore, string? source, bool automaticOnly, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 50);
        minimumScore = Math.Clamp(minimumScore, 50, 100);

        // Keep the database query provider-neutral. SQLite cannot reliably ORDER BY
        // DateTimeOffset values. Freshness is already part of the final in-memory
        // priority calculation below, so ordering by score here is sufficient.
        var rows = await db.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.Events)
            .Where(x => (x.Status == VacancyStatus.New || x.Status == VacancyStatus.Saved) &&
                        !x.Company.IsBlacklisted &&
                        x.Application == null &&
                        !x.HasExistingHhResponse &&
                        (scoring != null || x.MatchScore >= minimumScore) &&
                        (string.IsNullOrWhiteSpace(source) || x.Source == source))
            .OrderByDescending(x => x.MatchScore)
            .ToListAsync(ct);
        var history = await db.Vacancies
            .AsNoTracking()
            .Where(x => x.Application != null)
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var recommended = new HashSet<Guid>();
        if (scoring is not null)
        {
            foreach (var v in rows)
            {
                var match = scoring.Score(v.Title, v.DescriptionText, v.IsRemote, v.Experience, v.LocationText, v.RemoteScope, minimumScore);
                if (match.Assessment?.Decision == "APPLY") recommended.Add(v.Id);
                v.MatchScore = match.Score;
                v.WhyMatch = match.Why;
                v.MatchLevel = match.Level;
                v.EligibilityStatus = match.Assessment?.Decision == "APPLY" ? match.EligibilityStatus
                    : match.EligibilityStatus == "Likely ineligible" ? "Likely ineligible" : "Verify";
                v.EligibilityReason = match.Why;
                v.MatchedSkills = string.Join(", ", match.Matched);
                v.MissingSkills = string.Join(", ", match.Missing);
            }
        }
        return rows
            .Where(v => v.MatchScore >= minimumScore)
            // Filter before Take: review-only jobs must not crowd out safe auto-applications.
            .Where(v => !automaticOnly || (v.Source == "hh" && RemoteWorkPolicy.IsFullyRemote(v.IsRemote, v.DescriptionText) && (scoring == null || recommended.Contains(v.Id)) && AutomaticSubmissionPolicy.HasSafeSeniority(v.Title)))
            .Where(v => QueueDeferralPolicy.ShouldAppearInQueue(v, now))
            .Select(v =>
            {
                var learningBoost = RecruitmentLearning.CalculateBoost(v, history);
                var priorityScore = Math.Clamp(CalculatePriorityScore(v, now) + learningBoost, 0, 130);
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
                    learningBoost,
                    RecruitmentLearning.ExplainBoost(learningBoost),
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

        if (age <= TimeSpan.FromHours(12)) score += 12;
        else if (age <= TimeSpan.FromDays(1)) score += 10;
        else if (age <= TimeSpan.FromDays(3)) score += 7;
        else if (age <= TimeSpan.FromDays(7)) score += 4;
        else if (age > TimeSpan.FromDays(30)) score -= 10;
        else if (age > TimeSpan.FromDays(14)) score -= 4;

        if (vacancy.EligibilityStatus.Equals("Eligible", StringComparison.OrdinalIgnoreCase)) score += 6;
        if (vacancy.Company?.IsWatched == true) score += 4;
        if (vacancy.MatchScore >= 90) score += 3;
        if (VacancyClassifier.OpportunityType(vacancy) == VacancyClassifier.TypeInternship) score += 5;
        if (AutomaticSubmissionPolicy.IsEntryLevelTitle(vacancy.Title)) score += 3;
        if (vacancy.Experience.Contains("noExperience", StringComparison.OrdinalIgnoreCase)) score += 4;

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
