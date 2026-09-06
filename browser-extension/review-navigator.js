(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaReviewNavigator = api;
})(typeof window !== "undefined" ? window : null, function () {
  const priority = { failed: 0, review: 1, blocked: 2 };

  function ordered(items) {
    return (Array.isArray(items) ? items : [])
      .filter(item => item?.token && ["failed", "review", "blocked"].includes(item.action))
      .map((item, index) => ({ ...item, _order: index }))
      .sort((a, b) => (priority[a.action] ?? 99) - (priority[b.action] ?? 99) || a._order - b._order)
      .map(({ _order, ...item }) => item);
  }

  function next(items, currentToken = "") {
    const list = ordered(items);
    if (!list.length) return { item: null, index: -1, total: 0 };
    const currentIndex = list.findIndex(item => item.token === currentToken);
    const index = currentIndex < 0 ? 0 : (currentIndex + 1) % list.length;
    return { item: list[index], index, total: list.length };
  }

  function badge(item) {
    if (!item) return "";
    if (item.action === "failed") return item.currentValuePresent ? "Verify fill" : "Autofill failed";
    if (item.action === "blocked") return "Manual only";
    return item.currentValuePresent ? "Verify" : "Review";
  }

  function summary(selection) {
    if (!selection?.item) return "No unresolved detected fields.";
    const item = selection.item;
    return `${selection.index + 1}/${selection.total} · ${badge(item)} · ${item.label}${item.reason ? ` — ${item.reason}` : ""}`;
  }

  return { ordered, next, badge, summary };
});