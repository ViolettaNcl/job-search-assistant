using System.Net;
using System.Text.Json;

namespace JobSearchAssistant.Services;

public sealed class HhReadException(HttpStatusCode status, string code, string message) : HttpRequestException(message, null, status)
{
    public string Code { get; } = code;
    public static HhReadException FromResponse(HttpStatusCode status, string payload)
    {
        var codes = new List<string>();
        try
        {
            using var json = JsonDocument.Parse(payload);
            if (json.RootElement.ValueKind == JsonValueKind.Object && json.RootElement.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Array)
                foreach (var item in errors.EnumerateArray())
                    foreach (var key in new[] { "type", "value" })
                        if (item.ValueKind == JsonValueKind.Object && item.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String)
                            codes.Add(value.GetString() ?? "");
        }
        catch (JsonException) { }
        var code = codes.Contains("captcha_required") ? "captcha_required"
            : codes.Contains("bad_user_agent") ? "bad_user_agent"
            : codes.Any(c => c is "oauth" or "token_expired" or "token_revoked" or "bad_authorization") ? "oauth"
            : status == HttpStatusCode.TooManyRequests ? "rate_limit" : "access_denied";
        var message = code switch
        {
            "captcha_required" => "HH требует проверку CAPTCHA. Откройте HH и выполните её самостоятельно; автоматический поиск остановлен.",
            "bad_user_agent" => "HH отклонил идентификатор приложения. Проверьте HH__UserAgent по документации API; не подменяйте его браузером.",
            "oauth" => "Авторизация API HH недействительна. Подключите/обновите HH через настройки программы.",
            "rate_limit" => "HH ограничил частоту запросов (429). Поиск остановлен; повторите позже.",
            _ => $"HH отклонил запрос API (HTTP {(int)status}). Причина не уточнена. Проверьте подключение HH API; поиск через обычный сайт доступен отдельно в расширении."
        };
        return new(status, code, message);
    }
}
