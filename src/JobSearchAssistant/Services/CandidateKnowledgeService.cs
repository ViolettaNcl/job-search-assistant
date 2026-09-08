using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed class CandidateKnowledgeService(IOptions<CandidateProfileOptions> options)
{
    public static readonly DateOnly VerifiedOn = new(2026, 9, 8);
    public static ProjectEvidence[] VerifiedProjects() =>
    [
        new("dental", "DentalClinic", "Independent client project; not employment", "Healthcare",
            ["C#", ".NET", "ASP.NET Core", "EF Core", "SQL Server", "REST", "JWT", "SignalR", "Docker", "Git", "Testing"],
            ["Backend API and database integration", "Authentication and automated tests"],
            [new("ViolettaNcl/DentalClinic", "59fb1f2543297997d4fec708a0ce9817bc664275", "DentalClinic.csproj"),
             new("ViolettaNcl/DentalClinic", "59fb1f2543297997d4fec708a0ce9817bc664275", "README.md")], VerifiedOn),
        new("route", "Smart Route Planner", "Portfolio project; not employment", "Routing and algorithms",
            ["PHP", "JavaScript", "Algorithms", "Machine learning", "Testing", "Docker", "Git"],
            ["MLP forward/backward propagation in PHP", "Nearest-neighbor and 2-opt route optimization"],
            [new("ViolettaNcl/smart-route-planner", "3852c443a996615361cab1338309e1928c7dd75c", "src/ML/MLPClassifier.php"),
             new("ViolettaNcl/smart-route-planner", "3852c443a996615361cab1338309e1928c7dd75c", "src/Routing/RouteOptimizer.php")], VerifiedOn),
        new("fleet", "FleetManagement", "Portfolio project; not employment", "Fleet desktop workflows",
            ["C#", ".NET", "WPF", "EF6", "SQL Server", "Testing"],
            ["WPF desktop and database integration", "Vehicle, driver and route workflows"],
            [new("ViolettaNcl/FleetManagement", "3dfdae0ddb4ccdad46a3d06bd8c7c9ff6ae59728", "FleetManagment/FleetManagement.csproj"),
             new("ViolettaNcl/FleetManagement", "3dfdae0ddb4ccdad46a3d06bd8c7c9ff6ae59728", "README.md")], VerifiedOn),
        new("cv", "CV / Portfolio", "Portfolio project; not employment", "Web portfolio",
            ["TypeScript", "React", "Next.js"], ["Multilingual portfolio frontend"],
            [new("ViolettaNcl/violetta-cv", "69e5a451655fa2270fed4f663ce4aa43d20d6950", "package.json"),
             new("ViolettaNcl/violetta-cv", "69e5a451655fa2270fed4f663ce4aa43d20d6950", "README.md")], VerifiedOn)
    ];

    public CandidateKnowledge Get()
    {
        var c = options.Value;
        var conflicts = new List<string>();
        if (c.Name != "Violetta Nicolaou" || c.RussianName != "Виолетта Николау" || c.GreekName != "Βιολέττα Νικολάου")
            conflicts.Add("Configured identity differs from the verified CV. Review before submitting.");
        if (!string.IsNullOrWhiteSpace(c.Patronymic) && c.PatronymicVerification != "Verified")
            conflicts.Add("Patronymic has not been verified and must not be included.");
        var projects = VerifiedProjects();
        return new(new(c.Name, c.RussianName, c.GreekName,
                c.PatronymicVerification == "Verified" ? c.Patronymic : null,
                conflicts.Count == 0 ? "Verified CV" : "Needs review", conflicts.ToArray()),
            c.Education, c.FluentLanguages, c.Citizenships, c.RussiaWorkAuthorized, c.EuWorkAuthorized,
            c.CurrentCountry, c.CurrentCity, c.LocationPreferences,
            [new("primary", 70, ["Junior .NET / C#", "ASP.NET Core backend", "Full-stack .NET", "Graduate / associate software", ".NET internship"]),
             new("secondary", 20, ["C# QA automation", "API / SQL implementation"]),
             new("experimental", 10, ["Technical support with coding / API / SQL"] )],
            projects,
            projects.SelectMany(p => p.Skills).Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(s => new SkillEvidence(s, "Repository-backed project evidence",
                    projects.Where(p => p.Skills.Contains(s)).Select(p => p.Id).ToArray())).ToArray(),
            ["Verified years of salaried employment", "Binding salary expectation", "Exact availability", "Relocation commitments"]);
    }
}
