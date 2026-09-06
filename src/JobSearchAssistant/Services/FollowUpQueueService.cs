using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record FollowUpQueueItem(
    Guid VacancyId,
    string Title,
    string Company,
    string Url,
    string Source,
    string Market,
    int MatchScore,
    DateTimeOffset AppliedAt,
    DateTimeOffset WaitingSince,
    int BusinessDaysWaiting,
    int FollowUpCount,
    int PriorityScore,
    string Language,
    string RecommendedChannel,
    string Message);

public sealed class FollowUpQueueService(AppDbContext db)
{
    public async Task<IReadOnlyList<FollowUpQueueItem>> GetAsync(
        int afterBusinessDays,
        int limit,
        int maxAttempts,
        CancellationToken ct,
        DateTimeOffset? nowOverride = null)
    {
        var now = nowOverride ?? DateTimeOffset.UtcNow;
        afterBusinessDays = Math.Clamp(afterBusinessDays, 2, 15);
        limit = Math.Clamp(limit, 1, 100);
        maxAttempts = Math.Clamp(maxAttempts, 1, 4);

        var rows = await db.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.Application)
            .Include(x => x.Events)
            .Where(x => x.Status == VacancyStatus.Applied && x.Application != null && !x.Company.IsBlacklisted)
            .ToListAsync(ct);

        return rows
            .Select(v => BuildItem(v, now, afterBusinessDays, maxAttempts))
            .Where(x => x is not null)
            .Cast<FollowUpQueueItem>()
            .OrderByDescending(x => x.PriorityScore)
            .ThenByDescending(x => x.BusinessDaysWaiting)
            .Take(limit)
            .ToList();
    }

    public async Task<bool> MarkSentAsync(Guid vacancyId, string? note, CancellationToken ct)
    {
        var vacancy = await db.Vacancies
            .Include(x => x.Application)
            .SingleOrDefaultAsync(x => x.Id == vacancyId, ct);

        if (vacancy is null || vacancy.Application is null || vacancy.Status != VacancyStatus.Applied)
            return false;

        db.ApplicationEvents.Add(new ApplicationEvent
        {
            VacancyId = vacancy.Id,
            Type = "FollowUpSent",
            Note = string.IsNullOrWhiteSpace(note) ? "Follow-up sent" : note.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        vacancy.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }

    private static FollowUpQueueItem? BuildItem(Vacancy vacancy, DateTimeOffset now, int afterBusinessDays, int maxAttempts)
    {
        if (vacancy.Application is null) return null;

        var followUps = vacancy.Events
            .Where(x => x.Type.Equals("FollowUpSent", StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x.CreatedAt)
            .ToList();

        if (followUps.Count >= maxAttempts) return null;

        var waitingSince = followUps.Count == 0 ? vacancy.Application.AppliedAt : followUps[^1].CreatedAt;
        var businessDays = BusinessDaysBetween(waitingSince, now);
        if (businessDays < afterBusinessDays) return null;

        var market = VacancyClassifier.Market(vacancy);
        var russian = market == VacancyClassifier.MarketRussia || vacancy.Source.Equals("hh", StringComparison.OrdinalIgnoreCase);
        var priority = vacancy.MatchScore
            + Math.Min(businessDays, 15)
            + (vacancy.Company.IsWatched ? 5 : 0)
            - (followUps.Count * 4);

        return new FollowUpQueueItem(
            vacancy.Id,
            vacancy.Title,
            vacancy.Company.Name,
            vacancy.Url,
            vacancy.SourceLabel,
            market,
            vacancy.MatchScore,
            vacancy.Application.AppliedAt,
            waitingSince,
            businessDays,
            followUps.Count,
            priority,
            russian ? "ru" : "en",
            russian ? "HH / recruiter contact" : "Recruiter email / ATS contact",
            BuildMessage(vacancy, followUps.Count, russian));
    }

    internal static int BusinessDaysBetween(DateTimeOffset start, DateTimeOffset end)
    {
        if (end <= start) return 0;
        var cursor = start.Date.AddDays(1);
        var last = end.Date;
        var count = 0;
        while (cursor <= last)
        {
            if (cursor.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday) count++;
            cursor = cursor.AddDays(1);
        }
        return count;
    }

    private static string BuildMessage(Vacancy vacancy, int priorFollowUps, bool russian)
    {
        if (russian)
        {
            return priorFollowUps == 0
                ? $"Здравствуйте! Хотела уточнить статус моей заявки на позицию «{vacancy.Title}» в {vacancy.Company.Name}. Я по-прежнему заинтересована в этой возможности и буду рада предоставить дополнительную информацию, если потребуется. Подскажите, пожалуйста, есть ли обновления по процессу?\n\nС уважением,\nВиолетта Николау"
                : $"Здравствуйте! Ещё раз коротко уточняю статус моей заявки на позицию «{vacancy.Title}» в {vacancy.Company.Name}. Я всё ещё заинтересована в роли и буду благодарна за любое обновление по процессу отбора.\n\nС уважением,\nВиолетта Николау";
        }

        return priorFollowUps == 0
            ? $"Hello, I wanted to follow up on my application for the {vacancy.Title} role at {vacancy.Company.Name}. I remain very interested in the opportunity and would be glad to provide any additional information if helpful. Could you please let me know whether there is an update on the process?\n\nBest regards,\nVioletta Nicolaou"
            : $"Hello, I’m following up once more regarding my application for the {vacancy.Title} role at {vacancy.Company.Name}. I remain interested in the opportunity and would appreciate any update you can share on the hiring process.\n\nBest regards,\nVioletta Nicolaou";
    }
}
