(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaRequiredFieldState = api;
})(typeof window !== "undefined" ? window : null, function () {
  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function labelMarksRequired(value) {
    const text = normalize(value).toLowerCase();
    if (!text) return false;
    if (/\brequired\b|обязател|υποχρεω|\brequis\b|\bobligatoire\b/.test(text)) return true;
    return /(^|\s)\*(?=\s|$|[:：])/.test(text);
  }

  function evaluate(meta = {}) {
    const required = Boolean(
      meta.nativeRequired === true ||
      meta.ariaRequired === true ||
      meta.groupRequired === true ||
      labelMarksRequired(meta.label)
    );

    const currentValuePresent = Boolean(normalize(meta.currentValue));
    const satisfied = required
      ? (meta.groupSatisfied === true || (meta.groupSatisfied == null && currentValuePresent))
      : true;

    const token = normalize(meta.token);
    const groupKey = normalize(meta.groupKey);
    return {
      required,
      satisfied,
      missing: required && !satisfied,
      key: groupKey || token,
      currentValuePresent
    };
  }

  function uniqueMissing(fields) {
    const seen = new Set();
    const result = [];
    for (const field of Array.isArray(fields) ? fields : []) {
      if (field?.required !== true || field?.requiredSatisfied === true) continue;
      const key = normalize(field.requiredKey || field.token || field.label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(field);
    }
    return result;
  }

  return { normalize, labelMarksRequired, evaluate, uniqueMissing };
});