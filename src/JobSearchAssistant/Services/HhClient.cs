using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record HhVacancyDto(
    string Id,
    string Title,
    string Url,
    string EmployerId,
    string EmployerName,
    string Description,
    string Salary,
    string Schedule,
    string Experience,
    bool Remote,
    DateTimeOffset? PublishedAt,
    bool GotResponse);

public sealed record HhResumeDto(string Id, string Title, string Url);
public sealed record HhApplyResult(bool Success, string ErrorCode, string ErrorText);

public sealed class HhClient(
    IHttpClientFactory httpClientFactory,
    AppDbContext db,
    SecretCipher cipher,
    IOptions<HhOptions> options)
{
    private readonly HhOptions _options = options.Value;

    public async Task<IReadOnlyList<string>> SearchIdsAsync(string query, string experience, CancellationToken ct)
    {
        var client = CreateClient(await TryGetAccessTokenAsync(ct));
        var url = $"/vacancies?text={Uri.EscapeDataString(query)}&schedule=remote&experience={experience}&per_page=50&page=0&order_by=publication_time";
        using var response = await client.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return json.RootElement.GetProperty("items")
            .EnumerateArray()
            .Select(x => x.GetProperty("id").GetString()!)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();
    }

    public async Task<HhVacancyDto?> GetVacancyAsync(string id, CancellationToken ct)
    {
        var client = CreateClient(await TryGetAccessTokenAsync(ct));
        using var response = await client.GetAsync($"/vacancies/{Uri.EscapeDataString(id)}", ct);
        if (!response.IsSuccessStatusCode) return null;
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = json.RootElement;

        var employer = root.TryGetProperty("employer", out var e) ? e : default;
        var salary = FormatSalary(root.TryGetProperty("salary", out var s) ? s : default);
        var schedule = ReadNestedName(root, "schedule");
        var experience = root.TryGetProperty("experience", out var exp) && exp.ValueKind == JsonValueKind.Object
            ? exp.GetProperty("id").GetString() ?? ""
            : "";
        var relations = root.TryGetProperty("relations", out var rel) && rel.ValueKind == JsonValueKind.Array
            ? rel.EnumerateArray().Select(x => x.GetString()).ToArray()
            : [];

        var description = StripHtml(root.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "");
        if (root.TryGetProperty("key_skills", out var skills) && skills.ValueKind == JsonValueKind.Array)
        {
            description += "\nSkills: " + string.Join(", ", skills.EnumerateArray()
                .Select(x => x.TryGetProperty("name", out var n) ? n.GetString() : null)
                .Where(x => !string.IsNullOrWhiteSpace(x)));
        }

        return new HhVacancyDto(
            root.GetProperty("id").GetString() ?? id,
            root.GetProperty("name").GetString() ?? "",
            root.TryGetProperty("alternate_url", out var u) ? u.GetString() ?? "" : "",
            employer.ValueKind == JsonValueKind.Object && employer.TryGetProperty("id", out var eid) ? eid.GetString() ?? "unknown" : "unknown",
            employer.ValueKind == JsonValueKind.Object && employer.TryGetProperty("name", out var en) ? en.GetString() ?? "Unknown" : "Unknown",
            description,
            salary,
            schedule,
            experience,
            schedule.Contains("удален", StringComparison.OrdinalIgnoreCase) || schedule.Contains("remote", StringComparison.OrdinalIgnoreCase),
            root.TryGetProperty("published_at", out var p) && DateTimeOffset.TryParse(p.GetString(), out var published) ? published : null,
            relations.Contains("got_response", StringComparer.OrdinalIgnoreCase));
    }

    public async Task<string> BeginOAuthAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId)) throw new InvalidOperationException("HH ClientId is not configured.");
        var state = Base64Url(RandomNumberGenerator.GetBytes(24));
        var verifier = Base64Url(RandomNumberGenerator.GetBytes(48));
        var challenge = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var app = await GetStateAsync(ct);
        app.OAuthState = state;
        app.OAuthCodeVerifier = verifier;
        app.OAuthCreatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return "https://hh.ru/oauth/authorize" +
               $"?response_type=code&client_id={Uri.EscapeDataString(_options.ClientId)}" +
               $"&state={Uri.EscapeDataString(state)}" +
               $"&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}" +
               $"&code_challenge={Uri.EscapeDataString(challenge)}&code_challenge_method=S256";
    }

    public async Task ExchangeCodeAsync(string code, string state, CancellationToken ct)
    {
        var app = await GetStateAsync(ct);
        if (string.IsNullOrWhiteSpace(app.OAuthState) || !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(app.OAuthState), Encoding.UTF8.GetBytes(state)))
            throw new InvalidOperationException("Invalid OAuth state.");
        if (app.OAuthCreatedAt is null || app.OAuthCreatedAt < DateTimeOffset.UtcNow.AddMinutes(-15))
            throw new InvalidOperationException("OAuth request expired. Start authorization again.");

        var client = CreateClient();
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["code"] = code,
            ["redirect_uri"] = _options.RedirectUri,
            ["code_verifier"] = app.OAuthCodeVerifier
        });
        using var response = await client.PostAsync("/token", content, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"HH token exchange failed: {payload}");
        using var json = JsonDocument.Parse(payload);
        SaveTokens(app, json.RootElement);
        app.OAuthState = "";
        app.OAuthCodeVerifier = "";
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<HhResumeDto>> GetResumesAsync(CancellationToken ct)
    {
        var token = await GetAccessTokenAsync(ct);
        var client = CreateClient(token);
        using var response = await client.GetAsync("/resumes/mine", ct);
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        if (!json.RootElement.TryGetProperty("items", out var items)) return [];
        return items.EnumerateArray().Select(x => new HhResumeDto(
            x.GetProperty("id").GetString() ?? "",
            x.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            x.TryGetProperty("alternate_url", out var u) ? u.GetString() ?? "" : ""
        )).ToArray();
    }

    public async Task<IReadOnlyList<string>> GetAppliedVacancyIdsAsync(CancellationToken ct)
    {
        var token = await GetAccessTokenAsync(ct);
        var client = CreateClient(token);
        var ids = new HashSet<string>();
        for (var page = 0; page < 10; page++)
        {
            using var response = await client.GetAsync($"/negotiations?per_page=50&page={page}", ct);
            if (!response.IsSuccessStatusCode) break;
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            if (!json.RootElement.TryGetProperty("items", out var items)) break;
            var count = 0;
            foreach (var item in items.EnumerateArray())
            {
                count++;
                if (item.TryGetProperty("vacancy", out var v) && v.ValueKind == JsonValueKind.Object && v.TryGetProperty("id", out var vid))
                {
                    var id = vid.GetString();
                    if (!string.IsNullOrWhiteSpace(id)) ids.Add(id);
                }
            }
            if (count < 50) break;
        }
        return ids.ToArray();
    }

    public async Task<HhApplyResult> ApplyAsync(string vacancyId, string resumeId, string message, CancellationToken ct)
    {
        var token = await GetAccessTokenAsync(ct);
        var client = CreateClient(token);
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["vacancy_id"] = vacancyId,
            ["resume_id"] = resumeId,
            ["message"] = message
        });
        using var response = await client.PostAsync("/negotiations", content, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (response.IsSuccessStatusCode) return new HhApplyResult(true, "", "");

        var (code, text) = ParseHhError(payload);
        return new HhApplyResult(false, code, text);
    }

    public async Task<bool> HasOAuthAsync(CancellationToken ct)
    {
        var app = await GetStateAsync(ct);
        return !string.IsNullOrWhiteSpace(app.ProtectedAccessToken) || !string.IsNullOrWhiteSpace(app.ProtectedRefreshToken);
    }

    private HttpClient CreateClient(string? token = null)
    {
        var client = httpClientFactory.CreateClient("hh");
        client.BaseAddress = new Uri(_options.ApiBaseUrl.TrimEnd('/'));
        client.DefaultRequestHeaders.Remove("HH-User-Agent");
        client.DefaultRequestHeaders.TryAddWithoutValidation("HH-User-Agent", _options.UserAgent);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("ViolettaJobAssistant/1.0");
        if (!string.IsNullOrWhiteSpace(token)) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<string?> TryGetAccessTokenAsync(CancellationToken ct)
    {
        try { return await GetAccessTokenAsync(ct); }
        catch { return null; }
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken ct)
    {
        var app = await GetStateAsync(ct);
        if (!string.IsNullOrWhiteSpace(app.ProtectedAccessToken) && app.AccessTokenExpiresAt > DateTimeOffset.UtcNow.AddSeconds(30))
            return cipher.Unprotect(app.ProtectedAccessToken);

        if (string.IsNullOrWhiteSpace(app.ProtectedRefreshToken))
            throw new InvalidOperationException("HH OAuth is not connected.");

        var refresh = cipher.Unprotect(app.ProtectedRefreshToken);
        var client = CreateClient();
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refresh,
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret
        });
        using var response = await client.PostAsync("/token", content, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"HH token refresh failed: {payload}");
        using var json = JsonDocument.Parse(payload);
        SaveTokens(app, json.RootElement);
        await db.SaveChangesAsync(ct);
        return cipher.Unprotect(app.ProtectedAccessToken);
    }

    private void SaveTokens(AppState app, JsonElement root)
    {
        app.ProtectedAccessToken = cipher.Protect(root.GetProperty("access_token").GetString() ?? "");
        if (root.TryGetProperty("refresh_token", out var rt)) app.ProtectedRefreshToken = cipher.Protect(rt.GetString() ?? "");
        var expires = root.TryGetProperty("expires_in", out var ex) && ex.TryGetInt32(out var seconds) ? seconds : 1200;
        app.AccessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(expires);
    }

    private async Task<AppState> GetStateAsync(CancellationToken ct)
    {
        var app = await db.AppStates.SingleOrDefaultAsync(x => x.Id == 1, ct);
        if (app is not null) return app;
        app = new AppState { Id = 1 };
        db.AppStates.Add(app);
        await db.SaveChangesAsync(ct);
        return app;
    }

    private static string ReadNestedName(JsonElement root, string property)
        => root.TryGetProperty(property, out var x) && x.ValueKind == JsonValueKind.Object && x.TryGetProperty("name", out var n)
            ? n.GetString() ?? ""
            : "";

    private static string FormatSalary(JsonElement salary)
    {
        if (salary.ValueKind != JsonValueKind.Object) return "";
        var from = salary.TryGetProperty("from", out var f) && f.ValueKind == JsonValueKind.Number ? f.GetDecimal().ToString("N0") : "";
        var to = salary.TryGetProperty("to", out var t) && t.ValueKind == JsonValueKind.Number ? t.GetDecimal().ToString("N0") : "";
        var currency = salary.TryGetProperty("currency", out var c) ? c.GetString() ?? "" : "";
        return (from, to) switch
        {
            ({ Length: > 0 }, { Length: > 0 }) => $"{from}–{to} {currency}",
            ({ Length: > 0 }, _) => $"от {from} {currency}",
            (_, { Length: > 0 }) => $"до {to} {currency}",
            _ => ""
        };
    }

    private static string StripHtml(string html)
        => System.Net.WebUtility.HtmlDecode(System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " "));

    private static string Base64Url(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static (string Code, string Text) ParseHhError(string payload)
    {
        try
        {
            using var json = JsonDocument.Parse(payload);
            if (json.RootElement.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Array)
            {
                var first = errors.EnumerateArray().FirstOrDefault();
                var code = first.TryGetProperty("value", out var v) ? v.GetString() ?? "hh_error" : "hh_error";
                return (code, payload);
            }
        }
        catch { }
        return ("hh_error", payload);
    }
}
