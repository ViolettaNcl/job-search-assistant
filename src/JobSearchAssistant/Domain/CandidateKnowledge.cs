namespace JobSearchAssistant.Domain;

public sealed record LocationPreferences
{
    public bool RemotePreferred { get; init; } = true;
    public bool RussiaRemote { get; init; } = true;
    public bool EuRemote { get; init; } = true;
    public bool VolgogradHybrid { get; init; } = true;
    public bool VolgogradOnsite { get; init; } = true;
    // An empty list is not consent to relocate. Sponsorship alone is never consent.
    public string[] AcceptedRelocationCities { get; init; } = [];
    public string[] UnacceptableRelocationCities { get; init; } = [];
}

public sealed record EvidenceSource(string Repository, string Revision, string Path)
{
    public string Url => $"https://github.com/{Repository}/blob/{Revision}/{Path}";
}
public sealed record ProjectEvidence(string Id, string Name, string ExperienceKind, string Domain,
    string[] Skills, string[] Responsibilities, EvidenceSource[] Sources, DateOnly LastVerified);
public sealed record SkillEvidence(string Name, string Verification, string[] ProjectIds);
public sealed record CandidateIdentity(string English, string Russian, string Greek, string? Patronymic,
    string Verification, string[] Conflicts);
public sealed record CareerLane(string Id, int TargetSharePercent, string[] Roles);
public sealed record CandidateKnowledge(CandidateIdentity Identity, string Education, string[] Languages,
    string[] Citizenships, bool RussiaWorkAuthorized, bool EuWorkAuthorized, string CurrentCountry,
    string CurrentCity, LocationPreferences LocationPreferences, CareerLane[] Lanes,
    ProjectEvidence[] Projects, SkillEvidence[] Skills, string[] UnknownFacts);
