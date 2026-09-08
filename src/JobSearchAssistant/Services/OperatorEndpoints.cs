using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record RecruiterMessageRequest(string Text);
public static class OperatorEndpoints
{
    public static void MapOperatorEndpoints(this WebApplication app)
    {
        app.MapGet("/api/operator/vacancies/{id:guid}", async (Guid id, AppDbContext db, OpportunityScoringService scoring, EvidenceRetrievalService evidence, CancellationToken ct) =>
        {
            var v = await db.Vacancies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (v is null) return Results.NotFound();
            var a = scoring.Assess(v.Title, v.DescriptionText, v.IsRemote, v.Experience, v.LocationText, v.RemoteScope);
            return Results.Ok(new { assessment = a, strategy = evidence.Select(a) });
        });
        // Explicit request only: AI calls never run automatically while listing vacancies.
        app.MapPost("/api/operator/vacancies/{id:guid}/prepare", async (Guid id, AppDbContext db, OperatorPreparationService prepare, CancellationToken ct) =>
        {
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
