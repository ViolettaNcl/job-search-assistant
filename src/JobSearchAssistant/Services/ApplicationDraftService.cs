using System.Text.RegularExpressions;
using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record ApplicationDraft(
    string Language,
    string CandidateName,
    string RecommendedHeadline,
    string RecommendedCv,
    string ShortMessage,
    string CoverLetter,
    IReadOnlyDictionary<string, string> CommonAnswers,
    string[] Emphasize,
    string[] VerifyBeforeSubmit)
{
    public ApplicationStrategy? Strategy { get; init; }
    public string ReasoningMode { get; init; } = "deterministic-fallback";
}

public sealed class ApplicationDraftService(IOptions<CandidateProfileOptions> candidate)
{
    private sealed record FocusSignal(string[] Terms, string Russian, string English);

    private readonly CandidateProfileOptions _candidate = candidate.Value;

    private static readonly FocusSignal[] FocusSignals =
    [
        new(["api", "rest", "интеграц"], "API и интеграциями", "APIs and integrations"),
        new(["sql", "database", "данных", "базами данных", "базы данных"], "данными и базами данных", "data and databases"),
        new(["test", "qa", "quality", "тест", "качеств"], "качеством и тестированием", "quality and testing"),
        new(["customer", "client", "клиент", "пользоват"], "клиентами и пользователями", "customers and users"),
        new(["support", "поддерж", "incident", "обращени"], "поддержкой и решением практических проблем", "support and practical problem-solving"),
        new(["document", "knowledge base", "документ", "инструкц"], "понятной документацией", "clear documentation"),
        new(["sales", "продаж", "negotiat", "переговор"], "общением с клиентами и продажами", "customer communication and sales"),
        new(["content", "marketing", "social media", "контент", "маркет", "соцсет"], "контентом и продвижением", "content and promotion"),
        new(["analytics", "analysis", "аналит", "отчёт", "отчет"], "анализом информации и результатами", "analysis and measurable results"),
        new(["medical", "health", "dental", "медиц", "стомат", "пациент"], "цифровыми решениями для медицины", "digital products for healthcare"),
        new(["process", "operation", "coordinat", "процесс", "операц", "координ"], "организацией процессов и задач", "organising processes and tasks"),
        new(["react", "frontend", "front-end", "ui", "интерфейс"], "пользовательскими интерфейсами", "user-facing interfaces"),
        new(["docker", "devops", "ci/cd", "deployment", "деплой", "развёрт"], "надёжным запуском и автоматизацией", "reliable delivery and automation")
    ];

    public ApplicationDraft Build(Vacancy vacancy)
    {
        var company = vacancy.Company?.Name ?? "the company";
        return Build(
            vacancy.Title,
            company,
            vacancy.DescriptionText,
            vacancy.Country,
            vacancy.Source,
            vacancy.MatchScore,
            Split(vacancy.MatchedSkills),
            Split(vacancy.MissingSkills));
    }

    public ApplicationDraft Build(
        string title,
        string company,
        string description,
        string country,
        string source,
        int score,
        IEnumerable<string> matched,
        IEnumerable<string> missing)
    {
        title = Clean(title, "вакансию");
        company = Clean(company, "компанию");
        description ??= "";

        var russian = IsRussianMarket(country, source, description);
        var roleKind = ClassifyRole(title, description);
        var matchedSkills = matched.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Take(7).ToArray();
        var missingSkills = missing.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Take(5).ToArray();
        var emphasize = SelectEmphasis(roleKind, matchedSkills);
        var focus = SelectDescriptionFocus(roleKind, title, description, russian);
        var variant = StableVariant($"{title}|{company}|{description}", 3);

        var headline = RecommendedHeadline(roleKind, russian);
        var candidateName = russian ? _candidate.RussianName : _candidate.Name;
        var cv = russian ? _candidate.RussianCvFileName : _candidate.EnglishCvFileName;
        var shortMessage = russian
            ? BuildRussianShort(company, title, roleKind, focus, emphasize, variant)
            : BuildEnglishShort(company, title, roleKind, focus, emphasize, variant);
        var coverLetter = russian
            ? BuildRussianLetter(company, title, roleKind, focus, emphasize, variant)
            : BuildEnglishLetter(company, title, roleKind, focus, emphasize, variant);

        var answers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["email"] = _candidate.Email,
            ["github"] = _candidate.GitHubUrl,
            ["portfolio"] = _candidate.CvUrl,
            ["currentLocation"] = $"{_candidate.CurrentCity}, {_candidate.CurrentCountry}",
            ["russiaWorkAuthorization"] = _candidate.RussiaWorkAuthorized ? "Yes" : "No",
            ["euWorkAuthorization"] = _candidate.EuWorkAuthorized ? "Yes" : "No",
            ["requiresSponsorshipRussia"] = _candidate.RussiaWorkAuthorized ? "No" : "Yes",
            ["languages"] = string.Join(", ", _candidate.FluentLanguages),
            ["commercialExperience"] = russian
                ? "Подтверждён опыт проектов. Точный коммерческий стаж необходимо уточнить у кандидата."
                : "Verified project experience is available. Ask the candidate for exact commercial employment history.",
            ["availability"] = "Ask candidate if the form requires an exact start date.",
            ["salary"] = "Use the vacancy range/local market; ask candidate if a binding exact figure is required."
        };

