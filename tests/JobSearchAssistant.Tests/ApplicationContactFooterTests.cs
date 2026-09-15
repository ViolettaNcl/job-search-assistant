using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;
[TestClass]
public sealed class ApplicationContactFooterTests
{
    [TestMethod]
    public void RussianAndEnglishDraftsIncludeConfiguredEmailOnce()
    {
        const string email = "candidate@example.com";
        var service = new ApplicationDraftService(Options.Create(new CandidateProfileOptions { Email = email }));
        foreach (var (title, description, country, source) in new[] {
            ("Junior C# разработчик", "C# SQL API удаленная работа", "Russia", "hh"),
            ("Специалист поддержки", "Поддержка клиентов и ответы на вопросы", "Russia", "hh"),
            ("Junior C# Developer", "C# SQL API remote worldwide", "UK", "browser") })
        {
            var draft = service.Build(title, "Example", description, country, source, 85, ["C#", "SQL"], []);
            Assert.AreEqual(2, draft.CoverLetter.Split(email).Length);
            Assert.AreEqual(2, draft.ShortMessage.Split(email).Length);
            StringAssert.Contains(draft.CoverLetter, "Email:");
        }
    }
    [TestMethod]
    public void FooterDoesNotDuplicateOrCreateAnApplicationFromEmptyText()
    {
        const string letter = "Hello. Email: candidate@example.com";
        Assert.AreEqual(letter, ApplicationContactFooter.Append(letter, "candidate@example.com", false));
        Assert.AreEqual("", ApplicationContactFooter.Append("", "candidate@example.com", false));
        Assert.AreEqual("Hello", ApplicationContactFooter.Append("Hello", "", false));
    }
    [TestMethod]
    public void OperatorWriterIncludesEmailAndPreservesProjectEvidence()
    {
        var options = Options.Create(new CandidateProfileOptions { Email = "candidate@example.com" });
        var assessment = new OpportunityScoringService(options).Assess("Junior C#", "C# SQL API remote worldwide", true);
        var strategy = new EvidenceRetrievalService(new CandidateKnowledgeService(options)).Select(assessment);
        var writer = new ApplicationWritingService(options);
        StringAssert.Contains(writer.Write(strategy, true).Letter, "Email: candidate@example.com");
        StringAssert.Contains(writer.AddContact("Suggested project letter.", false), "Email: candidate@example.com");
    }
    [TestMethod]
    public void TelegramIsNormalizedAndAddedOnceAlongsideEmail()
    {
        var text = ApplicationContactFooter.Append("Здравствуйте!", "candidate@example.com", true, "https://t.me/Violet111");
        StringAssert.Contains(text, "Email: candidate@example.com · Telegram: @Violet111");
        Assert.AreEqual(text, ApplicationContactFooter.Append(text, "candidate@example.com", true, "@Violet111"));
        Assert.AreEqual("", ApplicationContactFooter.NormalizeTelegram("@name with spaces"));
        Assert.AreEqual("", ApplicationContactFooter.NormalizeTelegram("https://evil.test/Violet111"));
        Assert.AreEqual("", ApplicationContactFooter.NormalizeTelegram(""));
        Assert.AreEqual("@Violet111", new CandidateProfileOptions().Telegram);
    }

}
