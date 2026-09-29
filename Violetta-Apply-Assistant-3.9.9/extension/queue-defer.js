(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaQueueDefer = api;
})(typeof window !== "undefined" ? window : null, function () {
  const NOTE_PREFIX = "QueueDeferredUntil=";
  const DEFAULT_HOURS = 4;

  function buildRequest(vacancyId, hours = DEFAULT_HOURS, now = Date.now()) {
    const id = String(vacancyId || "").trim();
    if (!id) return null;

    const parsedHours = Number(hours);
    const baseMs = Number(now);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 168) return null;
    if (!Number.isFinite(baseMs) || baseMs <= 0) return null;

    const deferredUntil = new Date(baseMs + parsedHours * 60 * 60 * 1000);
    if (Number.isNaN(deferredUntil.getTime())) return null;

    const iso = deferredUntil.toISOString();
    return {
      path: `/api/vacancies/${encodeURIComponent(id)}/status`,
      body: {
        status: "Saved",
        note: `${NOTE_PREFIX}${iso}`
      },
      deferredUntil: iso,
      hours: parsedHours
    };
  }

  return {
    NOTE_PREFIX,
    DEFAULT_HOURS,
    buildRequest
  };
});