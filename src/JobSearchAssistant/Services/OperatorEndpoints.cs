using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record RecruiterMessageRequest(string Text);
public sealed record ScreeningReviewRequest(ExtensionAnalyzeRequest Vacancy, string? ResumeText);
public static class OperatorEndpoints
{
    public static void MapOperatorEndpoints(this WebApplication app)
    {
        app.MapPost("/api/operator/screening", (ScreeningReviewRequest request, HttpContext context, OpportunityScoringService scoring, ScreeningReviewService review) =>
        {
            // Private CV text stays in the local process and is never persisted or sent to an AI provider.
            if (context.Connection.RemoteIpAddress is null || !System.Net.IPAddress.IsLoopback(context.Connection.RemoteIpAddress)
                || !new[] { "localhost", "127.0.0.1", "[::1]" }.Contains(context.Request.Host.Host)) return Results.StatusCode(403);
            if (request.Vacancy is null || request.ResumeText?.Length > 80000) return Results.BadRequest(new { error = "Vacancy required; resume text must be at most 80000 characters." });
            var v = request.Vacancy;
            var a = scoring.Assess(v.Title ?? "", v.Description ?? "", v.Remote, v.Experience ?? "", v.Location ?? v.Country ?? "", v.RemoteScope ?? "");
            return Results.Ok(review.Review(a, request.ResumeText));
        });
        app.MapGet("/api/operator/vacancies/{id:guid}", async (Guid id, AppDbContext db, OpportunityScoringService scoring, EvidenceRetrievalService evidence, CancellationToken ct) =>
        {
            var v = await db.Vacancies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (v is null) return Results.NotFound();
            var a = scoring.Assess(v.Title, v.DescriptionText, v.IsRemote, v.Experience, v.LocationText, v.RemoteScope);
            return Results.Ok(new { assessment = a, strategy = evidence.Select(a) });
        });
        app.MapGet("/api/operator/today", async (AppDbContext db, OpportunityScoringService scoring, EvidenceRetrievalService evidence, CancellationToken ct) =>
        {
            var rows = await db.Vacancies.AsNoTracking().Include(v => v.Company).Include(v => v.Application)
                .Where(v => !v.Company.IsBlacklisted).ToListAsync(ct);
            var newJobs = rows.Where(v => (v.Status is VacancyStatus.New or VacancyStatus.Saved) && v.Application == null && !v.HasExistingHhResponse)
                .Select(v => new { vacancy = v, assessment = scoring.Assess(v.Title, v.DescriptionText, v.IsRemote, v.Experience, v.LocationText, v.RemoteScope) }).ToArray();
            return Results.Ok(new {
                reasoningMode = "deterministic-fallback",
                best = newJobs.Where(v => v.assessment.Decision == "APPLY").OrderByDescending(v => v.assessment.OverallScore).Take(7)
                    .Select(v => new { v.vacancy.Id, v.vacancy.Title, company = v.vacancy.Company.Name, v.assessment, strategy = evidence.Select(v.assessment) }),
                needsReview = newJobs.Count(v => v.assessment.Decision == "REVIEW"),
                actions = rows.Where(v => v.Status is VacancyStatus.HrContact or VacancyStatus.HrInterview or VacancyStatus.TechInterview or VacancyStatus.TestTask or VacancyStatus.Offer)
                    .OrderBy(v => v.Status == VacancyStatus.TestTask ? 0 : v.Status == VacancyStatus.Offer ? 1 : v.Status == VacancyStatus.HrContact ? 3 : 2)
                    .Select(v => new { v.Id, v.Title, company = v.Company.Name, stage = v.Status.ToString(), deadline = "Unknown — check recruiter message" }),
                // CRM records include manual declarations; this is not a verified browser success rate.
                applicationsRecordedToday = rows.Count(v => v.Application?.AppliedAt.UtcDateTime.Date == DateTime.UtcNow.Date),
                pilot = new { measuredAttempts = (int?)null, confirmedSuccessRate = (double?)null, status = "No authenticated pilot sample recorded" }
            });
        });
        // Explicit request only: AI calls never run automatically while listing vacancies.
        app.MapPost("/api/operator/vacancies/{id:guid}/prepare", async (Guid id, HttpContext context, AppDbContext db, OperatorPreparationService prepare, CancellationToken ct) =>
        {
            if (context.Connection.RemoteIpAddress is not { } address || !System.Net.IPAddress.IsLoopback(address)
                || context.Request.Host.Host is not ("localhost" or "127.0.0.1" or "[::1]" or "::1"))
                return Results.Json(new { message = "AI preparation is available only in the local application." }, statusCode: 403);
            var v = await db.Vacancies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (v is null) return Results.NotFound();
            return Results.Ok(await prepare.PrepareAsync(v.Title, v.DescriptionText, v.IsRemote, v.Experience, v.LocationText, v.RemoteScope,
                v.Source == "hh" || v.Country == "Russia", ct));
        });
        // Stateless local analysis: no recruiter content stored, sent externally or sent as a reply.
        app.MapPost("/api/operator/recruiter/triage", (RecruiterMessageRequest request, RecruiterMessageService messages) =>
            string.IsNullOrWhiteSpace(request.Text) || request.Text.Length > 12000
                ? Results.BadRequest(new { message = "Message must contain 1–12000 characters." })
                : Results.Ok(messages.Classify(request.Text)));
    }
}
