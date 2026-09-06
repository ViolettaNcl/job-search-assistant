using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class OutcomeAnalyticsServiceTests
{
    [TestMethod]
    public async Task Analytics_ComputesResponseAndInterviewRatesBySource()
    {
        await using var db = CreateDb();
        var company = Company("Example");
        db.Companies.Add(company);
        db.Vacancies.AddRange(
            Applied(company, "HH role", "hh", "HeadHunter", 90, VacancyStatus.HrInterview, "resume-1"),
            Applied(company, "HH role 2", "hh", "HeadHunter", 86, VacancyStatus.Applied, "resume-1"),
            Applied(company, "Lever role", "jobs.lever.co", "Lever", 82, VacancyStatus.Rejected, "external/Violetta_Nicolaou_CV_EN_v2.pdf"));
        await db.SaveChangesAsync();

        var result = await new OutcomeAnalyticsService(db).GetAsync(CancellationToken.None);

        Assert.AreEqual(3, result.TotalApplications);
        Assert.AreEqual(2, result.Overall.Responses);
        Assert.AreEqual(66.7, result.Overall.ResponseRate);
        Assert.AreEqual(1, result.Overall.Interviews);

        var hh = result.BySource.Single(x => x.Key == "HeadHunter");
        Assert.AreEqual(2, hh.Applications);
        Assert.AreEqual(1, hh.Responses);
        Assert.AreEqual(50.0, hh.ResponseRate);
    }

    [TestMethod]
    public async Task Analytics_AttributesKnownExternalCvButKeepsUnknownBucket()
    {
        await using var db = CreateDb();
        var company = Company("Example");
        db.Companies.Add(company);
        db.Vacancies.AddRange(
            Applied(company, "EN role", "jobs.lever.co", "Lever", 88, VacancyStatus.HrContact, "external/Violetta_Nicolaou_CV_EN_v2.pdf"),
            Applied(company, "Unknown CV", "boards.greenhouse.io", "Greenhouse", 80, VacancyStatus.Applied, "external/manual"),
            Applied(company, "HH role", "hh", "HeadHunter", 91, VacancyStatus.Applied, "hh-resume-id"));
        await db.SaveChangesAsync();

        var result = await new OutcomeAnalyticsService(db).GetAsync(CancellationToken.None);

        Assert.AreEqual(1, result.AttributedCvApplications);
        Assert.IsTrue(result.ByCvVariant.Any(x => x.Label == "Violetta_Nicolaou_CV_EN_v2.pdf" && x.Applications == 1));
        Assert.IsTrue(result.ByCvVariant.Any(x => x.Label == "CV not recorded" && x.Applications == 1));
        Assert.IsTrue(result.ByCvVariant.Any(x => x.Label == "HH selected resume" && x.Applications == 1));
    }

    [TestMethod]
    public void ScoreBands_AreStableAtThresholds()
    {
        var vacancy = new Vacancy { MatchScore = 90 };
        Assert.AreEqual("90-100", OutcomeAnalyticsService.ScoreBand(vacancy));
        vacancy.MatchScore = 85;
        Assert.AreEqual("85-89", OutcomeAnalyticsService.ScoreBand(vacancy));
        vacancy.MatchScore = 75;
        Assert.AreEqual("75-84", OutcomeAnalyticsService.ScoreBand(vacancy));
        vacancy.MatchScore = 65;
        Assert.AreEqual("65-74", OutcomeAnalyticsService.ScoreBand(vacancy));
        vacancy.MatchScore = 64;
        Assert.AreEqual("<65", OutcomeAnalyticsService.ScoreBand(vacancy));
    }

    [TestMethod]
    public void ResponseAndInterviewDefinitions_DoNotCountWaitingApplication()
    {
        Assert.IsFalse(OutcomeAnalyticsService.HasResponse(VacancyStatus.Applied));
        Assert.IsTrue(OutcomeAnalyticsService.HasResponse(VacancyStatus.HrContact));
        Assert.IsFalse(OutcomeAnalyticsService.HasInterview(VacancyStatus.HrContact));
        Assert.IsTrue(OutcomeAnalyticsService.HasInterview(VacancyStatus.HrInterview));
        Assert.IsTrue(OutcomeAnalyticsService.HasInterview(VacancyStatus.Offer));
    }

    private static Company Company(string name)
        => new() { Name = name, Source = "global", ExternalId = Guid.NewGuid().ToString("N") };

    private static Vacancy Applied(
        Company company,
        string title,
        string source,
        string sourceLabel,
        int score,
        VacancyStatus status,
        string resume)
    {
        var vacancy = new Vacancy
        {
            Company = company,
            CompanyId = company.Id,
            Source = source,
            SourceLabel = sourceLabel,
            ExternalId = Guid.NewGuid().ToString("N"),
            CanonicalFingerprint = Guid.NewGuid().ToString("N"),
            Title = title,
            Url = $"https://example.com/{Guid.NewGuid():N}",
            ApplyUrl = "https://example.com/apply",
            Country = source == "hh" ? "Russia" : "Poland",
            IsRemote = true,
            MatchScore = score,
            Status = status
        };
        vacancy.Application = new Application
        {
            Vacancy = vacancy,
            VacancyId = vacancy.Id,
            ResumeExternalId = resume,
            AppliedAt = DateTimeOffset.UtcNow.AddDays(-7)
        };
        return vacancy;
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"outcomes-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }
}
