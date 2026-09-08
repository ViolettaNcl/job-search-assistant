using System.Text.RegularExpressions;

namespace JobSearchAssistant.Services;

public static class SkillCatalog
{
    private static readonly Dictionary<string, string[]> Aliases = new()
    {
        ["C#"] = ["C#", "C sharp"], ["ASP.NET Core"] = ["ASP.NET Core"], [".NET"] = [".NET", "dotnet"],
        ["EF Core"] = ["EF Core", "Entity Framework Core"], ["EF6"] = ["EF6", "Entity Framework 6"],
        ["SQL Server"] = ["SQL Server", "MSSQL"], ["SQL"] = ["SQL"], ["REST"] = ["REST API", "REST", "Web API"],
        ["Testing"] = ["Testing", "tests", "MSTest", "xUnit", "тестирование", "тестирования"],
        ["Docker"] = ["Docker"], ["Git"] = ["Git", "GitHub Actions"], ["WPF"] = ["WPF", "XAML"],
        ["JavaScript"] = ["JavaScript"], ["TypeScript"] = ["TypeScript"], ["React"] = ["React"], ["Next.js"] = ["Next.js"],
        ["PHP"] = ["PHP"], ["Algorithms"] = ["algorithms", "algorithm", "optimization", "алгоритмы", "оптимизация"],
        ["Machine learning"] = ["machine learning", "MLP", "K-Means", "машинное обучение"],
        ["JWT"] = ["JWT"], ["SignalR"] = ["SignalR"], ["LINQ"] = ["LINQ"],
        ["Python"] = ["Python"], ["Java"] = ["Java"], ["Azure"] = ["Azure"], ["AWS"] = ["AWS"],
        ["Redis"] = ["Redis"], ["Kafka"] = ["Kafka"], ["RabbitMQ"] = ["RabbitMQ"], ["Kubernetes"] = ["Kubernetes"],
        ["gRPC"] = ["gRPC"], ["Elasticsearch"] = ["Elasticsearch"], ["PostgreSQL"] = ["PostgreSQL"], ["MySQL"] = ["MySQL"]
    };
    public static string[] Extract(string text) => Aliases.Where(kv => kv.Value.Any(a =>
        Regex.IsMatch(text ?? "", $@"(?<![\w]){Regex.Escape(a)}(?![\w])", RegexOptions.IgnoreCase)))
        .Select(kv => kv.Key).ToArray();
    public static string Family(string skill) => skill switch
    {
        "ASP.NET Core" or ".NET" => "dotnet", "SQL Server" or "SQL" => "sql", _ => skill.ToLowerInvariant()
    };
    public static bool Proves(IEnumerable<string> evidence, string required)
        => evidence.Contains(required, StringComparer.OrdinalIgnoreCase)
           || required == "SQL" && evidence.Contains("SQL Server")
           || required == ".NET" && evidence.Contains("ASP.NET Core");
}
