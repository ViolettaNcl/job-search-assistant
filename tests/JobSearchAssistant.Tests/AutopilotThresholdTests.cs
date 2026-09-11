using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;
[TestClass]
public sealed class AutopilotThresholdTests
{
    private readonly OpportunityScoringService scoring = new(Options.Create(new CandidateProfileOptions()));
    [TestMethod]
    public void LowerThresholdChangesDecisionWithoutChangingEvidenceScore()
    {
        const string text = "C#, SQL. Nice to have: Python Azure AWS Kubernetes Redis. Remote worldwide.";
        var normal = scoring.Assess("Junior .NET Developer", text, true);
        var lower = scoring.Assess("Junior .NET Developer", text, true, minimumScore: 50);
        Assert.IsTrue(lower.OverallScore >= 50 && lower.OverallScore < 75);
        Assert.AreEqual(normal.OverallScore, lower.OverallScore);
        Assert.AreEqual("REVIEW", normal.Decision);
        Assert.AreEqual("APPLY", lower.Decision);
    }
    [TestMethod]
    public void LowerThresholdKeepsEmploymentAndSenioritySelection()
    {
        foreach (var text in new[] { "C#, SQL. 3 years experience required." })
            Assert.AreNotEqual("APPLY", scoring.Assess("Junior .NET Developer", text, true, location: "Worldwide", minimumScore: 50).Decision);
        Assert.AreEqual("SKIP", scoring.Assess("Senior .NET Developer", "C#, SQL", true, location: "Worldwide", minimumScore: 50).Decision);
    }
    [TestMethod]
    public void EducationCountryAndMissingSkillsAreAdviceRatherThanVetoes()
    {
        foreach (var requirement in new[] { "Required: Azure.", "University degree required.", "US only.", "Must reside in Poland.", "Russia excluded." })
        {
            var result = scoring.Assess("Junior .NET Developer", "Required: C#, SQL. Remote worldwide. " + requirement, true, minimumScore: 50);
            Assert.AreEqual("APPLY", result.Decision, requirement);
            Assert.IsTrue(result.ReviewReasons.Length > 0, "Advice remains truthful.");
            if (requirement.Contains("Azure")) Assert.AreEqual("Not evidenced", result.Matches.Single(m => m.Requirement.Skill == "Azure").State);
        }
    }

}
