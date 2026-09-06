using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class EligibilityScoringTests
{
    private readonly MatchScoringService _sut = new(Options.Create(new CandidateProfileOptions
    {
        RussiaWorkAuthorized = true,
        EuWorkAuthorized = true
    }));

    [TestMethod]
    public void EuRemoteRole_IsEligibleForCyprusEuCitizen()
    {
        var result = _sut.Score(
            "Junior .NET Developer",
            "Remote within the European Union. C#, .NET, ASP.NET Core and SQL.",
            remote: true,
            experience: "noExperience",
            location: "European Union",
            remoteScope: "EU only");

        Assert.AreEqual("Eligible", result.EligibilityStatus);
        Assert.IsTrue(result.Score >= 65);
    }

    [TestMethod]
    public void RussianRemoteRole_IsEligibleForRussianCitizen()
    {
        var result = _sut.Score(
            "Junior C# Developer",
            "Удалённая работа по России. C#, ASP.NET Core, SQL, Git.",
            remote: true,
            experience: "noExperience",
            location: "Россия",
            remoteScope: "Remote Russia");

        Assert.AreEqual("Eligible", result.EligibilityStatus);
    }
}
