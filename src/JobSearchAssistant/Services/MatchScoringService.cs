using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

// Compatibility facade for imports, queues, Telegram and extension consumers.
public sealed record MatchResult(int Score, string Level, string[] Matched, string[] Missing, string Why, string EligibilityStatus, string EligibilityReason)
{
    public OpportunityAssessment? Assessment { get; init; }
}

public sealed class MatchScoringService(IOptions<CandidateProfileOptions> candidate, IOptions<SearchOptions>? search = null)
{
    public MatchResult Score(string title, string text, bool remote, string experience, string location = "", string remoteScope = "", int minimumScore = 75)
    {
        var a = new OpportunityScoringService(candidate, search).Assess(title, text, remote, experience, location, remoteScope, minimumScore);
        var matched = a.Matches.Where(m => m.ProjectIds.Length > 0).Select(m => m.Requirement.Skill).ToArray();
        var missing = a.Matches.Where(m => m.ProjectIds.Length == 0).Select(m => m.Requirement.Skill).ToArray();
        return new(a.OverallScore, a.OverallScore >= 85 ? "Strong Match" : a.OverallScore >= 65 ? "Apply" : a.OverallScore >= 50 ? "Stretch" : "Skip",
            matched, missing, $"{a.Decision}: {a.Dimensions[0].Explanation} {string.Join(" ", a.ReviewReasons)} {a.ScoreMeaning}",
            a.EligibilityStatus, a.EligibilityReason) { Assessment = a };
    }
}
