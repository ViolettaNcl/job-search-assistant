using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record CandidateProfileReadinessResult(
    bool CoreReady,
    int VerifiedCoreFields,
    int TotalCoreFields,
    bool PhoneConfigured,
    bool LinkedInConfigured,
    string[] MissingCoreFields,
    string[] MissingOptionalContacts);

public sealed class CandidateProfileReadinessService(IOptions<CandidateProfileOptions> candidate)
{
    private readonly CandidateProfileOptions _candidate = candidate.Value;

    public CandidateProfileReadinessResult Get()
        => Evaluate(_candidate);

    public static CandidateProfileReadinessResult Evaluate(CandidateProfileOptions candidate)
    {
        var core = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
        {
            ["name"] = !string.IsNullOrWhiteSpace(candidate.Name),
            ["email"] = !string.IsNullOrWhiteSpace(candidate.Email),
            ["currentCity"] = !string.IsNullOrWhiteSpace(candidate.CurrentCity),
            ["currentCountry"] = !string.IsNullOrWhiteSpace(candidate.CurrentCountry),
            ["github"] = !string.IsNullOrWhiteSpace(candidate.GitHubUrl),
            ["portfolio"] = !string.IsNullOrWhiteSpace(candidate.CvUrl),
            ["education"] = !string.IsNullOrWhiteSpace(candidate.Education),
            ["englishCv"] = !string.IsNullOrWhiteSpace(candidate.EnglishCvFileName),
            ["russianCv"] = !string.IsNullOrWhiteSpace(candidate.RussianCvFileName),
            ["citizenships"] = candidate.Citizenships.Length > 0,
            ["languages"] = candidate.FluentLanguages.Length > 0,
            ["skills"] = candidate.CoreSkills.Length > 0
        };

        var missingCore = core.Where(x => !x.Value).Select(x => x.Key).ToArray();
        var missingOptional = new List<string>();
        if (string.IsNullOrWhiteSpace(candidate.Phone)) missingOptional.Add("phone");
        if (string.IsNullOrWhiteSpace(candidate.LinkedInUrl)) missingOptional.Add("linkedin");

        return new CandidateProfileReadinessResult(
            CoreReady: missingCore.Length == 0,
            VerifiedCoreFields: core.Count(x => x.Value),
            TotalCoreFields: core.Count,
            PhoneConfigured: !string.IsNullOrWhiteSpace(candidate.Phone),
            LinkedInConfigured: !string.IsNullOrWhiteSpace(candidate.LinkedInUrl),
            MissingCoreFields: missingCore,
            MissingOptionalContacts: missingOptional.ToArray());
    }
}
