using System.Text;
using System.Text.Json;
using System.Net.Http.Json;
using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed class TelegramBotWorker(
    IServiceScopeFactory scopeFactory,
    IHttpClientFactory clients,
    IOptions<TelegramOptions> options,
    IOptions<SearchOptions> searchOptions,
    ILogger<TelegramBotWorker> logger) : BackgroundService
{
    private readonly TelegramOptions _options = options.Value;
    private long _offset;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(_options.BotToken))
        {
            logger.LogWarning("Telegram bot disabled: Telegram:BotToken is empty.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var json = await CallAsync("getUpdates", new { offset = _offset, timeout = 25, allowed_updates = new[] { "message", "callback_query" } }, stoppingToken);
                if (!json.RootElement.GetProperty("ok").GetBoolean()) continue;
                foreach (var update in json.RootElement.GetProperty("result").EnumerateArray())
                {
                    _offset = Math.Max(_offset, update.GetProperty("update_id").GetInt64() + 1);
                    await HandleUpdateAsync(update, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Telegram polling error");
                await Task.Delay(3000, stoppingToken);
            }
        }
    }

    private async Task HandleUpdateAsync(JsonElement update, CancellationToken ct)
    {
        if (update.TryGetProperty("message", out var message))
        {
            var chatId = message.GetProperty("chat").GetProperty("id").GetInt64();
            var text = message.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "";
            if (_options.AllowedChatId == 0)
            {
                if (text.StartsWith("/start", StringComparison.OrdinalIgnoreCase))
                    await SendAsync(chatId, $"Ваш Telegram chat id: <code>{chatId}</code>\nУкажите его в TELEGRAM_ALLOWED_CHAT_ID и перезапустите приложение.", null, ct);
                return;
            }
            if (chatId != _options.AllowedChatId) return;
            await HandleMessageAsync(chatId, text, ct);
        }
        else if (update.TryGetProperty("callback_query", out var callback))
        {
            var chatId = callback.GetProperty("message").GetProperty("chat").GetProperty("id").GetInt64();
            if (chatId != _options.AllowedChatId) return;
            var id = callback.GetProperty("id").GetString() ?? "";
            var data = callback.TryGetProperty("data", out var d) ? d.GetString() ?? "" : "";
            await HandleCallbackAsync(chatId, id, data, ct);
        }
    }

    private async Task HandleMessageAsync(long chatId, string text, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var jobs = scope.ServiceProvider.GetRequiredService<JobService>();
        var stats = scope.ServiceProvider.GetRequiredService<StatsService>();
        var hh = scope.ServiceProvider.GetRequiredService<HhClient>();

        if (text.StartsWith("/start"))
        {
            await SendAsync(chatId, "<b>Violetta Job Assistant</b>\n🌐 Только удалённая работа\n\n/today — новые\n/best — лучшие совпадения\n/russia — вакансии РФ\n/world — международные\n/internships — удалённые стажировки\n/applied — отклики\n/interviews — интервью\n/stats — статистика\n/sources — источники\n/resumes — HH резюме\n/sync — синхронизация HH\n\nМожно прислать ссылку hh.ru/vacancy/... или ссылку с другой площадки", null, ct);
            return;
        }
        if (text.StartsWith("/stats"))
        {
            var s = JsonSerializer.Serialize(await stats.GetAsync(ct));
            using var j = JsonDocument.Parse(s);
            var r = j.RootElement;
            await SendAsync(chatId,
                $"<b>Статистика</b>\nВакансий: {r.GetProperty("vacancies")}\nStrong Match: {r.GetProperty("strong")}\nОткликов: {r.GetProperty("applied")}\nОтветов: {r.GetProperty("responses")}\nИнтервью: {r.GetProperty("interviews")}\nTech: {r.GetProperty("technicalInterviews")}\nТестовых: {r.GetProperty("testTasks")}\nОтказов: {r.GetProperty("rejected")}\nОфферов: {r.GetProperty("offers")}\nОтклик→ответ: {r.GetProperty("responseRate")}%", null, ct);
            return;
        }
        if (text.StartsWith("/sync"))
        {
            var imported = await jobs.SyncExistingApplicationsAsync(ct);
            await SendAsync(chatId, $"Синхронизация завершена. Новых ранее сделанных откликов импортировано: {imported}.", null, ct);
            return;
        }
        if (text.StartsWith("/resumes"))
        {
            try
            {
                var resumes = await hh.GetResumesAsync(ct);
                var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
                var body = new StringBuilder("<b>HH резюме</b>\n");
                foreach (var r in resumes) body.AppendLine($"<code>{r.Id}</code> — {Esc(r.Title)}{(r.Id == state.HhResumeId ? " ✅" : "")}");
                body.AppendLine("\nВыбрать: /setresume ID");
                await SendAsync(chatId, body.ToString(), null, ct);
            }
            catch (Exception ex) { await SendAsync(chatId, $"HH OAuth не подключён или произошла ошибка: {Esc(ex.Message)}", null, ct); }
            return;
        }
        if (text.StartsWith("/setresume "))
        {
            var id = text[11..].Trim();
            var state = await db.AppStates.SingleAsync(x => x.Id == 1, ct);
            state.HhResumeId = id;
            await db.SaveChangesAsync(ct);
            await SendAsync(chatId, $"HH resume id сохранён: <code>{Esc(id)}</code>", null, ct);
            return;
        }
        if (text.StartsWith("/today") || text.StartsWith("/best"))
        {
            var q = db.Vacancies.Include(x => x.Company).Where(x => x.Status == VacancyStatus.New && !x.Company.IsBlacklisted);
            if (text.StartsWith("/today")) q = q.Where(x => x.FirstSeenAt >= DateTimeOffset.UtcNow.AddDays(-1));
            var list = await q.OrderByDescending(x => x.MatchScore).ThenByDescending(x => x.PublishedAt).Take(10).ToListAsync(ct);
            if (list.Count == 0) { await SendAsync(chatId, "Подходящих новых вакансий пока нет.", null, ct); return; }
            foreach (var v in list) await SendVacancyAsync(chatId, v, ct);
            return;
        }
        if (text.StartsWith("/russia"))
        {
            var list = await db.Vacancies.Include(x => x.Company)
                .Where(x => x.Status == VacancyStatus.New && x.Source == "hh" && x.IsRemote && !x.Company.IsBlacklisted)
                .OrderByDescending(x => x.MatchScore).ThenByDescending(x => x.PublishedAt).Take(12).ToListAsync(ct);
            if (list.Count == 0) { await SendAsync(chatId, "Удалённых вакансий по РФ пока нет. Запустите сбор.", null, ct); return; }
            foreach (var v in list) await SendVacancyAsync(chatId, v, ct);
            return;
        }
        if (text.StartsWith("/world"))
        {
            var list = await db.Vacancies.Include(x => x.Company)
                .Where(x => x.Status == VacancyStatus.New && x.Source != "hh" && x.IsRemote && !x.Company.IsBlacklisted)
                .OrderByDescending(x => x.MatchScore).ThenByDescending(x => x.PublishedAt).Take(12).ToListAsync(ct);
            if (list.Count == 0) { await SendAsync(chatId, "Международных remote-вакансий пока нет. Запустите сбор или включите Adzuna.", null, ct); return; }
            foreach (var v in list) await SendVacancyAsync(chatId, v, ct);
            return;
        }
        if (text.StartsWith("/internships"))
        {
            var candidates = await db.Vacancies.Include(x => x.Company)
                .Where(x => x.Status == VacancyStatus.New && x.IsRemote && !x.Company.IsBlacklisted)
                .OrderByDescending(x => x.MatchScore).ThenByDescending(x => x.PublishedAt).Take(200).ToListAsync(ct);
            var list = candidates.Where(x => VacancyClassifier.OpportunityType(x) == VacancyClassifier.TypeInternship).Take(12).ToList();
            if (list.Count == 0) { await SendAsync(chatId, "Удалённых C#/.NET стажировок пока нет.", null, ct); return; }
            foreach (var v in list) await SendVacancyAsync(chatId, v, ct);
            return;
        }
        if (text.StartsWith("/sources"))
        {
            var rows = await db.Vacancies.GroupBy(x => x.SourceLabel).Select(g => new { Source = g.Key, Count = g.Count() }).OrderByDescending(x => x.Count).ToListAsync(ct);
            var body = rows.Count == 0 ? "Источники пока пусты." : "<b>Источники вакансий</b>\n" + string.Join("\n", rows.Select(x => $"• {Esc(x.Source)}: {x.Count}"));
            await SendAsync(chatId, body, null, ct);
            return;
        }
        if (text.StartsWith("/applied"))
        {
            var list = await db.Vacancies.Include(x => x.Company).Where(x => x.Status == VacancyStatus.Applied).OrderByDescending(x => x.UpdatedAt).Take(10).ToListAsync(ct);
            if (list.Count == 0) { await SendAsync(chatId, "Откликов пока нет.", null, ct); return; }
            foreach (var v in list) await SendPipelineCardAsync(chatId, v, ct);
            return;
        }
        if (text.StartsWith("/interviews"))
        {
            var list = await db.Vacancies.Include(x => x.Company).Where(x => x.Status == VacancyStatus.HrContact || x.Status == VacancyStatus.HrInterview || x.Status == VacancyStatus.TechInterview || x.Status == VacancyStatus.TestTask).OrderByDescending(x => x.UpdatedAt).Take(10).ToListAsync(ct);
            if (list.Count == 0) { await SendAsync(chatId, "Активных интервью/тестовых пока нет.", null, ct); return; }
            foreach (var v in list) await SendPipelineCardAsync(chatId, v, ct);
            return;
        }
        if (text.StartsWith("/blacklist ") || text.StartsWith("/watch "))
        {
            var blacklist = text.StartsWith("/blacklist ");
            var name = text[(blacklist ? 11 : 7)..].Trim();
            var company = await db.Companies.FirstOrDefaultAsync(x => x.Name.ToLower().Contains(name.ToLower()), ct);
            if (company is null) { await SendAsync(chatId, "Компания не найдена.", null, ct); return; }
            await jobs.SetCompanyFlagAsync(company.Id, blacklist ? true : null, blacklist ? null : true, ct);
            await SendAsync(chatId, blacklist ? $"🚫 {Esc(company.Name)} добавлена в blacklist." : $"⭐ {Esc(company.Name)} добавлена в watchlist.", null, ct);
            return;
        }
        if (JobService.ExtractHhVacancyId(text) is not null)
        {
            var vacancy = await jobs.ImportHhUrlAsync(text, ct);
            if (vacancy is null) { await SendAsync(chatId, "Не удалось импортировать вакансию.", null, ct); return; }
            vacancy = await db.Vacancies.Include(x => x.Company).SingleAsync(x => x.Id == vacancy.Id, ct);
            await SendVacancyAsync(chatId, vacancy, ct);
            return;
        }
        if (Uri.TryCreate(text.Trim(), UriKind.Absolute, out var manualUri) && (manualUri.Scheme == "https" || manualUri.Scheme == "http"))
        {
            var vacancy = await jobs.ImportManualAsync(text.Trim(), null, manualUri.Host, ct);
            await SendAsync(chatId, $"🔗 Ссылка сохранена без дубля: <b>{Esc(vacancy.Title)}</b>\nИсточник: {Esc(vacancy.Source)}\nОтметить отклик можно в dashboard.", null, ct);
            return;
        }

        await SendAsync(chatId, "Команда не распознана. /start — список команд. Или пришлите ссылку на вакансию.", null, ct);
    }

    private async Task HandleCallbackAsync(long chatId, string callbackId, string data, CancellationToken ct)
    {
        await AnswerCallbackAsync(callbackId, ct);
        var parts = data.Split(':', 2);
        if (parts.Length != 2 || !Guid.TryParse(parts[1], out var vacancyId)) return;
        using var scope = scopeFactory.CreateScope();
        var jobs = scope.ServiceProvider.GetRequiredService<JobService>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        switch (parts[0])
        {
            case "save":
                await jobs.SetStatusAsync(vacancyId, VacancyStatus.Saved, "Saved from Telegram", ct);
                await SendAsync(chatId, "⭐ Сохранено.", null, ct);
                break;
            case "skip":
                await jobs.SetStatusAsync(vacancyId, VacancyStatus.Skipped, "Skipped from Telegram", ct);
                await SendAsync(chatId, "🚫 Пропущено.", null, ct);
                break;
            case "apply":
                var result = await jobs.ApplyAsync(vacancyId, ct);
                if (result.Success) await SendAsync(chatId, "📤 Отклик отправлен через HH API и записан в статистику.", null, ct);
                else if (result.ErrorCode == "test_required") await SendAsync(chatId, "⚠️ Для этой вакансии HH требует тест. Автоматический отклик через API недоступен — откройте вакансию вручную.", null, ct);
                else await SendAsync(chatId, $"Не отправлено: <code>{Esc(result.ErrorCode)}</code>\n{Esc(result.ErrorText)}", null, ct);
                break;
            case "manualapplied":
                await jobs.MarkExternalAppliedAsync(vacancyId, ct);
                await SendAsync(chatId, "✅ Отклик на внешней площадке отмечен. Повторно эта вакансия не будет предлагаться как новая.", null, ct);
                break;
            case "hr": await jobs.SetStatusAsync(vacancyId, VacancyStatus.HrContact, "HR contact", ct); break;
            case "hri": await jobs.SetStatusAsync(vacancyId, VacancyStatus.HrInterview, "HR interview", ct); break;
            case "tech": await jobs.SetStatusAsync(vacancyId, VacancyStatus.TechInterview, "Technical interview", ct); break;
            case "test": await jobs.SetStatusAsync(vacancyId, VacancyStatus.TestTask, "Test task", ct); break;
            case "reject": await jobs.SetStatusAsync(vacancyId, VacancyStatus.Rejected, "Rejected", ct); break;
            case "offer": await jobs.SetStatusAsync(vacancyId, VacancyStatus.Offer, "Offer", ct); break;
        }

        var v = await db.Vacancies.Include(x => x.Company).SingleOrDefaultAsync(x => x.Id == vacancyId, ct);
        if (v is not null && parts[0] is "hr" or "hri" or "tech" or "test" or "reject" or "offer")
            await SendAsync(chatId, $"Статус <b>{Esc(v.Title)}</b>: {v.Status}", null, ct);
    }

    private async Task SendVacancyAsync(long chatId, Vacancy v, CancellationToken ct)
    {
        if (v.MatchScore < searchOptions.Value.MinimumTelegramScore) return;
        var sameCompany = 0;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            sameCompany = await db.Vacancies.CountAsync(x => x.CompanyId == v.CompanyId && x.Status == VacancyStatus.Applied, ct);
        }
        var market = VacancyClassifier.Market(v);
        var opportunity = VacancyClassifier.OpportunityType(v);
        var text = $"<b>{Esc(v.MatchLevel)} — {v.MatchScore}%</b>\n<b>{Esc(v.Title)}</b>\n{Esc(v.Company.Name)}\n{Esc(VacancyClassifier.MarketLabel(market))} · {Esc(VacancyClassifier.TypeLabel(opportunity))}\n📍 {Esc(v.Country)} {Esc(v.LocationText)}\nИсточник: {Esc(v.SourceLabel)}\n{Esc(v.SalaryText)}" +
                   $"\n\n<b>Eligibility:</b> {Esc(v.EligibilityStatus)} — {Esc(v.EligibilityReason)}" +
                   $"\n\n✅ {Esc(v.MatchedSkills)}" +
                   (string.IsNullOrWhiteSpace(v.MissingSkills) ? "" : $"\n⚠️ {Esc(v.MissingSkills)}") +
                   $"\n\n{Esc(v.WhyMatch)}" +
                   (sameCompany > 0 ? $"\n\nℹ️ В эту компанию уже было откликов: {sameCompany}." : "") +
                   (v.HasExistingHhResponse ? "\n<b>Уже есть отклик на эту вакансию.</b>" : "");

        object keyboard;
        if (v.Source == "hh")
        {
            keyboard = new
            {
                inline_keyboard = new object[]
                {
                    new object[] { new { text = "📤 Откликнуться HH", callback_data = $"apply:{v.Id}" }, new { text = "⭐ Сохранить", callback_data = $"save:{v.Id}" } },
                    new object[] { new { text = "🌐 Открыть", url = v.ApplyUrl }, new { text = "🚫 Пропустить", callback_data = $"skip:{v.Id}" } }
                }
            };
        }
        else
        {
            keyboard = new
            {
                inline_keyboard = new object[]
                {
                    new object[] { new { text = "📝 Откликнуться на сайте", url = v.ApplyUrl }, new { text = "⭐ Сохранить", callback_data = $"save:{v.Id}" } },
                    new object[] { new { text = "✅ Я откликнулась", callback_data = $"manualapplied:{v.Id}" }, new { text = "🚫 Пропустить", callback_data = $"skip:{v.Id}" } }
                }
            };
        }
        await SendAsync(chatId, text, keyboard, ct);
    }

    private async Task SendPipelineCardAsync(long chatId, Vacancy v, CancellationToken ct)
    {
        var text = $"<b>{Esc(v.Status.ToString())}</b>\n<a href=\"{Esc(v.Url)}\">{Esc(v.Title)}</a>\n{Esc(v.Company.Name)}";
        var keyboard = new
        {
            inline_keyboard = new object[]
            {
                new object[] { new { text = "💬 HR", callback_data = $"hr:{v.Id}" }, new { text = "🧑 HR interview", callback_data = $"hri:{v.Id}" } },
                new object[] { new { text = "💻 Tech", callback_data = $"tech:{v.Id}" }, new { text = "📝 Test", callback_data = $"test:{v.Id}" } },
                new object[] { new { text = "❌ Reject", callback_data = $"reject:{v.Id}" }, new { text = "🏆 Offer", callback_data = $"offer:{v.Id}" } },
                new object[] { new { text = "🌐 Открыть", url = v.Url } }
            }
        };
        await SendAsync(chatId, text, keyboard, ct);
    }

    private async Task SendAsync(long chatId, string text, object? replyMarkup, CancellationToken ct)
        => _ = await CallAsync("sendMessage", new { chat_id = chatId, text, parse_mode = "HTML", disable_web_page_preview = true, reply_markup = replyMarkup }, ct);

    private async Task AnswerCallbackAsync(string callbackId, CancellationToken ct)
        => _ = await CallAsync("answerCallbackQuery", new { callback_query_id = callbackId }, ct);

    private async Task<JsonDocument> CallAsync(string method, object payload, CancellationToken ct)
    {
        var client = clients.CreateClient("telegram");
        using var response = await client.PostAsJsonAsync($"https://api.telegram.org/bot{_options.BotToken}/{method}", payload, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(text);
    }

    private static string Esc(string? value) => System.Net.WebUtility.HtmlEncode(value ?? "");
}
