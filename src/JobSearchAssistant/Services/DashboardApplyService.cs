using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record DashboardApplyCandidate(Guid VacancyId, string Title, string Url, int MatchScore, string EligibilityStatus);
public sealed record DashboardApplyPreparation(bool Ready, string Message, DashboardApplyCandidate? Candidate = null, ApplicationDraft? Draft = null);

public sealed class DashboardApplyService(AppDbContext db, OpportunityScoringService scoring, ApplicationDraftService drafts)
{
    public async Task<DashboardApplyPreparation> PrepareAsync(Guid id, CancellationToken ct)
    {
        var v = await db.Vacancies.AsNoTracking().Include(x => x.Company).Include(x => x.Application).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return new(false, "Вакансия не найдена.");
        if (v.Application is not null || v.HasExistingHhResponse || v.Status == VacancyStatus.Applied) return new(false, "Отклик на эту вакансию уже отправлен.");
        if (v.Source != "hh" || !Uri.TryCreate(v.Url, UriKind.Absolute, out var url) || url.Scheme != "https" ||
            !(url.Host == "hh.ru" || url.Host.EndsWith(".hh.ru")) || !System.Text.RegularExpressions.Regex.IsMatch(url.AbsolutePath, @"^/vacancy/\d+/?$"))
            return new(false, "Отправка из дашборда пока доступна только для вакансий HH.");
        if (v.Company.IsBlacklisted || v.Status is VacancyStatus.Skipped or VacancyStatus.Rejected)
            return new(false, "Вакансия или компания исключена из откликов.");
        // Clicking Apply is the user's decision. Fit, education and residence are
        // advisory and never require an override or an invented candidate credential.
        var assessment = scoring.Assess(v.Title, v.DescriptionText, v.IsRemote, v.Experience, v.LocationText, v.RemoteScope);
        var draft = drafts.Build(v);
        if (string.IsNullOrWhiteSpace(draft.CoverLetter)) return new(false, "Не удалось подготовить письмо.");
        return new(true, "Готово к отправке.", new(v.Id, v.Title, v.Url, assessment.OverallScore, assessment.EligibilityStatus), draft);
    }
}
