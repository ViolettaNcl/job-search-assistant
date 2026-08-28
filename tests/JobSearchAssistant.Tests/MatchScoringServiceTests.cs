using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class MatchScoringServiceTests
{
    private readonly MatchScoringService _sut = new(Options.Create(new CandidateProfileOptions()));

    [TestMethod]
    public void StrongJuniorDotNetVacancy_IsStrongMatch()
    {
        var result = _sut.Score(
            "Junior C#/.NET Developer",
            "ASP.NET Core, Entity Framework Core, SQL Server, REST API, LINQ, Docker, Git, unit testing. Remote worldwide.",
            remote: true,
            experience: "between1And3",
            location: "Worldwide",
            remoteScope: "Worldwide");

        Assert.IsTrue(result.Score >= 85);
        Assert.AreEqual("Strong Match", result.Level);
        Assert.AreEqual("Eligible", result.EligibilityStatus);
    }

    [TestMethod]
    public void SeniorLeadVacancy_IsPenalized()
    {
        var result = _sut.Score(
            "Senior .NET Team Lead",
            "C#, .NET, ASP.NET Core, SQL, Docker. 5+ years experience.",
            remote: true,
            experience: "moreThan6");

        Assert.IsTrue(result.Score < 50);
        Assert.AreEqual("Skip", result.Level);
    }

    [TestMethod]
    public void MissingInfrastructureSkill_IsShownButDoesNotAutomaticallyReject()
    {
        var result = _sut.Score(
            "Junior .NET Developer",
            "C#, .NET, ASP.NET Core, SQL, REST, RabbitMQ",
            remote: true,
            experience: "noExperience");

        CollectionAssert.Contains(result.Missing, "RabbitMQ");
        Assert.IsTrue(result.Score > 0);
    }

    [TestMethod]
    public void UsOnlyWithoutSponsorship_IsFlagged()
    {
        var result = _sut.Score(
            "Junior .NET Developer",
            "Remote US only. Must be authorized to work in the United States. No sponsorship.",
            remote: true,
            experience: "between1And3",
            location: "United States",
            remoteScope: "US only");

        Assert.AreEqual("Likely ineligible", result.EligibilityStatus);
    }

    [TestMethod]
    public void RemoteRussianInternship_IsEligibleAndPrioritized()
    {
        var result = _sut.Score(
            "Стажёр C#/.NET",
            "Удалённая стажировка: C#, .NET, ASP.NET Core, SQL, REST API, Git.",
            remote: true,
            experience: "noExperience",
            location: "Россия",
            remoteScope: "Remote Russia");

        Assert.AreEqual("Eligible", result.EligibilityStatus);
        Assert.IsTrue(result.Score >= 65);
    }

    [TestMethod]
    public void OnSiteVacancy_IsRejectedByRemoteOnlyProfile()
    {
        var result = _sut.Score(
            "Junior .NET Developer",
            "Office position. C#, .NET, ASP.NET Core, SQL.",
            remote: false,
            experience: "noExperience",
            location: "Moscow",
            remoteScope: "On-site");

        Assert.AreEqual("Likely ineligible", result.EligibilityStatus);
        Assert.AreEqual("Skip", result.Level);
    }
}
