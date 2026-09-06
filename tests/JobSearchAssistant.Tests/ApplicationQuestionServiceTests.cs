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
    public void RussianSponsorship_IsNo()
    {
        var result = Resolve("Russia", new ExtensionFieldInput("f1", "Will you require visa sponsorship to work in Russia?", "select", "", ["Yes", "No"]));
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
    public void DateOfBirth_IsBlocked()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Date of birth", "date", "", null));
        Assert.AreEqual("blocked", result.Fields.Single().Action);
    }

    [TestMethod]
    public void CompanyName_IsNotMistakenForCandidateName()
    {
        var result = Resolve("Cyprus", new ExtensionFieldInput("f1", "Company name", "text", "", null));
        Assert.AreEqual("review", result.Fields.Single().Action);
        Assert.IsNull(result.Fields.Single().Value);
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
    public void Salary_IsAlwaysReviewedEvenIfMemoryContainsValue()
    {
        var request = new ResolveApplicationFieldsRequest(
            "Russia", "ru", "", "",
            new Dictionary<string, string> { ["salary"] = "100000" },
            [new ExtensionFieldInput("f1", "Salary expectation", "number", "", null)]);

        var field = _sut.Resolve(request).Fields.Single();
        Assert.AreEqual("review", field.Action);
        Assert.IsNull(field.Value);
    }

    private ResolveApplicationFieldsResult Resolve(string country, ExtensionFieldInput field)
        => _sut.Resolve(new ResolveApplicationFieldsRequest(country, "en", "", "", null, [field]));
}
