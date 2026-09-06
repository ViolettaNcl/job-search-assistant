let vjaFinalGate = null;
let vjaFinalSubmitControl = null;

function vjaEnsureFinalReviewUi() {
  let card = $("finalReviewGate");
  if (card) return card;
  const anchor = $("candidateConfirmationStatus") || $("reviewNavigatorStatus") || $("recheckForm");
  if (!anchor) return null;

  card = document.createElement("section");
  card.id = "finalReviewGate";
  card.className = "readinessCard readiness-neutral";

  const title = document.createElement("strong");
  title.id = "finalReviewTitle";
  title.textContent = "Final review gate";

  const detail = document.createElement("p");
  detail.id = "finalReviewDetail";
  detail.className = "readinessDetail";
  detail.textContent = "Clear detected checkpoints, verify the attachment, then locate the employer's final action for a human review.";

  const locate = document.createElement("button");
  locate.id = "checkFinalReview";
  locate.className = "secondary full compactFull";
  locate.textContent = "Check final review";

  const confirm = document.createElement("button");
  confirm.id = "confirmFinalReview";
  confirm.className = "primary full compactFull";
  confirm.textContent = "I reviewed the full form";
  confirm.disabled = true;

  const note = document.createElement("p");
  note.id = "finalReviewSafety";
  note.className = "readinessDisclaimer";
  note.textContent = "This gate never clicks Submit/Apply. The employer's final action remains yours.";

  card.append(title, detail, locate, confirm, note);
  anchor.insertAdjacentElement("afterend", card);
  return card;
}

function vjaRenderFinalGate(gate, submitControl = null) {
  vjaFinalGate = gate;
  vjaFinalSubmitControl = submitControl;
  const card = vjaEnsureFinalReviewUi();
  if (!card) return;
  const title = $("finalReviewTitle");
  const detail = $("finalReviewDetail");
  const confirm = $("confirmFinalReview");

  title.textContent = gate?.title || "Final review gate";
  confirm.disabled = !gate?.canConfirmReview;
  card.className = `readinessCard ${gate?.state === "ready" || gate?.state === "ready-no-submit" ? "readiness-clear" : gate?.state === "unresolved" || gate?.state === "attachment-review" ? "readiness-review" : "readiness-neutral"}`;

  if (gate?.state === "unresolved") {
    detail.textContent = "Use Next field needing me and candidate confirmation to clear the remaining detected checkpoints first.";
  } else if (gate?.state === "attachment-review") {
    detail.textContent = "A CV/resume upload field is detected but the recommended attachment is not verified yet.";
  } else if (gate?.state === "ready" && submitControl?.found) {
    detail.textContent = `Detected and highlighted “${submitControl.label}”. Review the entire employer form, attachment and declarations before using it.`;
  } else if (gate?.state === "submit-ambiguous") {
    detail.textContent = "Several possible final actions were found, so none was highlighted. Inspect the employer page manually before submitting.";
  } else if (gate?.state === "ready-no-submit") {
    detail.textContent = "No unambiguous final Submit/Apply control was detected. The checklist is clear, but inspect the employer page manually.";
  } else {
    detail.textContent = "Run the final review check after the application has been prepared.";
  }
}

async function vjaCheckFinalReview() {
  const button = $("checkFinalReview");
  if (!latest) return showError("Analyze or prepare the application first.");
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Checking final state…";
  }
  try {
    await refreshFieldPlan();
    window.vjaRenderSubmissionReadiness?.();
    const readiness = typeof vjaCurrentReadiness === "function" ? vjaCurrentReadiness() : null;
    let gate = window.vjaFinalReviewGate.evaluate(readiness);
    let submitControl = null;

    if (gate.canLocateSubmit) {
      submitControl = await sendToPage({ type: "locateFinalSubmit" });
      if (submitControl?.error) throw new Error(submitControl.error);
      gate = window.vjaFinalReviewGate.evaluate(readiness, submitControl);
    }

    vjaRenderFinalGate(gate, submitControl);
    return gate;
  } catch (error) {
    showError(error?.message || String(error));
    vjaRenderFinalGate({ state: "error", title: "Final review check failed", canConfirmReview: false });
    return null;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Check final review";
    }
  }
}

async function vjaConfirmFinalReview() {
  const button = $("confirmFinalReview");
  if (!latest) return showError("Analyze or prepare the application first.");
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Rechecking…";
  }
  try {
    // Re-scan at the moment of confirmation so a changed/manual field cannot rely on a stale clear state.
    const gate = await vjaCheckFinalReview();
    if (!gate?.canConfirmReview) return;
    const completed = window.vjaFinalReviewGate.afterCandidateReview(gate);
    const card = vjaEnsureFinalReviewUi();
    if (card) card.className = "readinessCard readiness-clear";
    $("finalReviewTitle").textContent = completed.title;
    $("finalReviewDetail").textContent = "The assistant has not submitted anything. Do one last visual check on the employer page, then use the highlighted/final employer action yourself when ready.";
    if (button) {
      button.textContent = "Final review confirmed ✓";
      button.disabled = true;
    }
  } catch (error) {
    showError(error?.message || String(error));
  }
}

const vjaFinalReviewUi = vjaEnsureFinalReviewUi();
$("checkFinalReview")?.addEventListener("click", vjaCheckFinalReview);
$("confirmFinalReview")?.addEventListener("click", vjaConfirmFinalReview);

for (const id of ["analyze", "prepareApplication", "fillForm", "uploadCv", "confirmReviewField", "recheckForm"]) {
  $(id)?.addEventListener("click", () => {
    vjaFinalGate = null;
    vjaFinalSubmitControl = null;
    const confirm = $("confirmFinalReview");
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = "I reviewed the full form";
    }
  }, true);
}

window.vjaCheckFinalReview = vjaCheckFinalReview;
window.vjaConfirmFinalReview = vjaConfirmFinalReview;
