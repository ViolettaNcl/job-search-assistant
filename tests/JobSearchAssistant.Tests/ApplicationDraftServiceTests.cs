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
        StringAssert.Contains(draft.CoverLetter, "API");
        StringAssert.Contains(draft.CoverLetter, "GitHub: https://github.com/ViolettaNcl");
        Assert.IsFalse(draft.CoverLetter.Contains("диплом", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(draft.CoverLetter.Contains("официальная работа", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(draft.CoverLetter.Length < 750);
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
        StringAssert.Contains(draft.CoverLetter, "data and databases");
        Assert.IsFalse(draft.CoverLetter.Contains("Redis", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(draft.CoverLetter.Contains("honours", StringComparison.OrdinalIgnoreCase));
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
        StringAssert.Contains(draft.CoverLetter, "Testing");
        StringAssert.Contains(draft.CoverLetter, "project");
        Assert.IsFalse(draft.CoverLetter.Contains("years of QA experience", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void NonTechnicalRole_UsesItsDescriptionInsteadOfDeveloperTemplate()
    {
        var draft = _sut.Build(
            "Customer Support Specialist",
            "HelpfulCo",
            "Help customers, answer support requests, document solutions and communicate in English.",
            "Cyprus",
            "browser",
            76,
            [],
            []);

        StringAssert.Contains(draft.CoverLetter, "customers and users");
        StringAssert.Contains(draft.CoverLetter, "clarify needs");
        StringAssert.Contains(draft.CoverLetter, "English, Russian and Greek");
        Assert.IsFalse(draft.CoverLetter.Contains("ASP.NET", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(draft.CoverLetter.Contains("SQL", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(draft.CoverLetter.Contains("diploma", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void RussianWrittenSupportRole_GetsShortSupportSpecificLetter()
    {
        var draft = _sut.Build(
            "Специалист письменной поддержки клиентов каршеринга",
            "Dream Job",
            "Отвечать клиентам в чате, разбирать обращения, понятно объяснять решение и поддерживать высокое качество сервиса.",
            "Россия",
            "hh",
            70,
            [],
            []);

        Assert.AreEqual("ru", draft.Language);
        StringAssert.Contains(draft.CoverLetter, "клиентами и пользователями");
        StringAssert.Contains(draft.CoverLetter, "понятно объяснять сложные вещи");
        Assert.IsFalse(draft.CoverLetter.Contains("ASP.NET", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(draft.CoverLetter.Contains("SQL", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(draft.CoverLetter.Contains("диплом", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(draft.CoverLetter.Length < 750);
    }

    [TestMethod]
    public void DifferentDescriptions_ProduceDifferentHumanLetters()
    {
        var apiRole = _sut.Build("Junior Developer", "Example", "Build REST API integrations and work with SQL databases.", "Russia", "hh", 82, ["REST API", "SQL"], []);
        var uiRole = _sut.Build("Junior Developer", "Example", "Create React user interfaces and improve frontend usability.", "Russia", "hh", 82, ["React"], []);

        Assert.AreNotEqual(apiRole.CoverLetter, uiRole.CoverLetter);
        StringAssert.Contains(apiRole.CoverLetter, "API");
        StringAssert.Contains(uiRole.CoverLetter, "интерфейс");
    }
    [TestMethod]
    public void GroundedLettersKeepVacancyAndEmployerInsteadOfReusingGenericOpening()
    {
        var first = _sut.Build("Junior Backend Developer", "API Company", "Required: C#, SQL, REST.", "Russia", "hh", 90, ["C#", "SQL", "REST"], []);
        var second = _sut.Build("Junior Integration Developer", "Integration Company", "Required: C#, SQL, REST.", "Russia", "hh", 90, ["C#", "SQL", "REST"], []);
        StringAssert.Contains(first.CoverLetter, "Junior Backend Developer");
        StringAssert.Contains(first.CoverLetter, "API Company");
        StringAssert.Contains(second.CoverLetter, "Integration Company");
        Assert.AreNotEqual(first.CoverLetter, second.CoverLetter);
        StringAssert.Contains(first.CoverLetter, "https://github.com/ViolettaNcl/DentalClinic");
    }

    [TestMethod]
    public void FullStackLetterIncludesComplementaryFrontendProjectAndOnlyVerifiedSkills()
    {
        var draft = _sut.Build("Junior Fullstack Developer", "Example", "Required: C#, ASP.NET Core, SQL, React, TypeScript. Preferred: Azure.", "Russia", "hh", 90, ["C#", "SQL", "React"], ["Azure"]);
        CollectionAssert.AreEqual(new[] { "dental", "cv" }, draft.Strategy!.Projects.Select(p => p.Id).ToArray());
        StringAssert.Contains(draft.CoverLetter, "DentalClinic");
        StringAssert.Contains(draft.CoverLetter, "CV / Portfolio");
        StringAssert.Contains(draft.CoverLetter, "React");
        Assert.IsFalse(draft.CoverLetter.Contains("Azure"));
        Assert.IsTrue(draft.CoverLetter.Length < 1000);
        Assert.AreEqual(draft.Strategy.Headline, draft.RecommendedHeadline);
    }

    [TestMethod]
    public void FrontendDesktopAndQaHeadlinesAgreeWithApplicationStrategy()
    {
        foreach (var row in new[] {
            ("Junior Frontend Developer", "Required: React, Next.js, TypeScript.", "Frontend"),
            ("Junior WPF Developer", "Required: WPF, C#, SQL Server.", "C# Desktop"),
            ("Junior QA Engineer", "Required: WPF, C#, Testing.", "QA Automation") })
        {
            var draft = _sut.Build(row.Item1, "Example", row.Item2, "Russia", "hh", 90, [], []);
            Assert.AreEqual(row.Item3, draft.Strategy!.CvVariant);
            Assert.AreEqual(draft.Strategy.Headline, draft.RecommendedHeadline);
        }
    }

}
