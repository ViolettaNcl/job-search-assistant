using System.Text.RegularExpressions;
using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed record ExtensionFieldInput(
    string Token,
    string Label,
    string Type,
    string? CurrentValue,
    string[]? Options);

public sealed record ResolveApplicationFieldsRequest(
    string? Country,
    string? Language,
    string? CoverLetter,
    string? ShortMessage,
    IReadOnlyDictionary<string, string>? Memory,
    ExtensionFieldInput[] Fields);

public sealed record ExtensionFieldResolution(
    string Token,
    string Action,
    string? Value,
    string Reason,
    string Safety,
    string MemoryKey,
    bool CanRemember);

public sealed record ResolveApplicationFieldsResult(
    ExtensionFieldResolution[] Fields,
    int AutofillCount,
    int ReviewCount,
    int BlockedCount);

public sealed class ApplicationQuestionService(IOptions<CandidateProfileOptions> candidate)
{
    private readonly CandidateProfileOptions _candidate = candidate.Value;

    private static readonly string[] EuCountries =
    [
        "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech", "czechia", "denmark", "estonia",
        "finland", "france", "germany", "greece", "hungary", "ireland", "italy", "latvia", "lithuania",
        "luxembourg", "malta", "netherlands", "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden"
    ];

    public ResolveApplicationFieldsResult Resolve(ResolveApplicationFieldsRequest request)
    {
        var resolved = request.Fields.Select(field => ResolveOne(field, request)).ToArray();
        return new ResolveApplicationFieldsResult(
            resolved,
            resolved.Count(x => x.Action == "fill"),
            resolved.Count(x => x.Action == "review"),
            resolved.Count(x => x.Action == "blocked"));
    }

