using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public static class VacancyReadQueries
{
    // SQLite cannot translate DateTimeOffset ordering or range comparisons.
    // Keep ordinary predicates in SQL, then compare actual instants in memory.
    // Apply limits last so older matching jobs and equal-score ties are not lost.
    public static async Task<List<Vacancy>> RankedAsync(this IQueryable<Vacancy> query,
        int limit, CancellationToken ct, DateTimeOffset? firstSeenSince = null,
        Func<Vacancy, bool>? filter = null)
    {
        var rows = await query.ToListAsync(ct);
        return rows.Where(x => !firstSeenSince.HasValue || x.FirstSeenAt >= firstSeenSince.Value)
            .Where(x => filter is null || filter(x))
            .OrderByDescending(x => x.MatchScore)
            .ThenByDescending(x => x.PublishedAt)
            .ThenBy(x => x.Id)
            .Take(limit).ToList();
    }

    public static async Task<List<Vacancy>> RecentAsync(this IQueryable<Vacancy> query,
        int limit, CancellationToken ct, Func<Vacancy, bool>? filter = null)
    {
        var rows = await query.ToListAsync(ct);
        return rows.Where(x => filter is null || filter(x))
            .OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id)
            .Take(limit).ToList();
    }

    public static async Task<int> CountAppliedSinceAsync(this IQueryable<Application> query,
        DateTimeOffset since, CancellationToken ct)
    {
        var dates = await query.Select(x => x.AppliedAt).ToListAsync(ct);
        return dates.Count(x => x >= since);
    }
}
