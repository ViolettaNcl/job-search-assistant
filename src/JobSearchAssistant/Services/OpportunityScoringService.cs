using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record ScoreDimension(string Name, int? Score, string Explanation);
public sealed record RequirementMatch(Requirement Requirement, string State, string[] ProjectIds);
public sealed record OpportunityAssessment(string Version, string ReasoningMode, VacancyUnderstanding Understanding,
    int OverallScore, string ScoreMeaning, string Decision, string EligibilityStatus, string EligibilityReason,
    ScoreDimension[] Dimensions, RequirementMatch[] Matches, string[] ReviewReasons);

public sealed class OpportunityScoringService(IOptions<CandidateProfileOptions> options, IOptions<SearchOptions>? search = null)
{
    public OpportunityAssessment Assess(string title, string text, bool remote, string experience = "", string location = "", string scope = "", int minimumScore = 75)
    {
        experience = VacancyExperience.Normalize(experience);
        remote = RemoteWorkPolicy.IsFullyRemote(remote, text);
        var understandingText = !string.IsNullOrWhiteSpace(experience) && !VacancyExperience.IsKnownBand(experience)
            ? text + "\nExperience requirements: " + experience : text;
        var k = new CandidateKnowledgeService(options).Get();
        var u = new VacancyUnderstandingService().Understand(title, understandingText, remote, experience, location);
        var matches = u.Requirements.Select(r => new RequirementMatch(r,
            k.Projects.Any(p => SkillCatalog.Proves(p.Skills, r.Skill)) ? "Project evidence" : "Not evidenced",
            k.Projects.Where(p => SkillCatalog.Proves(p.Skills, r.Skill)).Select(p => p.Id).ToArray())).ToArray();
        // Each family contributes once. Every explicit requirement within that family must be covered.
        var families = matches.GroupBy(m => m.Requirement.Family).ToArray();
        var numerator = families.Sum(g => g.All(m => m.ProjectIds.Length > 0) ? (g.Any(m => m.Requirement.Importance != "Preferred") ? 1d : .5d) : 0d);
        var denominator = families.Sum(g => g.Any(m => m.Requirement.Importance != "Preferred") ? 1d : .5d);
        var technical = denominator == 0 ? 0 : (int)Math.Round(100 * numerator / denominator);
        var eligibility = Eligibility(k, text + " " + scope, location, remote, u.WorkMode);
        var review = new List<string>(k.Identity.Conflicts);
        if (!string.IsNullOrWhiteSpace(experience) && !VacancyExperience.IsKnownBand(experience))
            review.Add("Free-text experience requirements need review; no employment history is inferred.");
        if (u.RequiredYears > 0) review.Add($"Requires {u.RequiredYears}+ years; verified salaried experience is unknown. Project work is not employment.");
        if (experience == "between1And3" && u.Seniority != "Junior" && u.RequiredYears is null && u.PreferredYears is null)
            review.Add("HH lists 1–3 years without an explicit junior/intern level; review the experience expectation.");
        if (experience == "between3And6") review.Add("HH lists 3–6 years; verified employment history is insufficient for unattended application.");
        foreach (var language in u.Languages)
            if (!k.Languages.Any(l => l.Contains(language, StringComparison.OrdinalIgnoreCase))) review.Add($"Language requirement needs review: {language} is not verified.");
        if (u.MandatoryDegree) review.Add("Mandatory university degree is not evidenced by the programming diploma.");
        if (eligibility.Status != "Eligible") review.Add(eligibility.Reason);
        if (string.IsNullOrWhiteSpace(text)) review.Add("Vacancy description is missing; title alone cannot qualify an application.");
        if (families.Length < 2) review.Add("Insufficient distinct requirements for a confident recommendation.");
        if (matches.Any(m => m.Requirement.Importance == "Required" && m.ProjectIds.Length == 0)) review.Add("Missing must-have evidence.");
        if (u.CareerLane == "excluded") review.Add("Outside the configured technical career lanes.");
        var exp = u.RequiredYears > 0 ? Math.Max(10, 60 - u.RequiredYears.Value * 10) : u.PreferredYears > 0 ? 75 : experience == "between1And3" ? 70 : 90;
        var seniority = u.Seniority == "Junior" ? 100 : u.Seniority == "Senior" ? 0 : 60;
        var career = u.CareerLane switch { "primary" => 95, "secondary" => 75, "experimental" => 45, _ => 0 };
        var evidence = technical; // Project coverage only, never length of employment.
        var overall = (int)Math.Round(technical * .4 + exp * .2 + seniority * .15 + evidence * .15 + career * .1);
        if ((!remote && eligibility.Status == "Likely ineligible") || u.Seniority == "Senior" || u.CareerLane == "excluded") overall = Math.Min(overall, 39);
        if (u.RequiredYears > 0) overall = Math.Min(overall, 64);
        if (families.Length < 2) overall = Math.Min(overall, 64);
        // Candidate fit observations stay truthful in the detailed assessment,
        // but education, hiring country and missing skills do not veto applications.
        var blockingReview = review.Where(reason =>
            reason != "Mandatory university degree is not evidenced by the programming diploma." &&
            reason != "Missing must-have evidence." &&
            !(remote && reason == eligibility.Reason)).ToArray();
        var decision = overall < 50 ? "SKIP" : blockingReview.Length > 0 || overall < Math.Clamp(minimumScore, 50, 100) ? "REVIEW" : "APPLY";
        return new("operator-v1", "deterministic-fallback", u, overall,
            "Uncalibrated opportunity priority index, not percentage of requirements met or probability of being hired.",
            decision, eligibility.Status, eligibility.Reason,
            [new("Technical match", technical, $"{families.Count(g => g.All(m => m.ProjectIds.Length > 0))}/{families.Length} distinct families covered; preferred families count half."),
             new("Experience compatibility", exp, u.RequiredYears > 0 ? "Mandatory experience lacks employment evidence." : experience == "between1And3" && u.Seniority == "Junior" ? "Junior/intern with HH 1–3-year band, accepted by user preference when no mandatory years are stated. Project evidence only; no employment years claimed." : "Project experience; no salaried years claimed."),
             new("Evidence strength", evidence, "Share of requirement families with repository-backed project evidence."),
             new("Seniority compatibility", seniority, u.Seniority),
             new("Eligibility", eligibility.Status == "Eligible" ? 100 : eligibility.Status == "Likely ineligible" ? 0 : null, eligibility.Reason),
             new("Location compatibility", eligibility.Status == "Eligible" ? remote ? 100 : 85 : null, search?.Value.RemoteOnly != false ? "Only verified fully remote work; required office attendance is excluded." : "Remote preferred; local work follows explicit preferences."),
             new("Career value", career, u.CareerLane),
             new("Application friction", null, "Unknown until the employer form is inspected.")], matches, review.ToArray());
    }

