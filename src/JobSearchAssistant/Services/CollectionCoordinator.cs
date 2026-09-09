using System.Threading.Channels;
using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record CollectionSnapshot(bool Running, DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt, CollectResult? Result, string? Error);

// One host-owned job; closing a popup or timing out an HTTP request cannot cancel collection.
public sealed class CollectionCoordinator(IServiceScopeFactory scopes, IOptions<SearchOptions> options) : BackgroundService
{
    private readonly Channel<bool> _requests = Channel.CreateBounded<bool>(1);
    private CollectionSnapshot _snapshot = new(false, null, null, null, null);
    private int _requested;
    public CollectionSnapshot Snapshot => Volatile.Read(ref _snapshot);
    public CollectionSnapshot Start()
    {
        if (Interlocked.CompareExchange(ref _requested, 1, 0) != 0) return Snapshot;
        Volatile.Write(ref _snapshot, new(true, DateTimeOffset.UtcNow, null, null, null));
        _requests.Writer.TryWrite(true);
        return Snapshot;
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var _ in _requests.Reader.ReadAllAsync(stoppingToken))
        {
            var started = Snapshot.StartedAt;
            try
            {
                using var scope = scopes.CreateScope();
                var jobs = scope.ServiceProvider.GetRequiredService<JobService>();
                var result = await jobs.CollectAsync(options.Value, stoppingToken);
                Volatile.Write(ref _snapshot, new(false, started, DateTimeOffset.UtcNow, result, null));
                await jobs.RunAutoApplyCycleAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                var message = ex is HttpRequestException http ? $"Источник вакансий недоступен (HTTP {http.StatusCode})." : "Сбор вакансий завершился ошибкой: " + ex.GetType().Name;
                Volatile.Write(ref _snapshot, new(false, started, DateTimeOffset.UtcNow, null, message));
            }
            finally { Interlocked.Exchange(ref _requested, 0); }
        }
    }
}
