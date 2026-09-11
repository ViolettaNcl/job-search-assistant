namespace JobSearchAssistant.Domain;

/// <summary>
/// Detailed application outcomes are kept separate from vacancy pipeline states.
/// This prevents analytics from mixing confirmed rejections with technical failures or missing replies.
/// </summary>
public enum ApplicationOutcome
{
    Unknown,
    Submitted,
    EmployerRejected,
    CandidateCancelled,
    VacancyClosed,
    SubmissionError,
    NoResponse,
    HrInterview,
    TechnicalInterview,
    TestTask,
    Offer
}
