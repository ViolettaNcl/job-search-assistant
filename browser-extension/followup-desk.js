(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaFollowUpDesk = api;
})(typeof window !== "undefined" ? window : null, function () {
  const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function clean(value, max = 500) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function finiteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeHttpUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
    } catch {
      return "";
    }
  }

  function normalizeItem(value) {
    const vacancyId = clean(value?.vacancyId, 80);
    if (!GUID.test(vacancyId)) return null;
    const url = safeHttpUrl(value?.url);
    return {
      vacancyId,
      title: clean(value?.title, 180) || "Untitled vacancy",
      company: clean(value?.company, 180) || "Unknown company",
      url,
      source: clean(value?.source, 80),
      market: clean(value?.market, 80),
      matchScore: Math.max(0, Math.min(100, finiteNumber(value?.matchScore))),
      appliedAt: clean(value?.appliedAt, 80),
      waitingSince: clean(value?.waitingSince, 80),
      businessDaysWaiting: Math.max(0, finiteNumber(value?.businessDaysWaiting)),
      followUpCount: Math.max(0, Math.floor(finiteNumber(value?.followUpCount))),
      priorityScore: finiteNumber(value?.priorityScore),
      language: String(value?.language || "").toLowerCase() === "ru" ? "ru" : "en",
      recommendedChannel: clean(value?.recommendedChannel, 140),
      message: String(value?.message || "").trim().slice(0, 5000)
    };
  }

  function selectNext(items) {
    return (Array.isArray(items) ? items : [])
      .map(normalizeItem)
      .filter(Boolean)
      .sort((a, b) =>
        b.priorityScore - a.priorityScore ||
        b.businessDaysWaiting - a.businessDaysWaiting ||
        b.matchScore - a.matchScore
      )[0] || null;
  }

  function buildMarkSentRequest(vacancyId, note = "Follow-up sent from extension") {
    const id = clean(vacancyId, 80);
    if (!GUID.test(id)) return null;
    return {
      path: `/api/vacancies/${encodeURIComponent(id)}/followup-sent`,
      method: "POST",
      body: { note: clean(note, 500) || "Follow-up sent from extension" }
    };
  }

  function attemptNumber(item) {
    return Math.max(1, Math.floor(finiteNumber(item?.followUpCount)) + 1);
  }

  return { clean, finiteNumber, safeHttpUrl, normalizeItem, selectNext, buildMarkSentRequest, attemptNumber };
});
