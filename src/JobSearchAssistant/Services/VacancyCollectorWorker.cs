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
                var coordinator = scope.ServiceProvider.GetRequiredService<CollectionCoordinator>();
                coordinator.Start();
                logger.LogInformation("Scheduled vacancy collection requested");
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Vacancy collection failed"); }

            await Task.Delay(TimeSpan.FromMinutes(Math.Max(15, options.Value.IntervalMinutes)), stoppingToken);
        }
    }
}
