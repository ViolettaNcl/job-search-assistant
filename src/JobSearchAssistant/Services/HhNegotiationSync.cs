using System.Text.Json;
using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public sealed record HhNegotiationDto(
    string Id,
    string VacancyId,
    string StateId,
    string StateName,
    string EmployerStateId,
    string EmployerStateName,
    bool HasUpdates,
    bool ViewedByOpponent,
    DateTimeOffset? CreatedAt,
    DateTimeOffset? UpdatedAt)
{
    public bool VacancyArchived { get; init; }
}

public static class HhNegotiationParser
{
    public static IReadOnlyList<HhNegotiationDto> ParseList(string payload)
    {
        using var json = JsonDocument.Parse(payload);
        return ParseList(json.RootElement);
    }

    public static IReadOnlyList<HhNegotiationDto> ParseList(JsonElement root)
    {
        if (!root.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array)
            return [];

        var result = new List<HhNegotiationDto>();
        foreach (var item in items.EnumerateArray())
        {
            var vacancyId = ReadNestedString(item, "vacancy", "id");
            if (string.IsNullOrWhiteSpace(vacancyId)) continue;

            result.Add(new HhNegotiationDto(
                ReadString(item, "id"),
                vacancyId,
                ReadNestedString(item, "state", "id"),
                ReadNestedString(item, "state", "name"),
                ReadNestedString(item, "employer_state", "id"),
                ReadNestedString(item, "employer_state", "name"),
                ReadBoolean(item, "has_updates"),
                ReadBoolean(item, "viewed_by_opponent"),
                ReadDate(item, "created_at"),
                ReadDate(item, "updated_at")) { VacancyArchived = item.TryGetProperty("vacancy", out var vacancy) && ReadBoolean(vacancy, "archived") });
        }
        return result;
    }

    private static string ReadString(JsonElement item, string property)
        => item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : "";

    private static string ReadNestedString(JsonElement item, string property, string nestedProperty)
        => item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.Object
            ? ReadString(value, nestedProperty)
            : "";

    private static bool ReadBoolean(JsonElement item, string property)
        => item.TryGetProperty(property, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False && value.GetBoolean();

    private static DateTimeOffset? ReadDate(JsonElement item, string property)
        => item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String &&
           DateTimeOffset.TryParse(value.GetString(), out var parsed)
            ? parsed
            : null;
}

public static class HhNegotiationStatusMapper
{
    public const string EventTypePrefix = "HhStatusSynced";

    public static VacancyStatus Map(HhNegotiationDto negotiation, VacancyStatus current)
    {
        var externalState = $"{negotiation.StateId} {negotiation.StateName} {negotiation.EmployerStateId} {negotiation.EmployerStateName}".ToLowerInvariant();
        var target = MapExternalState(externalState, negotiation.VacancyArchived);

        if (target is VacancyStatus.Rejected or VacancyStatus.Withdrawn or VacancyStatus.Closed) return target;
        if (current == VacancyStatus.Offer) return current;
        if (current == VacancyStatus.Rejected) return current;
        if (current is VacancyStatus.HrInterview or VacancyStatus.TechInterview or VacancyStatus.TestTask)
            return target == VacancyStatus.Offer ? target : current;
        if (current == VacancyStatus.HrContact && target == VacancyStatus.Applied) return current;
        return target;
    }

    public static string Describe(HhNegotiationDto negotiation, VacancyStatus mappedStatus)
    {
        var state = !string.IsNullOrWhiteSpace(negotiation.EmployerStateName)
            ? negotiation.EmployerStateName
            : !string.IsNullOrWhiteSpace(negotiation.StateName)
                ? negotiation.StateName
                : negotiation.EmployerStateId.Length > 0 ? negotiation.EmployerStateId : negotiation.StateId;
        var unread = negotiation.HasUpdates ? " Есть непрочитанное сообщение — откройте HH." : "";
        return $"HH синхронизирован: {state}; этап — {RussianStatus(mappedStatus)}.{unread}".Trim();
    }

    public static string EventType(HhNegotiationDto negotiation)
        => string.Join(':', new[]
        {
            EventTypePrefix,
            negotiation.Id,
            negotiation.StateId,
            negotiation.EmployerStateId,
            negotiation.HasUpdates ? "unread" : "read",
            negotiation.VacancyArchived ? "archived" : "active",
            negotiation.UpdatedAt?.ToUniversalTime().Ticks.ToString() ?? "unknown"
        });

    private static VacancyStatus MapExternalState(string state, bool archived)
    {
        if (ContainsAny(state, "offer", "hired", "оффер", "нанят")) return VacancyStatus.Offer;
        if (ContainsAny(state, "discard_by_applicant", "withdraw", "отозван")) return VacancyStatus.Withdrawn;
        if (ContainsAny(state, "discard", "reject", "отказ")) return VacancyStatus.Rejected;
        if (archived) return VacancyStatus.Closed;
        if (ContainsAny(state, "phone_interview", "первичный контакт")) return VacancyStatus.HrContact;
        if (ContainsAny(state, "tech_interview", "technical_interview", "техническ")) return VacancyStatus.TechInterview;
        if (ContainsAny(state, "assessment", "test_task", "test", "тестов")) return VacancyStatus.TestTask;
        if (ContainsAny(state, "interview", "интервью")) return VacancyStatus.HrInterview;
        if (ContainsAny(state, "invitation", "consider", "phone_interview", "приглаш", "первичный контакт")) return VacancyStatus.HrContact;
        return VacancyStatus.Applied; // An unread message alone does not establish a recruiting stage.
    }

    private static bool ContainsAny(string value, params string[] terms)
        => terms.Any(term => value.Contains(term, StringComparison.OrdinalIgnoreCase));

    private static string RussianStatus(VacancyStatus status) => status switch
    {
        VacancyStatus.Applied => "отклик отправлен",
        VacancyStatus.HrContact => "ответ HR",
        VacancyStatus.HrInterview => "HR-интервью",
        VacancyStatus.TechInterview => "техническое интервью",
        VacancyStatus.TestTask => "тестовое задание",
        VacancyStatus.Rejected => "отказ",
        VacancyStatus.Offer => "оффер",
        VacancyStatus.Skipped => "пропущено",
        VacancyStatus.Withdrawn => "отклик отозван кандидатом",
        VacancyStatus.Closed => "вакансия закрыта",
        _ => status.ToString()
    };
}
