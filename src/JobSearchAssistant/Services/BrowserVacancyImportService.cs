using System.Security.Cryptography;
using System.Text;
using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Services;

public sealed record BrowserVacancyImportRequest(
    string Url,
    string? Title,
    string? Company,
    string? Description,
    string? Country,
    string? Location,
    string? RemoteScope,
    string? Experience,
    string? Source,
    bool Remote = true);

public sealed class BrowserVacancyImportService(AppDbContext db, MatchScoringService scoring)
{
    public async Task<Vacancy> ImportAsync(BrowserVacancyImportRequest request, CancellationToken ct)
    {
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new ArgumentException("A valid HTTP/HTTPS vacancy URL is required.", nameof(request));

        var source = string.IsNullOrWhiteSpace(request.Source)
            ? uri.Host.Replace("www.", "", StringComparison.OrdinalIgnoreCase).ToLowerInvariant()
            : request.Source.Trim().ToLowerInvariant();
        var externalId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Url))).ToLowerInvariant();

        // Browser and API imports share the HH vacancy identity, independent of tracking parameters/subdomain.
        if (uri.Host.Equals("hh.ru", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith(".hh.ru", StringComparison.OrdinalIgnoreCase))
        {
            var id = System.Text.RegularExpressions.Regex.Match(uri.AbsolutePath, @"^/vacancy/(\d+)/?$");
            if (!id.Success) throw new ArgumentException("HH import requires a vacancy page.");
            source = "hh";
            externalId = id.Groups[1].Value;
        }
        else if (source == "hh") throw new ArgumentException("HH source requires an HH vacancy URL.");

        var companyName = Clean(request.Company, uri.Host);
        var title = Clean(request.Title, $"Vacancy — {uri.Host}");
        var description = request.Description?.Trim() ?? "";
        var country = request.Country?.Trim() ?? "";
        var location = request.Location?.Trim() ?? "";
        var remoteScope = request.RemoteScope?.Trim() ?? (request.Remote ? "Remote detected in browser" : "");
        var experience = request.Experience?.Trim() ?? "";
        var match = scoring.Score(title, description, request.Remote, experience, location.Length > 0 ? location : country, remoteScope);

        var company = await GetOrCreateCompanyAsync(companyName, ct);
        var existing = await db.Vacancies.Include(x => x.Company)
            .SingleOrDefaultAsync(x => x.Source == source && x.ExternalId == externalId, ct);

        if (existing is null)
        {
            existing = new Vacancy
            {
                Source = source,
                SourceLabel = uri.Host,
                ExternalId = externalId,
                Url = request.Url,
                ApplyUrl = request.Url,
                FirstSeenAt = DateTimeOffset.UtcNow,
                Status = VacancyStatus.New
            };
            db.Vacancies.Add(existing);
        }

        existing.Company = company;
        existing.CompanyId = company.Id;
        existing.CanonicalFingerprint = CreateFingerprint(company.Name, title, location);
        existing.Title = title;
        existing.Url = request.Url;
        existing.ApplyUrl = request.Url;
        existing.DescriptionText = description;
        existing.Country = country;
        existing.LocationText = location;
        existing.RemoteScope = remoteScope;
        existing.Experience = experience;
        existing.IsRemote = request.Remote;
        existing.MatchScore = match.Score;
        existing.MatchLevel = match.Level;
        existing.MatchedSkills = string.Join(", ", match.Matched);
        existing.MissingSkills = string.Join(", ", match.Missing);
        existing.WhyMatch = match.Why;
        existing.EligibilityStatus = match.EligibilityStatus;
        existing.EligibilityReason = match.EligibilityReason;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return existing;
    }

    private async Task<Company> GetOrCreateCompanyAsync(string name, CancellationToken ct)
    {
        var key = Normalize(name);
        if (string.IsNullOrWhiteSpace(key)) key = "unknown";
        var company = await db.Companies.SingleOrDefaultAsync(x => x.Source == "global" && x.ExternalId == key, ct);
        if (company is not null) return company;

        company = new Company { Source = "global", ExternalId = key, Name = name };
        db.Companies.Add(company);
        return company;
    }

    private static string CreateFingerprint(string company, string title, string location)
    {
        var input = $"{Normalize(company)}|{Normalize(title)}|{Normalize(location)}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
    }

    private static string Normalize(string value)
        => string.Concat((value ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit));

    private static string Clean(string? value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
}
