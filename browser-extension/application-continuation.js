(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaApplicationContinuation = api;
})(typeof window !== "undefined" ? window : null, function () {
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function boundedScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function safeWebUrl(value) {
    try {
      const url = new URL(clean(value));
      if (!/^https?:$/.test(url.protocol)) return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  function shorten(value, max = 62) {
    const text = clean(value);
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
  }

  function build({ recorded = false, nextJob = null } = {}) {
    if (!recorded) {
      return {
        visible: false,
        enabled: false,
        url: "",
        label: "Continue to next strong job",
        detail: "Record the verified submission before continuing."
      };
    }

    const url = safeWebUrl(nextJob?.url);
    if (!nextJob || !url) {
      return {
        visible: true,
        enabled: false,
        url: "",
        label: "No next 75+ job ready",
        detail: "The ranked queue has no other strong unapplied vacancy ready right now."
      };
    }

    const score = boundedScore(nextJob.matchScore);
    const title = shorten(nextJob.title || "Next strong job");
    const company = shorten(nextJob.company || "", 38);
    const context = [company, score ? `${score}/100` : ""].filter(Boolean).join(" · ");
    return {
      visible: true,
      enabled: true,
      url,
      label: score ? `Continue to next ${score}/100 job` : "Continue to next strong job",
      detail: context ? `${title} — ${context}` : title
    };
  }

  return { build, safeWebUrl, boundedScore, shorten };
});
