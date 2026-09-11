using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class DashboardApplyServiceTests
{
    private static AppDbContext Database() => new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static DashboardApplyService Service(AppDbContext db) => new(db, new(Options.Create(new CandidateProfileOptions())), new(Options.Create(new CandidateProfileOptions())));
    private static Vacancy Job() => new() { Source = "hh", Url = "https://volgograd.hh.ru/vacancy/123", Title = "Junior .NET Developer", DescriptionText = "Required: C#, ASP.NET Core, SQL. Remote Russia.", IsRemote = true, Experience = "between1And3", LocationText = "Russia", Company = new() { Name = "Example Studio" }, MatchScore = 0, EligibilityStatus = "Verify" };

    [TestMethod]
    public async Task UnknownHiringCountryDoesNotBlockManualApplyWithAutopilotOnOrOff()
    {
        foreach (var enabled in new[] { false, true })
        {
            using var db = Database(); var job = Job();
            job.DescriptionText = "Required: C#, ASP.NET Core, SQL. Remote B2B.";
            job.LocationText = "Almaty, KZ";
            db.Add(job); db.Add(new AppState { Id = 1, AutoApplyEnabled = enabled, AutoApplyMinimumScore = 50 }); await db.SaveChangesAsync();
            var result = await Service(db).PrepareAsync(job.Id, default);
            Assert.IsTrue(result.Ready, result.Message); Assert.AreEqual("Verify", result.Candidate!.EligibilityStatus);
            Assert.IsFalse(result.Message.Contains("payroll scope")); Assert.AreEqual(0, await db.Applications.CountAsync());
        }
    }

    [TestMethod]
    public async Task PreparesFreshEvidenceLetterWithAutopilotOffWithoutRecordingSubmission()
    {
        using var db = Database(); var job = Job(); db.Add(job); db.Add(new AppState { Id = 1, AutoApplyEnabled = false, AutoApplyMinimumScore = 50 }); await db.SaveChangesAsync();
        var result = await Service(db).PrepareAsync(job.Id, default);
        Assert.IsTrue(result.Ready, result.Message); Assert.AreEqual(job.Id, result.Candidate!.VacancyId); Assert.AreEqual(job.Url, result.Candidate.Url);
        Assert.IsTrue(result.Candidate.MatchScore > job.MatchScore); StringAssert.Contains(result.Draft!.CoverLetter, "Example Studio");
        Assert.AreEqual(0, await db.Applications.CountAsync()); Assert.IsFalse(job.HasExistingHhResponse);
        var state = await db.AppStates.SingleAsync(); state.AutoApplyMinimumScore = 100; await db.SaveChangesAsync();
        Assert.IsTrue((await Service(db).PrepareAsync(job.Id, default)).Ready, "Manual choice is independent of the autopilot threshold.");
    }

    [TestMethod]
    public async Task StopsDuplicatesAndExclusionsBeforePreparingSubmission()
    {
        foreach (var kind in new[] { "response", "application", "applied", "blacklist", "skipped", "rejected" })
        {
            using var db = Database(); var job = Job();
            if (kind == "response") job.HasExistingHhResponse = true;
            if (kind == "application") job.Application = new Application { VacancyId = job.Id };
            if (kind == "applied") job.Status = VacancyStatus.Applied;
            if (kind == "blacklist") job.Company.IsBlacklisted = true;
            if (kind == "skipped") job.Status = VacancyStatus.Skipped;
            if (kind == "rejected") job.Status = VacancyStatus.Rejected;
            db.Add(job); await db.SaveChangesAsync(); Assert.IsFalse((await Service(db).PrepareAsync(job.Id, default)).Ready, kind);
        }
    }

    [TestMethod]
    public async Task RejectsUntrustedDestinations()
    {
        foreach (var kind in new[] { "source", "http", "spoof", "path" })
        {
            using var db = Database(); var job = Job();
            if (kind == "source") job.Source = "other";
            if (kind == "http") job.Url = "http://hh.ru/vacancy/123";
            if (kind == "spoof") job.Url = "https://hh.ru.example.com/vacancy/123";
            if (kind == "path") job.Url = "https://hh.ru/account";
            db.Add(job); await db.SaveChangesAsync(); Assert.IsFalse((await Service(db).PrepareAsync(job.Id, default)).Ready, kind);
        }
    }
    [TestMethod]
    public async Task ManualChoiceAcceptsFitGapsWithoutChangingCandidateFacts()
    {
        foreach (var kind in new[] { "onsite", "hybrid", "missing", "senior", "employment", "degree", "country" })
        {
            using var db = Database(); var job = Job();
            if (kind == "onsite") job.IsRemote = false;
            if (kind == "hybrid") job.DescriptionText += " Required to visit the office every week.";
            if (kind == "missing") job.DescriptionText += " Required: Azure.";
            if (kind == "senior") job.Title = "Senior .NET Developer";
            if (kind == "employment") job.DescriptionText += " 2 years commercial experience required.";
            if (kind == "degree") job.DescriptionText += " University degree required.";
            if (kind == "country") job.DescriptionText += " US only.";
            db.Add(job); await db.SaveChangesAsync();
            var result = await Service(db).PrepareAsync(job.Id, default);
            Assert.IsTrue(result.Ready, kind + ": " + result.Message);
            Assert.IsFalse(string.IsNullOrWhiteSpace(result.Draft!.CoverLetter));
            Assert.AreEqual(0, await db.Applications.CountAsync(), "Preparation does not claim a submission.");
        }
    }

}
