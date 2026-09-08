using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class OperatorWritingTests
{
    private static readonly IOptions<CandidateProfileOptions> Profile = Options.Create(new CandidateProfileOptions());
    private static OperatorPreparationService Service(ReasoningSuggestion? suggestion)
    {
        var knowledge = new CandidateKnowledgeService(Profile);
        return new(new(Profile), new(knowledge), knowledge, new(Profile), new FakeProvider(suggestion));
    }
    private sealed class FakeProvider(ReasoningSuggestion? suggestion) : IAiReasoningProvider
    {
        public Task<ReasoningSuggestion?> SuggestAsync(ReasoningInput input, CancellationToken ct) => Task.FromResult(suggestion);
    }
    private static Task<OperatorPreparation> Prepare(ReasoningSuggestion? suggestion) => Service(suggestion).PrepareAsync("Junior .NET Developer", "Required C#, ASP.NET Core, SQL. Remote worldwide.", true, "noExperience", "Worldwide", "", true, CancellationToken.None);

    [TestMethod]
    public async Task DisabledAiProducesShortEvidenceGroundedApplication()
    {
        var result = await Prepare(null);
        Assert.AreEqual("deterministic-fallback", result.Application.ReasoningMode);
        Assert.IsTrue(result.Application.Letter.Length < 1000);
        StringAssert.Contains(result.Application.Letter, "DentalClinic");
        Assert.IsFalse(result.Application.Letter.Contains("с отличием"));
        Assert.IsFalse(result.Application.Letter.Contains("коммерческ"));
    }
    [TestMethod]
    public async Task InventedSkillOrEmploymentIsRejected()
    {
        foreach (var letter in new[] { "I use Python and Azure.", "I have 2 years commercial experience." })
        {
            var result = await Prepare(new("Backend APIs", ["dental"], letter, []));
            Assert.AreEqual("invalid-output-fallback", result.ProviderStatus);
            Assert.AreNotEqual(letter, result.Application.Letter);
            Assert.IsTrue(result.Application.RequiresReview);
        }
    }
    [TestMethod]
    public async Task EvenValidAiProseRemainsAReviewableSuggestion()
    {
        var result = await Prepare(new("Backend APIs", ["dental"], "My DentalClinic project uses C# and SQL Server.", []));
        Assert.AreEqual("ai-assisted-suggestion", result.Application.ReasoningMode);
        Assert.IsTrue(result.Application.RequiresReview);
    }
    [TestMethod]
    public async Task UnknownEvidenceCannotBeUsed()
        => Assert.AreEqual("invalid-output-fallback", (await Prepare(new("Backend", ["invented"], "My project uses C#.", []))).ProviderStatus);
    [TestMethod]
    public void CountryExclusionsAndMissingDescriptionBlockAutomaticApply()
    {
        var scoring = new OpportunityScoringService(Profile);
        Assert.AreEqual("Likely ineligible", scoring.Assess("Junior .NET Developer", "C#, SQL. Worldwide except Russia.", true).EligibilityStatus);
        Assert.AreNotEqual("APPLY", scoring.Assess("Junior C# SQL Developer", "", true, location: "Worldwide").Decision);
    }
    [TestMethod]
    public void RecruiterInvitationAndTaskDeadlinesTakePriority()
    {
        var service = new RecruiterMessageService();
        var invitation = service.Classify("Приглашаем на собеседование завтра.");
        CollectionAssert.Contains(invitation.Intents, "interview");
        Assert.AreEqual("CRITICAL", invitation.Urgency);
        Assert.AreEqual("HrInterview", invitation.PipelineStage);
        var task = service.Classify("Please complete the technical assignment by tomorrow.");
        CollectionAssert.Contains(task.Intents, "test-assignment");
        Assert.AreEqual("CRITICAL", task.Urgency);
    }
    [TestMethod]
    public void SalaryLegalExperienceAndTechnicalQuestionsAlwaysNeedCandidate()
    {
        var service = new RecruiterMessageService();
        foreach (var message in new[] { "What are your salary expectations?", "Do you need visa sponsorship?", "Ваш коммерческий стаж?", "Explain how this algorithm works." })
        {
            var result = service.Classify(message);
            Assert.IsTrue(result.RequiresApproval);
            Assert.AreEqual("HIGH", result.Risk);
            Assert.IsTrue(result.UnknownFacts.Length > 0);
        }
        Assert.AreEqual("LOW", service.Classify("Thank you for applying.").Urgency);
    }
}
