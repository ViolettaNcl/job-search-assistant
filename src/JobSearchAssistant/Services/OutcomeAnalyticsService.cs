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
    double OfferRate)
{
    public int PositiveResponses { get; init; }
    public double PositiveResponseRate { get; init; }
    public int Waiting { get; init; }
    public int RecentWaiting { get; init; }
    public int Withdrawn { get; init; }
    public int Closed { get; init; }
}

public sealed record OutcomeAnalyticsResult(
    OutcomeSegment Overall,
    IReadOnlyList<OutcomeSegment> BySource,
    IReadOnlyList<OutcomeSegment> ByMarket,
    IReadOnlyList<OutcomeSegment> ByRoleType,
    IReadOnlyList<OutcomeSegment> ByScoreBand,
    IReadOnlyList<OutcomeSegment> ByCvVariant,
    int AttributedCvApplications,
    int TotalApplications)
{
    public IReadOnlyList<OutcomeSegment> ByDirection { get; init; } = [];
    public IReadOnlyList<OutcomeSegment> ByLetterVersion { get; init; } = [];
    public int TechnicalFailures { get; init; }
}

public sealed class OutcomeAnalyticsService(AppDbContext db)
{
    public async Task<OutcomeAnalyticsResult> GetAsync(CancellationToken ct)
    {
        var rows = await db.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.Application)
            .Include(x => x.Events)
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
            rows.Count)
        {
            ByDirection = Group(rows, Direction),
            ByLetterVersion = Group(rows, v => SubmissionDetails.Read(v).LetterVersion, key => key == "unknown" ? "Версия письма не записана" : key),
            TechnicalFailures = await db.ApplicationEvents.Where(e => e.Type == "AutoApplyFailed" || e.Type == "BrowserApplyReview").Select(e => e.VacancyId).Distinct().CountAsync(ct)
        };
    }

    public async Task<object> ExportHistoryAsync(CancellationToken ct)
    {
        var rows = await db.Vacancies.AsNoTracking().Include(v => v.Company).Include(v => v.Application).Include(v => v.Events)
            .Where(v => v.Application != null || v.Events.Any(e => e.Type == "AutoApplyFailed" || e.Type == "BrowserApplyReview"))
            .ToListAsync(ct);
        return new { exportedAt = DateTimeOffset.UtcNow, applications = rows.Select(v => new {
            v.Id, v.Title, company = v.Company.Name, v.Source, v.Url, status = v.Status.ToString(),
            v.MatchScore, direction = Direction(v), appliedAt = v.Application?.AppliedAt,
            actualResume = v.Application?.ResumeExternalId, actualCoverLetter = v.Application?.CoverLetter,
            letterVersion = SubmissionDetails.Read(v).LetterVersion,
            events = v.Events.OrderBy(e => e.CreatedAt).Select(e => new { e.Type, e.Note, e.CreatedAt })
        }) };
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
        var responses = list.Count(v => Reached(v, HasResponse));
        var interviews = list.Count(v => Reached(v, HasInterview));
        var positive = list.Count(v => Reached(v, status => HasResponse(status) && status != VacancyStatus.Rejected));
        var offers = list.Count(v => Reached(v, status => status == VacancyStatus.Offer));
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
            Rate(offers, applications))
        {
            PositiveResponses = positive, PositiveResponseRate = Rate(positive, applications),
            Waiting = list.Count(v => v.Status == VacancyStatus.Applied),
            RecentWaiting = list.Count(v => v.Status == VacancyStatus.Applied && v.Application!.AppliedAt >= DateTimeOffset.UtcNow.AddDays(-7)),
            Withdrawn = list.Count(v => v.Status == VacancyStatus.Withdrawn),
            Closed = list.Count(v => v.Status == VacancyStatus.Closed)
        };
    }

    public static bool Reached(Vacancy vacancy, Func<VacancyStatus, bool> predicate)
    {
        if (predicate(vacancy.Status)) return true;
        return vacancy.Events.Any(e =>
        {
            if (Enum.TryParse<VacancyStatus>(e.Type, out var status)) return predicate(status);
            var parts = e.Type.Split(':');
            if (parts.Length < 4 || parts[0] != HhNegotiationStatusMapper.EventTypePrefix) return false;
            return predicate(HhNegotiationStatusMapper.Map(new("", "", parts[2], "", parts[3], "", false, false, null, null), VacancyStatus.Applied));
        });
    }

    public static string Direction(Vacancy vacancy)
    {
        var snapshot = SubmissionDetails.Read(vacancy);
        if (snapshot.RoleVariant != "unknown") return snapshot.RoleVariant;
        var role = new VacancyUnderstandingService().Understand(vacancy.Title, vacancy.DescriptionText, vacancy.IsRemote);
        if (role.RoleFamily != "Software engineering") return role.RoleFamily;
        if (role.Requirements.Any(r => r.Skill is "React" or "Next.js" or "TypeScript")) return "Frontend / Fullstack";
        if (role.Requirements.Any(r => r.Skill == "WPF")) return "C# Desktop";
        return role.Requirements.Any(r => r.Skill is "C#" or ".NET" or "ASP.NET Core") ? ".NET Backend" : "Software engineering";
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
        if (vacancy.Source.Equals("hh", StringComparison.OrdinalIgnoreCase)) return resume.StartsWith("hh/browser:", StringComparison.OrdinalIgnoreCase) ? resume : "hh";
        return "unknown";
    }

    private static string CvLabel(string key)
    {
        if (key.StartsWith("hh/browser:", StringComparison.OrdinalIgnoreCase)) return "HH: " + key[11..];
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
