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
  const applicationRoute = /application|candidate|apply/i.test(location.pathname + location.search);
  const candidates = [...document.querySelectorAll(selector)]
    .filter(vjaFinalActionVisible)
    .map(el => {
      const label = vjaFinalActionText(el).slice(0, 160);
      return {
        el,
        label,
        metadata: {
          submitType: Boolean(el.matches?.('button[type="submit"], input[type="submit"]')),
          inForm: Boolean(el.closest?.("form")),
          applicationRoute
        }
      };
    });

  const choice = window.vjaFinalSubmitControl?.choose?.(candidates) || { found: false, ambiguous: false, count: 0 };
  if (!choice.found) return choice;

  const best = choice.candidate;
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
