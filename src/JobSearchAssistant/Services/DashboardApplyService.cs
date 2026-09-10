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
        if (!RemoteWorkPolicy.IsFullyRemote(v.IsRemote, v.DescriptionText)) return new(false, "Полностью удалённый формат не подтверждён.");
        var state = await db.AppStates.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct);
        var minimum = Math.Clamp(state?.AutoApplyMinimumScore ?? 75, 50, 100);
        var assessment = scoring.Assess(v.Title, v.DescriptionText, v.IsRemote, v.Experience, v.LocationText, v.RemoteScope, minimum);
        if (assessment.Decision != "APPLY") return new(false, "Нужна проверка: " + (assessment.ReviewReasons.Length > 0 ? string.Join(" ", assessment.ReviewReasons) : $"приоритет {assessment.OverallScore}/100 ниже выбранного порога {minimum}."));
        var draft = drafts.Build(v);
        if (string.IsNullOrWhiteSpace(draft.CoverLetter)) return new(false, "Не удалось подготовить письмо.");
        return new(true, "Готово к отправке.", new(v.Id, v.Title, v.Url, assessment.OverallScore, assessment.EligibilityStatus), draft);
    }
}
