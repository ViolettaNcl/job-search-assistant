using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed class VacancyCollectorWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<SearchOptions> options,
    ILogger<VacancyCollectorWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<JobService>();
                var result = await service.CollectAsync(options.Value, stoppingToken);
                logger.LogInformation("Global collection: found {Found}, added {Added}, strong {Strong}, imported {Imported}; HH {HH}, Remotive {Remotive}, Adzuna {Adzuna}", result.Found, result.Added, result.Strong, result.AppliedImported, result.HhFound, result.RemotiveFound, result.AdzunaFound);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Vacancy collection failed"); }

            await Task.Delay(TimeSpan.FromMinutes(Math.Max(15, options.Value.IntervalMinutes)), stoppingToken);
        }
    }
}
