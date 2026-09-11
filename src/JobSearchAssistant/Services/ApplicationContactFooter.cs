namespace JobSearchAssistant.Services;

public static class ApplicationContactFooter
{
    public static string Append(string text, string email, bool russian, string? telegram = null)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;

        var result = text.TrimEnd();
        var contacts = new List<string>();

        if (!string.IsNullOrWhiteSpace(email) && !result.Contains(email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            contacts.Add($"Email: {email.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(telegram) && !result.Contains(telegram.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            contacts.Add($"Telegram: {telegram.Trim()}");
        }

        if (contacts.Count == 0) return result;

        return result + "\n\n" + string.Join(" · ", contacts);
    }
}