        var verify = new List<string>();
        var assessment = new OpportunityScoringService(candidate).Assess(title, description, true, location: country);
        var strategy = new EvidenceRetrievalService(new CandidateKnowledgeService(candidate)).Select(assessment);
        if (assessment.Understanding.CareerLane != "excluded" && strategy.Projects.Length > 0)
        {
            var grounded = new ApplicationWritingService(candidate).Write(strategy, russian, title, company);
            coverLetter = grounded.Letter;
            shortMessage = grounded.Letter;
            emphasize = strategy.SkillsToEmphasize;
            headline = strategy.Headline;
            verify.AddRange(grounded.ReviewReasons);
        }
        if (missingSkills.Length > 0) verify.Add($"Do not claim these skills unless independently verified: {string.Join(", ", missingSkills)}.");
        if (score < 75) verify.Add("Fit score is below the normal auto-apply threshold; review before applying.");
        verify.Add("Never invent years of commercial employment, certifications, relocation commitments or legal declarations.");

        coverLetter = ApplicationContactFooter.Append(coverLetter, _candidate.Email, russian);
        shortMessage = ApplicationContactFooter.Append(shortMessage, _candidate.Email, russian);

        return new ApplicationDraft(
            russian ? "ru" : "en",
            candidateName,
            headline,
            cv,
            shortMessage,
            coverLetter,
            answers,
            emphasize,
            verify.ToArray()) { Strategy = strategy };
    }

    private string BuildRussianShort(string company, string title, string roleKind, string focus, string[] emphasize, int variant)
    {
        var opening = variant switch
        {
            1 => $"Меня заинтересовала вакансия «{title}» в {company}",
            2 => $"Откликаюсь на вакансию «{title}» в {company}",
            _ => $"Хочу откликнуться на вакансию «{title}» в {company}"
        };
        return $"Здравствуйте! {opening}: особенно близки задачи, связанные с {focus}. {RussianEvidence(roleKind, emphasize)} GitHub: {_candidate.GitHubUrl}";
    }

    private string BuildEnglishShort(string company, string title, string roleKind, string focus, string[] emphasize, int variant)
    {
        var opening = variant switch
        {
            1 => $"The {title} role at {company} caught my attention",
            2 => $"I would like to apply for the {title} role at {company}",
            _ => $"I am interested in the {title} opening at {company}"
        };
        return $"Hi! {opening}, especially the work around {focus}. {EnglishEvidence(roleKind, emphasize)} GitHub: {_candidate.GitHubUrl}";
    }

    private string BuildRussianLetter(string company, string title, string roleKind, string focus, string[] emphasize, int variant)
    {
        var opening = variant switch
        {
            1 => $"Меня заинтересовала вакансия «{title}» в {company}. В описании особенно откликнулись задачи, связанные с {focus}.",
            2 => $"Откликаюсь на вакансию «{title}» в {company}. Мне близко то, что в этой роли важно работать с {focus}.",
            _ => $"Хочу откликнуться на вакансию «{title}» в {company}. Больше всего меня заинтересовали задачи про {focus}."
        };

        return $"Здравствуйте!\n\n{opening}\n\n{RussianEvidence(roleKind, emphasize)}\n\nGitHub: {_candidate.GitHubUrl}\n\nВиолетта";
    }

    private string BuildEnglishLetter(string company, string title, string roleKind, string focus, string[] emphasize, int variant)
    {
        var opening = variant switch
        {
            1 => $"The {title} role at {company} caught my attention, especially the work involving {focus}.",
            2 => $"I would like to apply for the {title} role at {company}. The focus on {focus} feels particularly relevant to me.",
            _ => $"I am interested in the {title} opening at {company}. I was especially drawn to the work around {focus}."
        };

        return $"Hi,\n\n{opening}\n\n{EnglishEvidence(roleKind, emphasize)}\n\nGitHub: {_candidate.GitHubUrl}\n\nVioletta";
    }

    private static string RussianEvidence(string roleKind, string[] emphasize)
    {
        var skills = HumanListRu(emphasize.Take(3), "цифровыми инструментами, самостоятельными задачами и внимательной проверкой результата");
        return roleKind switch
        {
            "qa" => $"В своих проектах я проверяла API, данные и пользовательские сценарии, писала автоматические тесты и работала с {skills}.",
            "support" => "Я работала с API, SQL и интеграциями, умею спокойно разбираться в проблеме и понятно объяснять решение. Свободно говорю на русском, английском и греческом.",
            "customer" or "sales" => "Я самостоятельно вела проект для реального заказчика, поэтому умею уточнять потребности, договариваться о результате и понятно объяснять сложные вещи. Свободно говорю на русском, английском и греческом.",
            "marketing" => "Я уверенно работаю с цифровыми продуктами, умею структурировать информацию и адаптировать текст под аудиторию. Свободно говорю на русском, английском и греческом.",
            "operations" => "Самостоятельная работа над большим проектом научила меня организовывать задачи, внимательно работать с деталями и доводить результат до конца.",
            "healthcare" => "Мой основной самостоятельный проект создан для реальной стоматологической практики, поэтому мне знакомы медицинские рабочие процессы и ответственность при работе с данными.",
            "data" => $"В собственных проектах я работала с данными, интеграциями и автоматическими проверками, используя {skills}.",
            "general" => "Я самостоятельно довела проект для реального заказчика от идеи до работающего продукта, умею быстро разбираться в новых задачах и внимательно проверять результат.",
            _ => $"В собственных проектах я работала с {skills} и доводила задачи от реализации до тестирования и запуска."
        };
    }

    private static string EnglishEvidence(string roleKind, string[] emphasize)
    {
        var skills = HumanListEn(emphasize.Take(3), "digital tools, independent work and careful checking");
        return roleKind switch
        {
            "qa" => $"In my own projects I tested APIs, data and user flows, wrote automated checks and worked with {skills}.",
            "support" => "I have worked with APIs, SQL and integrations, and I am comfortable investigating a problem and explaining the solution clearly. I speak English, Russian and Greek fluently.",
            "customer" or "sales" => "I independently delivered a project for a real client, which taught me to clarify needs, agree on outcomes and explain complex ideas clearly. I speak English, Russian and Greek fluently.",
            "marketing" => "I am comfortable with digital products, structuring information and adapting messages for different audiences. I speak English, Russian and Greek fluently.",
            "operations" => "Building a substantial project independently taught me to organise tasks, pay attention to detail and follow work through to completion.",
            "healthcare" => "My main independent project was built for a real dental practice, so healthcare workflows and responsible handling of data are especially meaningful to me.",
            "data" => $"In my own projects I worked with data, integrations and automated checks using {skills}.",
            "general" => "I independently took a real-client project from an initial idea to a working product, and I am comfortable learning new tasks quickly and checking the result carefully.",
            _ => $"In my own projects I worked with {skills} and followed tasks through implementation, testing and release."
        };
    }

    private static string SelectDescriptionFocus(string roleKind, string title, string description, bool russian)
    {
        var text = $"{title}\n{description}".ToLowerInvariant();
        var selected = FocusSignals
            .Where(signal => signal.Terms.Any(text.Contains))
            .OrderBy(signal => FocusPriority(roleKind, signal))
            .Select(signal => russian ? signal.Russian : signal.English)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(1)
            .ToArray();

        if (selected.Length > 0)
            return russian ? HumanListRu(selected, FallbackFocus(roleKind, true)) : HumanListEn(selected, FallbackFocus(roleKind, false));

        return FallbackFocus(roleKind, russian);
    }

    private static int FocusPriority(string roleKind, FocusSignal signal)
    {
        var terms = string.Join(' ', signal.Terms);
        var preferred = roleKind switch
        {
            "customer" => new[] { "customer", "client", "клиент", "пользоват", "support", "поддерж" },
            "sales" => new[] { "sales", "продаж", "negotiat", "переговор", "customer", "клиент" },
            "support" => new[] { "support", "поддерж", "incident", "обращени", "api", "sql" },
            "qa" => new[] { "test", "qa", "quality", "тест", "качеств" },
            "marketing" => new[] { "content", "marketing", "контент", "маркет", "соцсет" },
            "operations" => new[] { "process", "operation", "coordinat", "процесс", "операц", "координ" },
            "healthcare" => new[] { "medical", "health", "dental", "медиц", "стомат", "пациент" },
            "data" => new[] { "analytics", "analysis", "аналит", "отчёт", "отчет", "database", "данных" },
            "frontend" => new[] { "react", "frontend", "ui", "интерфейс" },
            _ => Array.Empty<string>()
        };
        return preferred.Any(terms.Contains) ? 0 : 1;
    }

    private static string FallbackFocus(string roleKind, bool russian)
        => (roleKind, russian) switch
        {
            ("qa", true) => "качеством продукта и понятными пользовательскими сценариями",
            ("qa", false) => "product quality and clear user flows",
            ("support", true) => "помощью пользователям и решением практических вопросов",
            ("support", false) => "helping users and solving practical problems",
            ("customer", true) => "клиентами и качеством сервиса",
            ("customer", false) => "customers and service quality",
            ("sales", true) => "потребностями клиентов и результатом",
            ("sales", false) => "customer needs and outcomes",
            ("marketing", true) => "контентом, аудиторией и результатами",
            ("marketing", false) => "content, audiences and results",
            ("operations", true) => "организацией процессов и внимательной работой с деталями",
            ("operations", false) => "organising processes and working carefully with details",
            ("healthcare", true) => "людьми и качеством медицинского сервиса",
            ("healthcare", false) => "people and the quality of healthcare services",
            ("data", true) => "данными, аналитикой и автоматизацией",
            ("data", false) => "data, analysis and automation",
            ("frontend", true) => "понятными и удобными интерфейсами",
            ("frontend", false) => "clear and useful interfaces",
            ("fullstack", true) => "серверной частью и пользовательским интерфейсом",
            ("fullstack", false) => "backend services and user-facing interfaces",
            (_, true) => "практическими задачами и качественным результатом",
            _ => "practical work and delivering a solid result"
        };

    private static string RecommendedHeadline(string roleKind, bool russian)
        => (roleKind, russian) switch
        {
            ("qa", true) => "Junior QA Engineer / .NET Developer",
            ("support", true) => "Junior специалист технической поддержки / внедрения",
            ("customer", true) => "Специалист по работе с клиентами",
            ("sales", true) => "Специалист по работе с клиентами / продажам",
            ("marketing", true) => "Junior специалист по контенту / маркетингу",
            ("operations", true) => "Junior специалист по операциям / координации",
            ("healthcare", true) => "Junior специалист цифровых медицинских проектов",
            ("data", true) => "Junior Data / AI Engineer",
            ("frontend", true) => "Junior Front-End разработчик",
            ("fullstack", true) => "Junior Full-Stack .NET разработчик",
            ("backend", true) => "Junior C# / .NET разработчик",
            ("general", true) => "Кандидат на позицию",
            ("qa", false) => "Junior QA Engineer / .NET Developer",
            ("support", false) => "Junior Technical Support / Implementation Specialist",
            ("customer", false) => "Customer Support Specialist",
            ("sales", false) => "Customer / Sales Specialist",
            ("marketing", false) => "Junior Content / Marketing Specialist",
            ("operations", false) => "Junior Operations Coordinator",
            ("healthcare", false) => "Junior Digital Health Specialist",
            ("data", false) => "Junior Data / AI Engineer",
            ("frontend", false) => "Junior Front-End Developer",
            ("fullstack", false) => "Junior Full-Stack .NET Developer",
            ("backend", false) => "Junior C# / .NET Developer",
            _ => "Candidate"
        };

    private static string[] SelectEmphasis(string roleKind, string[] matched)
    {
        var preferred = roleKind switch
        {
            "qa" => new[] { "Automated Testing", "xUnit", "REST API", "SQL", "GitHub Actions", "C#" },
            "support" => new[] { "REST API", "SQL", "Git", "C#", "Docker", "English / Greek / Russian" },
            "data" => new[] { "SQL", "REST API", "Automated Testing", "C#", "Docker" },
            "frontend" => new[] { "React", "TypeScript", "JavaScript", "REST API", "Git" },
            "fullstack" => new[] { "C#", "ASP.NET Core", "EF Core", "SQL Server", "TypeScript", "React", "JavaScript" },
            "backend" => new[] { "C#", "ASP.NET Core", "EF Core", "SQL Server", "REST API", "Docker", "Git" },
            _ => Array.Empty<string>()
        };

        return preferred
            .Where(x => matched.Length == 0 || matched.Contains(x, StringComparer.OrdinalIgnoreCase) || x.Contains("English", StringComparison.OrdinalIgnoreCase))
            .Concat(matched)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(7)
            .ToArray();
    }

    private static string ClassifyRole(string title, string description)
    {
        var titleText = title.ToLowerInvariant();
        var all = $"{title} {description}".ToLowerInvariant();
        if (Has(titleText, "qa", "tester", "testing", "тестиров")) return "qa";
        if (Has(titleText, "customer support", "customer success", "client service", "written support", "оператор", "менеджер по работе с клиент", "письменн", "поддержк клиент", "клиентск поддерж", "чат-поддерж")) return "customer";
        if (Has(titleText, "technical support", "application support", "helpdesk", "service desk", "техническ поддерж", "внедрен")) return "support";
        if (Has(titleText, "поддержк")) return Has(all, "api", "sql", "incident", "инцидент", "техническ", "оборудован") ? "support" : "customer";
        if (Has(titleText, "sales", "account manager", "business development", "продаж", "аккаунт-менедж")) return "sales";
        if (Has(titleText, "marketing", "content", "smm", "маркет", "контент")) return "marketing";
        if (Has(titleText, "administrator", "coordinator", "operations", "office manager", "администратор", "координатор", "операцион")) return "operations";
        if (Has(titleText, "doctor", "nurse", "medical", "healthcare", "врач", "медицин", "медсестр")) return "healthcare";
        if (Has(titleText, "data", "machine learning", "ai engineer", "analyst", "аналитик", "машинн")) return "data";
        if (Has(titleText, "frontend", "front-end", "react developer", "верстальщик")) return "frontend";
        if (Has(titleText, "full-stack", "full stack", "fullstack")) return "fullstack";
        if (Has(titleText, "developer", "engineer", "programmer", "software", ".net", "c#", "разработчик", "программист")) return "backend";
        if (Has(all, "c#", ".net", "asp.net", "software development", "разработка api")) return "backend";
        if (Has(all, "test", "qa", "тестиров")) return "qa";
        if (Has(all, "support", "поддержк", "helpdesk")) return "support";
        return "general";
    }

    private static bool Has(string text, params string[] values) => values.Any(text.Contains);

    private static bool IsRussianMarket(string country, string source, string description)
    {
        if (country.Contains("Russia", StringComparison.OrdinalIgnoreCase) || country.Contains("Россия", StringComparison.OrdinalIgnoreCase)) return true;
        if (source.Equals("hh", StringComparison.OrdinalIgnoreCase)) return true;
        var cyrillic = Regex.Matches(description ?? "", "[А-Яа-яЁё]").Count;
        return cyrillic > 40;
    }

    private static string Clean(string value, string fallback)
    {
        var clean = Regex.Replace(value ?? "", @"\s+", " ").Trim();
        return string.IsNullOrWhiteSpace(clean) ? fallback : clean;
    }

    private static int StableVariant(string value, int count)
    {
        unchecked
        {
            var hash = 17;
            foreach (var c in value) hash = hash * 31 + c;
            return (hash & int.MaxValue) % Math.Max(1, count);
        }
    }

    private static string[] Split(string value) => string.IsNullOrWhiteSpace(value)
        ? []
        : value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

    private static string HumanListEn(IEnumerable<string> items, string fallback)
        => HumanList(items, fallback, "and");

    private static string HumanListRu(IEnumerable<string> items, string fallback)
        => HumanList(items, fallback, "и");

    private static string HumanList(IEnumerable<string> items, string fallback, string conjunction)
    {
        var array = items.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (array.Length == 0) return fallback;
        if (array.Length == 1) return array[0];
        if (array.Length == 2) return $"{array[0]} {conjunction} {array[1]}";
        return $"{string.Join(", ", array[..^1])} {conjunction} {array[^1]}";
    }
}
