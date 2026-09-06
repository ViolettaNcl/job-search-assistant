let vjaSubmissionReceiptResult = null;
let vjaSubmissionReceiptRetry = 0;
let vjaContinuationJob = null;

function vjaEnsureSubmissionReceiptUi() {
  let card = $("submissionReceiptCard");
  if (card) return card;

  const anchor = $("sessionBanner") || $("stepCard") || $("prepareApplication");
  if (!anchor) return null;

  card = document.createElement("section");
  card.id = "submissionReceiptCard";
  card.className = "readinessCard readiness-clear hidden";

  const eyebrow = document.createElement("span");
  eyebrow.className = "small";
  eyebrow.textContent = "Submission receipt";

  const title = document.createElement("strong");
  title.id = "submissionReceiptTitle";
  title.textContent = "Employer confirmation detected";

  const detail = document.createElement("p");
  detail.id = "submissionReceiptDetail";
  detail.className = "readinessDetail";
  detail.textContent = "A strong application-submitted signal was detected on the employer page. Nothing has been recorded yet.";

  const record = document.createElement("button");
  record.id = "recordSubmissionReceipt";
  record.className = "primary full compactFull";
  record.textContent = "Record application";

  const continueButton = document.createElement("button");
  continueButton.id = "continueApplicationSession";
  continueButton.className = "secondary full compactFull hidden";
  continueButton.textContent = "Continue to next strong job";

  const safety = document.createElement("p");
  safety.id = "submissionReceiptSafety";
  safety.className = "readinessDisclaimer";
  safety.textContent = "The assistant never treats the signal alone as permission to change the CRM. Recording and navigation each require an explicit click.";

  card.append(eyebrow, title, detail, record, continueButton, safety);
  anchor.insertAdjacentElement("afterend", card);
  record.addEventListener("click", vjaRecordSubmissionReceipt);
  continueButton.addEventListener("click", vjaContinueApplicationSession);
  return card;
}

function vjaHideSubmissionReceiptUi() {
  $("submissionReceiptCard")?.classList.add("hidden");
  vjaSubmissionReceiptResult = null;
  vjaContinuationJob = null;
  $("continueApplicationSession")?.classList.add("hidden");
}

function vjaRenderContinuation(nextJob) {
  vjaContinuationJob = nextJob || null;
  const button = $("continueApplicationSession");
  if (!button || !window.vjaApplicationContinuation) return null;
  const state = window.vjaApplicationContinuation.build({ recorded: true, nextJob });
  button.classList.toggle("hidden", !state.visible);
  button.disabled = !state.enabled;
  button.textContent = state.label;
  button.title = state.detail;
  return state;
}

function vjaRenderSubmissionReceipt(result) {
  const card = vjaEnsureSubmissionReceiptUi();
  if (!card) return;
  vjaSubmissionReceiptResult = result;
  vjaContinuationJob = null;
  card.classList.remove("hidden");
  card.className = "readinessCard readiness-clear";

  const title = $("submissionReceiptTitle");
  const detail = $("submissionReceiptDetail");
  const button = $("recordSubmissionReceipt");
  const continueButton = $("continueApplicationSession");
  if (continueButton) continueButton.classList.add("hidden");
  if (title) title.textContent = "Employer confirmation detected";
  if (detail) {
    const labels = {
      "application-submitted": "The employer page says the application was submitted.",
      "application-received": "The employer page says the application was received.",
      "thank-you": "The employer page shows a post-application thank-you confirmation.",
      "application-complete": "The employer page says the application is complete."
    };
    detail.textContent = `${labels[result?.signal] || "A strong post-submission confirmation was detected."} Review the page once, then record it in Job Search Assistant.`;
  }
  if (button) {
    button.disabled = !latest;
    button.textContent = latest ? "Record application" : "Restoring application context…";
  }
}

