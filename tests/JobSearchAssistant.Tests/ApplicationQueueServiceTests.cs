using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Data.Sqlite;
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

    [TestMethod]
    public async Task Queue_RunsAgainstSqlite_WithDateTimeOffsetPublishedDates()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var company = new Company { Name = "SQLite Example", Source = "browser", ExternalId = "sqlite-example" };
        db.Companies.Add(company);
        var now = DateTimeOffset.UtcNow;
        var fresh = CreateVacancy(company, "Junior C# Developer", 90, "Eligible", now.AddHours(-2));
        var older = CreateVacancy(company, "Junior QA Automation", 80, "Eligible", now.AddDays(-10));
        db.Vacancies.AddRange(fresh, older);
        await db.SaveChangesAsync();

        var drafts = new ApplicationDraftService(Options.Create(new CandidateProfileOptions()));
        var sut = new ApplicationQueueService(db, drafts);
        var queue = await sut.GetAsync(20, 65, CancellationToken.None);

        Assert.AreEqual(2, queue.Count);
        Assert.AreEqual(fresh.Id, queue[0].VacancyId);
        Assert.IsTrue(queue[0].PriorityScore > queue[1].PriorityScore);
    }

    [TestMethod]
    public async Task Queue_HidesActiveDeferral_RestoresExpiredDeferral_AndDoesNotExposeOrdinarySavedJob()
    {
        await using var db = CreateDb();
        var company = new Company { Name = "Deferred Example", Source = "global", ExternalId = "deferred-example" };
        db.Companies.Add(company);
        var now = DateTimeOffset.UtcNow;

        var active = CreateVacancy(company, "Active defer", 91, "Eligible", now.AddHours(-1));
        active.Status = VacancyStatus.Saved;
        active.Events.Add(new ApplicationEvent
        {
            Vacancy = active,
            VacancyId = active.Id,
            Type = VacancyStatus.Saved.ToString(),
            Note = QueueDeferralPolicy.BuildNote(now.AddHours(4)),
            CreatedAt = now
        });

        var expired = CreateVacancy(company, "Expired defer", 89, "Eligible", now.AddHours(-2));
        expired.Status = VacancyStatus.Saved;
        expired.Events.Add(new ApplicationEvent
        {
            Vacancy = expired,
            VacancyId = expired.Id,
            Type = VacancyStatus.Saved.ToString(),
            Note = QueueDeferralPolicy.BuildNote(now.AddMinutes(-5)),
            CreatedAt = now.AddHours(-5)
        });

        var ordinarySaved = CreateVacancy(company, "Manual bookmark", 95, "Eligible", now.AddMinutes(-30));
        ordinarySaved.Status = VacancyStatus.Saved;
        ordinarySaved.Events.Add(new ApplicationEvent
        {
            Vacancy = ordinarySaved,
            VacancyId = ordinarySaved.Id,
            Type = VacancyStatus.Saved.ToString(),
            Note = "Saved for manual review",
            CreatedAt = now
        });

        db.Vacancies.AddRange(active, expired, ordinarySaved);
        await db.SaveChangesAsync();

        var drafts = new ApplicationDraftService(Options.Create(new CandidateProfileOptions()));
        var sut = new ApplicationQueueService(db, drafts);
        var queue = await sut.GetAsync(20, 65, CancellationToken.None);

        Assert.AreEqual(1, queue.Count);
        Assert.AreEqual(expired.Id, queue[0].VacancyId);
        Assert.IsFalse(queue.Any(x => x.VacancyId == active.Id));
        Assert.IsFalse(queue.Any(x => x.VacancyId == ordinarySaved.Id));
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
