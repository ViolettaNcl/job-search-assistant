let vjaReviewNavigatorToken = "";
window.vjaReviewNavigatorSelection = window.vjaReviewNavigatorSelection || null;

function vjaSetReviewNavigatorStatus(message, action = "") {
  const node = $("reviewNavigatorStatus");
  if (!node) return;
  node.textContent = message || "";
  node.dataset.action = action || "";
}

function vjaSetReviewNavigatorSelection(item) {
  window.vjaReviewNavigatorSelection = item || null;
  window.vjaUpdateCandidateConfirmationUi?.(window.vjaReviewNavigatorSelection);
}

async function vjaNavigateNextReviewField() {
  const button = $("nextReviewField");
  if (!latest) return showError("Analyze or prepare the vacancy first.");
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Finding next field…";
  }

  try {
    await refreshFieldPlan();
    window.vjaRenderSubmissionReadiness?.();
    const readiness = typeof vjaCurrentReadiness === "function" ? vjaCurrentReadiness() : null;
    const selection = window.vjaReviewNavigator.next(readiness?.items || [], vjaReviewNavigatorToken);

    if (!selection.item) {
      vjaReviewNavigatorToken = "";
      vjaSetReviewNavigatorSelection(null);
      vjaSetReviewNavigatorStatus("No unresolved detected fields. Review the full employer form and attachment before submitting.", "clear");
      return;
    }

    const result = await sendToPage({
      type: "focusReviewField",
      token: selection.item.token,
      action: selection.item.action
    });

    if (!result?.found) {
      vjaReviewNavigatorToken = "";
      vjaSetReviewNavigatorSelection(null);
      await refreshFieldPlan();
      throw new Error(result?.error || "The field moved. The form was refreshed; try again.");
    }

    vjaReviewNavigatorToken = selection.item.token;
    vjaSetReviewNavigatorSelection({ ...selection.item, currentValuePresent: Boolean(result.currentValuePresent) });
    vjaSetReviewNavigatorStatus(window.vjaReviewNavigator.summary(selection), selection.item.action);
    window.vjaCaptureApplicationStep?.();
  } catch (error) {
    showError(error?.message || String(error));
    vjaSetReviewNavigatorStatus(error?.message || String(error), "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Next field needing me";
    }
  }
}

$("nextReviewField")?.addEventListener("click", vjaNavigateNextReviewField);

// Do not reset the cursor when refreshFieldPlan updates count cards. Keeping the
// last token lets repeated clicks cycle deterministically. If a corrected or
// candidate-confirmed field disappears from the unresolved list, next() starts
// from the first remaining unresolved item because the old token is absent.

window.vjaNavigateNextReviewField = vjaNavigateNextReviewField;
window.vjaSetReviewNavigatorSelection = vjaSetReviewNavigatorSelection;
