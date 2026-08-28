using System.Security.Cryptography;
using System.Text;
using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record CollectResult(
    int Found,
    int Added,
    int Strong,
    int AppliedImported,
    int HhFound,
    int RemotiveFound,
    int AdzunaFound);

public sealed class JobService(
    AppDbContext db,
    HhClient hh,
    RemotiveClient remotive,
    AdzunaClient adzuna,
    MatchScoringService scoring,
    IOptions<CandidateProfileOptions> candidate,
    IOptions<SecurityOptions> security,
    IOptions<HhOptions> hhOptions)
{
    public async Task<CollectResult> CollectAsync(SearchOptions options, CancellationToken ct)
    {
        var added = 0;
        var strong = 0;
        var hhFound = 0;
        var remotiveFound = 0;
        var adzunaFound = 0;
        var remaining = Math.Max(1, options.MaxNewVacanciesPerRun);

        if (hhOptions.Value.Enabled && remaining > 0)
        {
            var ids = new HashSet<string>();
            foreach (var query in options.RussiaQueries)
            {
                foreach (var exp in new[] { "noExperience", "between1And3" })
                {
                    try
                    {
                        foreach (var id in await hh.SearchIdsAsync(query, exp, ct)) ids.Add(id);
                    }
                    catch { }
                }
            }
            hhFound = ids.Count;
            var existingIds = await db.Vacancies.Where(x => x.Source == "hh").Select(x => x.ExternalId).ToHashSetAsync(ct);
            // Reserve at least half of each collection cycle for international sources.
            var hhBudget = Math.Min(remaining, Math.Max(10, options.MaxNewVacanciesPerRun / 2));
            foreach (var id in ids.Where(id => !existingIds.Contains(id)).Take(hhBudget))
            {
                var dto = await hh.GetVacancyAsync(id, ct);
                if (dto is null) continue;
                var vacancy = await AddExternalAsync(new ExternalVacancyDto(
                    "hh", "HeadHunter", dto.Id, dto.Title, dto.Url, dto.Url, dto.EmployerId, dto.EmployerName,
                    dto.Description, dto.Salary, dto.Schedule, dto.Experience, dto.Remote, "Russia", "Россия", dto.Remote ? "Remote Russia" : dto.Schedule, dto.PublishedAt),
                    dto.GotResponse, ct);
                if (vacancy is null) continue;
                added++;
                if (vacancy.MatchScore >= 85) strong++;
                remaining--;
                hhBudget--;
                if (remaining <= 0 || hhBudget <= 0) break;
            }
        }

        if (remotive.Enabled && remaining > 0)
        {
            var feed = new Dictionary<string, ExternalVacancyDto>(StringComparer.OrdinalIgnoreCase);
            try
            {
                foreach (var item in await remotive.GetSoftwareJobsAsync(ct))
                {
                    if (!LooksLikeDotNet(item)) continue;
                    feed[$"{item.Source}:{item.ExternalId}"] = item;
                }
            }
            catch { }
            remotiveFound = feed.Count;
            var remotiveBudget = adzuna.Enabled ? Math.Max(1, remaining / 2) : remaining;
            foreach (var item in feed.Values.OrderByDescending(x => x.PublishedAt).Take(remotiveBudget * 2))
            {
                if (!ShouldConsider(item, options)) continue;
                var vacancy = await AddExternalAsync(item, false, ct);
                if (vacancy is null) continue;
                added++;
                if (vacancy.MatchScore >= 85) strong++;
                remaining--;
                remotiveBudget--;
                if (remaining <= 0 || remotiveBudget <= 0) break;
            }
        }

        if (adzuna.Enabled && remaining > 0)
        {
            var feed = new Dictionary<string, ExternalVacancyDto>(StringComparer.OrdinalIgnoreCase);
            foreach (var query in options.InternationalQueries)
            {
                try
                {
                    foreach (var item in await adzuna.SearchAsync(query, ct)) feed[$"{item.Source}:{item.ExternalId}"] = item;
                }
                catch { }
            }
            adzunaFound = feed.Count;
            foreach (var item in feed.Values.OrderByDescending(x => x.PublishedAt).Take(remaining * 3))
            {
                if (!ShouldConsider(item, options)) continue;
                var vacancy = await AddExternalAsync(item, false, ct);
                if (vacancy is null) continue;
                added++;
                if (vacancy.MatchScore >= 85) strong++;
                remaining--;
                if (remaining <= 0) break;
            }
        }

        var state = await GetStateAsync(ct);
        state.LastCollectedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        var imported = await SyncExistingApplicationsAsync(ct);

        if (state.AutoApplyEnabled && security.Value.EnableAutomaticSubmission)
            await RunConservativeAutoApplyAsync(state, ct);

        return new CollectResult(hhFound + remotiveFound + adzunaFound, added, strong, imported, hhFound, remotiveFound, adzunaFound);
    }

    private async Task<Vacancy?> AddExternalAsync(ExternalVacancyDto dto, bool existingHhResponse, CancellationToken ct)
    {
        if (await db.Vacancies.AnyAsync(x => x.Source == dto.Source && x.ExternalId == dto.ExternalId, ct)) return null;

        var fingerprint = CreateFingerprint(dto.CompanyName, dto.Title, dto.Location);
        if (!string.IsNullOrWhiteSpace(fingerprint) && await db.Vacancies.AnyAsync(x => x.CanonicalFingerprint == fingerprint, ct))
            return null; // same vacancy discovered through another aggregator/source

        var company = await GetOrCreateCompanyAsync(dto.CompanyName, dto.CompanyId, ct);
        if (company.IsBlacklisted) return null;

        var match = scoring.Score(dto.Title, dto.Description, dto.Remote, dto.Experience, dto.Location, dto.RemoteScope);
        var vacancy = new Vacancy
        {
            Source = dto.Source,
            SourceLabel = dto.SourceLabel,
            ExternalId = dto.ExternalId,
            CanonicalFingerprint = fingerprint,
            Title = dto.Title,
            Url = dto.Url,
            ApplyUrl = string.IsNullOrWhiteSpace(dto.ApplyUrl) ? dto.Url : dto.ApplyUrl,
            DescriptionText = dto.Description,
            SalaryText = dto.Salary,
            Schedule = dto.Schedule,
            Experience = dto.Experience,
            Country = dto.Country,
            LocationText = dto.Location,
            RemoteScope = dto.RemoteScope,
            PublishedAt = dto.PublishedAt,
            CompanyId = company.Id,
            Company = company,
            MatchScore = match.Score,
            MatchLevel = match.Level,
            MatchedSkills = string.Join(", ", match.Matched),
            MissingSkills = string.Join(", ", match.Missing),
            WhyMatch = match.Why,
            EligibilityStatus = match.EligibilityStatus,
            EligibilityReason = match.EligibilityReason,
            IsRemote = dto.Remote,
            HasExistingHhResponse = existingHhResponse,
            Status = existingHhResponse ? VacancyStatus.Applied : VacancyStatus.New
        };
        db.Vacancies.Add(vacancy);
        if (existingHhResponse)
        {
            db.Applications.Add(new Application { Vacancy = vacancy, VacancyId = vacancy.Id, ResumeExternalId = "imported-hh" });
            db.ApplicationEvents.Add(new ApplicationEvent { Vacancy = vacancy, VacancyId = vacancy.Id, Type = "Applied", Note = "Imported from HH vacancy relation" });
        }
        await db.SaveChangesAsync(ct);
        return vacancy;
    }

    public async Task<Vacancy?> ImportHhUrlAsync(string url, CancellationToken ct)
    {
        var id = ExtractHhVacancyId(url);
        if (id is null) return null;
        var existing = await db.Vacancies.Include(x => x.Company).SingleOrDefaultAsync(x => x.Source == "hh" && x.ExternalId == id, ct);
        if (existing is not null) return existing;
        var dto = await hh.GetVacancyAsync(id, ct);
        if (dto is null) return null;
        return await AddExternalAsync(new ExternalVacancyDto(
            "hh", "HeadHunter", dto.Id, dto.Title, dto.Url, dto.Url, dto.EmployerId, dto.EmployerName,
            dto.Description, dto.Salary, dto.Schedule, dto.Experience, dto.Remote, "Russia", "Россия", dto.Remote ? "Remote Russia" : dto.Schedule, dto.PublishedAt),
            dto.GotResponse, ct);
    }

    public async Task<Vacancy> ImportManualAsync(string url, string? title, string? companyName, CancellationToken ct)
    {
        var uri = new Uri(url);
        var source = uri.Host.Replace("www.", "", StringComparison.OrdinalIgnoreCase).ToLowerInvariant();
        var externalId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(url))).ToLowerInvariant();
        var existing = await db.Vacancies.Include(x => x.Company)
            .SingleOrDefaultAsync(x => x.Source == source && x.ExternalId == externalId, ct);
        if (existing is not null) return existing;

        var company = await GetOrCreateCompanyAsync(companyName ?? uri.Host, companyName ?? uri.Host, ct);
        var displayTitle = string.IsNullOrWhiteSpace(title) ? $"Manual vacancy — {uri.Host}" : title.Trim();
        var match = scoring.Score(displayTitle, "", true, "", "", "Verify on source site");
        var vacancy = new Vacancy
        {
            Source = source,
            SourceLabel = uri.Host,
            ExternalId = externalId,
            CanonicalFingerprint = CreateFingerprint(company.Name, displayTitle, ""),
            Title = displayTitle,
            Url = url,
            ApplyUrl = url,
            Company = company,
            CompanyId = company.Id,
            MatchScore = match.Score,
            MatchLevel = match.Level,
            MatchedSkills = string.Join(", ", match.Matched),
            MissingSkills = string.Join(", ", match.Missing),
            WhyMatch = "Добавлено вручную. Откройте вакансию для проверки требований.",
            EligibilityStatus = "Verify",
            EligibilityReason = "Проверьте страну найма, work authorization и visa/relocation условия на исходном сайте."
        };
        db.Vacancies.Add(vacancy);
        await db.SaveChangesAsync(ct);
        return vacancy;
    }

    public async Task<int> SyncExistingApplicationsAsync(CancellationToken ct)
    {
        if (!await hh.HasOAuthAsync(ct)) return 0;
        IReadOnlyList<string> ids;
        try { ids = await hh.GetAppliedVacancyIdsAsync(ct); }
        catch { return 0; }

        var imported = 0;
        foreach (var externalId in ids)
        {
            var vacancy = await db.Vacancies.Include(x => x.Application).SingleOrDefaultAsync(x => x.Source == "hh" && x.ExternalId == externalId, ct);
            if (vacancy is null)
            {
                vacancy = await ImportHhUrlAsync($"https://hh.ru/vacancy/{externalId}", ct);
                if (vacancy is null) continue;
            }
            if (vacancy.Application is not null) continue;
            vacancy.Status = VacancyStatus.Applied;
            vacancy.HasExistingHhResponse = true;
            db.Applications.Add(new Application { VacancyId = vacancy.Id, ResumeExternalId = "imported-hh", AppliedAt = DateTimeOffset.UtcNow });
            db.ApplicationEvents.Add(new ApplicationEvent { VacancyId = vacancy.Id, Type = "Applied", Note = "Imported from HH negotiations" });
            imported++;
        }
        await db.SaveChangesAsync(ct);
        return imported;
    }

    public async Task<HhApplyResult> ApplyAsync(Guid vacancyId, CancellationToken ct)
    {
        var vacancy = await db.Vacancies.Include(x => x.Application).Include(x => x.Company).SingleAsync(x => x.Id == vacancyId, ct);
        if (vacancy.Company.IsBlacklisted) return new HhApplyResult(false, "blacklisted", "Company is blacklisted.");
        if (vacancy.Application is not null || vacancy.HasExistingHhResponse || vacancy.Status == VacancyStatus.Applied)
            return new HhApplyResult(false, "already_applied_local", "This vacancy is already marked as applied.");
        if (vacancy.Source != "hh") return new HhApplyResult(false, "external_apply_required", "Open the official application page, submit there, then mark the vacancy as applied in Job Assistant.");

        var state = await GetStateAsync(ct);
        if (string.IsNullOrWhiteSpace(state.HhResumeId)) return new HhApplyResult(false, "resume_not_selected", "Select an HH resume first.");

        var letter = BuildCoverLetter(vacancy);
        var result = await hh.ApplyAsync(vacancy.ExternalId, state.HhResumeId, letter, ct);
        if (!result.Success)
        {
            if (result.ErrorCode == "already_applied")
            {
                vacancy.Status = VacancyStatus.Applied;
                vacancy.HasExistingHhResponse = true;
                if (vacancy.Application is null)
                    db.Applications.Add(new Application { VacancyId = vacancy.Id, ResumeExternalId = state.HhResumeId, CoverLetter = letter, LastError = result.ErrorText });
                await db.SaveChangesAsync(ct);
            }
            return result;
        }

        vacancy.Status = VacancyStatus.Applied;
        vacancy.HasExistingHhResponse = true;
        db.Applications.Add(new Application { VacancyId = vacancy.Id, ResumeExternalId = state.HhResumeId, CoverLetter = letter });
        db.ApplicationEvents.Add(new ApplicationEvent { VacancyId = vacancy.Id, Type = "Applied", Note = "Submitted via HH API" });
        await db.SaveChangesAsync(ct);
        return result;
    }

    public async Task MarkExternalAppliedAsync(Guid vacancyId, CancellationToken ct)
    {
        var vacancy = await db.Vacancies.Include(x => x.Application).SingleAsync(x => x.Id == vacancyId, ct);
        vacancy.Status = VacancyStatus.Applied;
        vacancy.UpdatedAt = DateTimeOffset.UtcNow;
        if (vacancy.Application is null)
            db.Applications.Add(new Application { VacancyId = vacancy.Id, ResumeExternalId = "external/manual", AppliedAt = DateTimeOffset.UtcNow });
        db.ApplicationEvents.Add(new ApplicationEvent { VacancyId = vacancy.Id, Type = "Applied", Note = $"Marked applied on external source: {vacancy.SourceLabel}" });
        await db.SaveChangesAsync(ct);
    }

    public async Task SetStatusAsync(Guid vacancyId, VacancyStatus status, string note, CancellationToken ct)
    {
        var vacancy = await db.Vacancies.Include(x => x.Application).SingleAsync(x => x.Id == vacancyId, ct);
        vacancy.Status = status;
        vacancy.UpdatedAt = DateTimeOffset.UtcNow;
        if (status == VacancyStatus.Applied && vacancy.Application is null)
            db.Applications.Add(new Application { VacancyId = vacancyId, ResumeExternalId = "manual", AppliedAt = DateTimeOffset.UtcNow });
        db.ApplicationEvents.Add(new ApplicationEvent { VacancyId = vacancyId, Type = status.ToString(), Note = note });
        await db.SaveChangesAsync(ct);
    }

    public async Task SetCompanyFlagAsync(Guid companyId, bool? blacklist, bool? watch, CancellationToken ct)
    {
        var company = await db.Companies.SingleAsync(x => x.Id == companyId, ct);
        if (blacklist.HasValue) company.IsBlacklisted = blacklist.Value;
        if (watch.HasValue) company.IsWatched = watch.Value;
        await db.SaveChangesAsync(ct);
    }

    public string BuildCoverLetter(Vacancy vacancy)
    {
        var profile = candidate.Value;
        var strongest = vacancy.MatchedSkills.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(5);
        return $"Здравствуйте! Меня заинтересовала вакансия «{vacancy.Title}». " +
               $"Мой основной стек — C#/.NET, ASP.NET Core, EF Core, SQL и REST API; по вакансии особенно совпадают: {string.Join(", ", strongest)}. " +
               "В портфолио есть full-stack DentalClinic для реальной стоматологической практики и другие законченные проекты с тестами и CI. " +
               $"GitHub: {profile.GitHubUrl}  CV/Portfolio: {profile.CvUrl}. Буду рада обсудить задачи команды.";
    }

    private async Task RunConservativeAutoApplyAsync(AppState state, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(state.HhResumeId)) return;
        var today = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);
        var alreadyToday = await db.Applications.CountAsync(x => x.AppliedAt >= today, ct);
        var available = Math.Max(0, state.DailyAutoApplyLimit - alreadyToday);
        if (available == 0) return;

        var candidates = await db.Vacancies.Include(x => x.Company).Include(x => x.Application)
            .Where(x => x.Source == "hh" && x.Status == VacancyStatus.New && x.Application == null && !x.Company.IsBlacklisted && x.MatchScore >= state.AutoApplyMinimumScore)
            .OrderByDescending(x => x.MatchScore).ThenByDescending(x => x.PublishedAt)
            .Take(available).ToListAsync(ct);

        foreach (var vacancy in candidates)
        {
            var title = vacancy.Title.ToLowerInvariant();
            if (title.Contains("senior") || title.Contains("lead") || title.Contains("ведущ")) continue;
            await ApplyAsync(vacancy.Id, ct);
        }
    }

    private async Task<Company> GetOrCreateCompanyAsync(string name, string externalHint, CancellationToken ct)
    {
        var cleanName = string.IsNullOrWhiteSpace(name) ? "Unknown" : name.Trim();
        var key = NormalizeCompany(cleanName);
        if (string.IsNullOrWhiteSpace(key)) key = NormalizeCompany(externalHint);
        if (string.IsNullOrWhiteSpace(key)) key = "unknown";
        var company = await db.Companies.SingleOrDefaultAsync(x => x.Source == "global" && x.ExternalId == key, ct);
        if (company is not null) return company;
        company = new Company { Source = "global", ExternalId = key, Name = cleanName };
        db.Companies.Add(company);
        return company;
    }

    private async Task<AppState> GetStateAsync(CancellationToken ct)
        => await db.AppStates.SingleAsync(x => x.Id == 1, ct);

    private static string NormalizeCompany(string value)
        => string.Concat(value.ToLowerInvariant().Where(char.IsLetterOrDigit));

    private static string CreateFingerprint(string company, string title, string location)
    {
        var input = $"{NormalizeCompany(company)}|{NormalizeCompany(title)}|{NormalizeCompany(location)}";
        if (input.Replace("|", "").Length == 0) return "";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
    }

    private static bool LooksLikeDotNet(ExternalVacancyDto dto)
    {
        var text = $"{dto.Title} {dto.Description}";
        return text.Contains("C#", StringComparison.OrdinalIgnoreCase) ||
               text.Contains(".NET", StringComparison.OrdinalIgnoreCase) ||
               text.Contains("dotnet", StringComparison.OrdinalIgnoreCase) ||
               text.Contains("ASP.NET", StringComparison.OrdinalIgnoreCase);
    }
    private static bool ShouldConsider(ExternalVacancyDto dto, SearchOptions options)
    {
        // The product is intentionally Remote Only. On-site and hybrid roles are not collected.
        if (!options.RemoteOnly) return true;
        return dto.Remote;
    }
    public static string? ExtractHhVacancyId(string text)
    {
        var match = System.Text.RegularExpressions.Regex.Match(text, @"(?:hh\.ru|headhunter\.[a-z.]+)/vacancy/(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }
}
