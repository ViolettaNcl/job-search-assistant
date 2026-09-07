using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class VacancyReadQueriesTests
{
    [TestMethod]
    public async Task SqliteQueries_CompareInstants_FilterBeforeLimits_AndCountUtcDay()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var midnight = new DateTimeOffset(2026, 9, 7, 0, 0, 0, TimeSpan.Zero);
        var company = new Company { ExternalId = "sqlite", Name = "Example" };
        Vacancy Job(string title, int score, DateTimeOffset? published, DateTimeOffset updated) => new()
        {
            Company = company, ExternalId = Guid.NewGuid().ToString(), Title = title,
            MatchScore = score, PublishedAt = published, UpdatedAt = updated,
            FirstSeenAt = updated, IsRemote = true
        };
        var older = Job("Junior developer", 90, midnight.AddHours(1).ToOffset(TimeSpan.FromHours(5)), midnight.AddMinutes(-1));
        var newer = Job("Junior developer", 90, midnight.AddHours(2).ToOffset(TimeSpan.FromHours(-5)), midnight.AddHours(2));
        var internship = Job("C# internship", 80, null, midnight);
        var excluded = Job("Onsite", 100, midnight.AddDays(1), midnight.AddDays(1));
        excluded.IsRemote = false;
        db.Vacancies.AddRange(older, newer, internship, excluded);
        db.Applications.AddRange(
            new Application { Vacancy = older, AppliedAt = midnight.AddTicks(-1).ToOffset(TimeSpan.FromHours(5)) },
            new Application { Vacancy = newer, AppliedAt = midnight.ToOffset(TimeSpan.FromHours(-5)) },
            new Application { Vacancy = internship, AppliedAt = midnight.AddHours(3) });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var query = db.Vacancies.Include(x => x.Company).Where(x => x.IsRemote);
        var ranked = await query.RankedAsync(1, CancellationToken.None);
        Assert.AreEqual(newer.Id, ranked.Single().Id, "Rank equal scores by instant, not offset text, before taking the limit.");
        Assert.AreEqual("Example", ranked.Single().Company.Name);
        var today = await query.RankedAsync(10, CancellationToken.None, firstSeenSince: midnight);
        CollectionAssert.AreEqual(new[] { newer.Id, internship.Id }, today.Select(x => x.Id).ToArray());
        var interns = await query.RankedAsync(1, CancellationToken.None,
            filter: x => VacancyClassifier.OpportunityType(x) == VacancyClassifier.TypeInternship);
        Assert.AreEqual(internship.Id, interns.Single().Id);
        var recent = await query.RecentAsync(1, CancellationToken.None);
        Assert.AreEqual(newer.Id, recent.Single().Id);
        var filtered = await query.RecentAsync(1, CancellationToken.None, x => x.Title.Contains("internship"));
        Assert.AreEqual(internship.Id, filtered.Single().Id);
        Assert.AreEqual(2, await db.Applications.CountAppliedSinceAsync(midnight, CancellationToken.None));
    }
}
