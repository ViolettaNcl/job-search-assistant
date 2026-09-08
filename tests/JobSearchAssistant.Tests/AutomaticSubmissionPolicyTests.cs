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
        var search = new SearchOptions();

        Assert.IsFalse(state.AutoApplyEnabled);
        Assert.AreEqual(85, state.AutoApplyMinimumScore);
        Assert.AreEqual(25, state.DailyAutoApplyLimit);
        Assert.AreEqual(10, schedule.CycleMinutes);
        Assert.AreEqual(180, schedule.FailureCooldownMinutes);
        Assert.AreEqual(30, search.IntervalMinutes);
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

    [TestMethod]
    public void AutoSubmit_PrioritizesFreshEntryLevelVacancies_AndHonorsFailureCooldown()
    {
        var now = new DateTimeOffset(2026, 9, 8, 12, 0, 0, TimeSpan.Zero);
        var olderHighScore = EligibleVacancy();
        olderHighScore.MatchScore = 96;
        olderHighScore.Title = ".NET Developer";
        olderHighScore.PublishedAt = now.AddDays(-12);
        olderHighScore.FirstSeenAt = now.AddDays(-12);

        var freshJunior = EligibleVacancy();
        freshJunior.MatchScore = 90;
        freshJunior.Title = "Junior .NET Developer";
        freshJunior.PublishedAt = now.AddHours(-2);
        freshJunior.FirstSeenAt = now.AddHours(-2);

        var coolingDown = EligibleVacancy();
        coolingDown.MatchScore = 99;
        coolingDown.PublishedAt = now.AddMinutes(-20);
        coolingDown.FirstSeenAt = now.AddMinutes(-20);
        coolingDown.Events.Add(new ApplicationEvent { Type = "AutoApplyFailed", CreatedAt = now.AddMinutes(-10) });

        var selected = AutomaticSubmissionPolicy.SelectCandidates(
            new[] { olderHighScore, coolingDown, freshJunior }, 85, 10, now, now.AddHours(-3));

        CollectionAssert.AreEqual(new[] { freshJunior.Id, olderHighScore.Id }, selected.Select(x => x.Id).ToArray());
        Assert.IsTrue(AutomaticSubmissionPolicy.IsEntryLevelTitle("Graduate Software Engineer"));
        Assert.IsFalse(AutomaticSubmissionPolicy.IsEntryLevelTitle("Senior Software Engineer"));
    }

    private static Vacancy EligibleVacancy()
        => new()
        {
            Source = "hh",
            Title = "Junior .NET Developer",
            MatchScore = 96,
            EligibilityStatus = "Eligible",
            Status = VacancyStatus.New,
            Company = new Company { Name = "Example" },
            FirstSeenAt = DateTimeOffset.UtcNow,
            PublishedAt = DateTimeOffset.UtcNow
        };
}
