using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record OutcomeSegment(
    string Key,
    string Label,
    int Applications,
    int Responses,
    int Interviews,
    int Offers,
    int Rejections,
    double ResponseRate,
    double InterviewRate,
    double OfferRate);

public sealed record OutcomeAnalyticsResult(
    OutcomeSegment Overall,
    IReadOnlyList<OutcomeSegment> BySource,
    IReadOnlyList<OutcomeSegment> ByMarket,
    IReadOnlyList<OutcomeSegment> ByRoleType,
    IReadOnlyList<OutcomeSegment> ByScoreBand,
    IReadOnlyList<OutcomeSegment> ByCvVariant,
    int AttributedCvApplications,
    int TotalApplications);

public sealed class OutcomeAnalyticsService(AppDbContext db)
{
    public async Task<OutcomeAnalyticsResult> GetAsync(CancellationToken ct)
    {
        var rows = await db.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.Application)
            .Where(x => x.Application != null)
            .ToListAsync(ct);

        var overall = Segment("all", "All applications", rows);
        var bySource = Group(rows, v => string.IsNullOrWhiteSpace(v.SourceLabel) ? v.Source : v.SourceLabel);
        var byMarket = Group(rows, VacancyClassifier.Market, VacancyClassifier.MarketLabel);
        var byRoleType = Group(rows, VacancyClassifier.OpportunityType, VacancyClassifier.TypeLabel);
        var byScoreBand = Group(rows, ScoreBand, ScoreBandLabel);
        var byCv = Group(rows, CvKey, CvLabel);
        var attributed = rows.Count(v => IsAttributedCv(v.Application?.ResumeExternalId));

        return new OutcomeAnalyticsResult(
            overall,
            bySource,
            byMarket,
            byRoleType,
            byScoreBand,
            byCv,
            attributed,
            rows.Count);
    }

    private static IReadOnlyList<OutcomeSegment> Group(
        IEnumerable<Vacancy> rows,
        Func<Vacancy, string> keySelector,
        Func<string, string>? labelSelector = null)
    {
        return rows
            .GroupBy(keySelector)
            .Select(g => Segment(g.Key, labelSelector?.Invoke(g.Key) ?? g.Key, g))
            .OrderByDescending(x => x.Applications)
            .ThenByDescending(x => x.ResponseRate)
            .ThenBy(x => x.Label)
            .ToList();
    }

    public static OutcomeSegment Segment(string key, string label, IEnumerable<Vacancy> rows)
    {
        var list = rows.ToList();
        var applications = list.Count;
        var responses = list.Count(v => HasResponse(v.Status));
        var interviews = list.Count(v => HasInterview(v.Status));
        var offers = list.Count(v => v.Status == VacancyStatus.Offer);
        var rejections = list.Count(v => v.Status == VacancyStatus.Rejected);

        return new OutcomeSegment(
            key,
            label,
            applications,
            responses,
            interviews,
            offers,
            rejections,
            Rate(responses, applications),
            Rate(interviews, applications),
            Rate(offers, applications));
    }

    public static bool HasResponse(VacancyStatus status)
        => status is VacancyStatus.HrContact
            or VacancyStatus.HrInterview
            or VacancyStatus.TechInterview
            or VacancyStatus.TestTask
            or VacancyStatus.Rejected
            or VacancyStatus.Offer;

    public static bool HasInterview(VacancyStatus status)
        => status is VacancyStatus.HrInterview
            or VacancyStatus.TechInterview
            or VacancyStatus.TestTask
            or VacancyStatus.Offer;

    public static string ScoreBand(Vacancy vacancy)
        => vacancy.MatchScore switch
        {
            >= 90 => "90-100",
            >= 85 => "85-89",
            >= 75 => "75-84",
            >= 65 => "65-74",
            _ => "<65"
        };

    private static string ScoreBandLabel(string key)
        => key switch
        {
            "90-100" => "90–100 · highest fit",
            "85-89" => "85–89 · strong fit",
            "75-84" => "75–84 · apply",
            "65-74" => "65–74 · review",
            _ => "Below 65"
        };

    public static string CvKey(Vacancy vacancy)
    {
        var resume = vacancy.Application?.ResumeExternalId?.Trim() ?? "";
        if (resume.StartsWith("external/", StringComparison.OrdinalIgnoreCase))
        {
            var value = resume["external/".Length..].Trim();
            return string.IsNullOrWhiteSpace(value) || value.Equals("manual", StringComparison.OrdinalIgnoreCase)
                ? "external:unknown"
                : $"external:{value}";
        }
        if (vacancy.Source.Equals("hh", StringComparison.OrdinalIgnoreCase)) return "hh";
        return "unknown";
    }

    private static string CvLabel(string key)
    {
        if (key == "hh") return "HH selected resume";
        if (key is "unknown" or "external:unknown") return "CV not recorded";
        if (key.StartsWith("external:", StringComparison.OrdinalIgnoreCase)) return key["external:".Length..];
        return key;
    }

    private static bool IsAttributedCv(string? resumeExternalId)
        => !string.IsNullOrWhiteSpace(resumeExternalId)
           && resumeExternalId.StartsWith("external/", StringComparison.OrdinalIgnoreCase)
           && !resumeExternalId.Equals("external/manual", StringComparison.OrdinalIgnoreCase);

    private static double Rate(int numerator, int denominator)
        => denominator == 0 ? 0 : Math.Round(numerator * 100.0 / denominator, 1);
}
