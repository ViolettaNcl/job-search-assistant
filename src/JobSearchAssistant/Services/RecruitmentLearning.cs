using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public static class RecruitmentLearning
{
    public const int MinimumSegmentApplications = 20;

    public static int CalculateBoost(Vacancy candidate, IReadOnlyCollection<Vacancy> history)
    {
        history = history.Where(v => v.Application is null || v.Status != VacancyStatus.Applied || v.Application.AppliedAt <= DateTimeOffset.UtcNow.AddDays(-7)).ToArray();
        if (history.Count < MinimumSegmentApplications) return 0;

        var role = OutcomeAnalyticsService.Direction(candidate);
        var source = string.IsNullOrWhiteSpace(candidate.SourceLabel) ? candidate.Source : candidate.SourceLabel;
        var roleRows = history.Where(v => OutcomeAnalyticsService.Direction(v) == role).ToArray();
        var sourceRows = history.Where(v => string.Equals(
            string.IsNullOrWhiteSpace(v.SourceLabel) ? v.Source : v.SourceLabel,
            source,
            StringComparison.OrdinalIgnoreCase)).ToArray();

        return Math.Clamp(SegmentBoost(roleRows) + SegmentBoost(sourceRows), -8, 10);
    }

    public static string ExplainBoost(int boost)
        => boost switch
        {
            >= 4 => "В достаточной выборке похожих откликов больше положительных ответов; это не прогноз",
            > 0 => "Есть положительная история ответов по похожим вакансиям",
            <= -4 => "Похожие отклики пока редко приводили к ответу",
            < 0 => "История ответов немного снижает приоритет",
            _ => "Недостаточно истории — используется базовый приоритет"
        };

    private static int SegmentBoost(IReadOnlyCollection<Vacancy> rows)
    {
        if (rows.Count < MinimumSegmentApplications) return 0;
        var responses = rows.Count(v => v.Status is VacancyStatus.HrContact or VacancyStatus.HrInterview or VacancyStatus.TechInterview or VacancyStatus.TestTask or VacancyStatus.Offer);
        var interviews = rows.Count(v => OutcomeAnalyticsService.Reached(v, OutcomeAnalyticsService.HasInterview));

        // Conservative Bayesian smoothing prevents a few early outcomes from dominating the queue.
        var responseRate = (responses + 1.0) / (rows.Count + 4.0);
        var interviewRate = (interviews + 0.5) / (rows.Count + 5.0);
        var value = ((responseRate - 0.25) * 12.0) + ((interviewRate - 0.08) * 18.0);
        return Math.Clamp((int)Math.Round(value), -4, 5);
    }
}
