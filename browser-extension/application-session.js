(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaApplicationSession = api;
})(typeof window !== "undefined" ? window : null, function () {
  const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;
  const SESSION_VERSION = 1;
  const SHARED_ATS_FAMILIES = new Set([
    "smartrecruiters.com",
    "greenhouse.io",
    "lever.co",
    "ashbyhq.com",
    "workable.com"
  ]);

  function safeUrl(value) {
    try { return new URL(String(value || "")); }
    catch { return null; }
  }

  function normalizedUrl(value) {
    const parsed = safeUrl(value);
    if (!parsed) return "";
    parsed.hash = "";
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  }

  function hostFamily(value) {
    const parsed = safeUrl(value);
    const host = (parsed?.hostname || "").toLowerCase();
    const families = [
      "myworkdayjobs.com",
      "smartrecruiters.com",
      "greenhouse.io",
      "lever.co",
      "ashbyhq.com",
      "teamtailor.com",
      "recruitee.com",
      "workable.com",
      "personio.de",
      "personio.com"
    ];
    return families.find(domain => host === domain || host.endsWith(`.${domain}`)) || host;
  }

  function firstPathSegment(parsed) {
    return parsed.pathname.split("/").map(x => x.trim()).filter(Boolean)[0]?.toLowerCase() || "";
  }

  function sharedPathTenant(parsed) {
    const host = parsed.hostname.toLowerCase();
    const first = firstPathSegment(parsed);
    if (!first) return "";

    const allowed = [
      ["jobs.smartrecruiters.com", "smartrecruiters.com"],
      ["boards.greenhouse.io", "greenhouse.io"],
      ["job-boards.greenhouse.io", "greenhouse.io"],
      ["jobs.lever.co", "lever.co"],
      ["jobs.ashbyhq.com", "ashbyhq.com"],
      ["apply.workable.com", "workable.com"]
    ];

    const match = allowed.find(([sharedHost]) => host === sharedHost);
    if (!match) return "";

    const reserved = new Set(["apply", "application", "applications", "job", "jobs", "career", "careers"]);
    if (reserved.has(first)) return "";
    return `${match[1]}:path:${first}`;
  }

  function tenantKey(value) {
    const parsed = safeUrl(value);
    if (!parsed) return "";
    const host = parsed.hostname.toLowerCase();

    const workday = host.match(/^([^.]+)\.wd\d+\.myworkdayjobs\.com$/);
    if (workday) return `workday:${workday[1]}`;

    for (const domain of ["teamtailor.com", "recruitee.com", "personio.de", "personio.com"]) {
      if (host.endsWith(`.${domain}`)) {
        const tenant = host.slice(0, -(domain.length + 1)).split(".")[0];
        return tenant ? `${domain}:${tenant}` : "";
      }
    }

    return sharedPathTenant(parsed);
  }

  function isApplicationLike(value) {
    const parsed = safeUrl(value);
    if (!parsed) return false;
    const text = `${parsed.pathname} ${parsed.search}`.toLowerCase();
    return /(?:^|[\s\/_?=&.-])(apply|application|applications|candidate|questionnaire|screening|jobapplication|job-application|applynow|apply-now)(?:$|[\s\/_?=&.-])/.test(text);
  }

  function create(input, now = Date.now()) {
    if (!input?.latest || !input?.latestPage?.url) return null;
    return {
      version: SESSION_VERSION,
      savedAt: Number(now),
      sourceUrl: String(input.latestPage.url),
      latestPage: input.latestPage,
      latest: input.latest,
      latestTrackedId: input.latestTrackedId || null,
      coverLetter: String(input.coverLetter || input.latest?.draft?.coverLetter || "")
    };
  }

  function isExpired(session, now = Date.now(), ttlMs = DEFAULT_TTL_MS) {
    const savedAt = Number(session?.savedAt || 0);
    if (!savedAt || savedAt > now + 60_000) return true;
    return now - savedAt > ttlMs;
  }

  function canRestore(session, currentUrl, now = Date.now(), ttlMs = DEFAULT_TTL_MS) {
    if (!session || session.version !== SESSION_VERSION || !session.latest || !session.latestPage?.url) return false;
    if (isExpired(session, now, ttlMs)) return false;

    const source = safeUrl(session.sourceUrl || session.latestPage.url);
    const current = safeUrl(currentUrl);
    if (!source || !current) return false;

    if (normalizedUrl(source) === normalizedUrl(current)) return true;

    const sameOrigin = source.origin === current.origin;
    const sourceFamily = hostFamily(source);
    const currentFamily = hostFamily(current);
    const sourceTenant = tenantKey(source);
    const currentTenant = tenantKey(current);
    const sameKnownTenant = Boolean(
      sourceFamily && currentFamily && sourceFamily === currentFamily &&
      sourceTenant && currentTenant && sourceTenant === currentTenant
    );
    const sharedOrigin = sourceFamily && sourceFamily === currentFamily && SHARED_ATS_FAMILIES.has(sourceFamily);
    const safeSameOrigin = sameOrigin && (!sharedOrigin || sameKnownTenant);

    return Boolean((safeSameOrigin || sameKnownTenant) && isApplicationLike(current));
  }

  function canHandoffFromOpener(session, currentUrl, sourceTabId, openerTabId, now = Date.now(), ttlMs = DEFAULT_TTL_MS) {
    const sourceId = Number(sourceTabId);
    const openerId = Number(openerTabId);
    if (!Number.isFinite(sourceId) || !Number.isFinite(openerId) || sourceId < 0 || openerId < 0) return false;
    if (sourceId !== openerId) return false;
    if (!session || isExpired(session, now, ttlMs)) return false;

    const source = safeUrl(session.sourceUrl || session.latestPage?.url);
    const current = safeUrl(currentUrl);
    if (!source || !current || !isApplicationLike(current)) return false;

    const sourceTenant = tenantKey(source);
    const currentTenant = tenantKey(current);
    if (!sourceTenant || !currentTenant || sourceTenant !== currentTenant) return false;

    return canRestore(session, currentUrl, now, ttlMs);
  }

  function slotKey(tabId) {
    const id = Number(tabId);
    return Number.isFinite(id) && id >= 0 ? `vjaApplicationSession:${id}` : "";
  }

  return {
    DEFAULT_TTL_MS,
    SESSION_VERSION,
    normalizedUrl,
    hostFamily,
    tenantKey,
    isApplicationLike,
    create,
    isExpired,
    canRestore,
    canHandoffFromOpener,
    slotKey
  };
});