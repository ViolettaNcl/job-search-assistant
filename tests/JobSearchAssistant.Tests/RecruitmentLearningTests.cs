using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class RecruitmentLearningTests
{
    [TestMethod]
    public void Learning_BoostsSegmentsWithRepeatedResponses_AndIgnoresTinySamples()
    {
        var candidate = Vacancy("Junior .NET Developer", "hh", "HeadHunter", VacancyStatus.New);
        var positiveHistory = Enumerable.Range(0, 6)
            .Select(i => Vacancy("Junior .NET Developer", "hh", "HeadHunter", i < 4 ? VacancyStatus.HrContact : VacancyStatus.Applied))
            .ToArray();
        var tinyHistory = positiveHistory.Take(2).ToArray();

        Assert.IsTrue(RecruitmentLearning.CalculateBoost(candidate, positiveHistory) > 0);
        Assert.AreEqual(0, RecruitmentLearning.CalculateBoost(candidate, tinyHistory));
    }

    [TestMethod]
    public void Learning_DoesNotTransferUnrelatedRoleHistory()
    {
        var candidate = Vacancy("Junior .NET Developer", "career", "Career site", VacancyStatus.New);
        var unrelated = Enumerable.Range(0, 6)
            .Select(_ => Vacancy("QA Internship", "hh", "HeadHunter", VacancyStatus.HrInterview))
            .ToArray();

        Assert.AreEqual(0, RecruitmentLearning.CalculateBoost(candidate, unrelated));
    }

    private static Vacancy Vacancy(string title, string source, string sourceLabel, VacancyStatus status)
    {
        var vacancy = new Vacancy
        {
            Title = title,
            Source = source,
            SourceLabel = sourceLabel,
            Status = status,
            Company = new Company { Name = "Example" }
        };
        if (status != VacancyStatus.New)
            vacancy.Application = new Application { Vacancy = vacancy, VacancyId = vacancy.Id };
        return vacancy;
    }
}
