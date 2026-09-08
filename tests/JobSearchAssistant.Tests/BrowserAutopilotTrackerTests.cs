using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class BrowserAutopilotTrackerTests
{
    [TestMethod]
    public void HeartbeatAndResult_ExposeConnectedRunningAndLastRunState()
    {
        var tracker = new BrowserAutopilotTracker();

        var running = tracker.Heartbeat(true, "Отправляю отклик", "Junior .NET Developer");
        Assert.IsTrue(running.Connected);
        Assert.IsTrue(running.Running);
        Assert.AreEqual("Junior .NET Developer", running.VacancyTitle);

        var completed = tracker.RecordResult("Отклик и письмо отправлены", "Junior .NET Developer");
        Assert.IsTrue(completed.Connected);
        Assert.IsFalse(completed.Running);
        Assert.IsNotNull(completed.LastRunAt);
        Assert.AreEqual("Отклик и письмо отправлены", completed.LastMessage);
    }
}
