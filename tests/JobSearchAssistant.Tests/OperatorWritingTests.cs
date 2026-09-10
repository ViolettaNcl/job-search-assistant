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
    private sealed class JsonHandler(string response) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(response) });
        }
    }
    [TestMethod]
    public async Task ConfiguredProviderParsesFakeTransportAndRejectsMalformedStructure()
    {
        var knowledge = new CandidateKnowledgeService(Profile);
        var assessment = new OpportunityScoringService(Profile).Assess("Junior .NET Developer", "C#, SQL", true, location: "Worldwide");
        var input = new ReasoningInput("Junior .NET", "C#, SQL", new EvidenceRetrievalService(knowledge).Select(assessment), false);
        var fixture = System.Text.Json.JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = "{\"employerNeed\":\"APIs\",\"evidenceIds\":[\"dental\"],\"letter\":\"My project uses C#.\",\"unknowns\":[]}" } } } });
        var handler = new JsonHandler(fixture);
        var configured = Options.Create(new ReasoningOptions { Enabled = true, Endpoint = "https://provider.invalid/v1/chat/completions", Model = "test-fixture", ApiKey = "test-fixture" });
        var provider = new ChatReasoningProvider(new HttpClient(handler), configured);
        Assert.AreEqual("APIs", (await provider.SuggestAsync(input, CancellationToken.None))!.EmployerNeed);
        Assert.AreEqual(1, handler.Calls);
        var disabledHandler = new JsonHandler("{}");
        Assert.IsNull(await new ChatReasoningProvider(new HttpClient(disabledHandler), Options.Create(new ReasoningOptions())).SuggestAsync(input, CancellationToken.None));
        Assert.AreEqual(0, disabledHandler.Calls);
        var malformed = new ChatReasoningProvider(new HttpClient(new JsonHandler("{}")), configured);
        var service = new OperatorPreparationService(new(Profile), new(knowledge), knowledge, new(Profile), malformed);
        var result = await service.PrepareAsync(input.Title, input.Description, true, "", "Worldwide", "", false, CancellationToken.None);
        Assert.AreEqual("provider-unavailable-fallback", result.ProviderStatus);
    }

    [TestMethod]
    public void MandatoryEducationLanguageAndSeniorExperienceCannotPassSilently()
    {
        var scoring = new OpportunityScoringService(Profile);
        foreach (var text in new[] { "Requirements: C#, SQL. Bachelor's degree.", "Requirements: C#, SQL. German B2." })
            Assert.AreEqual("REVIEW", scoring.Assess("Junior .NET Developer", text, true, location: "Worldwide").Decision);
        Assert.AreEqual("SKIP", scoring.Assess(".NET Developer", "C#, SQL", true, "moreThan6", "Worldwide").Decision);
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
    [TestMethod]
    public async Task OperatorFallbackRetainsActualRoleTitle()
        => StringAssert.Contains((await Prepare(null)).Application.Letter, "Junior .NET Developer");

    [TestMethod]
    public void SecondProjectMustContributeEvidenceNotRepeatFirstProject()
    {
        var knowledge = new CandidateKnowledgeService(Profile);
        var scorer = new OpportunityScoringService(Profile);
        var evidence = new EvidenceRetrievalService(knowledge);
        var backend = evidence.Select(scorer.Assess("Junior Backend Developer", "Required: C#, ASP.NET Core, SQL, REST.", true, location: "Russia"));
        CollectionAssert.AreEqual(new[] { "dental" }, backend.Projects.Select(p => p.Id).ToArray());
        var fullstack = evidence.Select(scorer.Assess("Junior Fullstack Developer", "Required: C#, ASP.NET Core, SQL, React, TypeScript.", true, location: "Russia"));
        var letter = new ApplicationWritingService(Profile).Write(fullstack, false, "Junior Fullstack Developer", "Example");
        CollectionAssert.AreEqual(new[] { "dental", "cv" }, letter.EvidenceIds);
        StringAssert.Contains(letter.Letter, "React");
        Assert.AreEqual(0, ApplicationClaimValidator.ValidateSuggestion(letter.Letter, letter.EvidenceIds, knowledge.Get()).Length);
    }

}
