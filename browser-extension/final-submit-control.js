(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaFinalSubmitControl = api;
})(typeof window !== "undefined" ? window : null, function () {
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function score(label, metadata = {}) {
    const text = clean(label).toLowerCase();
    if (!text) return -100;
    if (/\b(next|continue|back|previous|save|draft|cancel|preview|review)\b|далее|назад|сохранить|отмена/i.test(text)) return -100;

    let value = 0;
    if (/submit application|complete application|send application|finish application/i.test(text)) value += 12;
    else if (/\bsubmit\b/i.test(text)) value += 9;
    else if (/\bapply now\b|\bapply\b/i.test(text)) value += 7;
    else if (/подать (заявку|отклик)|отправить (заявку|отклик)|откликнуться/i.test(text)) value += 10;
    else return -100;

    if (metadata.submitType) value += 3;
    if (metadata.inForm) value += 2;
    if (metadata.applicationRoute) value += 1;
    return value;
  }

  function choose(candidates) {
    const ranked = (Array.isArray(candidates) ? candidates : [])
      .map((item, index) => ({ ...item, index, score: Number.isFinite(item?.score) ? item.score : score(item?.label, item?.metadata) }))
      .filter(item => item.score >= 7)
      .sort((a, b) => b.score - a.score || a.index - b.index);

    if (!ranked.length) return { found: false, ambiguous: false, count: 0 };
    const bestScore = ranked[0].score;
    const ties = ranked.filter(item => item.score === bestScore);
    if (ties.length !== 1) {
      return {
        found: false,
        ambiguous: true,
        count: ties.length,
        labels: ties.slice(0, 4).map(item => clean(item.label))
      };
    }
    return { found: true, ambiguous: false, count: 1, candidate: ties[0] };
  }

  return { clean, score, choose };
});