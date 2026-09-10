using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class JobOperatorCoreTests
{
    private static readonly CandidateProfileOptions Profile = new();
    private static OpportunityAssessment Assess(string text, string title = "Junior .NET Developer", bool remote = true, string location = "Worldwide", SearchOptions? search = null)
        => new OpportunityScoringService(Options.Create(Profile), Options.Create(search ?? new())).Assess(title, text, remote, "noExperience", location);

    [TestMethod]
    public void AliasesDoNotInflateOpportunity()
    {
        var a = Assess("Required: ASP.NET Core, SQL Server, REST. Remote worldwide.");
        var b = Assess("Required: ASP.NET Core, .NET, SQL Server, SQL, REST API, REST. Remote worldwide.");
        Assert.AreEqual(a.OverallScore, b.OverallScore);
        Assert.AreEqual(a.Dimensions[0].Score, b.Dimensions[0].Score);
    }

    [TestMethod]
    public void JuniorPreferredAndSeniorRejected()
    {
        var text = "Required: C#, ASP.NET Core, SQL. Remote worldwide.";
        Assert.AreEqual("APPLY", Assess(text).Decision);
        Assert.AreEqual("SKIP", Assess(text, "Senior .NET Developer").Decision);
        Assert.IsTrue(Assess(text).OverallScore > Assess(text, ".NET Developer").OverallScore);
    }

    [TestMethod]
    public void RequiredExperienceIsNotInterchangeableWithPreferred()
    {
        var required = Assess("C#, SQL. 2 years experience required. Remote worldwide.");
        var preferred = Assess("C#, SQL. 2 years experience preferred. Remote worldwide.");
        Assert.AreEqual(2, required.Understanding.RequiredYears);
        Assert.AreEqual(2, preferred.Understanding.PreferredYears);
        Assert.AreEqual("REVIEW", required.Decision);
        Assert.IsTrue(required.OverallScore < preferred.OverallScore);
    }

    [TestMethod]
    public void RemotePreferredAllowsLocalOnsiteButHonorsExplicitRemoteOnly()
    {
        Assert.AreEqual("Eligible", Assess("C#, SQL", remote: false, location: "Волгоград", search: new() { RemoteOnly = false }).EligibilityStatus);
        Assert.AreEqual("Likely ineligible", Assess("C#, SQL", remote: false, location: "Волгоград", search: new() { RemoteOnly = true }).EligibilityStatus);
        Assert.AreEqual("Likely ineligible", Assess("C#, SQL", remote: false, location: "Moscow").EligibilityStatus);
    }

    [TestMethod]
    public void RemoteOnlyDefaultRejectsLocalOfficeAndContradictoryLabels()
    {
        Assert.AreEqual("SKIP", Assess("C#, SQL", remote: false, location: "Волгоград").Decision);
        foreach (var condition in new[] { "Hybrid, two office days", "Remote after probation", "Must attend the office weekly", "Обязательное посещение офиса", "Удалёнка после испытательного срока", "На месте работодателя", "Не удалённая работа" })
        {
            var result = Assess("Required: C#, SQL. Remote worldwide. " + condition);
            Assert.AreEqual("SKIP", result.Decision, condition);
            Assert.AreNotEqual("Remote", result.Understanding.WorkMode, condition);
        }
        Assert.AreEqual("APPLY", Assess("Required: C#, SQL. Fully remote worldwide. Hybrid cloud architecture.").Decision);
        Assert.IsFalse(RemoteWorkPolicy.IsFullyRemote(false, "C# SQL"));
    }

    [TestMethod]
    public void ResidenceRestrictionOverridesWorldwideAndCitizenship()
    {
        Assert.AreEqual("Verify", Assess("C#, SQL. Worldwide company. Must reside in Poland.").EligibilityStatus);
        Assert.AreEqual("Likely ineligible", Assess("C#, SQL. Remote worldwide. US only.").EligibilityStatus);
    }

    [TestMethod]
    public void BestProjectFollowsEvidence()
    {
        var service = new EvidenceRetrievalService(new(Options.Create(Profile)));
        Assert.AreEqual("fleet", service.Select(Assess("WPF SQL Server C#", "Junior C# WPF Developer")).Projects[0].Id);
        Assert.AreEqual("route", service.Select(Assess("PHP algorithms machine learning", "Junior Software Engineer")).Projects[0].Id);
        Assert.AreEqual("dental", service.Select(Assess("ASP.NET Core REST EF Core", "Junior Backend Developer")).Projects[0].Id);
    }

    [TestMethod]
    public void MissingSkillsRemainMissingDespiteFlatProfileClaims()
    {
        var a = new OpportunityScoringService(Options.Create(Profile with { CoreSkills = ["Azure", "Python"] }))
            .Assess("Junior .NET Developer", "Required: C#, SQL, Azure, Python. Remote worldwide.", true);
        Assert.IsTrue(a.Matches.Single(m => m.Requirement.Skill == "Azure").ProjectIds.Length == 0);
        Assert.AreEqual("REVIEW", a.Decision);
    }

    [TestMethod]
    public void IdentityAndPrivateDataHaveExplicitBoundaries()
    {
        var k = new CandidateKnowledgeService(Options.Create(Profile)).Get();
        Assert.AreEqual("Виолетта Николау", k.Identity.Russian);
        Assert.AreEqual("", Profile.Phone);
        Assert.IsNull(k.Identity.Patronymic);
        Assert.IsTrue(new CandidateKnowledgeService(Options.Create(Profile with { RussianName = "unverified name" })).Get().Identity.Conflicts.Length > 0);
        Assert.IsTrue(k.UnknownFacts.Any(x => x.Contains("employment")));
        Assert.IsTrue(k.Projects.All(x => x.Sources.Length > 0 && x.ExperienceKind.Contains("not employment")));
    }

    [TestMethod]
    public void NonTechnicalJobsAreOutsideRecommendedCareerLanes()
        => Assert.AreEqual("SKIP", Assess("Help customers by email", "Customer Service Agent").Decision);
}
