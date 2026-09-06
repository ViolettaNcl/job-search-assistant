using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<CandidateProfileOptions>(builder.Configuration.GetSection("Candidate"));
builder.Services.Configure<SearchOptions>(builder.Configuration.GetSection("Search"));
builder.Services.Configure<TelegramOptions>(builder.Configuration.GetSection("Telegram"));
builder.Services.Configure<HhOptions>(builder.Configuration.GetSection("HH"));
builder.Services.Configure<RemotiveOptions>(builder.Configuration.GetSection("Remotive"));
builder.Services.Configure<AdzunaOptions>(builder.Configuration.GetSection("Adzuna"));
builder.Services.Configure<SecurityOptions>(builder.Configuration.GetSection("Security"));

var connection = builder.Configuration.GetConnectionString("Postgres");
var persistentDatabase = !string.IsNullOrWhiteSpace(connection);
if (persistentDatabase)
{
    builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connection));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("jobassistant"));
}
builder.Services.AddHttpClient("hh");
builder.Services.AddHttpClient("telegram");
builder.Services.AddHttpClient("remotive");
builder.Services.AddHttpClient("adzuna");
builder.Services.AddSingleton<SecretCipher>();
builder.Services.AddSingleton<MatchScoringService>();
builder.Services.AddSingleton<ApplicationDraftService>();
builder.Services.AddSingleton<ApplicationQuestionService>();
builder.Services.AddScoped<HhClient>();
builder.Services.AddScoped<RemotiveClient>();
builder.Services.AddScoped<AdzunaClient>();
builder.Services.AddScoped<JobService>();
builder.Services.AddScoped<TailoredHhApplyService>();
builder.Services.AddScoped<BrowserVacancyImportService>();
builder.Services.AddScoped<ApplicationQueueService>();
builder.Services.AddScoped<StatsService>();
builder.Services.AddHostedService<VacancyCollectorWorker>();
builder.Services.AddHostedService<TelegramBotWorker>();

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    if (!await db.AppStates.AnyAsync(x => x.Id == 1))
    {
        db.AppStates.Add(new AppState { Id = 1 });
        await db.SaveChangesAsync();
    }
}

app.MapGet("/health", () => Results.Ok(new { status = "ok", utc = DateTimeOffset.UtcNow, database = persistentDatabase ? "postgres" : "in-memory", persistent = persistentDatabase }));

app.MapGet("/api/candidate", (IOptions<CandidateProfileOptions> options) =>
{
    var c = options.Value;
    return Results.Ok(new
    {
        c.Name,
        c.RussianName,
        c.GreekName,
        c.Email,
        c.CurrentCountry,
        c.CurrentCity,
        c.GitHubUrl,
        c.CvUrl,
        c.EnglishCvFileName,
        c.RussianCvFileName,
        c.Education,
        c.MainProjectUrl,
        c.MainProjectSummary,
        c.RussiaWorkAuthorized,
        c.EuWorkAuthorized,
        c.Citizenships,
        c.FluentLanguages,
        c.CoreSkills,
        c.PreferredRoles,
        c.EmploymentTypes
    });
});

