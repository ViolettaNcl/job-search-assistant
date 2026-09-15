using System.Text.Json;
using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

// Persist alongside the confirmed application in the existing event table; no destructive schema change.
public sealed record SubmissionSnapshot(string LetterVersion, string RoleVariant);
public static class SubmissionDetails
{
    public const string EventType = "SubmissionDetails";
    public static SubmissionSnapshot Read(Vacancy vacancy)
    {
        var note = vacancy.Events.FirstOrDefault(e => e.Type == EventType)?.Note;
        try { return note is null ? new("unknown", "unknown") : JsonSerializer.Deserialize<SubmissionSnapshot>(note) ?? new("unknown", "unknown"); }
        catch (JsonException) { return new("unknown", "unknown"); }
    }
    public static void Record(AppDbContext db, Vacancy vacancy, string? letterVersion, string? roleVariant)
    {
        if (vacancy.Events.Any(e => e.Type == EventType)) return;
        static string Clean(string? value) => string.IsNullOrWhiteSpace(value) || value.Length > 100 ? "unknown" : value.Trim();
        db.ApplicationEvents.Add(new ApplicationEvent { VacancyId = vacancy.Id, Type = EventType,
            Note = JsonSerializer.Serialize(new SubmissionSnapshot(Clean(letterVersion), Clean(roleVariant))) });
    }
}
