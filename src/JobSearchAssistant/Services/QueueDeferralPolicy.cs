using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public static class QueueDeferralPolicy
{
    public const string NotePrefix = "QueueDeferredUntil=";

    public static string BuildNote(DateTimeOffset deferredUntil)
        => $"{NotePrefix}{deferredUntil.ToUniversalTime():O}";

    public static DateTimeOffset? GetDeferredUntil(IEnumerable<ApplicationEvent>? events)
    {
        if (events is null) return null;

        var latestSaved = events
            .Where(x => x.Type.Equals(VacancyStatus.Saved.ToString(), StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();

        if (latestSaved is null || !latestSaved.Note.StartsWith(NotePrefix, StringComparison.Ordinal)) return null;
        var raw = latestSaved.Note[NotePrefix.Length..].Split('\n')[0].Trim();
        return DateTimeOffset.TryParse(raw, out var parsed) ? parsed.ToUniversalTime() : null;
    }

    public static bool IsActivelyDeferred(Vacancy vacancy, DateTimeOffset now)
    {
        if (vacancy.Status != VacancyStatus.Saved) return false;
        var until = GetDeferredUntil(vacancy.Events);
        return until.HasValue && until.Value > now.ToUniversalTime();
    }

    public static bool ShouldAppearInQueue(Vacancy vacancy, DateTimeOffset now)
    {
        if (vacancy.Status == VacancyStatus.New) return true;
        if (vacancy.Status != VacancyStatus.Saved) return false;

        var until = GetDeferredUntil(vacancy.Events);
        return until.HasValue && until.Value <= now.ToUniversalTime();
    }
}
