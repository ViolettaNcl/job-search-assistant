using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class FollowUpQueueServiceTests
{
    [TestMethod]
    public async Task Queue_SurfacesOnlyAppliedJobsThatReachedBusinessDayThreshold()
    {
        await using var db = CreateDb();
        var company = new Company { Name = "Example", Source = "browser", ExternalId = "example" };
        db.Companies.Add(company);

        var due = CreateApplied(company, "Junior .NET Developer", 90, new DateTimeOffset(2026, 9, 4, 10, 0, 0, TimeSpan.Zero));
        var recent = CreateApplied(company, "Junior QA Engineer", 80, new DateTimeOffset(2026, 9, 10, 10, 0, 0, TimeSpan.Zero));
        var progressed = CreateApplied(company, "Backend Developer", 88, new DateTimeOffset(2026, 9, 4, 10, 0, 0, TimeSpan.Zero));
        progressed.Status = VacancyStatus.HrContact;

        db.Vacancies.AddRange(due, recent, progressed);
        await db.SaveChangesAsync();

        var sut = new FollowUpQueueService(db);
        var now = new DateTimeOffset(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);
        var queue = await sut.GetAsync(5, 20, 2, CancellationToken.None, now);

        Assert.AreEqual(1, queue.Count);
        Assert.AreEqual(due.Id, queue[0].VacancyId);
        Assert.AreEqual(6, queue[0].BusinessDaysWaiting);
        Assert.AreEqual("en", queue[0].Language);
        StringAssert.Contains(queue[0].Message, "follow up on my application");
    }

    [TestMethod]
    public async Task Queue_UsesLastFollowUpAsNewWaitingPoint()
    {
        await using var db = CreateDb();
        var company = new Company { Name = "Example", Source = "browser", ExternalId = "example" };
        db.Companies.Add(company);

        var vacancy = CreateApplied(company, "Junior .NET Developer", 92, new DateTimeOffset(2026, 9, 1, 10, 0, 0, TimeSpan.Zero));
        vacancy.Events.Add(new ApplicationEvent
        {
            VacancyId = vacancy.Id,
            Type = "FollowUpSent",
            Note = "First follow-up",
            CreatedAt = new DateTimeOffset(2026, 9, 8, 10, 0, 0, TimeSpan.Zero)
        });
        db.Vacancies.Add(vacancy);
        await db.SaveChangesAsync();

        var sut = new FollowUpQueueService(db);
        var tooSoon = await sut.GetAsync(5, 20, 2, CancellationToken.None, new DateTimeOffset(2026, 9, 14, 12, 0, 0, TimeSpan.Zero));
        Assert.AreEqual(0, tooSoon.Count);

        var dueAgain = await sut.GetAsync(5, 20, 2, CancellationToken.None, new DateTimeOffset(2026, 9, 15, 12, 0, 0, TimeSpan.Zero));
        Assert.AreEqual(1, dueAgain.Count);
        Assert.AreEqual(1, dueAgain[0].FollowUpCount);
        StringAssert.Contains(dueAgain[0].Message, "following up once more");
    }

    [TestMethod]
    public async Task Queue_StopsAfterConfiguredMaximumAttempts()
    {
        await using var db = CreateDb();
        var company = new Company { Name = "Example", Source = "browser", ExternalId = "example" };
        db.Companies.Add(company);
        var vacancy = CreateApplied(company, "Junior .NET Developer", 92, new DateTimeOffset(2026, 8, 20, 10, 0, 0, TimeSpan.Zero));
        vacancy.Events.Add(new ApplicationEvent { VacancyId = vacancy.Id, Type = "FollowUpSent", CreatedAt = new DateTimeOffset(2026, 8, 28, 10, 0, 0, TimeSpan.Zero) });
        vacancy.Events.Add(new ApplicationEvent { VacancyId = vacancy.Id, Type = "FollowUpSent", CreatedAt = new DateTimeOffset(2026, 9, 4, 10, 0, 0, TimeSpan.Zero) });
        db.Vacancies.Add(vacancy);
        await db.SaveChangesAsync();

        var sut = new FollowUpQueueService(db);
        var queue = await sut.GetAsync(5, 20, 2, CancellationToken.None, new DateTimeOffset(2026, 9, 14, 12, 0, 0, TimeSpan.Zero));
        Assert.AreEqual(0, queue.Count);
    }

    [TestMethod]
    public async Task MarkSent_RecordsEventAndKeepsApplicationStatus()
    {
        await using var db = CreateDb();
        var company = new Company { Name = "Example", Source = "browser", ExternalId = "example" };
        db.Companies.Add(company);
        var vacancy = CreateApplied(company, "Junior .NET Developer", 90, DateTimeOffset.UtcNow.AddDays(-8));
        db.Vacancies.Add(vacancy);
        await db.SaveChangesAsync();

        var sut = new FollowUpQueueService(db);
        var result = await sut.MarkSentAsync(vacancy.Id, "Sent by email", CancellationToken.None);

        Assert.IsTrue(result);
        var saved = await db.Vacancies.Include(x => x.Events).SingleAsync(x => x.Id == vacancy.Id);
        Assert.AreEqual(VacancyStatus.Applied, saved.Status);
        Assert.AreEqual(1, saved.Events.Count(x => x.Type == "FollowUpSent"));
        Assert.AreEqual("Sent by email", saved.Events.Single(x => x.Type == "FollowUpSent").Note);
    }

    private static Vacancy CreateApplied(Company company, string title, int score, DateTimeOffset appliedAt)
    {
        var vacancy = new Vacancy
        {
            Company = company,
            CompanyId = company.Id,
            Source = "browser",
            SourceLabel = "Career site",
            ExternalId = Guid.NewGuid().ToString("N"),
            CanonicalFingerprint = Guid.NewGuid().ToString("N"),
            Title = title,
            Url = $"https://example.com/{Guid.NewGuid():N}",
            MatchScore = score,
            MatchLevel = score >= 85 ? "Strong Match" : "Apply",
            EligibilityStatus = "Eligible",
            IsRemote = true,
            Country = "Poland",
            Status = VacancyStatus.Applied,
            UpdatedAt = appliedAt
        };
        vacancy.Application = new Application
        {
            VacancyId = vacancy.Id,
            Vacancy = vacancy,
            ResumeExternalId = "external/manual",
            AppliedAt = appliedAt
        };
        return vacancy;
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"followups-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }
}
