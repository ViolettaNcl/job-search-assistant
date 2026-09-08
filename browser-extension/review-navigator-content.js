let vjaReviewFocusedElement = null;
let vjaReviewFocusedOutline = "";
let vjaReviewFocusedOutlineOffset = "";

function vjaClearReviewFocus() {
  if (!vjaReviewFocusedElement) return;
  if (vjaReviewFocusedElement.isConnected) {
    vjaReviewFocusedElement.style.outline = vjaReviewFocusedOutline;
    vjaReviewFocusedElement.style.outlineOffset = vjaReviewFocusedOutlineOffset;
  }
  vjaReviewFocusedElement = null;
  vjaReviewFocusedOutline = "";
  vjaReviewFocusedOutlineOffset = "";
}

function vjaReviewFocusTarget(el) {
  if (!el) return null;
  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
    return associatedLabel(el) || el.closest("label") || el;
  }
  if (fieldTypeFor(el) === "radiogroup") return el;
  return el.closest?.("fieldset, [role='group'], [class*='question'], [class*='field']") || el;
}

function vjaFocusReviewField(token, action) {
  if (!token) return { found: false, error: "Missing field token." };
  const el = document.querySelector(`[data-vja-field-token="${CSS.escape(token)}"]`);
  if (!el) return { found: false, error: "This field changed or moved. Recheck the form and try again." };

  vjaClearReviewFocus();
  const target = vjaReviewFocusTarget(el) || el;
  vjaReviewFocusedElement = target;
  vjaReviewFocusedOutline = target.style.outline || "";
  vjaReviewFocusedOutlineOffset = target.style.outlineOffset || "";
  target.style.outline = action === "blocked" ? "3px solid #dc2626" : action === "failed" ? "3px solid #ea580c" : "3px solid #d97706";
  target.style.outlineOffset = "4px";
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  try {
    if (typeof el.focus === "function") el.focus({ preventScroll: true });
  } catch { }

  return {
    found: true,
    token,
    action,
    type: fieldTypeFor(el),
    label: labelFor(el).slice(0, 240),
    currentValuePresent: Boolean(currentValue(el))
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "focusReviewField") return false;
  try {
    sendResponse(vjaFocusReviewField(message.token, message.action));
  } catch (error) {
    sendResponse({ found: false, error: error?.message || String(error) });
  }
  return false;
});
