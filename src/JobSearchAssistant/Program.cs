using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddPrivateCandidateConfiguration();

builder.Services.Configure<CandidateProfileOptions>(builder.Configuration.GetSection("Candidate"));
builder.Services.Configure<SearchOptions>(builder.Configuration.GetSection("Search"));
builder.Services.Configure<TelegramOptions>(builder.Configuration.GetSection("Telegram"));
builder.Services.Configure<HhOptions>(builder.Configuration.GetSection("HH"));
builder.Services.Configure<RemotiveOptions>(builder.Configuration.GetSection("Remotive"));
builder.Services.Configure<AdzunaOptions>(builder.Configuration.GetSection("Adzuna"));
builder.Services.Configure<SecurityOptions>(builder.Configuration.GetSection("Security"));
builder.Services.Configure<AutomationOptions>(builder.Configuration.GetSection("Automation"));

var postgresConnection = builder.Configuration.GetConnectionString("Postgres");
DatabaseStorageMode storageMode;
if (!string.IsNullOrWhiteSpace(postgresConnection))
{
    storageMode = DatabaseStorageMode.Postgres;
    builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(postgresConnection));
}
else
{
    storageMode = DatabaseStorageMode.LocalSqlite;
    var sqliteConnection = LocalSqliteDatabase.ResolveConnectionString(builder.Configuration);
    builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(sqliteConnection));
}
builder.Services.AddHttpClient("hh");
builder.Services.AddHttpClient("telegram");
builder.Services.AddHttpClient("remotive");
builder.Services.AddHttpClient("adzuna");
builder.Services.AddSingleton<SecretCipher>();
builder.Services.AddSingleton<MatchScoringService>();
builder.Services.AddSingleton<CandidateKnowledgeService>();
builder.Services.AddSingleton<OpportunityScoringService>();
builder.Services.AddSingleton<EvidenceRetrievalService>();
builder.Services.AddSingleton<ApplicationDraftService>();
builder.Services.AddSingleton<ScreeningReviewService>();
builder.Services.Configure<ReasoningOptions>(builder.Configuration.GetSection("Reasoning"));
builder.Services.AddHttpClient<IAiReasoningProvider, ChatReasoningProvider>().ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddSingleton<ApplicationWritingService>();
builder.Services.AddTransient<OperatorPreparationService>();
builder.Services.AddSingleton<RecruiterMessageService>();
builder.Services.AddSingleton<AutoApplyRunTracker>();
builder.Services.AddSingleton<BrowserAutopilotTracker>();
builder.Services.AddSingleton<ApplicationQuestionService>();
builder.Services.AddSingleton<CandidateProfileReadinessService>();
builder.Services.AddScoped<HhClient>();
builder.Services.AddSingleton<RemotiveClient>();
builder.Services.AddScoped<AdzunaClient>();
builder.Services.AddScoped<JobService>();
builder.Services.AddScoped<TailoredHhApplyService>();
builder.Services.AddScoped<DashboardApplyService>();
builder.Services.AddScoped<BrowserVacancyImportService>();
builder.Services.AddScoped<ApplicationQueueService>();
builder.Services.AddScoped<FollowUpQueueService>();
builder.Services.AddScoped<ApplicationAttributionService>();
builder.Services.AddScoped<OutcomeAnalyticsService>();
builder.Services.AddScoped<StatsService>();
builder.Services.AddSingleton<CollectionCoordinator>();
builder.Services.AddHostedService<CollectionCoordinator>(sp => sp.GetRequiredService<CollectionCoordinator>());
builder.Services.AddHostedService<VacancyCollectorWorker>();
builder.Services.AddHostedService<AutoApplyWorker>();
builder.Services.AddHostedService<TelegramBotWorker>();

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

