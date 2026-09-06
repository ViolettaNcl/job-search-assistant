using JobSearchAssistant.Data;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed class ApplicationAttributionService(AppDbContext db)
{
    public async Task<bool> RecordExternalCvAsync(Guid vacancyId, string? resumeLabel, CancellationToken ct)
    {
        var clean = SanitizeResumeLabel(resumeLabel);
        if (string.IsNullOrWhiteSpace(clean)) return false;

        var vacancy = await db.Vacancies
            .Include(x => x.Application)
            .SingleOrDefaultAsync(x => x.Id == vacancyId, ct);

        if (vacancy?.Application is null || vacancy.Source.Equals("hh", StringComparison.OrdinalIgnoreCase))
            return false;

        var reference = $"external/{clean}";
        if (vacancy.Application.ResumeExternalId.Equals(reference, StringComparison.OrdinalIgnoreCase))
            return true;

        vacancy.Application.ResumeExternalId = reference;
        db.ApplicationEvents.Add(new Domain.ApplicationEvent
        {
            VacancyId = vacancy.Id,
            Type = "CvAttributed",
            Note = $"External application CV recorded: {clean}",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return true;
    }

    internal static string SanitizeResumeLabel(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var normalized = value.Trim().Replace('\\', '/');
        var file = normalized[(normalized.LastIndexOf('/') + 1)..];
        if (!file.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) return "";
        var safe = new string(file.Where(c => char.IsLetterOrDigit(c) || c is '.' or '_' or '-' or ' ').ToArray()).Trim();
        return safe.Length > 160 ? safe[..160] : safe;
    }
}
