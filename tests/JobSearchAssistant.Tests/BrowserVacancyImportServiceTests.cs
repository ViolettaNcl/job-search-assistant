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

    [TestMethod]
    public async Task HhBrowserImportSharesApiIdentityAndPreservesApplicationState()
    {
        await using var db = CreateDb();
        var sut = new BrowserVacancyImportService(db, new MatchScoringService(Options.Create(new CandidateProfileOptions())));
        var first = await sut.ImportAsync(new BrowserVacancyImportRequest("https://hh.ru/vacancy/123?query=a", "Junior C#", "Employer", "C# SQL remote Russia", "Russia", "Russia", "", "", "hh.ru"), CancellationToken.None);
        first.Status = VacancyStatus.Applied; first.HasExistingHhResponse = true; await db.SaveChangesAsync();
        var second = await sut.ImportAsync(new BrowserVacancyImportRequest("https://volgograd.hh.ru/vacancy/123?query=b", "Junior C#", "Employer", "C# SQL remote Russia", "Russia", "Russia", "", "", "volgograd.hh.ru"), CancellationToken.None);
        Assert.AreEqual(first.Id, second.Id); Assert.AreEqual("hh", second.Source); Assert.AreEqual("123", second.ExternalId);
        Assert.AreEqual(VacancyStatus.Applied, second.Status); Assert.IsTrue(second.HasExistingHhResponse);
        Assert.AreEqual(1, await db.Vacancies.CountAsync());
    }

    [TestMethod]
    public async Task BrowserImport_DoesNotAssumeRemoteWhenFlagMissingOrOfficeRequired()
    {
        await using var db = CreateDb();
        var sut = new BrowserVacancyImportService(db, new MatchScoringService(Options.Create(new CandidateProfileOptions())));
        var request = new BrowserVacancyImportRequest("https://hh.ru/vacancy/987", "Junior C#", "Employer", "C# SQL", "Russia", "Волгоград", "", "noExperience", "hh.ru");
        var unknown = await sut.ImportAsync(request, CancellationToken.None);
        Assert.IsFalse(unknown.IsRemote);
        Assert.AreEqual("Likely ineligible", unknown.EligibilityStatus);
        var hybrid = await sut.ImportAsync(request with { Remote = true, Description = "C# SQL. Remote with required office visits. Hybrid." }, CancellationToken.None);
        Assert.IsFalse(hybrid.IsRemote);
        Assert.AreEqual("Likely ineligible", hybrid.EligibilityStatus);
        var remote = await sut.ImportAsync(request with { Remote = true, Description = "Required: C#, SQL. Fully remote Russia." }, CancellationToken.None);
        Assert.IsTrue(remote.IsRemote);
        Assert.AreEqual("Eligible", remote.EligibilityStatus);
        Assert.AreEqual(1, await db.Vacancies.CountAsync());
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"browser-import-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }
}