DatabaseBootstrapResult databaseBootstrap;
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    databaseBootstrap = await DatabaseBootstrapper.InitializeAsync(db, storageMode, app.Logger);
}

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    utc = DateTimeOffset.UtcNow,
    database = LocalSqliteDatabase.Label(storageMode),
    persistent = LocalSqliteDatabase.IsPersistent(storageMode),
    schemaMode = databaseBootstrap.Mode,
    latestMigration = databaseBootstrap.LatestMigration,
    appliedMigrations = databaseBootstrap.AppliedMigrations
}));
app.MapRuntimeHealth(storageMode, databaseBootstrap);
app.MapOperatorEndpoints();
app.MapGet("/api/operator/candidate", (CandidateKnowledgeService knowledge) => Results.Ok(knowledge.Get()));
app.MapPost("/api/operator/assess", (ExtensionAnalyzeRequest request, OpportunityScoringService scoring, EvidenceRetrievalService evidence) =>
{
    var assessment = scoring.Assess(request.Title ?? "", request.Description ?? "", request.Remote,
        request.Experience ?? "", request.Location ?? request.Country ?? "", request.RemoteScope ?? "");
    return Results.Ok(new { assessment, strategy = evidence.Select(assessment) });
});

app.MapGet("/api/candidate", (IOptions<CandidateProfileOptions> options, CandidateProfileReadinessService readiness) =>
{
    var c = options.Value;
    return Results.Ok(new
    {
        c.Name,
        c.RussianName,
        c.GreekName,
        c.Email,
        c.Phone,
        c.LinkedInUrl,
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
        c.EmploymentTypes,
        readiness = readiness.Get()
    });
});

