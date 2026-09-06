window.vjaCandidateConfirmationState = window.vjaCandidateConfirmationState || null;
window.vjaReviewNavigatorSelection = window.vjaReviewNavigatorSelection || null;

function vjaEnsureCandidateConfirmationUi() {
  let button = $("confirmReviewField");
  let note = $("candidateConfirmationStatus");
  if (button && note) return { button, note };

  const anchor = $("reviewNavigatorStatus");
  if (!anchor) return { button: null, note: null };

  button = document.createElement("button");
  button.id = "confirmReviewField";
  button.className = "secondary full compactFull";
  button.textContent = "I reviewed this field — next";
  button.disabled = true;

  note = document.createElement("p");
  note.id = "candidateConfirmationStatus";
  note.className = "note";
  note.dataset.state = "idle";

  anchor.insertAdjacentElement("afterend", note);
  anchor.insertAdjacentElement("afterend", button);
  return { button, note };
}

function vjaUpdateCandidateConfirmationUi(item = window.vjaReviewNavigatorSelection) {
  const { button, note } = vjaEnsureCandidateConfirmationUi();
  if (!button || !note) return;

  if (!item) {
    button.disabled = true;
    button.textContent = "I reviewed this field — next";
    note.textContent = "Open a field with Review Navigator, check or answer it on the employer page, then confirm that checkpoint here.";
    note.dataset.state = "idle";
    return;
  }

  button.disabled = false;
  button.textContent = "I reviewed this field — next";
  note.textContent = item.currentValuePresent
    ? "An answer is currently present. Confirm only after you have checked that it is correct for this application."
    : "Answer or select this field on the employer page first, then confirm it here.";
  note.dataset.state = item.action || "review";
}

async function vjaAnnotateCurrentScanWithConfirmations() {
  if (!latestScan || !window.vjaCandidateConfirmation) return;
  latestScan.fields = await window.vjaCandidateConfirmation.annotate(
    latestScan.fields || [],
    window.vjaCandidateConfirmationState
  );
}

function vjaRefreshConfirmationCounts() {
  if (typeof vjaCurrentReadiness !== "function") return;
  const readiness = vjaCurrentReadiness();
  if (!readiness) return;
  if ($("reviewCount")) $("reviewCount").textContent = Number(readiness.reviewCount || 0) + Number(readiness.failedCount || 0);
  if ($("blockedCount")) $("blockedCount").textContent = Number(readiness.blockedCount || 0);
}

// Every field rescan is annotated against the current salted fingerprints. A changed
// answer no longer matches, so confirmation is invalidated without storing the value.
if (typeof window.refreshFieldPlan === "function" && !window.refreshFieldPlan.__candidateConfirmationWrapped) {
  const originalRefreshFieldPlan = window.refreshFieldPlan;
  const wrappedRefreshFieldPlan = async function (...args) {
    const plan = await originalRefreshFieldPlan(...args);
    await vjaAnnotateCurrentScanWithConfirmations();
    window.vjaRenderSubmissionReadiness?.();
    vjaRefreshConfirmationCounts();
    return plan;
  };
  wrappedRefreshFieldPlan.__candidateConfirmationWrapped = true;
  window.refreshFieldPlan = wrappedRefreshFieldPlan;
}

async function vjaConfirmCurrentReviewField() {
  const { button, note } = vjaEnsureCandidateConfirmationUi();
  const item = window.vjaReviewNavigatorSelection;
  if (!latest || !item) return showError("Use Next field needing me first.");
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Checking field…";
  }

  try {
    await window.refreshFieldPlan();
    const field = (latestScan?.fields || []).find(x => x.token === item.token);
    if (!field) throw new Error("That ATS field moved or was replaced. Use Next field needing me again.");
    if (field.candidateConfirmed) {
      window.vjaReviewNavigatorSelection = null;
      vjaUpdateCandidateConfirmationUi(null);
      await window.vjaNavigateNextReviewField?.();
      return;
    }

    window.vjaCandidateConfirmationState = await window.vjaCandidateConfirmation.confirm(
      field,
      window.vjaCandidateConfirmationState
    );
    latestScan.fields = await window.vjaCandidateConfirmation.annotate(
      latestScan.fields || [],
      window.vjaCandidateConfirmationState
    );

    await window.vjaSaveApplicationSession?.();
    window.vjaRenderSubmissionReadiness?.();
    vjaRefreshConfirmationCounts();
    if (note) {
      note.textContent = "Checkpoint confirmed for this application session without storing the answer. Moving to the next unresolved field…";
      note.dataset.state = "confirmed";
    }
    window.vjaReviewNavigatorSelection = null;
    await window.vjaNavigateNextReviewField?.();
  } catch (error) {
    showError(error?.message || String(error));
    if (note) {
      note.textContent = error?.message || String(error);
      note.dataset.state = "error";
    }
  } finally {
    vjaUpdateCandidateConfirmationUi(window.vjaReviewNavigatorSelection);
  }
}

const vjaCandidateConfirmationUi = vjaEnsureCandidateConfirmationUi();
vjaCandidateConfirmationUi.button?.addEventListener("click", vjaConfirmCurrentReviewField);

for (const id of ["analyze", "prepareApplication"]) {
  $(id)?.addEventListener("click", () => {
    window.vjaCandidateConfirmationState = null;
    window.vjaReviewNavigatorSelection = null;
    vjaUpdateCandidateConfirmationUi(null);
  }, true);
}

$("clearSession")?.addEventListener("click", () => {
  window.vjaCandidateConfirmationState = null;
  window.vjaReviewNavigatorSelection = null;
  vjaUpdateCandidateConfirmationUi(null);
}, true);

window.vjaUpdateCandidateConfirmationUi = vjaUpdateCandidateConfirmationUi;
window.vjaConfirmCurrentReviewField = vjaConfirmCurrentReviewField;
window.vjaAnnotateCurrentScanWithConfirmations = vjaAnnotateCurrentScanWithConfirmations;
vjaUpdateCandidateConfirmationUi(null);