    private (string Status, string Reason) Eligibility(CandidateKnowledge k, string text, string location, bool remote, string mode)
    {
        var all = text + " " + location;
        bool Has(string p) => VacancyUnderstandingService.Has(all, p);
        if (Has(@"(?:except|excluding|not available in|outside|кроме|исключая)\s+(?:Russia|России|Россию)|Russia.{0,20}(?:excluded|not eligible)"))
            return ("Likely ineligible", "Current country is explicitly excluded.");
        if (!remote)
        {
            if (search?.Value.RemoteOnly != false) return ("Likely ineligible", "Explicit remote-only preference.");
            if (k.LocationPreferences.UnacceptableRelocationCities.Any(c => location.Contains(c, StringComparison.OrdinalIgnoreCase)))
                return ("Likely ineligible", "Explicitly excluded location.");
            var local = VacancyUnderstandingService.Has(k.CurrentCity, "Volgograd|Волгоград") && VacancyUnderstandingService.Has(location, "Volgograd|Волгоград");
            if (local && k.RussiaWorkAuthorized && (mode == "Hybrid" ? k.LocationPreferences.VolgogradHybrid : k.LocationPreferences.VolgogradOnsite))
                return ("Eligible", "Local Volgograd role allowed by location preferences.");
            return ("Likely ineligible", "Onsite location requires a verified relocation/work-authorization decision; none inferred.");
        }
        // Restrictive conditions override broad marketing labels such as 'worldwide'.
        if (Has(@"US only|U\.S\. only|UK only|authorized to work in the United States|right to work in the UK|must be based in the (US|UK)"))
            return ("Likely ineligible", "US/UK work authorization or residence is not verified.");
        if (Has(@"must (?:be based|reside|live)|remote within|EU only|только.*(?:прожива|резидент)|based in (?:Poland|Germany|EU)|remote.*(?:Poland|Germany)"))
            return ("Verify", "Residence/payroll restrictions require review; EU citizenship does not establish EU residence.");
        if (Has(@"Russia|России|Россия") && k.RussiaWorkAuthorized && k.LocationPreferences.RussiaRemote)
            return ("Eligible", "Russia remote and verified Russian work authorization.");
        if (Has(@"EU citizen|right to work in the EU") && k.EuWorkAuthorized && k.LocationPreferences.EuRemote)
            return ("Verify", "EU work authorization is verified; remote hiring from current residence must be confirmed.");
        if (Has(@"worldwide|anywhere|work from anywhere") && options.Value.OpenToWorldwideRemote)
            return ("Eligible", "Explicit worldwide remote scope; recheck any country exclusions before sending.");
        return ("Verify", "Eligible hiring countries/payroll scope are unknown. B2B alone does not establish eligibility.");
    }
}
