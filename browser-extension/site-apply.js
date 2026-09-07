(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaSiteApply = api;
})(typeof window !== "undefined" ? window : null, function () {
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function scoreStartAction(label, metadata = {}) {
    const text = clean(label).toLowerCase();
    if (!text) return -100;
    if (/sign in|log in|register|subscribe|save|bookmark|share|войти|регистрац|сохранить|подпис/i.test(text)) return -100;
    if (/submit application|send application|complete application|отправить (заявку|отклик)|подать (заявку|отклик)/i.test(text)) {
      return metadata.inForm || metadata.inDialog ? -100 : 5;
    }

    let score = -100;
    if (/^откликнуться$/i.test(text)) score = 14;
    else if (/откликнуться|отклик на вакансию|respond to (this )?(job|vacancy)/i.test(text)) score = 12;
    else if (/^apply now$|^apply$|apply for (this )?(job|position)/i.test(text)) score = 11;
    else if (/отправить резюме|send (my )?cv|send (my )?resume/i.test(text)) score = 10;
    if (score < 0) return score;

    if (metadata.inForm || metadata.inDialog) score -= 5;
    const href = clean(metadata.href).toLowerCase();
    if (/apply|response|respond|negotiation|vacancy/.test(href)) score += 2;
    if (metadata.primary) score += 1;
    return score;
  }

  function chooseStartAction(candidates = []) {
    const ranked = candidates
      .map((item, index) => ({ ...item, index, score: scoreStartAction(item?.label, item?.metadata) }))
      .filter(item => item.score >= 8)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (!ranked.length) return { found: false, ambiguous: false, count: 0 };
    const bestScore = ranked[0].score;
    const ties = ranked.filter(item => item.score === bestScore);
    if (ties.length !== 1) return { found: false, ambiguous: true, count: ties.length, labels: ties.slice(0, 4).map(x => clean(x.label)) };
    return { found: true, ambiguous: false, count: 1, candidate: ties[0] };
  }

  function scoreCoverLetterField(label, metadata = {}) {
    const text = clean(label).toLowerCase();
    if (/salary|зарплат|password|парол|phone|телефон|email|e-mail|linkedin|legal|право|citizenship|граждан/i.test(text)) return -100;
    let score = 0;
    if (/сопровод|мотивацион|cover letter|motivation letter/i.test(text)) score += 14;
    else if (/message to|message for|сообщение работодател|письмо работодател/i.test(text)) score += 11;
    else if (/message|comment|комментар|письмо/i.test(text)) score += 7;
    if (metadata.textarea) score += 3;
    if (metadata.required) score += 1;
    return score;
  }

  function chooseCoverLetterField(candidates = []) {
    const ranked = candidates
      .map((item, index) => ({ ...item, index, score: scoreCoverLetterField(item?.label, item?.metadata) }))
      .filter(item => item.score >= 7)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (!ranked.length) return { found: false, ambiguous: false, count: 0 };
    const bestScore = ranked[0].score;
    const ties = ranked.filter(item => item.score === bestScore);
    if (ties.length !== 1) return { found: false, ambiguous: true, count: ties.length };
    return { found: true, ambiguous: false, count: 1, candidate: ties[0] };
  }

  function unresolvedRequired(fields = []) {
    return fields.filter(field => {
      if (!field?.required || field.disabled || field.hidden) return false;
      if (field.type === "checkbox" || field.type === "radio") return !field.checked;
      if (field.type === "file") return Number(field.fileCount || 0) < 1;
      return !clean(field.value);
    });
  }

  function canSubmit(input = {}) {
    const unresolved = Math.max(0, Number(input.unresolvedRequired || 0));
    if (unresolved) return { ok: false, reason: "required-fields" };
    if (input.cvFieldPresent && !input.cvUploaded) return { ok: false, reason: "cv-not-uploaded" };
    if (!input.finalFound) return { ok: false, reason: "final-action-not-found" };
    if (input.finalAmbiguous) return { ok: false, reason: "final-action-ambiguous" };
    return { ok: true, reason: "ready" };
  }

  return { clean, scoreStartAction, chooseStartAction, scoreCoverLetterField, chooseCoverLetterField, unresolvedRequired, canSubmit };
});
