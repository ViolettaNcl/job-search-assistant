using System.Text.RegularExpressions;

namespace JobSearchAssistant.Services;

// An explicit remote signal is necessary; contradictory attendance requirements take precedence.
public static class RemoteWorkPolicy
{
    public static bool IsFullyRemote(bool remote, string? description)
        => remote && !Regex.IsMatch(description ?? "",
            @"\b(?:not remote|no remote|onsite only|on-site only|hybrid(?!\s+(?:cloud|architecture)))\b|" +
            @"remote.{0,20}(?:not available|after probation)|(?:must|required to)\s+(?:attend|visit|work (?:in|from))\s+(?:the )?office|" +
            @"не\s+удал[её]н|гибридн|только\s+(?:в\s+)?офис|на месте работодателя|не\s+предусмотрена\s+удал|" +
            @"удал[её]н\w*.{0,25}(?:невозмож|не предусмотр|после\s+(?:испытатель|стажиров))|" +
            @"(?:обязател\w*|необходимо)\s+(?:посещ\w*|присутств\w*|работать)\s+(?:в\s+)?офис",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
}
