using System.Text.RegularExpressions;

namespace JobSearchAssistant.Services;

public static class ApplicationContactFooter
{
    public static string NormalizeTelegram(string? value)
    {
        var handle = (value ?? "").Trim();
        if (handle.StartsWith("https://t.me/", StringComparison.OrdinalIgnoreCase)) handle = handle[13..];
        handle = handle.TrimStart('@');
        return Regex.IsMatch(handle, @"^[A-Za-z][A-Za-z0-9_]{4,31}$") ? "@" + handle : "";
    }

    public static string Append(string text, string email, bool russian, string? telegram = null)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;
        var contacts = new List<string>();
        email = (email ?? "").Trim();
        var handle = NormalizeTelegram(telegram);
        if (Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$") && !text.Contains(email, StringComparison.OrdinalIgnoreCase)) contacts.Add("Email: " + email);
        if (handle.Length > 0 && !text.Contains(handle, StringComparison.OrdinalIgnoreCase)) contacts.Add("Telegram: " + handle);
        return contacts.Count == 0 ? text : text.TrimEnd() + "\n\n" + string.Join(" · ", contacts);
    }
}
