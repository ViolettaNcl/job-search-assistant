(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaDailyQueue = api;
})(typeof window !== "undefined" ? window : null, function () {
  function normalizeUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      if (!/^https?:$/.test(parsed.protocol)) return "";
      parsed.hash = "";
      if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function isLikelyIneligible(value) {
    const text = String(value || "").trim().toLowerCase();
    return /ineligible|not eligible|cannot work|no work authorization|visa required/.test(text);
  }

  function selectNext(queue, options = {}) {
    const minScore = Number(options.minScore ?? 75);
    const excluded = new Set((options.excludeUrls || []).map(normalizeUrl).filter(Boolean));

    for (const item of Array.isArray(queue) ? queue : []) {
      const url = normalizeUrl(item?.url);
      const score = Number(item?.matchScore ?? 0);
      if (!url || excluded.has(url)) continue;
      if (!Number.isFinite(score) || score < minScore) continue;
      if (isLikelyIneligible(item?.eligibilityStatus)) continue;
      return { ...item, url };
    }
    return null;
  }

  function summary(item) {
    if (!item) return "No strong unapplied jobs are currently in the queue.";
    const company = String(item.company || "Unknown company").trim();
    const title = String(item.title || "Untitled vacancy").trim();
    const score = Number(item.matchScore ?? 0);
    const country = String(item.country || item.location || "").trim();
    return `${title} · ${company} · ${score}/100${country ? ` · ${country}` : ""}`;
  }

  return { normalizeUrl, isLikelyIneligible, selectNext, summary };
});