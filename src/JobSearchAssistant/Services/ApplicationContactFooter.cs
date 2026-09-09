namespace JobSearchAssistant.Services;

public static class ApplicationContactFooter
{
    public static string Append(string text, string email, bool russian)
    {
        if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(email) || text.Contains(email.Trim(), StringComparison.OrdinalIgnoreCase)) return text;
        return text.TrimEnd() + "\n\n" + (russian ? "Со мной можно связаться по email: " : "You can also contact me by email: ") + email.Trim();
    }
}
