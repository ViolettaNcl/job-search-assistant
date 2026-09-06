using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class ApplicationQuestionServiceTests
{
    private readonly ApplicationQuestionService _sut = new(Options.Create(new CandidateProfileOptions()));

    [TestMethod]
    public void EuWorkAuthorization_IsFilledTruthfully()
    {
        var result = Resolve("Poland", new ExtensionFieldInput("f1", "Are you authorized to work in Poland?", "select", "", ["Yes", "No"]));
        var field = result.Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("Yes", field.Value);
    }

    [TestMethod]
    public void CustomWorkAuthorizationCombobox_IsReviewFirst()
    {
        var result = Resolve("Poland", new ExtensionFieldInput("f1", "Are you authorized to work in Poland?", "combobox", "", ["Yes", "No"]));
        var field = result.Fields.Single();
        Assert.AreEqual("review", field.Action);
        Assert.AreEqual("workAuthorization", field.MemoryKey);
        Assert.IsNull(field.Value);
        StringAssert.Contains(field.Reason, "custom interactive");
    }

    [TestMethod]
    public void RussianSponsorship_IsNo()
    {
        var result = Resolve("Russia", new ExtensionFieldInput("f1", "Will you require visa sponsorship to work in Russia?", "select", "", ["Yes", "No"]));
        var field = result.Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("No", field.Value);
    }

    [TestMethod]
    public void EuImmigrationCaseSponsorship_IsNo()
    {
        var result = Resolve("Germany", new ExtensionFieldInput("f1", "Will you now or in the future require us to commence an immigration case to employ you?", "select", "", ["Yes", "No"]));
        var field = result.Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("No", field.Value);
    }

    [TestMethod]
    public void CommercialYears_AreNeverInvented()
    {
        var result = Resolve("Germany", new ExtensionFieldInput("f1", "How many years of commercial experience do you have?", "number", "", null));
        var field = result.Fields.Single();
        Assert.AreEqual("review", field.Action);
        Assert.IsNull(field.Value);
    }

    [TestMethod]
    public void SensitiveQuestion_IsBlocked()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Do you have a disability?", "select", "", ["Yes", "No"]));
        Assert.AreEqual("blocked", result.Fields.Single().Action);
    }

    [TestMethod]
    public void SensitiveCustomRadioGroup_RemainsBlocked()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Do you have a disability?", "radiogroup", "", ["Yes", "No"]));
        Assert.AreEqual("blocked", result.Fields.Single().Action);
    }

    [TestMethod]
    public void Pronouns_AreNotAutoFilled()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Pronouns", "select", "", ["She/her", "He/him"]));
        Assert.AreEqual("blocked", result.Fields.Single().Action);
    }

    [TestMethod]
    public void DateOfBirth_IsBlocked()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Date of birth", "date", "", null));
        Assert.AreEqual("blocked", result.Fields.Single().Action);
    }

    [TestMethod]
    public void GreenhouseVerificationCode_IsBlocked()
    {
        var result = Resolve("Germany", new ExtensionFieldInput("f1", "Security Code - confirm you are not a robot", "text", "", null));
        var field = result.Fields.Single();
        Assert.AreEqual("blocked", field.Action);
        Assert.AreEqual("verification", field.MemoryKey);
    }

    [TestMethod]
    public void CompanyName_IsNotMistakenForCandidateName()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Company name", "text", "", null));
        Assert.AreEqual("review", result.Fields.Single().Action);
        Assert.IsNull(result.Fields.Single().Value);
    }

    [TestMethod]
    public void LeverCurrentCompany_IsReviewed()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Current company", "text", "", null));
        Assert.AreEqual("review", result.Fields.Single().Action);
        Assert.AreEqual("employer", result.Fields.Single().MemoryKey);
    }

    [TestMethod]
    public void AshbyPlainName_IsCandidateFullName()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Name", "text", "", null));
        var field = result.Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("Violetta Nicolaou", field.Value);
    }

    [TestMethod]
    public void AtsAutocompleteCurrentLocation_IsReviewed()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Current location", "combobox", "", null));
        var field = result.Fields.Single();
        Assert.AreEqual("review", field.Action);
        Assert.AreEqual("location", field.MemoryKey);
        StringAssert.Contains(field.Reason, "custom interactive");
    }

    [TestMethod]
    public void NormalCurrentLocationText_IsSafelyFilled()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Current location", "text", "", null));
        var field = result.Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("Volgograd, Russia", field.Value);
    }

    [TestMethod]
    public void ConfirmedPhoneMemory_IsReused()
    {
        var request = new ResolveApplicationFieldsRequest(
            "Cyprus", "en", "", "",
            new Dictionary<string, string> { ["phone"] = "+357 00000000" },
            [new ExtensionFieldInput("f1", "Phone number", "tel", "", null)]);

        var field = _sut.Resolve(request).Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("+357 00000000", field.Value);
        Assert.IsTrue(field.CanRemember);
    }

    [TestMethod]
    public void VerifiedPhoneProfile_BeatsStaleBrowserMemory()
    {
        var sut = new ApplicationQuestionService(Options.Create(new CandidateProfileOptions
        {
            Phone = "+357 99 123456"
        }));
        var request = new ResolveApplicationFieldsRequest(
            "Cyprus", "en", "", "",
            new Dictionary<string, string> { ["phone"] = "+357 00 000000" },
            [new ExtensionFieldInput("f1", "Phone number", "tel", "", null)]);

        var field = sut.Resolve(request).Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("+357 99 123456", field.Value);
        Assert.IsFalse(field.CanRemember);
        StringAssert.Contains(field.Reason, "verified candidate-profile");
    }

    [TestMethod]
    public void VerifiedLinkedInProfile_IsAutofilled()
    {
        var sut = new ApplicationQuestionService(Options.Create(new CandidateProfileOptions
        {
            LinkedInUrl = "https://www.linkedin.com/in/violetta-example/"
        }));
        var request = new ResolveApplicationFieldsRequest(
            "Cyprus", "en", "", "", null,
            [new ExtensionFieldInput("f1", "LinkedIn profile", "url", "", null)]);

        var field = sut.Resolve(request).Fields.Single();
        Assert.AreEqual("fill", field.Action);
        Assert.AreEqual("https://www.linkedin.com/in/violetta-example/", field.Value);
        Assert.IsFalse(field.CanRemember);
    }

    [TestMethod]
    public void Salary_IsAlwaysReviewedEvenIfMemoryContainsValue()
    {
        var request = new ResolveApplicationFieldsRequest(
            "Russia", "ru", "", "",
            new Dictionary<string, string> { ["salary"] = "100000" },
            [new ExtensionFieldInput("f1", "Desired pay", "number", "", null)]);

        var field = _sut.Resolve(request).Fields.Single();
        Assert.AreEqual("review", field.Action);
        Assert.IsNull(field.Value);
    }

    private ResolveApplicationFieldsResult Resolve(string country, ExtensionFieldInput field)
        => _sut.Resolve(new ResolveApplicationFieldsRequest(country, "en", "", "", null, [field]));
}
