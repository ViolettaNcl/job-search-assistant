(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaAtsControls = api;
})(typeof window !== "undefined" ? window : null, function () {
  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function classifyElementMeta(meta) {
    const tagName = normalize(meta?.tagName);
    const role = normalize(meta?.role);
    const popup = normalize(meta?.ariaHasPopup);

    if (role === "radiogroup") return "radiogroup";
    if (role === "combobox") return "combobox";
    if ((tagName === "button" || role === "button") && (popup === "listbox" || popup === "true")) return "combobox";
    return "";
  }

  function isInteractiveReviewType(type) {
    const value = normalize(type);
    return value === "combobox" || value === "radiogroup";
  }

  return {
    classifyElementMeta,
    isInteractiveReviewType
  };
});
