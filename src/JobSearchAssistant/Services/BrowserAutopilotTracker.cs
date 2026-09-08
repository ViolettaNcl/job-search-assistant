namespace JobSearchAssistant.Services;

public sealed record BrowserAutopilotSnapshot(
    bool Connected,
    bool Running,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset? LastRunAt,
    string LastMessage,
    string? VacancyTitle);

public sealed class BrowserAutopilotTracker
{
    private readonly object _gate = new();
    private DateTimeOffset? _lastSeenAt;
    private DateTimeOffset? _lastRunAt;
    private bool _running;
    private string _lastMessage = "Расширение ещё не подключалось к автопилоту.";
    private string? _vacancyTitle;

    public BrowserAutopilotSnapshot Snapshot
    {
        get
        {
            lock (_gate)
            {
                var connected = _lastSeenAt.HasValue && DateTimeOffset.UtcNow - _lastSeenAt.Value < TimeSpan.FromMinutes(3);
                return new BrowserAutopilotSnapshot(connected, connected && _running, _lastSeenAt, _lastRunAt, _lastMessage, _vacancyTitle);
            }
        }
    }

    public BrowserAutopilotSnapshot Heartbeat(bool running, string? message, string? vacancyTitle)
    {
        lock (_gate)
        {
            _lastSeenAt = DateTimeOffset.UtcNow;
            _running = running;
            if (!string.IsNullOrWhiteSpace(message)) _lastMessage = message.Trim();
            _vacancyTitle = string.IsNullOrWhiteSpace(vacancyTitle) ? null : vacancyTitle.Trim();
            return SnapshotUnsafe();
        }
    }

    public BrowserAutopilotSnapshot RecordResult(string message, string? vacancyTitle)
    {
        lock (_gate)
        {
            _lastSeenAt = DateTimeOffset.UtcNow;
            _lastRunAt = DateTimeOffset.UtcNow;
            _running = false;
            _lastMessage = string.IsNullOrWhiteSpace(message) ? "Цикл браузерного автопилота завершён." : message.Trim();
            _vacancyTitle = string.IsNullOrWhiteSpace(vacancyTitle) ? null : vacancyTitle.Trim();
            return SnapshotUnsafe();
        }
    }

    private BrowserAutopilotSnapshot SnapshotUnsafe()
    {
        var connected = _lastSeenAt.HasValue && DateTimeOffset.UtcNow - _lastSeenAt.Value < TimeSpan.FromMinutes(3);
        return new BrowserAutopilotSnapshot(connected, connected && _running, _lastSeenAt, _lastRunAt, _lastMessage, _vacancyTitle);
    }
}
