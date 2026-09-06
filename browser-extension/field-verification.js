(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaFieldVerification = api;
})(typeof window !== "undefined" ? window : null, function () {
  function normalize(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function booleanMeaning(value) {
    const text = normalize(value);
    if (["yes", "да", "true", "1"].includes(text)) return true;
    if (["no", "нет", "false", "0"].includes(text)) return false;
    return null;
  }

  function matchesExpected(type, candidates, expected) {
    const target = normalize(expected);
    if (!target) return false;

    const values = Array.isArray(candidates) ? candidates : [candidates];
    const expectedBoolean = booleanMeaning(target);

    for (const candidate of values) {
      const actual = normalize(candidate);
      if (!actual) continue;
      if (actual === target) return true;

      if (expectedBoolean !== null) {
        const actualBoolean = booleanMeaning(actual);
        if (actualBoolean !== null && actualBoolean === expectedBoolean) return true;
      }

      if (String(type || "").toLowerCase() === "textarea") {
        const compactActual = actual.replace(/\s+/g, " ");
        const compactTarget = target.replace(/\s+/g, " ");
        if (compactActual === compactTarget) return true;
      }
    }

    return false;
  }

  return { normalize, booleanMeaning, matchesExpected };
});
