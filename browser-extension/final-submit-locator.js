function vjaFinalActionText(el) {
  return String(
    el?.innerText || el?.textContent || el?.value || el?.getAttribute?.("aria-label") || el?.getAttribute?.("title") || ""
  ).replace(/\s+/g, " ").trim();
}

function vjaFinalActionVisible(el) {
  if (!el || el.disabled || el.getAttribute?.("aria-disabled") === "true") return false;
  const style = getComputedStyle(el);
  return el.offsetParent !== null && style.visibility !== "hidden" && style.display !== "none";
}

function vjaFinalActionScore(el) {
  const text = vjaFinalActionText(el).toLowerCase();
  if (!text) return -100;
  if (/\b(next|continue|back|previous|save|draft|cancel|preview|review)\b|далее|назад|сохранить|отмена/i.test(text)) return -100;

  let score = 0;
  if (/submit application|complete application|send application|finish application/i.test(text)) score += 12;
  else if (/\bsubmit\b/i.test(text)) score += 9;
  else if (/\bapply now\b|\bapply\b/i.test(text)) score += 7;
  else if (/подать (заявку|отклик)|отправить (заявку|отклик)|откликнуться/i.test(text)) score += 10;
  else return -100;

  if (el.matches?.('button[type="submit"], input[type="submit"]')) score += 3;
  if (el.closest?.("form")) score += 2;
  if (/application|candidate|apply/i.test(location.pathname + location.search)) score += 1;
  return score;
}

let vjaFinalSubmitHighlight = null;
let vjaFinalSubmitOutline = "";
let vjaFinalSubmitOutlineOffset = "";

function vjaClearFinalSubmitHighlight() {
  if (vjaFinalSubmitHighlight?.isConnected) {
    vjaFinalSubmitHighlight.style.outline = vjaFinalSubmitOutline;
    vjaFinalSubmitHighlight.style.outlineOffset = vjaFinalSubmitOutlineOffset;
  }
  vjaFinalSubmitHighlight = null;
  vjaFinalSubmitOutline = "";
  vjaFinalSubmitOutlineOffset = "";
}

function vjaLocateFinalSubmit() {
  vjaClearFinalSubmitHighlight();
  const selector = 'button, input[type="submit"], input[type="button"], [role="button"]';
  const candidates = [...document.querySelectorAll(selector)]
    .filter(vjaFinalActionVisible)
    .map(el => ({ el, label: vjaFinalActionText(el).slice(0, 160), score: vjaFinalActionScore(el) }))
    .filter(x => x.score >= 7)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return { found: false, ambiguous: false, count: 0 };
  const best = candidates[0];
  const ties = candidates.filter(x => x.score === best.score);
  if (ties.length > 1) {
    return {
      found: false,
      ambiguous: true,
      count: ties.length,
      labels: ties.slice(0, 4).map(x => x.label)
    };
  }

  vjaFinalSubmitHighlight = best.el;
  vjaFinalSubmitOutline = best.el.style.outline || "";
  vjaFinalSubmitOutlineOffset = best.el.style.outlineOffset || "";
  best.el.style.outline = "4px solid #16a34a";
  best.el.style.outlineOffset = "4px";
  best.el.scrollIntoView({ behavior: "smooth", block: "center" });

  return {
    found: true,
    ambiguous: false,
    count: 1,
    label: best.label,
    score: best.score
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "locateFinalSubmit") return false;
  try {
    sendResponse(vjaLocateFinalSubmit());
  } catch (error) {
    sendResponse({ found: false, ambiguous: false, error: error?.message || String(error) });
  }
  return true;
});
