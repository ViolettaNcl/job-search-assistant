using System.Text.RegularExpressions;

namespace JobSearchAssistant.Services;

public static class VacancyExperience
{
    // Only known HH bands are metadata. Free-text employment requirements must still be understood.
    public static string Normalize(string? value)
    {
        var text = (value ?? "").Trim();
        if (text is "noExperience" or "between1And3" or "between3And6" or "moreThan6") return text;
        if (Regex.IsMatch(text, @"^(?:опыт работы\s*:?\s*)?(?:без опыта(?: работы)?|не требуется|no experience(?: required)?)$", RegexOptions.IgnoreCase)) return "noExperience";
        foreach (var band in new[] { (1, 3, "between1And3"), (3, 6, "between3And6") })
            if (Regex.IsMatch(text, $@"^(?:опыт работы\s*:?\s*)?(?:от\s*)?{band.Item1}\s*(?:года?|лет|years?)?\s*(?:[-–—]|до|to)\s*{band.Item2}\s*(?:года?|лет|years?)?$", RegexOptions.IgnoreCase)) return band.Item3;
        return text;
    }

    public static bool IsKnownBand(string value) => value is "noExperience" or "between1And3" or "between3And6" or "moreThan6";
}
