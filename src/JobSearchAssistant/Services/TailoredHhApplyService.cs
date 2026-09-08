using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed class TailoredHhApplyService(
    AppDbContext db,
    HhClient hh,
    ApplicationDraftService drafts,
    OpportunityScoringService scoring)
{
    public async Task<HhApplyResult> ApplyAsync(Guid vacancyId, CancellationToken ct)
    {
        var vacancy = await db.Vacancies
            .Include(x => x.Application)
            .Include(x => x.Company)
            .SingleOrDefaultAsync(x => x.Id == vacancyId, ct);

        if (vacancy is null)
            return new HhApplyResult(false, "vacancy_not_found", "Vacancy was not found in Job Assistant.");
        if (!vacancy.Source.Equals("hh", StringComparison.OrdinalIgnoreCase))
            return new HhApplyResult(false, "hh_only", "Tailored direct submission is only available for HH vacancies.");
        if (vacancy.Company.IsBlacklisted)
            return new HhApplyResult(false, "blacklisted", "Company is blacklisted.");
        var assessment = scoring.Assess(vacancy.Title, vacancy.DescriptionText, vacancy.IsRemote, vacancy.Experience, vacancy.LocationText, vacancy.RemoteScope);
        if (assessment.Decision != "APPLY")
            return new HhApplyResult(false, "operator_review_required", string.Join(" ", assessment.ReviewReasons));
        if (vacancy.MatchScore < 75)
            return new HhApplyResult(false, "fit_below_threshold", $"Fit score {vacancy.MatchScore}/100 is below the 75-point one-click threshold. Review manually first.");
        if (!AutomaticSubmissionPolicy.IsVerifiedEligible(vacancy))
            return new HhApplyResult(false, "eligibility_not_verified", "This vacancy requires a location/work-authorization review before submission.");
        if (vacancy.Application is not null || vacancy.HasExistingHhResponse || vacancy.Status == VacancyStatus.Applied)
            return new HhApplyResult(false, "already_applied_local", "This vacancy is already marked as applied.");

        var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
        if (string.IsNullOrWhiteSpace(state.HhResumeId))
            return new HhApplyResult(false, "resume_not_selected", "Select an HH resume first.");

        var draft = drafts.Build(vacancy);
        var result = await hh.ApplyAsync(vacancy.ExternalId, state.HhResumeId, draft.CoverLetter, ct);

        if (!result.Success)
        {
            if (result.ErrorCode == "already_applied")
            {
                vacancy.Status = VacancyStatus.Applied;
                vacancy.HasExistingHhResponse = true;
                if (vacancy.Application is null)
                {
                    db.Applications.Add(new Application
                    {
                        VacancyId = vacancy.Id,
                        ResumeExternalId = state.HhResumeId,
                        CoverLetter = draft.CoverLetter,
                        LastError = result.ErrorText
                    });
                }
                await db.SaveChangesAsync(ct);
            }
            return result;
        }

        vacancy.Status = VacancyStatus.Applied;
        vacancy.HasExistingHhResponse = true;
        vacancy.UpdatedAt = DateTimeOffset.UtcNow;
        db.Applications.Add(new Application
        {
            VacancyId = vacancy.Id,
            ResumeExternalId = state.HhResumeId,
            CoverLetter = draft.CoverLetter,
            AppliedAt = DateTimeOffset.UtcNow
        });
        db.ApplicationEvents.Add(new ApplicationEvent
        {
            VacancyId = vacancy.Id,
            Type = "Applied",
            Note = "Submitted via HH API with vacancy-specific Apply Autopilot draft"
        });
        await db.SaveChangesAsync(ct);
        return result;
    }
}
