using System.Net;
using System.Text.Json;
using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record ExternalVacancyDto(
    string Source,
    string SourceLabel,
    string ExternalId,
    string Title,
    string Url,
    string ApplyUrl,
    string CompanyId,
    string CompanyName,
    string Description,
    string Salary,
    string Schedule,
    string Experience,
    bool Remote,
    string Country,
    string Location,
    string RemoteScope,
    DateTimeOffset? PublishedAt);

public sealed class RemotiveClient(IHttpClientFactory clients, IOptions<RemotiveOptions> options)
{
    private readonly RemotiveOptions _options = options.Value;

    public bool Enabled => _options.Enabled;

    public async Task<IReadOnlyList<ExternalVacancyDto>> GetSoftwareJobsAsync(CancellationToken ct)
    {
        if (!Enabled) return [];
        var client = clients.CreateClient("remotive");
        var url = $"{_options.ApiUrl}?category=software-dev";
        using var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return [];
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        if (!json.RootElement.TryGetProperty("jobs", out var jobs) || jobs.ValueKind != JsonValueKind.Array) return [];

        var list = new List<ExternalVacancyDto>();
        foreach (var job in jobs.EnumerateArray())
        {
            var id = GetString(job, "id");
            var title = GetString(job, "title");
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(title)) continue;
            var company = GetString(job, "company_name");
            var location = GetString(job, "candidate_required_location");
            var description = StripHtml(GetString(job, "description"));
            var salary = GetString(job, "salary");
            var jobType = GetString(job, "job_type");
            var jobUrl = GetString(job, "url");
            DateTimeOffset? published = null;
            if (DateTimeOffset.TryParse(GetString(job, "publication_date"), out var p)) published = p;

            list.Add(new ExternalVacancyDto(
                "remotive", "Remotive", id, title, jobUrl, jobUrl,
                Normalize(company), company, description, salary, jobType, "",
                true, InferCountry(location), location, location, published));
        }
        return list;
    }

    private static string GetString(JsonElement root, string name)
        => root.TryGetProperty(name, out var x) ? x.ValueKind == JsonValueKind.String ? x.GetString() ?? "" : x.ToString() : "";

    private static string StripHtml(string html)
        => WebUtility.HtmlDecode(System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " "));

    private static string Normalize(string value)
        => string.Concat(value.ToLowerInvariant().Where(char.IsLetterOrDigit));

    private static string InferCountry(string location)
    {
        var l = location.ToLowerInvariant();
        if (l.Contains("worldwide") || l.Contains("anywhere") || l.Contains("global")) return "Worldwide";
        if (l.Contains("united states") || l.Contains("usa") || l.Contains("u.s.")) return "United States";
        if (l.Contains("europe") || l.Contains("emea")) return "Europe/EMEA";
        if (l.Contains("canada")) return "Canada";
        if (l.Contains("uk") || l.Contains("united kingdom")) return "United Kingdom";
        return location;
    }
}

public sealed class AdzunaClient(IHttpClientFactory clients, IOptions<AdzunaOptions> options)
{
    private readonly AdzunaOptions _options = options.Value;

    public bool Enabled => _options.Enabled && !string.IsNullOrWhiteSpace(_options.AppId) && !string.IsNullOrWhiteSpace(_options.AppKey);

    public async Task<IReadOnlyList<ExternalVacancyDto>> SearchAsync(string query, CancellationToken ct)
    {
        if (!Enabled) return [];
        var list = new List<ExternalVacancyDto>();
        foreach (var country in _options.CountryCodes.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                list.AddRange(await SearchCountryAsync(country, query, ct));
            }
            catch
            {
                // One country feed must never stop the full collection cycle.
            }
        }
        return list;
    }

    private async Task<IReadOnlyList<ExternalVacancyDto>> SearchCountryAsync(string country, string query, CancellationToken ct)
    {
        var client = clients.CreateClient("adzuna");
        var url = $"https://api.adzuna.com/v1/api/jobs/{Uri.EscapeDataString(country)}/search/1" +
                  $"?app_id={Uri.EscapeDataString(_options.AppId)}&app_key={Uri.EscapeDataString(_options.AppKey)}" +
                  $"&results_per_page={Math.Clamp(_options.ResultsPerPage, 1, 50)}&what={Uri.EscapeDataString(query)}&content-type=application/json";
        using var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return [];
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        if (!json.RootElement.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array) return [];

        var list = new List<ExternalVacancyDto>();
        foreach (var job in results.EnumerateArray())
        {
            var id = GetString(job, "id");
            var title = GetString(job, "title");
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(title)) continue;
            var company = job.TryGetProperty("company", out var c) ? GetString(c, "display_name") : "Unknown";
            var location = job.TryGetProperty("location", out var l) ? GetString(l, "display_name") : "";
            var description = GetString(job, "description");
            var redirect = GetString(job, "redirect_url");
            var salary = FormatSalary(job);
            var contract = GetString(job, "contract_time");
            DateTimeOffset? published = null;
            if (DateTimeOffset.TryParse(GetString(job, "created"), out var p)) published = p;
            var remote = ContainsRemote(title + " " + description + " " + location);

            list.Add(new ExternalVacancyDto(
                $"adzuna-{country.ToLowerInvariant()}", $"Adzuna {country.ToUpperInvariant()}", id, title,
                redirect, redirect, Normalize(company), company, description, salary, contract, "",
                remote, CountryName(country), location, remote ? "Remote/verify region" : "On-site/Hybrid", published));
        }
        return list;
    }

    private static string FormatSalary(JsonElement job)
    {
        decimal? minValue = null;
        decimal? maxValue = null;
        if (job.TryGetProperty("salary_min", out var min) && min.TryGetDecimal(out var minParsed)) minValue = minParsed;
        if (job.TryGetProperty("salary_max", out var max) && max.TryGetDecimal(out var maxParsed)) maxValue = maxParsed;
        if (minValue is null && maxValue is null) return "";
        if (minValue is not null && maxValue is not null) return $"{minValue.Value:N0}–{maxValue.Value:N0}";
        return minValue is not null ? $"from {minValue.Value:N0}" : $"to {maxValue!.Value:N0}";
    }

    private static string GetString(JsonElement root, string name)
        => root.TryGetProperty(name, out var x) ? x.ValueKind == JsonValueKind.String ? x.GetString() ?? "" : x.ToString() : "";

    private static string Normalize(string value)
        => string.Concat(value.ToLowerInvariant().Where(char.IsLetterOrDigit));

    private static bool ContainsRemote(string text)
        => text.Contains("remote", StringComparison.OrdinalIgnoreCase) || text.Contains("work from home", StringComparison.OrdinalIgnoreCase);

    private static string CountryName(string code) => code.ToLowerInvariant() switch
    {
        "us" => "United States",
        "gb" => "United Kingdom",
        "de" => "Germany",
        "ca" => "Canada",
        "au" => "Australia",
        "fr" => "France",
        "nl" => "Netherlands",
        "pl" => "Poland",
        _ => code.ToUpperInvariant()
    };
}