app.MapGet("/api/dashboard", async (AppDbContext db, StatsService stats, CancellationToken ct) =>
{
    var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
    var bestRows = await db.Vacancies.Include(x => x.Company)
        .Where(x => x.Status == VacancyStatus.New && !x.Company.IsBlacklisted && x.IsRemote)
        .OrderByDescending(x => x.MatchScore).ThenByDescending(x => x.PublishedAt)
        .Take(100).ToListAsync(ct);

    var best = bestRows.Select(x => new
    {
        x.Id, x.Title, company = x.Company.Name, companyId = x.Company.Id, x.Url, x.ApplyUrl, x.SalaryText,
        x.Source, x.SourceLabel, x.Country, x.LocationText, x.RemoteScope, x.EligibilityStatus, x.EligibilityReason,
        x.MatchScore, x.MatchLevel, x.MatchedSkills, x.MissingSkills, x.WhyMatch, status = x.Status.ToString(),
        x.HasExistingHhResponse, x.FirstSeenAt,
        market = VacancyClassifier.Market(x), marketLabel = VacancyClassifier.MarketLabel(VacancyClassifier.Market(x)),
        opportunityType = VacancyClassifier.OpportunityType(x), opportunityTypeLabel = VacancyClassifier.TypeLabel(VacancyClassifier.OpportunityType(x))
    }).ToList();

    var pipelineRows = await db.Vacancies.Include(x => x.Company)
        .Where(x => x.Status == VacancyStatus.Applied || x.Status == VacancyStatus.HrContact || x.Status == VacancyStatus.HrInterview || x.Status == VacancyStatus.TechInterview || x.Status == VacancyStatus.TestTask || x.Status == VacancyStatus.Offer)
        .OrderByDescending(x => x.UpdatedAt).Take(50).ToListAsync(ct);
    var pipeline = pipelineRows.Select(x => new
    {
        x.Id, x.Title, company = x.Company.Name, x.Url, status = x.Status.ToString(), x.UpdatedAt,
        market = VacancyClassifier.Market(x), marketLabel = VacancyClassifier.MarketLabel(VacancyClassifier.Market(x)),
        opportunityType = VacancyClassifier.OpportunityType(x), opportunityTypeLabel = VacancyClassifier.TypeLabel(VacancyClassifier.OpportunityType(x))
    }).ToList();

    var allRows = await db.Vacancies.AsNoTracking().ToListAsync(ct);
    var segments = new
    {
        russia = allRows.Count(x => VacancyClassifier.Market(x) == VacancyClassifier.MarketRussia),
        international = allRows.Count(x => VacancyClassifier.Market(x) == VacancyClassifier.MarketInternational),
        internships = allRows.Count(x => VacancyClassifier.OpportunityType(x) == VacancyClassifier.TypeInternship),
        fullTime = allRows.Count(x => VacancyClassifier.OpportunityType(x) == VacancyClassifier.TypeFullTime),
        contractor = allRows.Count(x => VacancyClassifier.OpportunityType(x) == VacancyClassifier.TypeContractor),
        freelance = allRows.Count(x => VacancyClassifier.OpportunityType(x) == VacancyClassifier.TypeFreelance)
    };

    return Results.Ok(new
    {
        stats = await stats.GetAsync(ct), segments,
        state = new { state.HhResumeId, state.AutoApplyEnabled, state.AutoApplyMinimumScore, state.DailyAutoApplyLimit, state.LastCollectedAt },
        best, pipeline
    });
});

app.MapGet("/api/application-queue", async (int? limit, int? minScore, ApplicationQueueService queue, CancellationToken ct)
    => Results.Ok(await queue.GetAsync(limit ?? 20, minScore ?? 65, ct)));

app.MapGet("/api/vacancies", async (AppDbContext db, string? status, int? minScore, string? market, string? type, CancellationToken ct) =>
{
    var q = db.Vacancies.Include(x => x.Company).AsQueryable();
    if (Enum.TryParse<VacancyStatus>(status, true, out var parsed)) q = q.Where(x => x.Status == parsed);
    if (minScore.HasValue) q = q.Where(x => x.MatchScore >= minScore.Value);
    q = q.Where(x => x.IsRemote);
    var rows = await q.OrderByDescending(x => x.UpdatedAt).Take(300).ToListAsync(ct);

    var items = rows.Select(x => new
    {
        x.Id, x.ExternalId, x.Title, x.Url, x.ApplyUrl, x.Source, x.SourceLabel, x.Country, x.LocationText, x.RemoteScope,
        x.EligibilityStatus, x.EligibilityReason, company = x.Company.Name, companyId = x.Company.Id,
        x.MatchScore, x.MatchLevel, status = x.Status.ToString(), x.SalaryText, x.MatchedSkills, x.MissingSkills,
        x.WhyMatch, x.HasExistingHhResponse, x.PublishedAt, x.FirstSeenAt,
        market = VacancyClassifier.Market(x), marketLabel = VacancyClassifier.MarketLabel(VacancyClassifier.Market(x)),
        opportunityType = VacancyClassifier.OpportunityType(x), opportunityTypeLabel = VacancyClassifier.TypeLabel(VacancyClassifier.OpportunityType(x))
    });
    if (!string.IsNullOrWhiteSpace(market)) items = items.Where(x => x.market.Equals(market, StringComparison.OrdinalIgnoreCase));
    if (!string.IsNullOrWhiteSpace(type)) items = items.Where(x => x.opportunityType.Equals(type, StringComparison.OrdinalIgnoreCase));
    return Results.Ok(items.ToList());
});

