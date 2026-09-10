using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public sealed record ScreeningTerm(string Skill, string Importance, string EvidenceState, string[] ProjectIds, string ResumeState);
public sealed record ScreeningAction(string Priority, string Code, string Message);
public sealed record ScreeningReview(string ReasoningMode, string EmployerDecisionReason, string Notice,
    bool ResumeTextChecked, ScreeningTerm[] Requirements, string[] VerifiedTermsToAdd,
    string[] UnsupportedRequirements, string[] ReviewReasons, string SuggestedResumeExcerpt, ScreeningAction[] Actions);

// A transparent comparison, not an emulator of any employer's private ranking/filter rules.
public sealed class ScreeningReviewService(EvidenceRetrievalService evidence)
{
    public ScreeningReview Review(OpportunityAssessment assessment, string? resumeText = null)
    {
        var checkedText = !string.IsNullOrWhiteSpace(resumeText);
        var present = SkillCatalog.Extract(resumeText ?? "");
        var terms = assessment.Matches.Select(m => new ScreeningTerm(m.Requirement.Skill,
            m.Requirement.Importance, m.State, m.ProjectIds,
            !checkedText ? "Not checked" : SkillCatalog.Proves(present, m.Requirement.Skill) ? "Mentioned" : "Not mentioned")).ToArray();
        var strategy = evidence.Select(assessment);
        var verified = terms.Where(t => t.ProjectIds.Length > 0).Select(t => t.Skill).Distinct().ToArray();
        var lines = new List<string>();
        if (verified.Length > 0)
        {
            lines.Add(strategy.Headline);
            lines.Add("Навыки / Skills: " + string.Join(", ", verified));
            lines.Add("Проекты / Projects — проектный опыт / project experience");
            foreach (var project in strategy.Projects)
            {
                var relevant = verified.Where(s => SkillCatalog.Proves(project.Skills, s)).ToArray();
                if (relevant.Length == 0) continue;
                lines.Add(project.Name + ": " + string.Join(", ", relevant));
                lines.Add(project.Sources.First().Url);
            }
        }
        var actions = new List<ScreeningAction>();
        var requiredGaps = terms.Where(t => t.Importance == "Required" && t.ProjectIds.Length == 0).Select(t => t.Skill).ToArray();
        if (requiredGaps.Length > 0)
            actions.Add(new("High", "must-have-gap", "Не подтверждены обязательные навыки: " + string.Join(", ", requiredGaps) + ". Добавление ключевых слов не заменит опыт; нужна проверка соответствия."));
        if (assessment.Understanding.RequiredYears > 0)
            actions.Add(new("High", "employment-review", "Работодатель требует опыт от " + assessment.Understanding.RequiredYears + " лет. Укажите проекты отдельно от работы по найму; коммерческий стаж не подтверждён."));
        if (assessment.Understanding.MandatoryDegree)
            actions.Add(new("High", "education-review", "Требуется высшее образование. Диплом по программированию не подтверждает университетскую степень."));
        if (assessment.EligibilityStatus != "Eligible")
            actions.Add(new("High", "eligibility-review", "Проверьте формат работы и условия найма: " + assessment.EligibilityReason));
        if (!checkedText)
            actions.Add(new("Normal", "check-selected-resume", "Сравните текст именно выбранного HH-резюме: письмо не изменяет его заголовок, навыки и опыт."));
        var missingVerified = terms.Where(t => t.ProjectIds.Length > 0 && t.ResumeState == "Not mentioned").Select(t => t.Skill).Distinct().ToArray();
        if (missingVerified.Length > 0)
            actions.Add(new("Normal", "describe-project-evidence", "Добавьте в раздел проектов конкретные примеры использования: " + string.Join(", ", missingVerified) + ". Ниже — фрагмент только с подтверждёнными навыками."));
        var claimedUnsupported = terms.Where(t => t.ProjectIds.Length == 0 && t.ResumeState == "Mentioned").Select(t => t.Skill).ToArray();
        if (claimedUnsupported.Length > 0)
            actions.Add(new("High", "unverified-resume-claim", "В резюме указано без подтверждения в базе знаний: " + string.Join(", ", claimedUnsupported) + ". Подтвердите реальным опытом или уточните формулировку перед отправкой."));
        return new("deterministic-evidence-review", "Unknown",
            "Причина отказа работодателя неизвестна. Это сравнение с описанием вакансии, а не оценка ATS и не гарантия прохождения отбора. " +
            (checkedText ? "Проверен только вставленный текст; наличие термина не подтверждает опыт. Формат файла и выбранное HH-резюме не проверены."
                : "Фактическое резюме пока не проверено. На HH отправляется резюме из аккаунта; сопроводительное письмо не меняет его поля."),
            checkedText, terms,
            checkedText ? terms.Where(t => t.ProjectIds.Length > 0 && t.ResumeState == "Not mentioned").Select(t => t.Skill).Distinct().ToArray() : [],
            terms.Where(t => t.ProjectIds.Length == 0).Select(t => t.Skill).Distinct().ToArray(),
            assessment.ReviewReasons, string.Join("\n\n", lines), actions.OrderBy(a => a.Priority == "High" ? 0 : 1).ToArray());
    }
}
