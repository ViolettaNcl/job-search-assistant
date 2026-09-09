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
    public void LowerThresholdCannotBypassHardRequirements()
    {
        foreach (var text in new[] { "Required: C#, SQL, Azure.", "C#, SQL. 3 years experience required.", "C#, SQL. US only." })
            Assert.AreNotEqual("APPLY", scoring.Assess("Junior .NET Developer", text, true, location: "Worldwide", minimumScore: 50).Decision);
        Assert.AreEqual("SKIP", scoring.Assess("Senior .NET Developer", "C#, SQL", true, location: "Worldwide", minimumScore: 50).Decision);
    }
}
