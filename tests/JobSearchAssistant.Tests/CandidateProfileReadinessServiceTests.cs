using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class CandidateProfileReadinessServiceTests
{
    [TestMethod]
    public void DefaultProfile_IsCoreReadyButShowsMissingOptionalContacts()
    {
        var result = CandidateProfileReadinessService.Evaluate(new CandidateProfileOptions());

        Assert.IsTrue(result.CoreReady);
        Assert.AreEqual(result.TotalCoreFields, result.VerifiedCoreFields);
        Assert.IsFalse(result.PhoneConfigured);
        Assert.IsFalse(result.LinkedInConfigured);
        CollectionAssert.AreEquivalent(new[] { "phone", "linkedin" }, result.MissingOptionalContacts);
    }

    [TestMethod]
    public void ConfiguredContacts_AreReportedAsVerified()
    {
        var result = CandidateProfileReadinessService.Evaluate(new CandidateProfileOptions
        {
            Phone = "+357 99 123456",
            LinkedInUrl = "https://www.linkedin.com/in/violetta-example/"
        });

        Assert.IsTrue(result.CoreReady);
        Assert.IsTrue(result.PhoneConfigured);
        Assert.IsTrue(result.LinkedInConfigured);
        Assert.AreEqual(0, result.MissingOptionalContacts.Length);
    }

    [TestMethod]
    public void MissingCoreFact_MakesProfileNotReady()
    {
        var result = CandidateProfileReadinessService.Evaluate(new CandidateProfileOptions { Email = "" });

        Assert.IsFalse(result.CoreReady);
        CollectionAssert.Contains(result.MissingCoreFields, "email");
    }
}
