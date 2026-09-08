namespace JobSearchAssistant.Services;

public sealed record RecruiterTriage(string[] Intents, string Urgency, string PipelineStage, string NextAction,
    string Risk, bool RequiresApproval, string[] UnknownFacts, string SuggestedReply, string ReasoningMode);

public sealed class RecruiterMessageService
{
    public RecruiterTriage Classify(string text)
    {
        bool Has(string pattern) => VacancyUnderstandingService.Has(text, pattern);
        var intents = new List<string>();
        var unknown = new List<string>();
        void Add(string name, string pattern, string? fact = null)
        {
            if (!Has(pattern)) return;
            intents.Add(name);
            if (fact is not null) unknown.Add(fact);
        }
        Add("interview", @"приглаша.{0,60}(?:собесед|интервью)|interview invitation|invite.{0,40}interview|schedule.{0,30}interview", "Confirm calendar availability and interview format.");
        Add("test-assignment", @"тестов.{0,15}задан|technical (?:task|assignment)|take.home|coding (?:task|challenge)", "Confirm deadline, scope and any unclear terms.");
        Add("experience", @"коммерческ|стаж|years.{0,20}experience|professional experience", "Exact paid employment history is unknown; project evidence is separate.");
        Add("salary", @"зарплат|ожидани.{0,20}(?:доход|оплат)|salary|compensation", "Candidate must confirm a salary commitment.");
        Add("availability", @"когда.{0,25}(?:выйти|приступ|начать)|notice period|start date|available to start", "Candidate must confirm start date.");
        Add("relocation", @"переез|релокац|relocat", "Candidate must confirm relocation preferences.");
        Add("work-authorization", @"прав.{0,15}работ|гражданств|виза|visa|sponsor|work authori|legal declaration", "Confirm the exact legal question and jurisdiction.");
        Add("documents", @"паспорт|документ|passport|identity|security question", "Verify recipient and necessity before sharing documents.");
        Add("technical-question", @"объясните|реализуйте|explain how|implement a|technical question", "Violetta must review and own the technical answer.");
        Add("rejection", @"к сожалению|отказ|not moving forward|unsuccessful|other candidates");
        Add("offer", @"предлагаем.{0,25}работ|job offer|offer of employment", "Review offer terms personally.");
        if (intents.Count == 0) intents.Add(Has(@"спасибо.{0,25}отклик|thank you for applying|application received") ? "acknowledgment" : "screening");
        var deadline = Has(@"сегодня|завтра|до \d|дедлайн|deadline|tomorrow|today|due (?:by|on)|by \d");
        var active = intents.Contains("interview") || intents.Contains("test-assignment");
        var urgency = active && deadline ? "CRITICAL" : active || unknown.Count > 0 || intents.Contains("screening") ? "HIGH" : intents.Contains("acknowledgment") ? "LOW" : "NORMAL";
        var risk = unknown.Count > 0 ? "HIGH" : "NORMAL";
        var stage = intents.Contains("offer") ? "Offer" : intents.Contains("rejection") ? "Rejected" : intents.Contains("test-assignment") ? "TestTask" : intents.Contains("interview") ? "HrInterview" : "HrContact";
        var next = intents.Contains("test-assignment") ? "Read the task and confirm its deadline before accepting." : intents.Contains("interview") ? "Confirm the interview time against your calendar." : unknown.Count > 0 ? "Answer the missing personal facts, then review the reply." : "Review the employer update.";
        var reply = unknown.Count > 0 ? "Здравствуйте! Спасибо за сообщение. Уточню детали и вернусь с ответом." : "Здравствуйте! Спасибо за информацию.";
        if (!Has("[А-Яа-я]")) reply = unknown.Count > 0 ? "Hello, thank you for your message. I will check the details and get back to you." : "Hello, thank you for the update.";
        return new(intents.ToArray(), urgency, stage, next, risk, true, unknown.ToArray(), reply, "deterministic-fallback");
    }
}
