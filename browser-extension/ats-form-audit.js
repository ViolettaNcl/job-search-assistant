(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaAtsFormAudit = api;
})(typeof window !== "undefined" ? window : null, function () {
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function hasValue(field) {
    const value = clean(field?.currentValue);
    if (value) return true;
    if (field?.type === "checkbox" || field?.type === "radio") return Boolean(field?.checked);
    return false;
  }

  function resolutionMap(resolutions) {
    return new Map((resolutions || []).map(x => [x.token, x]));
  }

  function dedupeByKey(rows) {
    const seen = new Set();
    return rows.filter(row => {
      const key = row.groupKey || row.token;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function audit(fields, resolutions) {
    const map = resolutionMap(resolutions);
    const normalized = (fields || []).map(field => ({
      ...field,
      label: clean(field.label) || "Unidentified field",
      required: Boolean(field.required),
      valid: field.valid !== false,
      resolution: map.get(field.token) || null
    }));

    const required = normalized.filter(x => x.required);
    const missingRequired = [];

    const grouped = new Map();
    for (const field of required) {
      const groupKey = field.groupKey || field.token;
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey).push(field);
    }

    for (const rows of grouped.values()) {
      const sample = rows[0];
      const isChoiceGroup = rows.some(x => x.type === "radio" || x.type === "checkbox");
      const anyValue = rows.some(hasValue);
      const anyValid = rows.some(x => x.valid);
      if (isChoiceGroup) {
        if (!anyValue && !anyValid) missingRequired.push(sample);
        else if (!anyValue && rows.every(x => !hasValue(x))) missingRequired.push(sample);
      } else if (!hasValue(sample) || !sample.valid) {
        missingRequired.push(sample);
      }
    }

    const requiredAttention = dedupeByKey(required.filter(field => {
      const action = field.resolution?.action;
      return action === "review" || action === "blocked";
    }));

    const blocked = dedupeByKey(normalized.filter(x => x.resolution?.action === "blocked"));
    const review = dedupeByKey(normalized.filter(x => x.resolution?.action === "review"));

    return {
      detectedFields: normalized.length,
      requiredFields: grouped.size,
      missingRequired: dedupeByKey(missingRequired).map(toSummary),
      requiredAttention: requiredAttention.map(toSummary),
      blocked: blocked.map(toSummary),
      review: review.map(toSummary),
      readyForManualSubmitReview: missingRequired.length === 0
    };
  }

  function toSummary(field) {
    return {
      token: field.token,
      label: field.label,
      type: field.type,
      groupKey: field.groupKey || field.token,
      action: field.resolution?.action || "unknown",
      reason: field.resolution?.reason || ""
    };
  }

  return { audit, hasValue };
});