    private ExtensionFieldResolution ResolveOne(ExtensionFieldInput field, ResolveApplicationFieldsRequest request)
    {
        var label = Normalize(field.Label);
        var country = Normalize(request.Country ?? "");
        var memory = request.Memory ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var isCombobox = field.Type.Equals("combobox", StringComparison.OrdinalIgnoreCase);
        var isRadioGroup = field.Type.Equals("radiogroup", StringComparison.OrdinalIgnoreCase);
        var isInteractiveControl = isCombobox || isRadioGroup;

        if (string.IsNullOrWhiteSpace(label))
            return Review(field, "unknown", "Field meaning could not be determined safely.", false);

        if (Matches(label, "verification code", "security code", "captcha", "confirm you are not a robot", "anti-bot", "код подтверждения", "проверочный код"))
            return Block(field, "verification", "Human verification and anti-bot challenges are never automated.");

        if (Matches(label, "company name", "employer name", "current company", "current employer", "название компании", "имя компании", "текущая компания"))
            return Review(field, "employer", "This asks about an employer/company, not the candidate's identity.", false);

        if (Matches(label, "salary", "compensation", "expected pay", "expected salary", "desired pay", "зарплат", "доход", "оклад"))
            return Review(field, "salary", "Salary should be chosen for this vacancy and market, not reused blindly.", false);

        if (Matches(label, "start date", "available from", "availability date", "notice period", "дата выхода", "когда можете начать", "срок выхода"))
            return Review(field, "availability", "Exact availability can change and should be confirmed for this application.", false);

        if (Matches(label, "criminal", "conviction", "background check", "security clearance", "passport", "national id", "identity document", "судим", "уголов", "допуск", "паспорт"))
            return Block(field, "legal", "Legal, security or identity-document declarations must be answered by the candidate.");

        if (Matches(label, "date of birth", "birth date", "birthday", "age", "disability", "medical", "health condition", "gender", "sex", "pronoun", "race", "ethnicity", "veteran", "religion", "дата рождения", "возраст", "инвалид", "здоров", "пол ", "национальност", "религи"))
            return Block(field, "sensitive", "Sensitive demographic, identity-preference or medical questions are never auto-filled.");

        if (Matches(label, "years of experience", "years experience", "commercial experience", "professional experience", "лет опыта", "коммерческ.*опыт"))
            return Review(field, "experience", "Do not convert project experience into invented years of commercial employment.", false);

        if (Matches(label, "visa status", "immigration status", "type of visa", "статус визы", "тип визы"))
            return Review(field, "visaStatus", "Visa/immigration wording varies by country and must be checked before answering.", false);

        if (Matches(label, "relocat", "переезд", "готовы.*переех"))
            return Review(field, "relocation", "Relocation is a job-specific commitment and should be confirmed before submission.", false);

        if (Matches(label, "country of residence", "residence country", "country where you live", "страна проживания"))
        {
            if (isInteractiveControl) return InteractiveReview(field, "residenceCountry", "country");
            return Fill(field, _candidate.CurrentCountry, "residenceCountry", "Verified current country.");
        }

        if (Matches(label, "city where you live", "city of residence", "город проживания"))
        {
            if (isInteractiveControl) return InteractiveReview(field, "city", "city");
            return Fill(field, _candidate.CurrentCity, "city", "Verified current city.");
        }

        if (Matches(label, "current location", "where are you located", "location", "местополож"))
        {
            if (isInteractiveControl) return InteractiveReview(field, "location", "location");
            return Fill(field, $"{_candidate.CurrentCity}, {_candidate.CurrentCountry}", "location", "Verified current location.");
        }

        if (Matches(label, "city", "город"))
        {
            if (isInteractiveControl) return InteractiveReview(field, "city", "city");
            return Fill(field, _candidate.CurrentCity, "city", "Verified current city.");
        }

        if (Matches(label, "education", "degree", "qualification", "образован", "диплом"))
        {
            if (field.Type.Equals("select", StringComparison.OrdinalIgnoreCase) || isInteractiveControl)
                return Review(field, "education", isInteractiveControl
                    ? "This ATS uses a custom interactive education control. Review and choose the closest truthful site-provided option manually."
                    : "Degree-level dropdowns differ between employers; review the closest truthful option.", false);
            return Fill(field, _candidate.Education, "education", "Verified education description.");
        }

        if (Matches(label, "authorized to work", "legally allowed to work", "right to work", "work authorization", "eligible to work", "право на работу", "разрешение на работу"))
        {
            if (isInteractiveControl) return InteractiveReview(field, "workAuthorization", "work-authorization");
            if (IsRussia(country, label))
                return FillYesNo(field, _candidate.RussiaWorkAuthorized, "workAuthRussia", "Russian work authorization is verified.");
            if (IsEu(country, label))
                return FillYesNo(field, _candidate.EuWorkAuthorized, "workAuthEu", "EU/Cyprus work authorization is verified.");
            return Review(field, "workAuthorization", "Country-specific work authorization could not be determined from the form.", false);
        }

        if (Matches(label, "sponsor", "sponsorship", "visa sponsorship", "immigration case", "спонсор", "рабочая виза"))
        {
            if (isInteractiveControl) return InteractiveReview(field, "sponsorship", "sponsorship");
            if (IsRussia(country, label) && _candidate.RussiaWorkAuthorized)
                return FillYesNo(field, false, "sponsorshipRussia", "No Russian work sponsorship is required.");
            if (IsEu(country, label) && _candidate.EuWorkAuthorized)
                return FillYesNo(field, false, "sponsorshipEu", "No EU work sponsorship is required.");
            return Review(field, "sponsorship", "Sponsorship depends on the employing country; verify before answering.", false);
        }

        if (isInteractiveControl)
            return InteractiveReview(field, $"custom:{label}", "field");

        if (Matches(label, "phone", "mobile", "телефон", "номер телефона"))
            return FromVerifiedOrMemoryOrReview(field, _candidate.Phone, memory, "phone", "Phone number has not been verified in the candidate profile yet.");

        if (Matches(label, "linkedin"))
            return FromVerifiedOrMemoryOrReview(field, _candidate.LinkedInUrl, memory, "linkedin", "LinkedIn URL has not been verified in the candidate profile yet.");

        if (Matches(label, "first name", "given name") || Regex.IsMatch(label, @"(^|\s)имя($|\s)", RegexOptions.IgnoreCase))
            return Fill(field, request.Language == "ru" ? "Виолетта" : FirstName(_candidate.Name), "firstName", "Verified candidate identity.");

        if (Matches(label, "last name", "surname", "family name", "фамили"))
            return Fill(field, request.Language == "ru" ? "Николау" : LastName(_candidate.Name), "lastName", "Verified candidate identity.");

        if (label is "name" or "candidate name" || Matches(label, "full name", "your name", "фио", "имя и фамилия"))
            return Fill(field, request.Language == "ru" ? _candidate.RussianName : _candidate.Name, "fullName", "Verified candidate identity.");

        if (Matches(label, "e-mail", "email", "почт"))
            return Fill(field, _candidate.Email, "email", "Verified candidate email.");

        if (Matches(label, "github"))
            return Fill(field, _candidate.GitHubUrl, "github", "Verified GitHub profile.");

        if (Matches(label, "portfolio", "personal site", "website", "сайт", "портфолио"))
            return Fill(field, _candidate.CvUrl, "portfolio", "Verified portfolio URL.");

        if (Matches(label, "cover letter", "motivation letter", "сопровод", "мотивац"))
            return !string.IsNullOrWhiteSpace(request.CoverLetter)
                ? Fill(field, request.CoverLetter!, "coverLetter", "Vacancy-specific tailored cover letter.", false)
                : Review(field, "coverLetter", "Generate the vacancy-specific draft first.", false);

        if (Regex.IsMatch(label, @"why.*(role|position|company)|why.*interested|why.*suited|well suited|почему.*(ваканс|компан)|интерес.*ваканс", RegexOptions.IgnoreCase))
            return !string.IsNullOrWhiteSpace(request.ShortMessage)
                ? Fill(field, request.ShortMessage!, "whyRole", "Vacancy-specific motivation answer.", false)
                : Review(field, "whyRole", "Generate the vacancy-specific application draft first.", false);

        if (Matches(label, "citizenship", "nationality", "гражданств"))
            return Fill(field, string.Join("; ", _candidate.Citizenships), "citizenship", "Verified citizenship/work-authorization profile.");

        if (Matches(label, "languages", "language", "язык"))
            return Fill(field, string.Join(", ", _candidate.FluentLanguages), "languages", "Verified fluent languages.");

        var normalizedKey = $"custom:{label}";
        if (memory.TryGetValue(normalizedKey, out var remembered) && !string.IsNullOrWhiteSpace(remembered))
            return Fill(field, remembered, normalizedKey, "Using a user-confirmed reusable answer.", true);

        return Review(field, normalizedKey, "Employer-specific or unfamiliar question; review once before answering.", false);
    }