app.MapGet("/api/vacancies/{id:guid}/application-draft", async (Guid id, AppDbContext db, ApplicationDraftService drafts, CancellationToken ct) =>
{
    var vacancy = await db.Vacancies.Include(x => x.Company).SingleOrDefaultAsync(x => x.Id == id, ct);
    return vacancy is null ? Results.NotFound() : Results.Ok(drafts.Build(vacancy));
});

app.MapPost("/api/extension/analyze", (ExtensionAnalyzeRequest request, MatchScoringService scoring, ApplicationDraftService drafts) =>
{
    var result = scoring.Score(
        request.Title ?? "",
        request.Description ?? "",
        request.Remote,
        request.Experience ?? "",
        request.Location ?? request.Country ?? "",
        request.RemoteScope ?? "");

    var draft = drafts.Build(
        request.Title ?? "Unknown role",
        request.Company ?? "the company",
        request.Description ?? "",
        request.Country ?? "",
        request.Source ?? "browser",
        result.Score,
        result.Matched,
        result.Missing);

    return Results.Ok(new
    {
        match = result,
        recommendation = result.Score >= 85 ? "Apply now" : result.Score >= 75 ? "Apply" : result.Score >= 65 ? "Review" : "Skip",
        draft
    });
});

app.MapPost("/api/extension/resolve-fields", (ResolveApplicationFieldsRequest request, ApplicationQuestionService questions)
    => Results.Ok(questions.Resolve(request)));

app.MapPost("/api/collect", async (JobService jobs, IOptions<SearchOptions> options, CancellationToken ct)
    => Results.Ok(await jobs.CollectAsync(options.Value, ct)));

app.MapPost("/api/import/hh", async (ManualImport request, JobService jobs, CancellationToken ct) =>
{
    var vacancy = await jobs.ImportHhUrlAsync(request.Url, ct);
    return vacancy is null ? Results.NotFound() : Results.Ok(new { vacancy.Id, vacancy.Title, vacancy.MatchScore, vacancy.MatchLevel });
});

app.MapPost("/api/import/browser", async (BrowserVacancyImportRequest request, BrowserVacancyImportService imports, CancellationToken ct) =>
{
    try
    {
        var vacancy = await imports.ImportAsync(request, ct);
        return Results.Ok(new
        {
            vacancy.Id,
            vacancy.Title,
            vacancy.Source,
            vacancy.MatchScore,
            vacancy.MatchLevel,
            vacancy.EligibilityStatus,
            vacancy.EligibilityReason
        });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = "invalid_url", message = ex.Message });
    }
});

app.MapPost("/api/import/manual", async (ManualVacancyImport request, JobService jobs, CancellationToken ct) =>
{
    var vacancy = await jobs.ImportManualAsync(request.Url, request.Title, request.Company, ct);
    return Results.Ok(new { vacancy.Id, vacancy.Title, vacancy.Source });
});

