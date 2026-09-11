using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record DashboardApplyCandidate(Guid VacancyId, string Title, string Url, int MatchScore, string EligibilityStatus);
public sealed record DashboardApplyPreparation(bool Ready, string Message, DashboardApplyCandidate? Candidate = null, ApplicationDraft? Draft = null);

public sealed class DashboardApplyService(AppDbContext db, OpportunityScoringService scoring, ApplicationDraftService drafts)
{
    private static string ReviewMessage(string reason) => reason switch
    {
        "Eligible hiring countries/payroll scope are unknown. B2B alone does not establish eligibility." =>
            "Работодатель не указал, можно ли работать удалённо из России. Формат B2B сам по себе этого не подтверждает. Откройте вакансию и уточните допустимую страну работы; включение автопилота эту проверку не отменяет.",
        "Residence/payroll restrictions require review; EU citizenship does not establish EU residence." =>
            "Есть ограничения по стране проживания или оформления. Гражданство ЕС не подтверждает проживание в ЕС. Уточните у работодателя возможность работы из России.",
        "EU work authorization is verified; remote hiring from current residence must be confirmed." =>
            "Право на работу в ЕС подтверждено, но возможность удалённого оформления из России нужно уточнить у работодателя.",
        "Current country is explicitly excluded." => "Работодатель прямо исключил текущую страну проживания из допустимых стран работы.",
        "Missing must-have evidence." => "Не подтверждены обязательные навыки вакансии. Посмотрите раздел «Почему подходит» и недостающие навыки.",
        "Mandatory university degree is not evidenced by the programming diploma." => "Требуется высшее образование; диплом колледжа не подтверждает это требование.",
        "Outside the configured technical career lanes." => "Вакансия не относится к выбранным техническим направлениям.",
        _ when reason.StartsWith("Requires ", StringComparison.Ordinal) => "Требуется подтверждённый стаж работы. Опыт проектов не заменяет коммерческий стаж.",
        _ => reason
    };
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
        if (assessment.Decision != "APPLY") return new(false, "Нужна проверка: " + (assessment.ReviewReasons.Length > 0 ? string.Join(" ", assessment.ReviewReasons.Select(ReviewMessage)) : $"приоритет {assessment.OverallScore}/100 ниже выбранного порога {minimum}."));
        var draft = drafts.Build(v);
        if (string.IsNullOrWhiteSpace(draft.CoverLetter)) return new(false, "Не удалось подготовить письмо.");
        return new(true, "Готово к отправке.", new(v.Id, v.Title, v.Url, assessment.OverallScore, assessment.EligibilityStatus), draft);
    }
}
