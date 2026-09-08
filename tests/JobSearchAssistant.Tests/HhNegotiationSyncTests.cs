using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class HhNegotiationSyncTests
{
    [TestMethod]
    public void Parser_ReadsApplicantNegotiationFields()
    {
        const string payload = """
        {
          "items": [{
            "id": "neg-42",
            "created_at": "2026-09-01T08:00:00+0300",
            "updated_at": "2026-09-08T12:30:00+0300",
            "has_updates": true,
            "viewed_by_opponent": true,
            "state": { "id": "invitation", "name": "Приглашение" },
            "employer_state": { "id": "phone_interview", "name": "Первичный контакт" },
            "vacancy": { "id": "130452758" }
          }]
        }
        """;

        var item = HhNegotiationParser.ParseList(payload).Single();

        Assert.AreEqual("neg-42", item.Id);
        Assert.AreEqual("130452758", item.VacancyId);
        Assert.AreEqual("invitation", item.StateId);
        Assert.AreEqual("phone_interview", item.EmployerStateId);
        Assert.IsTrue(item.HasUpdates);
        Assert.IsTrue(item.ViewedByOpponent);
        Assert.IsNotNull(item.UpdatedAt);
    }

    [TestMethod]
    public void Mapper_TracksRepliesTestsOffersAndRejections()
    {
        Assert.AreEqual(VacancyStatus.Applied, Map("response"));
        Assert.AreEqual(VacancyStatus.HrContact, Map("response", hasUpdates: true));
        Assert.AreEqual(VacancyStatus.HrContact, Map("invitation"));
        Assert.AreEqual(VacancyStatus.TestTask, Map("response", employerState: "assessment"));
        Assert.AreEqual(VacancyStatus.Offer, Map("response", employerState: "offer"));
        Assert.AreEqual(VacancyStatus.Rejected, Map("discard"));
    }

    [TestMethod]
    public void Mapper_DoesNotDowngradeManuallyConfirmedInterview()
    {
        var routineSync = Negotiation("response");
        var invitation = Negotiation("invitation");

        Assert.AreEqual(VacancyStatus.TechInterview, HhNegotiationStatusMapper.Map(routineSync, VacancyStatus.TechInterview));
        Assert.AreEqual(VacancyStatus.TestTask, HhNegotiationStatusMapper.Map(invitation, VacancyStatus.TestTask));
    }

    [TestMethod]
    public void EventType_ChangesWhenUnreadStateChanges()
    {
        var read = Negotiation("response");
        var unread = read with { HasUpdates = true };

        Assert.AreNotEqual(HhNegotiationStatusMapper.EventType(read), HhNegotiationStatusMapper.EventType(unread));
        StringAssert.StartsWith(HhNegotiationStatusMapper.EventType(read), HhNegotiationStatusMapper.EventTypePrefix);
    }

    private static VacancyStatus Map(string state, bool hasUpdates = false, string employerState = "")
        => HhNegotiationStatusMapper.Map(Negotiation(state, hasUpdates, employerState), VacancyStatus.Applied);

    private static HhNegotiationDto Negotiation(string state, bool hasUpdates = false, string employerState = "")
        => new("neg-1", "vacancy-1", state, state, employerState, employerState, hasUpdates, true, null, DateTimeOffset.UtcNow);
}
