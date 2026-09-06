(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaFillReconciliation = api;
})(typeof window !== "undefined" ? window : null, function () {
  function reconcile(scan, plan, verification) {
    const fields = Array.isArray(scan?.fields) ? scan.fields : [];
    const resolutions = Array.isArray(plan?.fields) ? plan.fields : [];
    const byToken = new Map(resolutions.map(item => [item?.token, item]));
    let clearedFailures = 0;

    const nextFields = fields.map(field => {
      if (field?.fillFailed !== true) return field;
      const item = byToken.get(field.token);
      if (!item || item.action !== "fill" || item.value == null || item.value === "") return field;
      const matcher = verification?.matchesExpected;
      if (typeof matcher !== "function") return field;

      const current = String(field.currentValue || "").trim();
      if (!current) return field;
      if (!matcher(field.type || "text", [current], item.value)) return field;

      clearedFailures++;
      return { ...field, fillFailed: false, fillRecovered: true };
    });

    return {
      scan: { ...(scan || {}), fields: nextFields },
      clearedFailures
    };
  }

  return { reconcile };
});
