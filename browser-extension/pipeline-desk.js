(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaPipelineDesk = api;
})(typeof window !== "undefined" ? window : null, function () {
  const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ACTIVE = new Set(["Applied", "HrContact", "HrInterview", "TechInterview", "TestTask", "Offer"]);
  const LABELS = {
    Applied: "Applied",
    HrContact: "HR contacted me",
    HrInterview: "HR interview",
    TechInterview: "Technical interview",
    TestTask: "Test task",
    Offer: "Offer",
    Rejected: "Rejected"
  };

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

  function normalizeRow(value) {
    const id = clean(value?.id, 80);
    const status = clean(value?.status, 40);
    if (!GUID.test(id) || !ACTIVE.has(status)) return null;
    return {
      id,
      title: clean(value?.title, 180) || "Untitled vacancy",
      company: clean(value?.company, 180) || "Unknown company",
      url: safeHttpUrl(value?.url),
      status,
      updatedAt: clean(value?.updatedAt, 80),
      matchScore: Math.max(0, Math.min(100, finiteNumber(value?.matchScore)))
    };
  }

  function normalizePipeline(rows, limit = 15) {
    return (Array.isArray(rows) ? rows : [])
      .map(normalizeRow)
      .filter(Boolean)
      .slice(0, Math.max(1, Math.min(50, Math.floor(finiteNumber(limit, 15)))));
  }

  function allowedTargets(currentStatus) {
    const map = {
      Applied: ["HrContact", "HrInterview", "TechInterview", "TestTask", "Offer", "Rejected"],
      HrContact: ["HrInterview", "TechInterview", "TestTask", "Offer", "Rejected"],
      HrInterview: ["TechInterview", "TestTask", "Offer", "Rejected"],
      TechInterview: ["TestTask", "Offer", "Rejected"],
      TestTask: ["TechInterview", "Offer", "Rejected"],
      Offer: []
    };
    return [...(map[currentStatus] || [])];
  }

  function label(status) {
    return LABELS[status] || clean(status, 60) || "Unknown stage";
  }

  function buildStatusRequest(vacancyId, currentStatus, targetStatus, note = "") {
    const id = clean(vacancyId, 80);
    if (!GUID.test(id)) return null;
    if (!allowedTargets(currentStatus).includes(targetStatus)) return null;
    const safeNote = clean(note, 500) || `Pipeline updated in extension: ${label(targetStatus)}`;
    return {
      path: `/api/vacancies/${encodeURIComponent(id)}/status`,
      method: "POST",
      body: { status: targetStatus, note: safeNote }
    };
  }

  return {
    clean,
    finiteNumber,
    safeHttpUrl,
    normalizeRow,
    normalizePipeline,
    allowedTargets,
    label,
    buildStatusRequest
  };
});
