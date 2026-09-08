using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public sealed record ApplicationStrategy(string CvVariant, string Headline, ProjectEvidence[] Projects,
    string[] SkillsToEmphasize, string[] SkillsNotToClaim, string LikelyObjection, string SuggestedResponse);

public sealed class EvidenceRetrievalService(CandidateKnowledgeService knowledge)
{
    public ApplicationStrategy Select(OpportunityAssessment assessment)
    {
        var requirements = assessment.Understanding.Requirements;
        var ranked = knowledge.Get().Projects.Select(p => new
        {
            Project = p,
            Relevance = requirements.GroupBy(r => r.Family).Sum(g => g.All(r => SkillCatalog.Proves(p.Skills, r.Skill))
                ? g.Any(r => r.Importance != "Preferred") ? 2 : 1 : 0)
        }).Where(x => x.Relevance > 0).OrderByDescending(x => x.Relevance).ThenBy(x => x.Project.Id).Take(2).Select(x => x.Project).ToArray();
        var lane = assessment.Understanding.RoleFamily;
        var variant = lane == "QA automation" ? "QA Automation" : requirements.Any(r => r.Skill is "React" or "Next.js") ? "Full-Stack .NET" : ".NET Backend";
        if (ranked.FirstOrDefault()?.Id == "fleet") variant = "C# Desktop";
        if (ranked.FirstOrDefault()?.Id == "route") variant = "Software / Algorithms";
        return new(variant, "Junior " + variant, ranked,
            assessment.Matches.Where(m => m.ProjectIds.Length > 0).Select(m => m.Requirement.Skill).ToArray(),
            assessment.Matches.Where(m => m.ProjectIds.Length == 0).Select(m => m.Requirement.Skill).ToArray(),
            "Project work does not establish salaried commercial experience.",
            "I can walk through the relevant project and code. Exact salaried employment history requires my confirmation.");
    }
}