    private static ExtensionFieldResolution InteractiveReview(ExtensionFieldInput field, string key, string subject)
        => Review(
            field,
            key,
            $"This ATS uses a custom interactive {subject} control. Review and choose the truthful site-provided option manually; the assistant will not guess or script this control.",
            false);

    private static ExtensionFieldResolution FromVerifiedOrMemoryOrReview(
        ExtensionFieldInput field,
        string verifiedValue,
        IReadOnlyDictionary<string, string> memory,
        string key,
        string reason)
    {
        if (!string.IsNullOrWhiteSpace(verifiedValue))
            return Fill(field, verifiedValue.Trim(), key, "Using a verified candidate-profile contact fact.", false);
        if (memory.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            return Fill(field, value, key, "Using a user-confirmed reusable answer from this browser.", true);
        return Review(field, key, reason, true);
    }

    private static ExtensionFieldResolution Fill(ExtensionFieldInput field, string value, string key, string reason, bool canRemember = false)
        => new(field.Token, "fill", value, reason, "safe", key, canRemember);

    private static ExtensionFieldResolution FillYesNo(ExtensionFieldInput field, bool value, string key, string reason)
        => new(field.Token, "fill", value ? "Yes" : "No", reason, "safe", key, false);

    private static ExtensionFieldResolution Review(ExtensionFieldInput field, string key, string reason, bool canRemember)
        => new(field.Token, "review", null, reason, "review", key, canRemember);

    private static ExtensionFieldResolution Block(ExtensionFieldInput field, string key, string reason)
        => new(field.Token, "blocked", null, reason, "blocked", key, false);

    private static string Normalize(string value)
        => Regex.Replace((value ?? "").Trim().ToLowerInvariant(), @"\s+", " ");

    private static bool Matches(string input, params string[] needles)
        => needles.Any(x => x.Contains(".*", StringComparison.Ordinal)
            ? Regex.IsMatch(input, x, RegexOptions.IgnoreCase)
            : input.Contains(x, StringComparison.OrdinalIgnoreCase));

    private static bool IsRussia(string country, string label)
        => country.Contains("russia") || country.Contains("росси") || label.Contains("russia") || label.Contains("росси");

    private static bool IsEu(string country, string label)
    {
        if (country.Equals("eu", StringComparison.OrdinalIgnoreCase)) return true;
        if (label.Contains("eu") || label.Contains("european union") || label.Contains("ес ") || label.EndsWith(" ес")) return true;
        return EuCountries.Any(country.Contains);
    }

    private static string FirstName(string name) => name.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? name;
    private static string LastName(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 1 ? string.Join(' ', parts.Skip(1)) : name;
    }
}
