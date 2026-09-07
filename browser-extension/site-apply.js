(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaSiteApply = api;
})(typeof window !== "undefined" ? window : null, function () {
  const APPLY_RE = /^(?:откликнуться|отправить отклик|подать заявку|apply|apply now|submit application|send application|respond)$/i;
  const FINAL_RE = /(?:отправить\s+отклик|отправить\s+заявку|подать\s+заявку|submit\s+application|send\s+application|apply\s+now|откликнуться)/i;
  const COVER_RE = /(?:сопровод|мотивац|письм|сообщен|cover\s*letter|motivation|message\s+to)/i;

  function textOf(el) {
    return String(el?.innerText || el?.textContent || el?.value || "").replace(/\s+/g, " ").trim();
  }

  function visible(el) {
    if (!el || el.disabled || el.getAttribute?.("aria-disabled") === "true") return false;
    const style = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return el.offsetParent !== null || el.getClientRects?.().length > 0;
  }

  function labelText(el, doc = document) {
    const parts = [el?.getAttribute?.("aria-label"), el?.getAttribute?.("placeholder"), el?.name, el?.id];
    if (el?.id) {
      try {
        const label = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) parts.push(textOf(label));
      } catch { }
    }
    const parentLabel = el?.closest?.("label");
    if (parentLabel) parts.push(textOf(parentLabel));
    const container = el?.closest?.("[role='dialog'], form, [class*='field'], [class*='form']");
    if (container) parts.push(textOf(container).slice(0, 500));
    return parts.filter(Boolean).join(" ");
  }

  function buttonCandidates(doc = document) {
    return [...doc.querySelectorAll("button, a, [role='button'], input[type='submit'], input[type='button']")]
      .filter(visible)
      .map((el, index) => ({ el, index, text: textOf(el) }))
      .filter(x => x.text);
  }

  function findApplyTrigger(doc = document) {
    const candidates = buttonCandidates(doc);
    const exact = candidates.find(x => APPLY_RE.test(x.text));
    if (exact) return exact.el;
    const fuzzy = candidates.find(x => /отклик|apply|подать\s+заявку/i.test(x.text) && !/отмен|cancel|withdraw/i.test(x.text));
    return fuzzy?.el || null;
  }

  function applicationSurface(doc = document) {
    const dialog = [...doc.querySelectorAll("[role='dialog'], dialog, [class*='modal'], [class*='application'], form")]
      .filter(visible)
      .find(el => /отклик|заявк|apply|application|сопровод|resume|резюме/i.test(textOf(el)));
    return dialog || doc;
  }

  function findCoverLetterField(doc = document) {
    const surface = applicationSurface(doc);
    const fields = [...surface.querySelectorAll("textarea, [contenteditable='true']")].filter(visible);
    const labelled = fields.find(el => COVER_RE.test(labelText(el, doc)));
    if (labelled) return labelled;
    if (fields.length === 1) return fields[0];
    return fields.sort((a, b) => (b.clientHeight || 0) - (a.clientHeight || 0))[0] || null;
  }

  function setValue(el, value) {
    if (!el) return false;
    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return textOf(el).length > 0;
    }
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return String(el.value || "").trim() === String(value || "").trim();
  }

  function findFinalSubmit(doc = document, opener = null) {
    const surface = applicationSurface(doc);
    const inside = [...surface.querySelectorAll("button, [role='button'], input[type='submit'], a")]
      .filter(visible)
      .filter(el => el !== opener)
      .map(el => ({ el, text: textOf(el) }))
      .filter(x => x.text && FINAL_RE.test(x.text) && !/предпросмотр|preview|сохранить|save|назад|back/i.test(x.text));
    if (inside.length) return inside[inside.length - 1].el;

    const all = buttonCandidates(doc)
      .filter(x => x.el !== opener)
      .filter(x => FINAL_RE.test(x.text) && !/предпросмотр|preview|сохранить|save|назад|back/i.test(x.text));
    return all.length ? all[all.length - 1].el : null;
  }

  function hasApplicationFields(doc = document) {
    const surface = applicationSurface(doc);
    return [...surface.querySelectorAll("textarea, input[type='file'], input:not([type]), input[type='text'], input[type='email'], input[type='tel'], select")]
      .some(visible);
  }

  async function waitFor(predicate, timeoutMs = 4500, intervalMs = 120) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const result = predicate();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return null;
  }

  async function begin(doc, payload = {}) {
    const beforeUrl = String(doc.location?.href || "");
    let opener = null;
    if (!hasApplicationFields(doc)) {
      opener = findApplyTrigger(doc);
      if (!opener) return { success: false, stage: "open", error: "Could not find the employer Apply/Откликнуться button on this page." };
      opener.scrollIntoView?.({ block: "center", behavior: "smooth" });
      opener.click();
      await waitFor(() => hasApplicationFields(doc) || findFinalSubmit(doc, opener) || String(doc.location?.href || "") !== beforeUrl);
    }

    const afterUrl = String(doc.location?.href || "");
    if (afterUrl !== beforeUrl && !hasApplicationFields(doc)) {
      return { success: true, stage: "redirected", redirected: true, url: afterUrl };
    }

    let coverLetterFilled = false;
    const coverLetter = String(payload.coverLetter || "").trim();
    if (coverLetter) {
      const field = await waitFor(() => findCoverLetterField(doc), 2500, 100);
      if (field) coverLetterFilled = setValue(field, coverLetter);
    }

    let cv = { attempted: false, success: false, noField: false };
    if (payload.fileData) {
      cv.attempted = true;
      if (typeof window !== "undefined" && typeof window.vjaUploadCv === "function") {
        const result = window.vjaUploadCv(payload.fileData);
        cv = { attempted: true, ...result, noField: !result?.success && /No unambiguous/i.test(result?.error || "") };
      } else {
        cv.error = "CV uploader is unavailable on this page.";
      }
    }

    return {
      success: true,
      stage: "prepared",
      coverLetterFilled,
      cv,
      finalButtonFound: Boolean(findFinalSubmit(doc, opener)),
      url: afterUrl
    };
  }

  async function submit(doc) {
    const button = await waitFor(() => findFinalSubmit(doc), 2500, 100);
    if (!button) return { success: false, submitted: false, error: "Application form is open, but the final Submit/Откликнуться button was not found." };
    const label = textOf(button);
    button.scrollIntoView?.({ block: "center", behavior: "smooth" });
    button.click();
    return { success: true, submitted: true, buttonText: label };
  }

  return { textOf, findApplyTrigger, findCoverLetterField, findFinalSubmit, hasApplicationFields, begin, submit };
});

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage && typeof document !== "undefined") {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "beginSiteApplication") {
      window.vjaSiteApply.begin(document, message).then(sendResponse).catch(error => sendResponse({ success: false, error: error?.message || String(error) }));
      return true;
    }
    if (message?.type === "submitSiteApplication") {
      window.vjaSiteApply.submit(document).then(sendResponse).catch(error => sendResponse({ success: false, submitted: false, error: error?.message || String(error) }));
      return true;
    }
    return false;
  });
}
