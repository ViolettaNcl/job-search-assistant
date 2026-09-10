using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public sealed record ApplicationStrategy(string CvVariant, string Headline, ProjectEvidence[] Projects,
    string[] SkillsToEmphasize, string[] SkillsNotToClaim, string LikelyObjection, string SuggestedResponse);

public sealed class EvidenceRetrievalService(CandidateKnowledgeService knowledge)
{
    public ApplicationStrategy Select(OpportunityAssessment assessment)
    {
        var requirements = assessment.Understanding.Requirements;
        var families = requirements.GroupBy(r => r.Family).ToArray();
        int Coverage(ProjectEvidence p, IEnumerable<IGrouping<string, Requirement>> groups) => groups.Sum(g => g.All(r => SkillCatalog.Proves(p.Skills, r.Skill))
            ? g.Any(r => r.Importance != "Preferred") ? 2 : 1 : 0);
        var projects = knowledge.Get().Projects;
        var first = projects.OrderByDescending(p => Coverage(p, families)).ThenBy(p => p.Id)
            .FirstOrDefault(p => Coverage(p, families) > 0);
        var uncovered = families.Where(g => first is null || !g.All(r => SkillCatalog.Proves(first.Skills, r.Skill))).ToArray();
        var second = projects.Where(p => p.Id != first?.Id).OrderByDescending(p => Coverage(p, uncovered)).ThenBy(p => p.Id)
            .FirstOrDefault(p => Coverage(p, uncovered) > 0);
        var ranked = new[] { first, second }.OfType<ProjectEvidence>().ToArray();
        var lane = assessment.Understanding.RoleFamily;
        var frontend = requirements.Any(r => r.Skill is "React" or "Next.js");
        var dotnet = requirements.Any(r => r.Skill is "C#" or ".NET" or "ASP.NET Core");
        var variant = lane switch
        {
            "QA automation" => "QA Automation",
            "Implementation" => "Technical Implementation",
            "Technical support" => "Technical Support",
            _ when frontend => dotnet ? "Full-Stack .NET" : "Frontend",
            _ when first?.Id == "fleet" => "C# Desktop",
            _ when first?.Id == "route" => "Software / Algorithms",
            _ => ".NET Backend"
        };
        return new(variant, "Junior " + variant, ranked,
            assessment.Matches.Where(m => m.ProjectIds.Length > 0).Select(m => m.Requirement.Skill).ToArray(),
            assessment.Matches.Where(m => m.ProjectIds.Length == 0).Select(m => m.Requirement.Skill).ToArray(),
            "Project work does not establish salaried commercial experience.",
            "My verified experience is described in the linked projects. Exact salaried employment history requires my confirmation.");
    }
}
