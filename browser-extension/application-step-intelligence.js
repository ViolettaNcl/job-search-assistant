(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaApplicationStepIntelligence = api;
})(typeof window !== "undefined" ? window : null, function () {
  const MAX_HISTORY = 12;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(value) {
    const text = String(value || "");
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function routeKey(value) {
    try {
      const url = new URL(String(value || ""));
      const path = url.pathname.replace(/\/+$/, "") || "/";
      return `${url.origin}${path}`.toLowerCase();
    } catch {
      return "";
    }
  }

  function fieldSignature(field) {
    const type = normalize(field?.type || "field");
    const label = normalize(field?.label || "unlabelled").slice(0, 500);
    return `${type}:${hash(label)}`;
  }

  function signatureSet(scan) {
    return [...new Set((scan?.fields || []).map(fieldSignature).filter(Boolean))].sort();
  }

  function fingerprint(signatures) {
    return hash((signatures || []).join("|"));
  }

  function buildSnapshot(scan, plan, meta = {}) {
    const signatures = signatureSet(scan);
    return {
      at: Number(meta.at || Date.now()),
      jobKey: hash(String(meta.jobUrl || "")),
      route: routeKey(meta.currentUrl || meta.jobUrl || ""),
      ats: normalize(scan?.ats || meta.ats || "generic"),
      fingerprint: fingerprint(signatures),
      signatures,
      fieldCount: signatures.length,
      autofillCount: Number(plan?.autofillCount || 0),
      reviewCount: Number(plan?.reviewCount || 0),
      blockedCount: Number(plan?.blockedCount || 0),
      failedCount: Number((scan?.fields || []).filter(field => field?.fillFailed === true).length)
    };
  }

  function similarity(a, b) {
    const left = new Set(a || []);
    const right = new Set(b || []);
    if (!left.size && !right.size) return 1;
    let intersection = 0;
    for (const value of left) if (right.has(value)) intersection++;
    const union = new Set([...left, ...right]).size;
    return union ? intersection / union : 1;
  }

  function diff(previous, current) {
    if (!previous) {
      return { added: current?.fieldCount || 0, removed: 0, similarity: 0 };
    }
    const before = new Set(previous.signatures || []);
    const after = new Set(current?.signatures || []);
    let added = 0;
    let removed = 0;
    for (const value of after) if (!before.has(value)) added++;
    for (const value of before) if (!after.has(value)) removed++;
    return { added, removed, similarity: similarity(previous.signatures, current?.signatures) };
  }

  function isNewStage(previous, current) {
    if (!previous) return true;
    if (previous.jobKey && current?.jobKey && previous.jobKey !== current.jobKey) return true;
    if (previous.fingerprint === current?.fingerprint) return false;

    const comparison = diff(previous, current);
    const routeChanged = Boolean(previous.route && current?.route && previous.route !== current.route);
    if (routeChanged && comparison.similarity < 0.85) return true;
    if (!routeChanged && comparison.similarity < 0.35 && Math.max(previous.fieldCount || 0, current?.fieldCount || 0) >= 2) return true;
    return false;
  }

  function advance(history, snapshot, maxHistory = MAX_HISTORY) {
    const current = snapshot || null;
    if (!current) return { history: Array.isArray(history) ? history : [], stage: 0, isNew: false, change: { added: 0, removed: 0, similarity: 1 } };

    let next = Array.isArray(history) ? history.filter(Boolean).slice(-maxHistory) : [];
    if (next.length && next[0]?.jobKey && current.jobKey && next[0].jobKey !== current.jobKey) next = [];

    const previous = next.length ? next[next.length - 1] : null;
    const change = diff(previous, current);
    const newStage = isNewStage(previous, current);

    if (!previous || newStage) {
      const stage = next.length + 1;
      next.push({ ...current, stage });
      if (next.length > maxHistory) next = next.slice(-maxHistory);
      return { history: next, stage, isNew: true, change };
    }

    const stage = Number(previous.stage || next.length || 1);
    next[next.length - 1] = { ...previous, ...current, stage };
    return { history: next, stage, isNew: false, change };
  }

  function publicSummary(result) {
    const latest = result?.history?.[result.history.length - 1];
    if (!latest) return null;
    return {
      stage: Number(latest.stage || result.stage || 1),
      isNew: Boolean(result.isNew),
      fieldCount: Number(latest.fieldCount || 0),
      autofillCount: Number(latest.autofillCount || 0),
      reviewCount: Number(latest.reviewCount || 0),
      blockedCount: Number(latest.blockedCount || 0),
      failedCount: Number(latest.failedCount || 0),
      added: Number(result.change?.added || 0),
      removed: Number(result.change?.removed || 0)
    };
  }

  return {
    MAX_HISTORY,
    normalize,
    hash,
    routeKey,
    fieldSignature,
    signatureSet,
    fingerprint,
    buildSnapshot,
    similarity,
    diff,
    isNewStage,
    advance,
    publicSummary
  };
});