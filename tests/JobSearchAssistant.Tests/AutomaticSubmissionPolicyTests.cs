using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class AutomaticSubmissionPolicyTests
{
    [TestMethod]
    public void NewInstallation_UsesPracticalButConservativeAutopilotDefaults()
    {
        var state = new AppState();
        var schedule = new AutomationOptions();

        Assert.IsFalse(state.AutoApplyEnabled);
        Assert.AreEqual(85, state.AutoApplyMinimumScore);
        Assert.AreEqual(25, state.DailyAutoApplyLimit);
        Assert.AreEqual(10, schedule.CycleMinutes);
        Assert.AreEqual(180, schedule.FailureCooldownMinutes);
    }

    [TestMethod]
    public void AutoSubmit_RequiresVerifiedEligibleJuniorHhVacancy()
    {
        var vacancy = EligibleVacancy();
        Assert.IsTrue(AutomaticSubmissionPolicy.CanSubmit(vacancy, 95));

        vacancy.EligibilityStatus = "Verify";
        Assert.IsFalse(AutomaticSubmissionPolicy.CanSubmit(vacancy, 95));
        vacancy.EligibilityStatus = "Likely ineligible";
        Assert.IsFalse(AutomaticSubmissionPolicy.CanSubmit(vacancy, 95));

        vacancy = EligibleVacancy();
        vacancy.Title = "Senior .NET Developer";
        Assert.IsFalse(AutomaticSubmissionPolicy.CanSubmit(vacancy, 95));
        vacancy.Title = "Ведущий разработчик C#";
        Assert.IsFalse(AutomaticSubmissionPolicy.CanSubmit(vacancy, 95));

        vacancy = EligibleVacancy();
        vacancy.HasExistingHhResponse = true;
        Assert.IsFalse(AutomaticSubmissionPolicy.CanSubmit(vacancy, 95));
        vacancy = EligibleVacancy();
        vacancy.Company.IsBlacklisted = true;
        Assert.IsFalse(AutomaticSubmissionPolicy.CanSubmit(vacancy, 95));
    }

    private static Vacancy EligibleVacancy()
        => new()
        {
            Source = "hh",
            Title = "Junior .NET Developer",
            MatchScore = 96,
            EligibilityStatus = "Eligible",
            Status = VacancyStatus.New,
            Company = new Company { Name = "Example" }
        };
}
