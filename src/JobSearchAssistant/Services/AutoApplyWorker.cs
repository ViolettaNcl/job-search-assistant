using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed class AutoApplyWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<AutomationOptions> options,
    ILogger<AutoApplyWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(25), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var jobs = scope.ServiceProvider.GetRequiredService<JobService>();
                await jobs.SyncExistingApplicationsAsync(stoppingToken);
                var result = await jobs.RunAutoApplyCycleAsync(stoppingToken);
                if (result.Enabled)
                {
                    logger.LogInformation(
                        "Apply Autopilot cycle: ready {Ready}, attempted {Attempted}, submitted {Submitted}, failed {Failed}, remaining today {Remaining}",
                        result.Ready, result.Attempted, result.Submitted, result.Failed, result.RemainingToday);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Apply Autopilot cycle failed");
            }

            var minutes = Math.Clamp(options.Value.CycleMinutes, 2, 60);
            await Task.Delay(TimeSpan.FromMinutes(minutes), stoppingToken);
        }
    }
}
