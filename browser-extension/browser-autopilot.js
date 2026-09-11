(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaBrowserAutopilot = api;
})(typeof self !== "undefined" ? self : null, function () {
  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (!/^https?:$/.test(url.protocol)) return "";
      url.hash = "";
      return url.toString();
    } catch {
      return "";
    }
  }

  function isHhVacancy(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === 'https:' && (url.hostname === "hh.ru" || url.hostname.endsWith(".hh.ru")) && /^\/vacancy\/\d+\/?$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function shouldRun(status = {}) {
    if (!status.autoApplyEnabled || !status.allowed) return false;
    if (status.apiReady && status.automationMode === "hh-api") return false;
    return Number(status.remainingToday || 0) > 0;
  }

  function hasSafeSeniority(title) {
    return !/\b(senior|lead|principal|staff|architect|head)\b|ведущ|руководител|главн(?:ый|ая)|архитектор/i.test(String(title || ""));
  }

  function selectCandidate(queue = [], minimumScore = 75) {
    return (Array.isArray(queue) ? queue : []).find(item => {
      const url = normalizeUrl(item?.url);
      if (!isHhVacancy(url)) return false;
      if (Number(item?.matchScore || 0) < Number(minimumScore || 75)) return false;
      if (!hasSafeSeniority(item?.title)) return false;
      return true;
    }) || null;
  }

  function buildPlan(item = {}, draft = {}, now = Date.now()) {
    const sourceUrl = normalizeUrl(item.url);
    return {
      id: `browser-auto-${now}-${String(item.vacancyId || "")}`,
      trackedId: String(item.vacancyId || ""),
      sourceUrl,
      sourceHost: sourceUrl ? new URL(sourceUrl).hostname : "",
      jobTitle: String(item.title || ""),
      coverLetter: String(draft.coverLetter || "").trim(),
      cvKey: "",
      resumeHint: String(draft.recommendedCv || item.recommendedCv || ""),
      siteKind: "hh",
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      finalClicked: false,
      automatic: true
    };
  }

  return { normalizeUrl, isHhVacancy, shouldRun, hasSafeSeniority, selectCandidate, buildPlan };
});