async function vjaCheckSubmissionReceipt({ retry = true } = {}) {
  try {
    const result = await sendToPage({ type: "scanSubmissionReceipt" });
    if (result?.error) throw new Error(result.error);
    if (!result?.confirmed) {
      vjaHideSubmissionReceiptUi();
      return null;
    }

    vjaRenderSubmissionReceipt(result);
    if (!latest && retry && vjaSubmissionReceiptRetry < 5) {
      vjaSubmissionReceiptRetry += 1;
      setTimeout(() => vjaCheckSubmissionReceipt({ retry: true }).catch(() => {}), 220);
    } else {
      vjaSubmissionReceiptRetry = 0;
    }
    return result;
  } catch {
    // Receipt detection is supplemental. Normal application controls stay usable if
    // an employer page blocks content-script messaging or unloads during navigation.
    return null;
  }
}

async function vjaContinueApplicationSession() {
  clearError();
  const button = $("continueApplicationSession");
  const state = window.vjaApplicationContinuation?.build({ recorded: true, nextJob: vjaContinuationJob });
  if (!state?.enabled || !state.url) {
    return showError("No safe 75+ unapplied vacancy is ready to open right now.");
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Opening next job…";
  }

  try {
    await chrome.tabs.create({ url: state.url, active: true });
    if (button) button.textContent = "Next job opened ✓";
    if ($("submissionReceiptDetail")) {
      $("submissionReceiptDetail").textContent = `${state.detail}. Opened in a new tab; this confirmation page remains available.`;
    }
    if ($("queueLoopStatus")) $("queueLoopStatus").textContent = "Next ranked strong job opened in a new tab.";
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = state.label;
    }
    showError(error?.message || String(error));
  }
}

async function vjaRecordSubmissionReceipt() {
  const button = $("recordSubmissionReceipt");
  if (!latest) return showError("The application context is not available yet. Reopen the extension on this confirmation page.");
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Verifying receipt…";
  }

  try {
    // Never record from a stale popup state. Require the employer confirmation to
    // still be present at the exact moment the candidate asks us to record it.
    const fresh = await sendToPage({ type: "scanSubmissionReceipt" });
    if (fresh?.error) throw new Error(fresh.error);
    if (!fresh?.confirmed) {
      vjaHideSubmissionReceiptUi();
      throw new Error("The employer confirmation is no longer detected, so the application was not recorded automatically.");
    }

    const id = await ensureTracked();
    const api = await getApiBase();
    const response = await fetch(`${api}/api/vacancies/${id}/mark-applied`, { method: "POST" });
    if (!response.ok) throw new Error(`Could not record the application (${response.status}).`);

    if ($("trackJob")) $("trackJob").textContent = "Saved ✓";
    if ($("markApplied")) $("markApplied").textContent = "Applied ✓";
    if ($("fillNote")) $("fillNote").textContent = "Employer submission receipt verified and application recorded in the CRM as Applied.";

    const card = vjaEnsureSubmissionReceiptUi();
    if (card) card.className = "readinessCard readiness-clear";
    if ($("submissionReceiptTitle")) $("submissionReceiptTitle").textContent = "Application recorded ✓";
    if (button) {
      button.disabled = true;
      button.textContent = "Recorded ✓";
    }

    await window.vjaClearApplicationSession?.();
    const next = await window.vjaLoadNextStrongJob?.({ quiet: true });
    const continuation = vjaRenderContinuation(next);

    if ($("submissionReceiptDetail")) {
      $("submissionReceiptDetail").textContent = continuation?.enabled
        ? `The CRM is updated. ${continuation.detail}`
        : "The CRM is updated. No other 75+ unapplied vacancy is ready right now.";
    }
    if ($("queueLoopStatus")) {
      $("queueLoopStatus").textContent = continuation?.enabled
        ? "Application recorded. The next ranked strong job is ready to open."
        : "Application recorded. Ranked queue refreshed; no next 75+ job is ready.";
    }
  } catch (error) {
    showError(error?.message || String(error));
    if (button && document.body.contains(button)) {
      button.disabled = false;
      button.textContent = "Record application";
    }
  }
}

vjaEnsureSubmissionReceiptUi();
setTimeout(() => {
  vjaCheckSubmissionReceipt({ retry: true }).catch(() => {});
}, 180);

window.vjaCheckSubmissionReceipt = vjaCheckSubmissionReceipt;
window.vjaRecordSubmissionReceipt = vjaRecordSubmissionReceipt;
window.vjaContinueApplicationSession = vjaContinueApplicationSession;
