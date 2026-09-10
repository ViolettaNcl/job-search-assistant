using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class JuniorAutopilotTests
{
    private readonly OpportunityScoringService scoring = new(Options.Create(new CandidateProfileOptions()));

    [TestMethod]
    public void JuniorOneToThreeBandCanApplyAcrossVerifiedTechnicalDirections()
    {
        foreach (var band in new[] { "between1And3", "1–3 года", "От 1 года до 3 лет", "1-3 years" })
        foreach (var role in new[] {
            ("Junior .NET Developer", "C#, ASP.NET Core, SQL"),
            ("Junior Frontend Developer", "React, TypeScript, Next.js"),
            ("Junior QA Automation Engineer", "C#, SQL, Testing"),
            ("Junior Implementation Engineer", "SQL, REST"),
            ("Junior Technical Support Engineer", "SQL, REST"),
            ("Junior WPF Developer", "C#, WPF, SQL Server") })
        {
            var result = scoring.Assess(role.Item1, "Required: " + role.Item2 + ". Remote Russia.", true, band, "Russia");
            Assert.AreEqual("APPLY", result.Decision, role.Item1 + " / " + band);
            Assert.IsTrue(result.Dimensions.Any(d => d.Name == "Experience compatibility" && d.Explanation.Contains("no employment years claimed")));
        }
    }

    [TestMethod]
    public void InternshipsAreNotRestrictedToDotNet()
    {
        foreach (var role in new[] { ("Frontend Intern", "React, TypeScript"), ("Стажёр PHP", "PHP, Algorithms"), ("Стажёр тестировщик", "SQL, Testing") })
            Assert.AreEqual("APPLY", scoring.Assess(role.Item1, "Required: " + role.Item2 + ". Remote Russia.", true, "noExperience", "Russia").Decision);
    }

    [TestMethod]
    public void BandPreferenceDoesNotAuthorizeRequiredEmploymentOrOtherHardGaps()
    {
        foreach (var requirement in new[] { "2 years commercial experience required.", "Обязателен опыт работы от 2 лет.", "Required: Azure.", "University degree required.", "US only." })
            Assert.AreNotEqual("APPLY", scoring.Assess("Junior .NET Developer", "Required: C#, SQL. Remote Russia. " + requirement, true, "between1And3", "Russia", minimumScore: 50).Decision, requirement);
        Assert.AreNotEqual("APPLY", scoring.Assess("Junior .NET Developer", "C#, SQL. Remote Russia.", true, "3 years commercial experience required", "Russia", minimumScore: 50).Decision);
        Assert.AreNotEqual("APPLY", scoring.Assess("Junior .NET Developer", "C#, SQL. Remote Russia.", true, "one year of employment required", "Russia", minimumScore: 50).Decision);
        Assert.AreNotEqual("APPLY", scoring.Assess("Junior .NET Developer", "C#, SQL. Remote Russia.", true, "3–6 лет", "Russia", minimumScore: 50).Decision);
        Assert.AreEqual("REVIEW", scoring.Assess(".NET Developer", "C#, SQL. Remote Russia.", true, "between1And3", "Russia").Decision);
        Assert.AreEqual("SKIP", scoring.Assess("Senior .NET Developer", "C#, SQL. Remote Russia.", true, "between1And3", "Russia").Decision);
        Assert.AreEqual("SKIP", scoring.Assess("Junior Customer Support", "Answer customer calls.", true, "noExperience", "Russia").Decision);
    }

    [TestMethod]
    public void DefaultSearchIncludesComplementaryJuniorDirections()
    {
        var queries = string.Join(" ", new SearchOptions().RussiaQueries);
        foreach (var term in new[] { "C#", ".NET", "React", "QA", "WPF", "PHP", "TypeScript", "внедрению", "поддержки" }) StringAssert.Contains(queries, term);
        Assert.IsTrue(new SearchOptions().RemoteOnly);
    }
}
