using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class ApplicationQueueServiceTests
{
    [TestMethod]
    public async Task Queue_RanksFreshStrongEligibleVacancyFirst_AndExcludesIneligible()
    {
        await using var db = CreateDb();
        var company = new Company { Name = "Example", Source = "global", ExternalId = "example" };
        db.Companies.Add(company);

        var freshStrong = CreateVacancy(company, "Junior .NET Developer", 92, "Eligible", DateTimeOffset.UtcNow.AddHours(-4));
        var olderApply = CreateVacancy(company, "Junior QA Engineer", 80, "Eligible", DateTimeOffset.UtcNow.AddDays(-8));
        var ineligible = CreateVacancy(company, "Junior .NET US only", 95, "Likely ineligible", DateTimeOffset.UtcNow.AddHours(-1));
        db.Vacancies.AddRange(freshStrong, olderApply, ineligible);
        await db.SaveChangesAsync();

        var drafts = new ApplicationDraftService(Options.Create(new CandidateProfileOptions()));
        var sut = new ApplicationQueueService(db, drafts);
        var queue = await sut.GetAsync(20, 65, CancellationToken.None);

        Assert.AreEqual(2, queue.Count);
        Assert.AreEqual(freshStrong.Id, queue[0].VacancyId);
        Assert.AreEqual("Apply now", queue[0].Priority);
        Assert.IsTrue(queue[0].PriorityScore > queue[1].PriorityScore);
        Assert.IsFalse(queue.Any(x => x.VacancyId == ineligible.Id));
        Assert.IsFalse(string.IsNullOrWhiteSpace(queue[0].RecommendedCv));
    }

    private static Vacancy CreateVacancy(Company company, string title, int score, string eligibility, DateTimeOffset published)
        => new()
        {
            Company = company,
            CompanyId = company.Id,
            Source = "browser",
            SourceLabel = "Browser",
            ExternalId = Guid.NewGuid().ToString("N"),
            CanonicalFingerprint = Guid.NewGuid().ToString("N"),
            Title = title,
            Url = $"https://example.com/{Guid.NewGuid():N}",
            MatchScore = score,
            MatchLevel = score >= 85 ? "Strong Match" : "Apply",
            MatchedSkills = "C#, .NET, SQL",
            EligibilityStatus = eligibility,
            EligibilityReason = eligibility,
            IsRemote = true,
            Country = "Poland",
            PublishedAt = published,
            FirstSeenAt = published,
            Status = VacancyStatus.New
        };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"queue-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }
}