app.MapGet("/api/dashboard", async (AppDbContext db, StatsService stats, CancellationToken ct) =>
{
    var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
    var bestRows = await db.Vacancies.Include(x => x.Company)
        .Where(x => x.Status == VacancyStatus.New && !x.Company.IsBlacklisted)
        .RankedAsync(100, ct);

    var best = bestRows.Select(x => new
    {
        x.Id, x.Title, company = x.Company.Name, companyId = x.Company.Id, x.Url, x.ApplyUrl, x.SalaryText,
        x.Source, x.SourceLabel, x.Country, x.LocationText, x.RemoteScope, x.EligibilityStatus, x.EligibilityReason,
        x.MatchScore, x.MatchLevel, x.MatchedSkills, x.MissingSkills, x.WhyMatch, status = x.Status.ToString(),
        x.HasExistingHhResponse, x.FirstSeenAt,
        market = VacancyClassifier.Market(x), marketLabel = VacancyClassifier.MarketLabel(VacancyClassifier.Market(x)),
        opportunityType = VacancyClassifier.OpportunityType(x), opportunityTypeLabel = VacancyClassifier.TypeLabel(VacancyClassifier.OpportunityType(x))
    }).ToList();

    var pipelineRows = await db.Vacancies.Include(x => x.Company).Include(x => x.Application).Include(x => x.Events)
        .Where(x => x.Status == VacancyStatus.Applied || x.Status == VacancyStatus.HrContact || x.Status == VacancyStatus.HrInterview || x.Status == VacancyStatus.TechInterview || x.Status == VacancyStatus.TestTask || x.Status == VacancyStatus.Rejected || x.Status == VacancyStatus.Offer)
        .RecentAsync(50, ct);
    var pipeline = pipelineRows.Select(x =>
    {
        var latestHhSync = x.Events.Where(e => e.Type.StartsWith(HhNegotiationStatusMapper.EventTypePrefix, StringComparison.Ordinal)).OrderByDescending(e => e.CreatedAt).FirstOrDefault();
        return new
        {
            x.Id, x.Title, company = x.Company.Name, x.Url, status = x.Status.ToString(), x.UpdatedAt, x.FirstSeenAt,
            appliedAt = x.Application?.AppliedAt,
            resume = x.Application?.ResumeExternalId,
            coverLetterIncluded = x.Application != null && !string.IsNullOrWhiteSpace(x.Application.CoverLetter),
            automatic = x.Events.Any(e => e.Type == "AutoApplied"),
            hhHasUpdates = latestHhSync?.Note.Contains("непрочитанное сообщение", StringComparison.OrdinalIgnoreCase) == true,
            latestEvent = x.Events.OrderByDescending(e => e.CreatedAt).Select(e => new { e.Type, e.Note, e.CreatedAt }).FirstOrDefault(),
            market = VacancyClassifier.Market(x), marketLabel = VacancyClassifier.MarketLabel(VacancyClassifier.Market(x)),
            opportunityType = VacancyClassifier.OpportunityType(x), opportunityTypeLabel = VacancyClassifier.TypeLabel(VacancyClassifier.OpportunityType(x))
        };
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

app.MapGet("/api/application-queue", async (int? limit, int? minScore, string? source, bool? automaticOnly, ApplicationQueueService queue, CancellationToken ct)
    => Results.Ok(await queue.GetAsync(limit ?? 20, minScore ?? 65, source, automaticOnly ?? false, ct)));

app.MapGet("/api/followups", async (int? afterBusinessDays, int? limit, int? maxAttempts, FollowUpQueueService followUps, CancellationToken ct)
    => Results.Ok(await followUps.GetAsync(afterBusinessDays ?? 5, limit ?? 30, maxAttempts ?? 2, ct)));

app.MapGet("/api/analytics/outcomes", async (OutcomeAnalyticsService analytics, CancellationToken ct)
    => Results.Ok(await analytics.GetAsync(ct)));

app.MapGet("/api/applications/activity", async (int? limit, AppDbContext db, CancellationToken ct) =>
{
    var rows = await db.Applications.AsNoTracking()
        .Include(x => x.Vacancy).ThenInclude(x => x.Company)
        .Include(x => x.Vacancy).ThenInclude(x => x.Events)
        .ToListAsync(ct);
    var items = rows.OrderByDescending(x => x.AppliedAt).ThenBy(x => x.Id)
        .Take(Math.Clamp(limit ?? 100, 1, 500))
        .Select(x => new
        {
            x.Id,
            x.VacancyId,
            x.Vacancy.Title,
            company = x.Vacancy.Company.Name,
            x.Vacancy.Url,
            source = x.Vacancy.SourceLabel,
            status = x.Vacancy.Status.ToString(),
            x.AppliedAt,
            x.Vacancy.UpdatedAt,
            resume = x.ResumeExternalId,
            coverLetterIncluded = !string.IsNullOrWhiteSpace(x.CoverLetter),
            automatic = x.Vacancy.Events.Any(e => e.Type == "AutoApplied"),
            latestEvent = x.Vacancy.Events.OrderByDescending(e => e.CreatedAt)
                .Select(e => new { e.Type, e.Note, e.CreatedAt }).FirstOrDefault(),
            x.LastError
        });
    return Results.Ok(items);
});

app.MapGet("/api/automation/status", async (AppDbContext db, HhClient hh, JobService jobs, AutoApplyRunTracker runs, BrowserAutopilotTracker browserAutopilot, IOptions<SecurityOptions> security, IOptions<SearchOptions> search, CollectionCoordinator collector, CancellationToken ct) =>
{
    var state = await db.AppStates.AsNoTracking().SingleAsync(x => x.Id == 1, ct);
    var localNow = DateTimeOffset.Now;
    var today = new DateTimeOffset(localNow.Date, localNow.Offset);
    var appliedToday = await db.Applications.CountAppliedSinceAsync(today, ct);
    var autoEvents = await db.ApplicationEvents.AsNoTracking()
        .Where(x => x.Type == "AutoApplied" || x.Type == "AutoApplyFailed")
        .ToListAsync(ct);
    var last = autoEvents.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
    var hhConfigured = hh.IsOAuthConfigured;
    var hhConnected = false;
    try { hhConnected = await hh.IsConnectedAsync(ct); } catch { }
    var allowed = security.Value.EnableAutomaticSubmission;
    var browser = browserAutopilot.Snapshot;
    var apiReady = hhConfigured && hhConnected && !string.IsNullOrWhiteSpace(state.HhResumeId);
    var browserReady = browser.Connected;
    var ready = state.AutoApplyEnabled && allowed && (apiReady || browserReady);
    var diagnostics = await jobs.GetAutoApplyDiagnosticsAsync(state.AutoApplyMinimumScore, ct);
    var latestRun = runs.LastResult;
    return Results.Ok(new
    {
        state.AutoApplyEnabled,
        allowed,
        ready,
        hhConfigured,
        hhConnected,
        resumeSelected = !string.IsNullOrWhiteSpace(state.HhResumeId),
        apiReady,
        browserConnected = browser.Connected,
        browserRunning = browser.Running,
        browserLastSeenAt = browser.LastSeenAt,
        browserLastRunAt = browser.LastRunAt,
        browserVacancyTitle = browser.VacancyTitle,
        automationMode = apiReady ? "hh-api" : browserReady ? "browser-extension" : "setup-required",
        state.AutoApplyMinimumScore,
        state.DailyAutoApplyLimit,
        appliedToday,
        remainingToday = Math.Max(0, state.DailyAutoApplyLimit - appliedToday),
        state.LastCollectedAt,
        lastRunAt = browserReady ? browser.LastRunAt ?? browser.LastSeenAt : latestRun?.CheckedAt ?? last?.CreatedAt,
        lastMessage = browserReady ? browser.LastMessage : latestRun?.Message ?? last?.Note,
        lastResult = latestRun is null
            ? (last is null ? null : new { type = last.Type, message = last.Note, attempted = 0, submitted = 0, failed = 0 })
            : new { type = latestRun.Ready ? "Cycle" : "Setup", message = latestRun.Message, attempted = latestRun.Attempted, submitted = latestRun.Submitted, failed = latestRun.Failed },
        diagnostics,
        browserSearchQueries = search.Value.RussiaQueries,
        remoteOnly = search.Value.RemoteOnly,
        collection = collector.Snapshot
    });
});

app.MapGet("/api/vacancies", async (AppDbContext db, string? status, int? minScore, string? market, string? type, CancellationToken ct) =>
{
    var q = db.Vacancies.Include(x => x.Company).Include(x => x.Events).AsQueryable();
    if (Enum.TryParse<VacancyStatus>(status, true, out var parsed)) q = q.Where(x => x.Status == parsed);
    if (minScore.HasValue) q = q.Where(x => x.MatchScore >= minScore.Value);
    var rows = await q.RecentAsync(300, ct, x =>
        (string.IsNullOrWhiteSpace(market) || VacancyClassifier.Market(x).Equals(market, StringComparison.OrdinalIgnoreCase)) &&
        (string.IsNullOrWhiteSpace(type) || VacancyClassifier.OpportunityType(x).Equals(type, StringComparison.OrdinalIgnoreCase)));

    var items = rows.Select(x => new
    {
        x.Id, x.ExternalId, x.Title, x.Url, x.ApplyUrl, x.Source, x.SourceLabel, x.Country, x.LocationText, x.RemoteScope,
        x.EligibilityStatus, x.EligibilityReason, company = x.Company.Name, companyId = x.Company.Id,
        x.MatchScore, x.MatchLevel, status = x.Status.ToString(), x.SalaryText, x.MatchedSkills, x.MissingSkills,
        x.WhyMatch, x.HasExistingHhResponse, x.PublishedAt, x.FirstSeenAt,
        reviewNote = x.Status == VacancyStatus.Saved ? x.Events.Where(e => e.Type == "Saved").OrderByDescending(e => e.CreatedAt).FirstOrDefault()?.Note : null,
        market = VacancyClassifier.Market(x), marketLabel = VacancyClassifier.MarketLabel(VacancyClassifier.Market(x)),
        opportunityType = VacancyClassifier.OpportunityType(x), opportunityTypeLabel = VacancyClassifier.TypeLabel(VacancyClassifier.OpportunityType(x))
    });
    return Results.Ok(items.ToList());
});

app.MapGet("/api/vacancies/{id:guid}/application-draft", async (Guid id, AppDbContext db, ApplicationDraftService drafts, CancellationToken ct) =>
{
    var vacancy = await db.Vacancies.Include(x => x.Company).SingleOrDefaultAsync(x => x.Id == id, ct);
    return vacancy is null ? Results.NotFound() : Results.Ok(drafts.Build(vacancy));
});

app.MapPost("/api/extension/analyze", (ExtensionAnalyzeRequest request, MatchScoringService scoring, ApplicationDraftService drafts, ScreeningReviewService screening) =>
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
        recommendation = result.Assessment?.Decision ?? "REVIEW",
        screening = result.Assessment is null ? null : screening.Review(result.Assessment),
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

app.MapPost("/api/vacancies/{id:guid}/prepare-dashboard-apply", async (Guid id, DashboardApplyService preparation, CancellationToken ct) =>
{
    var result = await preparation.PrepareAsync(id, ct);
    return result.Ready ? Results.Ok(result) : Results.BadRequest(result);
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

app.MapPost("/api/vacancies/{id:guid}/browser-auto-applied", async (Guid id, BrowserAutoAppliedRequest request, JobService jobs, BrowserAutopilotTracker browserAutopilot, CancellationToken ct) =>
{
    await jobs.MarkBrowserAppliedAsync(id, request.CoverLetter, request.ResumeLabel, true, ct);
    browserAutopilot.RecordResult("Отклик и персональное письмо отправлены через расширение Chrome.", request.VacancyTitle);
    return Results.Ok(new { status = "recorded" });
});

app.MapPost("/api/vacancies/{id:guid}/browser-applied", async (Guid id, BrowserAutoAppliedRequest request, JobService jobs, CancellationToken ct) =>
{
    await jobs.MarkBrowserAppliedAsync(id, request.CoverLetter, request.ResumeLabel, false, ct);
    return Results.Ok(new { status = "recorded" });
});

app.MapPost("/api/browser-autopilot/heartbeat", (BrowserAutopilotHeartbeat request, BrowserAutopilotTracker browserAutopilot) =>
{
    var status = browserAutopilot.Heartbeat(request.Running, request.Message, request.VacancyTitle);
    return Results.Ok(status);
});

app.MapPost("/api/vacancies/{id:guid}/cv-attribution", async (Guid id, string? resumeLabel, ApplicationAttributionService attribution, CancellationToken ct) =>
{
    var recorded = await attribution.RecordExternalCvAsync(id, resumeLabel, ct);
    return recorded
        ? Results.Ok(new { status = "recorded", resumeLabel })
        : Results.BadRequest(new { error = "cv_attribution_not_recorded" });
});

app.MapPost("/api/vacancies/{id:guid}/followup-sent", async (Guid id, FollowUpSentRequest request, FollowUpQueueService followUps, CancellationToken ct) =>
{
    var marked = await followUps.MarkSentAsync(id, request.Note, ct);
    return marked
        ? Results.Ok(new { status = "recorded" })
        : Results.BadRequest(new { error = "followup_not_available", message = "The vacancy must still be in Applied status with an application record." });
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
app.MapPost("/api/settings/autoapply", async (AutoApplyRequest request, AppDbContext db, CollectionCoordinator collector, CancellationToken ct) =>
{
    var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
    state.AutoApplyEnabled = request.Enabled;
    state.AutoApplyMinimumScore = Math.Clamp(request.MinimumScore, 50, 100);
    state.DailyAutoApplyLimit = Math.Clamp(request.DailyLimit, 1, 200);
    await db.SaveChangesAsync(ct);
    if (request.Enabled) collector.Start();
    return Results.Ok(new { state.AutoApplyEnabled, state.AutoApplyMinimumScore, state.DailyAutoApplyLimit, collection = collector.Snapshot });
});

app.MapPost("/api/settings/autoapply/preferences", async (AutoApplyPreferencesRequest request, AppDbContext db, CancellationToken ct) =>
{
    var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
    state.AutoApplyMinimumScore = Math.Clamp(request.MinimumScore, 50, 100);
    state.DailyAutoApplyLimit = Math.Clamp(request.DailyLimit, 1, 200);
    await db.SaveChangesAsync(ct);
    return Results.Ok(new { state.AutoApplyMinimumScore, state.DailyAutoApplyLimit });
});

app.MapPost("/api/automation/run", (CollectionCoordinator collector) => Results.Accepted("/api/automation/status", new { collection = collector.Start() }));
app.MapPost("/api/collect/start", (CollectionCoordinator collector) => Results.Accepted("/api/automation/status", collector.Start()));

app.MapFallbackToFile("index.html");
app.Run();

public sealed record ManualImport(string Url);
public sealed record ManualVacancyImport(string Url, string? Title, string? Company);
public sealed record StatusRequest(string Status, string? Note);
public sealed record FollowUpSentRequest(string? Note);
public sealed record BoolRequest(bool Value);
public sealed record ResumeRequest(string ResumeId);
public sealed record BrowserAutoAppliedRequest(string? CoverLetter, string? ResumeLabel, string? VacancyTitle);
public sealed record BrowserAutopilotHeartbeat(bool Running, string? Message, string? VacancyTitle);
public sealed record AutoApplyRequest(bool Enabled, int MinimumScore, int DailyLimit);
public sealed record AutoApplyPreferencesRequest(int MinimumScore, int DailyLimit);
public sealed record ExtensionAnalyzeRequest(
    string? Title,
    string? Company,
    string? Description,
    string? Country,
    string? Location,
    string? RemoteScope,
    string? Experience,
    string? Source,
    bool Remote = false);
