using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record GroundedApplication(string Letter, string ReasoningMode, string[] EvidenceIds, bool RequiresReview, string[] ReviewReasons);

public sealed class ApplicationWritingService(IOptions<CandidateProfileOptions> candidate)
{
    public string AddContact(string letter, bool russian) => ApplicationContactFooter.Append(letter, candidate.Value.Email, russian);

    public GroundedApplication Write(ApplicationStrategy strategy, bool russian, string? title = null, string? company = null)
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
        // Vacancy labels describe the employer's role, not a candidate claim. Keep them short and on one line.
        static string Label(string? value, int max)
        {
            var normalized = string.Join(" ", (value ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            return normalized[..Math.Min(normalized.Length, max)];
        }
        var role = Label(title, 140);
        var employer = Label(company, 80);
        var opening = role.Length == 0
            ? (russian ? $"Меня заинтересовали задачи по направлению {strategy.CvVariant}." : $"The {strategy.CvVariant} work interests me.")
            : russian ? $"Откликаюсь на вакансию «{role}»{(employer.Length > 0 ? " в " + employer : "")}."
                : $"I am applying for the {role} role{(employer.Length > 0 ? " at " + employer : "")}.";
        var evidenceIds = new List<string> { project.Id };
        var complement = "";
        var second = strategy.Projects.Skip(1).FirstOrDefault();
        if (second is not null)
        {
            var extra = strategy.SkillsToEmphasize.Where(s => !SkillCatalog.Proves(project.Skills, s) && SkillCatalog.Proves(second.Skills, s)).Take(3).ToArray();
            if (extra.Length > 0)
            {
                complement = russian ? $" В проекте {second.Name} также использовала {string.Join(", ", extra)}."
                    : $" My {second.Name} project also uses {string.Join(", ", extra)}.";
                evidenceIds.Add(second.Id);
            }
        }
        var source = project.Sources.FirstOrDefault();
        var projectLink = source is null ? "" : "\n" + (russian ? "Проект: " : "Project: ") + "https://github.com/" + source.Repository;
        var letter = russian
            ? $"Здравствуйте! {opening} В проекте {project.Name} есть близкая работа: {contribution}. Использованные технологии: {evidence}.{complement}\n\nGitHub: {c.GitHubUrl}{projectLink}\n{c.RussianName}"
            : $"Hello! {opening} My {project.Name} project includes relevant work on {contribution}, using {evidence}.{complement}\n\nGitHub: {c.GitHubUrl}{projectLink}\n{c.Name}";
        var conflicts = new CandidateKnowledgeService(candidate).Get().Identity.Conflicts;
        return new(AddContact(letter, russian), "deterministic-fallback", evidenceIds.ToArray(), conflicts.Length > 0, conflicts);
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
        if (VacancyUnderstandingService.Has(letter, @"(?:показать|покажу|рассказать|расскажу|объяснить|объясню|разобрать|разберу)[^.\n]{0,80}(?:код|проект)|(?:show|explain|walk\s+(?:you\s+)?through|demonstrate)[^.\n]{0,80}(?:code|project)|code\s+walkthrough"))
            errors.Add("Do not offer a code demonstration or project walkthrough; provide GitHub links instead.");
        return errors.ToArray();
    }
}
