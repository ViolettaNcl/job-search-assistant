using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class ScreeningReviewTests
{
    private static ScreeningReview Review(string description, string? cv = null)
    {
        var options = Options.Create(new CandidateProfileOptions());
        var assessment = new OpportunityScoringService(options).Assess("Junior .NET Developer", description, true, location: "Russia");
        return new ScreeningReviewService(new EvidenceRetrievalService(new CandidateKnowledgeService(options))).Review(assessment, cv);
    }

    [TestMethod]
    public void MissingResumeIsUnknownNotAParsingFailure()
    {
        var r = Review("Required: C#, SQL.");
        Assert.IsFalse(r.ResumeTextChecked);
        Assert.AreEqual("Unknown", r.EmployerDecisionReason);
        Assert.AreEqual(0, r.VerifiedTermsToAdd.Length);
        Assert.IsTrue(r.Requirements.All(t => t.ResumeState == "Not checked"));
    }

    [TestMethod]
    public void AddOnlyRelevantVerifiedSkillsMissingFromActualText()
    {
        var r = Review("Required: C#, SQL Server, Azure.", "C# projects");
        CollectionAssert.Contains(r.VerifiedTermsToAdd, "SQL Server");
        CollectionAssert.DoesNotContain(r.VerifiedTermsToAdd, "Azure");
        CollectionAssert.Contains(r.UnsupportedRequirements, "Azure");
        Assert.IsFalse(r.SuggestedResumeExcerpt.Contains("Azure"));
        Assert.IsTrue(r.ReviewReasons.Length > 0);
    }

    [TestMethod]
    public void RecognizesResumeAliasesWithoutKeywordStuffing()
    {
        var r = Review("Required: C#, SQL Server, EF Core, REST API.", "C sharp, MSSQL, Entity Framework Core, Web API");
        Assert.AreEqual(0, r.VerifiedTermsToAdd.Length);
        Assert.IsTrue(r.Requirements.All(t => t.ResumeState == "Mentioned"));
    }

    [TestMethod]
    public void GeneralSqlDoesNotProveSpecificSqlServerMention()
    {
        var r = Review("Required: C#, SQL Server.", "C#, SQL");
        CollectionAssert.Contains(r.VerifiedTermsToAdd, "SQL Server");
    }

    [TestMethod]
    public void CvClaimsCannotOverrideVerifiedKnowledgeOrEmploymentReview()
    {
        var r = Review("Required: C#, SQL, Azure. 3 years experience required.", "C# SQL Azure, 5 years commercial experience");
        CollectionAssert.Contains(r.UnsupportedRequirements, "Azure");
        Assert.IsTrue(r.ReviewReasons.Any(x => x.Contains("years")));
        Assert.IsFalse(r.SuggestedResumeExcerpt.Contains("commercial experience"));
        Assert.AreEqual("Unknown", r.EmployerDecisionReason);
    }

    [TestMethod]
    public void DesktopExcerptSelectsFleetAndClearlyLabelsProjectWork()
    {
        var r = Review("Required: WPF, EF6, SQL Server.");
        StringAssert.Contains(r.SuggestedResumeExcerpt, "FleetManagement");
        StringAssert.Contains(r.SuggestedResumeExcerpt, "project experience");
        StringAssert.Contains(r.SuggestedResumeExcerpt, "github.com");
    }

    [TestMethod]
    public void ActionsSeparateMandatoryGapsFromPreferredSkillsAndDoNotDiagnoseRejection()
    {
        var r = Review("Required: C#, SQL. Preferred: Azure.", "C#");
        Assert.IsFalse(r.Actions.Any(a => a.Code == "must-have-gap"));
        Assert.IsTrue(r.Actions.Any(a => a.Code == "describe-project-evidence" && a.Message.Contains("SQL")));
        Assert.AreEqual("Unknown", r.EmployerDecisionReason);
        var mandatory = Review("Required: C#, SQL, Azure. 3 years experience required.", "C# SQL Azure");
        Assert.IsTrue(mandatory.Actions.Any(a => a.Code == "must-have-gap" && a.Priority == "High"));
        Assert.IsTrue(mandatory.Actions.Any(a => a.Code == "unverified-resume-claim"));
        Assert.IsTrue(mandatory.Actions.Any(a => a.Code == "employment-review"));
        Assert.AreEqual(0, mandatory.VerifiedTermsToAdd.Length);
        Assert.IsFalse(mandatory.SuggestedResumeExcerpt.Contains("Azure"));
    }

    [TestMethod]
    public void MissingResumeAndMandatoryEducationProduceSpecificNextActions()
    {
        var r = Review("Required: C#, SQL. University degree required.");
        Assert.IsTrue(r.Actions.Any(a => a.Code == "check-selected-resume"));
        Assert.IsTrue(r.Actions.Any(a => a.Code == "education-review"));
        Assert.IsFalse(r.Actions.Any(a => a.Code == "describe-project-evidence"));
    }

    [TestMethod]
    public void NoEvidenceProducesNoInventedResumeExcerpt()
    {
        var r = Review("Required: Python, Azure.", "Python Azure");
        Assert.AreEqual("", r.SuggestedResumeExcerpt);
        Assert.AreEqual(0, r.VerifiedTermsToAdd.Length);
        Assert.AreEqual(2, r.UnsupportedRequirements.Length);
    }
}
