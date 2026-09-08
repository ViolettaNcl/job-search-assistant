using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class BrowserVacancyImportServiceTests
{
    [TestMethod]
    public async Task BrowserImport_PreservesDescriptionAndCalculatesRealMatch()
    {
        await using var db = CreateDb();
        var scoring = new MatchScoringService(Options.Create(new CandidateProfileOptions()));
        var sut = new BrowserVacancyImportService(db, scoring);

        var vacancy = await sut.ImportAsync(new BrowserVacancyImportRequest(
            "https://boards.greenhouse.io/example/jobs/123",
            "Junior .NET Developer",
            "Example EU",
            "C# ASP.NET Core EF Core SQL Server REST API Git Docker. Remote in Poland.",
            "Poland",
            "Warsaw / Remote",
            "Remote Poland",
            "between1And3",
            "boards.greenhouse.io",
            true), CancellationToken.None);

        Assert.AreEqual("Example EU", vacancy.Company.Name);
        StringAssert.Contains(vacancy.DescriptionText, "ASP.NET Core");
        Assert.AreEqual("Poland", vacancy.Country);
        Assert.IsTrue(vacancy.MatchScore >= 75);
        // Citizenship does not establish Polish residence or payroll eligibility.
        Assert.AreEqual("Verify", vacancy.EligibilityStatus);
    }

    [TestMethod]
    public async Task BrowserImport_SameUrlUpdatesExistingInsteadOfDuplicating()
    {
        await using var db = CreateDb();
        var scoring = new MatchScoringService(Options.Create(new CandidateProfileOptions()));
        var sut = new BrowserVacancyImportService(db, scoring);
        const string url = "https://jobs.lever.co/example/abc";

        var first = await sut.ImportAsync(new BrowserVacancyImportRequest(
            url, "Junior Developer", "Example", "C# .NET", "Cyprus", "Limassol", "Remote", "", "jobs.lever.co", true), CancellationToken.None);

        var second = await sut.ImportAsync(new BrowserVacancyImportRequest(
            url, "Junior .NET Developer", "Example", "C# .NET ASP.NET Core SQL REST API Docker", "Cyprus", "Limassol", "Remote Cyprus", "noExperience", "jobs.lever.co", true), CancellationToken.None);

        Assert.AreEqual(first.Id, second.Id);
        Assert.AreEqual(1, await db.Vacancies.CountAsync());
        Assert.AreEqual("Junior .NET Developer", second.Title);
        StringAssert.Contains(second.DescriptionText, "Docker");
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"browser-import-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }
}
