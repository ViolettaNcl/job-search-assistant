using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record GroundedApplication(string Letter, string ReasoningMode, string[] EvidenceIds, bool RequiresReview, string[] ReviewReasons);

public sealed class ApplicationWritingService(IOptions<CandidateProfileOptions> candidate)
{
    public const string LetterVersion = "human-2.7.13";
    public string AddContact(string letter, bool russian) => ApplicationContactFooter.Append(letter, candidate.Value.Email, russian, candidate.Value.Telegram);

    public GroundedApplication Write(ApplicationStrategy strategy, bool russian, string? title = null, string? company = null)
    {
        var project = strategy.Projects.FirstOrDefault();
        if (project is null) return new("", "deterministic-fallback", [], true, ["No verified project evidence selected."]);
        var skills = strategy.SkillsToEmphasize.Where(s => SkillCatalog.Proves(project.Skills, s)).Take(3).ToArray();
        static string Label(string? value, int max)
        {
            var clean = string.Join(" ", (value ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            return clean.Length > max ? clean[..max].TrimEnd() + "…" : clean;
        }
        var role = Label(title, 100);
        var employer = Label(company, 60);
        var opening = role.Length == 0
            ? (russian ? $"Меня заинтересовала работа по направлению {strategy.CvVariant}." : $"I am interested in a {strategy.CvVariant} role.")
            : russian ? $"Откликаюсь на вакансию «{role}»{(employer.Length > 0 ? " в " + employer : "")}."
                : $"I am applying for the {role} role{(employer.Length > 0 ? " at " + employer : "")}.";
        var work = (project.Id, strategy.CvVariant) switch
        {
            ("dental", "QA Automation") => russian ? "писала автоматические тесты и работала с API и данными" : "wrote automated tests and worked with APIs and data",
            ("dental", "Technical Support") => russian ? "работала с API, авторизацией и базой данных" : "worked with APIs, authentication and the database",
            ("dental", _) => russian ? "разрабатывала API и связывала его с базой данных" : "built APIs and connected them to the database",
            ("fleet", _) => russian ? "работала над настольным приложением для учёта транспорта и маршрутов" : "worked on a desktop application for vehicles and routes",
            ("route", _) => russian ? "реализовала алгоритмы выбора маршрутов и нейросеть на PHP" : "implemented route optimization and a neural network in PHP",
            _ => russian ? "создавала многоязычный интерфейс портфолио" : "built a multilingual portfolio interface"
        };
        var evidence = russian ? $"В своём проекте {project.Name} я {work}" : $"In my {project.Name} project, I {work}";
        if (skills.Length > 0) evidence += russian ? $"; использовала {string.Join(", ", skills)}" : $", using {string.Join(", ", skills)}";
        evidence += ".";
        var evidenceIds = new List<string> { project.Id };
        var second = strategy.Projects.Skip(1).FirstOrDefault();
        if (second is not null)
        {
            var extra = strategy.SkillsToEmphasize.Where(s => !SkillCatalog.Proves(project.Skills, s) && SkillCatalog.Proves(second.Skills, s)).Take(2).ToArray();
            if (extra.Length > 0)
            {
                evidence += russian ? $" В {second.Name} также использовала {string.Join(", ", extra)}." : $" I also used {string.Join(", ", extra)} in {second.Name}.";
                evidenceIds.Add(second.Id);
            }
        }
        var source = project.Sources.FirstOrDefault();
        var link = source is null ? "" : "\n\nGitHub: https://github.com/" + source.Repository;
        var closing = russian ? "Буду рада обсудить задачи и ожидания от этой роли." : "I'd be glad to discuss the work and what you need from someone in this role.";
        var letter = (russian ? "Здравствуйте! " : "Hello! ") + opening + "\n\n" + evidence + " " + closing + link;
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
