using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed class StatsService(AppDbContext db)
{
    public async Task<object> GetAsync(CancellationToken ct)
    {
        var vacancies = await db.Vacancies.CountAsync(ct);
        var applied = await db.Vacancies.CountAsync(x => x.Status == VacancyStatus.Applied || x.Status == VacancyStatus.HrContact || x.Status == VacancyStatus.HrInterview || x.Status == VacancyStatus.TechInterview || x.Status == VacancyStatus.TestTask || x.Status == VacancyStatus.Rejected || x.Status == VacancyStatus.Offer, ct);
        var responses = await db.Vacancies.CountAsync(x => x.Status == VacancyStatus.HrContact || x.Status == VacancyStatus.HrInterview || x.Status == VacancyStatus.TechInterview || x.Status == VacancyStatus.TestTask || x.Status == VacancyStatus.Rejected || x.Status == VacancyStatus.Offer, ct);
        var interviews = await db.Vacancies.CountAsync(x => x.Status == VacancyStatus.HrInterview || x.Status == VacancyStatus.TechInterview, ct);
        var tech = await db.Vacancies.CountAsync(x => x.Status == VacancyStatus.TechInterview, ct);
        var tests = await db.Vacancies.CountAsync(x => x.Status == VacancyStatus.TestTask, ct);
        var rejected = await db.Vacancies.CountAsync(x => x.Status == VacancyStatus.Rejected, ct);
        var offers = await db.Vacancies.CountAsync(x => x.Status == VacancyStatus.Offer, ct);
        var strong = await db.Vacancies.CountAsync(x => x.MatchScore >= 85, ct);

        return new
        {
            vacancies,
            strong,
            applied,
            responses,
            interviews,
            technicalInterviews = tech,
            testTasks = tests,
            rejected,
            offers,
            responseRate = applied == 0 ? 0 : Math.Round(responses * 100.0 / applied, 1),
            interviewRate = responses == 0 ? 0 : Math.Round(interviews * 100.0 / responses, 1)
        };
    }
}