app.MapPost("/api/vacancies/{id:guid}/status", async (Guid id, StatusRequest request, JobService jobs, CancellationToken ct) =>
{
    if (!Enum.TryParse<VacancyStatus>(request.Status, true, out var status)) return Results.BadRequest(new { error = "invalid_status" });
    await jobs.SetStatusAsync(id, status, request.Note ?? "Dashboard update", ct);
    return Results.Ok();
});

app.MapPost("/api/vacancies/{id:guid}/apply", async (Guid id, JobService jobs, CancellationToken ct) =>
{
    var result = await jobs.ApplyAsync(id, ct);
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
});

app.MapPost("/api/vacancies/{id:guid}/apply-tailored", async (Guid id, TailoredHhApplyService apply, CancellationToken ct) =>
{
    var result = await apply.ApplyAsync(id, ct);
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
});

app.MapPost("/api/vacancies/{id:guid}/mark-applied", async (Guid id, JobService jobs, CancellationToken ct) =>
{
    await jobs.MarkExternalAppliedAsync(id, ct);
    return Results.Ok();
});

app.MapPost("/api/companies/{id:guid}/blacklist", async (Guid id, BoolRequest request, JobService jobs, CancellationToken ct) =>
{
    await jobs.SetCompanyFlagAsync(id, request.Value, null, ct); return Results.Ok();
});
app.MapPost("/api/companies/{id:guid}/watch", async (Guid id, BoolRequest request, JobService jobs, CancellationToken ct) =>
{
    await jobs.SetCompanyFlagAsync(id, null, request.Value, ct); return Results.Ok();
});

app.MapGet("/api/hh/oauth/start", async (HhClient hh, CancellationToken ct) => Results.Redirect(await hh.BeginOAuthAsync(ct)));
app.MapGet("/api/hh/oauth/callback", async (string? code, string? state, string? error, HhClient hh, CancellationToken ct) =>
{
    if (!string.IsNullOrWhiteSpace(error)) return Results.Content($"HH authorization denied: {System.Net.WebUtility.HtmlEncode(error)}", "text/html");
    if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state)) return Results.BadRequest("Missing code/state");
    await hh.ExchangeCodeAsync(code, state, ct);
    return Results.Content("<h2>HH подключён ✅</h2><p>Можно закрыть вкладку и вернуться в Job Assistant.</p><a href='/'>Dashboard</a>", "text/html");
});

app.MapGet("/api/hh/resumes", async (HhClient hh, CancellationToken ct) => Results.Ok(await hh.GetResumesAsync(ct)));
app.MapPost("/api/settings/resume", async (ResumeRequest request, AppDbContext db, CancellationToken ct) =>
{
    var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct); state.HhResumeId = request.ResumeId; await db.SaveChangesAsync(ct); return Results.Ok();
});
app.MapPost("/api/settings/autoapply", async (AutoApplyRequest request, AppDbContext db, CancellationToken ct) =>
{
    var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
    state.AutoApplyEnabled = request.Enabled;
    state.AutoApplyMinimumScore = Math.Clamp(request.MinimumScore, 90, 100);
    state.DailyAutoApplyLimit = Math.Clamp(request.DailyLimit, 1, 10);
    await db.SaveChangesAsync(ct);
    return Results.Ok(new { state.AutoApplyEnabled, state.AutoApplyMinimumScore, state.DailyAutoApplyLimit });
});

app.MapFallbackToFile("index.html");
app.Run();

public sealed record ManualImport(string Url);
public sealed record ManualVacancyImport(string Url, string? Title, string? Company);
public sealed record StatusRequest(string Status, string? Note);
public sealed record BoolRequest(bool Value);
public sealed record ResumeRequest(string ResumeId);
public sealed record AutoApplyRequest(bool Enabled, int MinimumScore, int DailyLimit);
public sealed record ExtensionAnalyzeRequest(
    string? Title,
    string? Company,
    string? Description,
    string? Country,
    string? Location,
    string? RemoteScope,
    string? Experience,
    string? Source,
    bool Remote = true);
