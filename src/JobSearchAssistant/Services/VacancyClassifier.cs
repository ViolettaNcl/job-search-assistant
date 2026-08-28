using JobSearchAssistant.Domain;

namespace JobSearchAssistant.Services;

public static class VacancyClassifier
{
    public const string MarketRussia = "Russia";
    public const string MarketInternational = "International";

    public const string TypeFullTime = "Full-time";
    public const string TypeContractor = "Contractor/B2B";
    public const string TypeFreelance = "Freelance/Project";
    public const string TypeInternship = "Internship";

    public static string Market(Vacancy vacancy)
        => Market(vacancy.Source, vacancy.Country, vacancy.LocationText);

    public static string Market(string source, string country, string location)
    {
        if (source.Equals("hh", StringComparison.OrdinalIgnoreCase)) return MarketRussia;
        var haystack = $"{country} {location}".ToLowerInvariant();
        if (haystack.Contains("russia") || haystack.Contains("росси")) return MarketRussia;
        return MarketInternational;
    }

    public static string OpportunityType(Vacancy vacancy)
        => OpportunityType(vacancy.Title, vacancy.DescriptionText, vacancy.Schedule);

    public static string OpportunityType(string title, string description, string schedule)
    {
        var text = $"{title} {description} {schedule}".ToLowerInvariant();

        if (ContainsAny(text, "internship", "intern ", "intern,", "intern.", "trainee", "graduate program", "graduate programme", "стажиров", "стажер", "стажёр"))
            return TypeInternship;

        if (ContainsAny(text, "freelance", "freelancer", "project-based", "project based", "фриланс", "проектная работа", "проектный контракт"))
            return TypeFreelance;

        if (ContainsAny(text, "contractor", "independent contractor", "b2b", "contract role", "contract position", "контракт", "подрядчик", "самозанят"))
            return TypeContractor;

        return TypeFullTime;
    }

    public static string MarketLabel(string market) => market == MarketRussia ? "🇷🇺 Россия" : "🌍 Международные";

    public static string TypeLabel(string type) => type switch
    {
        TypeInternship => "🎓 Стажировка",
        TypeContractor => "🤝 Contractor / B2B",
        TypeFreelance => "🧩 Freelance / Project",
        _ => "💼 Remote Full-Time"
    };

    private static bool ContainsAny(string text, params string[] tokens)
        => tokens.Any(text.Contains);
}
