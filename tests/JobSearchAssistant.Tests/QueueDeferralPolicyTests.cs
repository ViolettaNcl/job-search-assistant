using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class QueueDeferralPolicyTests
{
    [TestMethod]
    public void BuildAndParseNote_RoundTripsUtcTimestamp()
    {
        var until = new DateTimeOffset(2026, 9, 7, 10, 30, 0, TimeSpan.FromHours(3));
        var note = QueueDeferralPolicy.BuildNote(until);
        var parsed = QueueDeferralPolicy.GetDeferredUntil([
            new ApplicationEvent { Type = VacancyStatus.Saved.ToString(), Note = note, CreatedAt = until.AddHours(-1) }
        ]);

        Assert.IsTrue(note.StartsWith(QueueDeferralPolicy.NotePrefix, StringComparison.Ordinal));
        Assert.AreEqual(until.ToUniversalTime(), parsed);
    }

    [TestMethod]
    public void ShouldAppearInQueue_OnlyRestoresExpiredMachineDeferredSavedJobs()
    {
        var now = new DateTimeOffset(2026, 9, 6, 12, 0, 0, TimeSpan.Zero);

        var active = SavedWithNote(QueueDeferralPolicy.BuildNote(now.AddHours(4)), now.AddMinutes(-5));
        var expired = SavedWithNote(QueueDeferralPolicy.BuildNote(now.AddMinutes(-1)), now.AddHours(-5));
        var manual = SavedWithNote("Saved for later", now.AddMinutes(-5));
        var fresh = new Vacancy { Status = VacancyStatus.New };
        var applied = new Vacancy { Status = VacancyStatus.Applied };

        Assert.IsTrue(QueueDeferralPolicy.IsActivelyDeferred(active, now));
        Assert.IsFalse(QueueDeferralPolicy.ShouldAppearInQueue(active, now));
        Assert.IsTrue(QueueDeferralPolicy.ShouldAppearInQueue(expired, now));
        Assert.IsFalse(QueueDeferralPolicy.ShouldAppearInQueue(manual, now));
        Assert.IsTrue(QueueDeferralPolicy.ShouldAppearInQueue(fresh, now));
        Assert.IsFalse(QueueDeferralPolicy.ShouldAppearInQueue(applied, now));
    }

    [TestMethod]
    public void LatestSavedEventControlsWhetherSavedJobWasMachineDeferred()
    {
        var now = DateTimeOffset.UtcNow;
        var vacancy = SavedWithNote(QueueDeferralPolicy.BuildNote(now.AddHours(2)), now.AddHours(-2));
        vacancy.Events.Add(new ApplicationEvent
        {
            Type = VacancyStatus.Saved.ToString(),
            Note = "Saved manually after deferral",
            CreatedAt = now.AddMinutes(-1)
        });

        Assert.IsNull(QueueDeferralPolicy.GetDeferredUntil(vacancy.Events));
        Assert.IsFalse(QueueDeferralPolicy.ShouldAppearInQueue(vacancy, now));
    }

    private static Vacancy SavedWithNote(string note, DateTimeOffset createdAt)
    {
        var vacancy = new Vacancy { Status = VacancyStatus.Saved };
        vacancy.Events.Add(new ApplicationEvent
        {
            Type = VacancyStatus.Saved.ToString(),
            Note = note,
            CreatedAt = createdAt
        });
        return vacancy;
    }
}
