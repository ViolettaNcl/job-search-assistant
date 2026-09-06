using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class ApplicationDraftServiceTests
{
    private readonly ApplicationDraftService _sut = new(Options.Create(new CandidateProfileOptions()));

    [TestMethod]
    public void RussianDotNetRole_UsesRussianIdentityAndCv()
    {
        var draft = _sut.Build(
            "Junior .NET Developer",
            "ExampleSoft",
            "C# ASP.NET Core EF Core SQL Server REST API Git Docker",
            "Russia",
            "hh",
            92,
            ["C#", "ASP.NET Core", "EF Core", "SQL Server", "REST API", "Git", "Docker"],
            []);

        Assert.AreEqual("ru", draft.Language);
        Assert.AreEqual("Виолетта Николау", draft.CandidateName);
        Assert.AreEqual("Violetta_Nicolaou_CV_RU_v2.pdf", draft.RecommendedCv);
        StringAssert.Contains(draft.CoverLetter, "DentalClinic");
        StringAssert.Contains(draft.CoverLetter, "первый официальный developer role");
    }

    [TestMethod]
    public void EuropeanRole_UsesEnglishCvAndNeverInventsMissingSkill()
    {
        var draft = _sut.Build(
            "Junior Backend Developer",
            "Example EU",
            "C# .NET SQL Redis. EU remote.",
            "Poland",
            "browser",
            84,
            ["C#", ".NET", "SQL"],
            ["Redis"]);

        Assert.AreEqual("en", draft.Language);
        Assert.AreEqual("Violetta_Nicolaou_CV_EN_v2.pdf", draft.RecommendedCv);
        CollectionAssert.Contains(draft.VerifyBeforeSubmit, "Do not claim these skills unless independently verified: Redis.");
        StringAssert.Contains(draft.CoverLetter, "less hands-on experience with Redis");
    }

    [TestMethod]
    public void QaRole_RepositionsWithoutPretendingQaEmployment()
    {
        var draft = _sut.Build(
            "Junior QA Engineer",
            "QualityCo",
            "API testing, SQL, Git, automated testing, C#",
            "Cyprus",
            "browser",
            88,
            ["Automated Testing", "SQL", "Git", "C#"],
            []);

        StringAssert.Contains(draft.RecommendedHeadline, "QA");
        StringAssert.Contains(draft.CoverLetter, "early in my professional developer career");
        Assert.IsFalse(draft.CoverLetter.Contains("years of QA experience", StringComparison.OrdinalIgnoreCase));
    }
}
