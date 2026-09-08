using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record GroundedApplication(string Letter, string ReasoningMode, string[] EvidenceIds, bool RequiresReview, string[] ReviewReasons);

public sealed class ApplicationWritingService(IOptions<CandidateProfileOptions> candidate)
{
    public GroundedApplication Write(ApplicationStrategy strategy, bool russian)
    {
        var c = candidate.Value;
        var project = strategy.Projects.FirstOrDefault();
        if (project is null) return new("", "deterministic-fallback", [], true, ["No verified project evidence selected."]);
        var skills = strategy.SkillsToEmphasize.Where(s => SkillCatalog.Proves(project.Skills, s)).Take(5).ToArray();
        var evidence = string.Join(", ", skills);
        var contribution = project.Id switch
        {
            "dental" => russian ? "API и работа с базой данных" : "APIs, data and databases",
            "fleet" => russian ? "настольное приложение для управления автопарком" : "a desktop application for fleet workflows",
            "route" => russian ? "алгоритмы маршрутизации и собственная нейросеть на PHP" : "route optimization and a neural network implemented in PHP",
            _ => russian ? "многоязычный веб-интерфейс портфолио" : "a multilingual portfolio interface"
        };
        var letter = russian
            ? $"Здравствуйте! Меня заинтересовали задачи по направлению {strategy.CvVariant}. В проекте {project.Name} есть близкая работа: {contribution}. Использованные технологии: {evidence}. Буду рада показать код и обсудить, как этот опыт пригодится вашей команде.\n\nGitHub: {c.GitHubUrl}\n{c.RussianName}"
            : $"Hello! The {strategy.CvVariant} work interests me. My {project.Name} project includes relevant work on {contribution}, using {evidence}. I would be happy to walk through the code and discuss how this project experience could help your team.\n\nGitHub: {c.GitHubUrl}\n{c.Name}";
        var conflicts = new CandidateKnowledgeService(candidate).Get().Identity.Conflicts;
        return new(letter, "deterministic-fallback", [project.Id], conflicts.Length > 0, conflicts);
    }
}

// LLM text is always a suggestion. A lexical check cannot prove arbitrary prose true.
public static class ApplicationClaimValidator
{
    public static string[] ValidateSuggestion(string letter, string[] projectIds, CandidateKnowledge knowledge)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(letter) || letter.Length > 1200) errors.Add("Invalid letter length.");
        if (projectIds.Length == 0 || projectIds.Any(id => !knowledge.Projects.Any(p => p.Id == id))) errors.Add("Unknown evidence reference.");
        var projects = knowledge.Projects.Where(p => projectIds.Contains(p.Id)).ToArray();
        foreach (var skill in SkillCatalog.Extract(letter))
            if (!projects.Any(p => SkillCatalog.Proves(p.Skills, skill))) errors.Add("Unsupported skill: " + skill);
        if (VacancyUnderstandingService.Has(letter, @"\b\d+\s*(?:years?|лет|года)|commercial experience|коммерческ|certified|сертифи|bachelor|магистр|relocat|переез|зарплат|salary|visa|виз[ауы]"))
            errors.Add("Employment, degree, legal or personal commitment requires candidate review.");
        return errors.ToArray();
    }
}
