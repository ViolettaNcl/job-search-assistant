namespace JobSearchAssistant.Services;

public sealed class AutoApplyRunTracker
{
    private AutoApplyCycleResult? _lastResult;

    public AutoApplyCycleResult? LastResult => Volatile.Read(ref _lastResult);

    public AutoApplyCycleResult Record(AutoApplyCycleResult result)
    {
        Volatile.Write(ref _lastResult, result);
        return result;
    }
}
