function vjaEnsureSiteApplyButton() {
  let button = $("siteApplyNow");
  if (button) return button;
  const anchor = $("externalActions") || $("applyHh") || $("fillNote");
  if (!anchor) return null;
  button = document.createElement("button");
  button.id = "siteApplyNow";
  button.className = "primary full";
  button.textContent = "Apply now — site + CV + letter";
  anchor.insertAdjacentElement("beforebegin", button);
  return button;
}

async function vjaRecordConfirmedSiteApply(resultEnvelope, cvName = "") {
  const trackedId = resultEnvelope?.trackedId || latestTrackedId || "";
  if (!trackedId) return false;
  try {
    const api = await getApiBase();
    const response = await fetch(`${api}/api/vacancies/${trackedId}/mark-applied`, { method: "POST" });
    if (!response.ok) return false;
    if (cvName) {
      await fetch(`${api}/api/vacancies/${trackedId}/cv-attribution?resumeLabel=${encodeURIComponent(cvName)}`, { method: "POST" }).catch(() => null);
    }
    return true;
  } catch {
    return false;
  }
}

function vjaSiteApplyReason(result) {
  const reason = String(result?.reason || "");
  if (reason === "required-fields") {
    const names = (result?.unresolved || []).filter(Boolean);
    return names.length ? `Required fields still need you: ${names.join(", ")}.` : "Required fields still need your review before submission.";
  }
  if (reason === "cv-not-uploaded") return "The site exposes a CV upload field, but the CV could not be attached automatically.";
  if (reason === "final-action-not-found") return "The application was filled, but no safe final Submit/Откликнуться action was found.";
  if (reason === "final-action-ambiguous") return "Several possible final submission buttons were found. The assistant stopped instead of clicking the wrong one.";
  return reason || "The site needs a manual review before it can be submitted safely.";
}

async function vjaHandleSiteApplyResult(envelope, cvName = "") {
  const result = envelope?.result || envelope || {};
  const note = $("fillNote");
  if (result.submitted && result.status === "confirmed") {
    const recorded = await vjaRecordConfirmedSiteApply(envelope, cvName || result?.cvResult?.filename || "");
    if (note) note.textContent = recorded
      ? "Application submitted on the employer site with the prepared data and recorded as Applied."
      : "Application submitted on the employer site. The local tracker could not be updated automatically.";
    const button = $("siteApplyNow");
    if (button) {
      button.textContent = "Applied on site ✓";
      button.disabled = true;
    }
    return;
  }
  if (result.status === "clicked-unverified" || result.status === "verification-needed") {
    if (note) note.textContent = "The employer's final action was clicked, but the site did not expose a reliable confirmation signal. Check the page once before recording it as Applied.";
    return;
  }
  if (result.status === "needs-review") {
    if (note) note.textContent = vjaSiteApplyReason(result);
    return;
  }
  if (result.error) showError(result.error);
}

async function vjaApplyNowOnSite() {
  clearError();
  if (!latest || !latestPage?.url) return showError("Analyze the vacancy first.");

  if (Number(latest.match?.score || 0) < 65) {
    const proceed = window.confirm(`This vacancy is currently scored ${latest.match?.score || 0}/100 (${latest.recommendation || "low fit"}).\n\nSubmit anyway?`);
    if (!proceed) return;
  }

  const language = latest.draft?.language === "ru" ? "ru" : "en";
  const cvKey = language === "ru" ? "cvVaultRu" : "cvVaultEn";
  const stored = await chrome.storage.local.get(cvKey);
  const fileData = stored[cvKey];
  if (!fileData?.base64) {
    showError(`${language === "ru" ? "Russian" : "English"} CV is not stored in the CV Vault yet.`);
    await chrome.runtime.openOptionsPage();
    return;
  }

  const confirmed = window.confirm(`Apply on this employer site now?\n\n${latestPage.title || "Vacancy"}\nFit: ${latest.match?.score || 0}/100\n\nThe assistant will click Apply/Откликнуться, attach ${fileData.name}, fill the tailored cover letter when the site provides a field, and click the final submission action only when required fields are clear.`);
  if (!confirmed) return;

  const button = vjaEnsureSiteApplyButton();
  if (button) {
    button.disabled = true;
    button.textContent = "Applying…";
  }

  let trackedId = latestTrackedId || "";
  try { trackedId = await ensureTracked(); } catch { }

  let sourceHost = "";
  try { sourceHost = new URL(latestPage.url).hostname; } catch { }
  const pending = {
    id: `site-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    trackedId,
    sourceUrl: latestPage.url,
    sourceHost,
    coverLetter: $("coverLetter")?.value || latest.draft?.coverLetter || "",
    cvKey,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
    finalClicked: false
  };
  await chrome.storage.local.set({ vjaPendingSiteApply: pending });

  try {
    const result = await sendToPage({ type: "siteApplyNow", plan: { ...pending, fileData } });
    const envelope = { id: pending.id, trackedId, sourceUrl: pending.sourceUrl, result };
    await vjaHandleSiteApplyResult(envelope, fileData.name);
  } catch (error) {
    const note = $("fillNote");
    if (note) note.textContent = "Application flow started. If the employer site navigated to a new step, the extension will resume there automatically.";
  } finally {
    if (button && !button.textContent.includes("Applied")) {
      button.disabled = false;
      button.textContent = "Apply now — site + CV + letter";
    }
  }
}

async function vjaRestoreSiteApplyResult() {
  const stored = await chrome.storage.local.get("vjaSiteApplyResult");
  const envelope = stored.vjaSiteApplyResult;
  if (!envelope || Date.now() - Number(envelope.createdAt || 0) > 15 * 60 * 1000) return;
  const language = latest?.draft?.language === "ru" ? "ru" : "en";
  const cvKey = language === "ru" ? "cvVaultRu" : "cvVaultEn";
  const cvStored = await chrome.storage.local.get(cvKey);
  await vjaHandleSiteApplyResult(envelope, cvStored[cvKey]?.name || "");
}

const vjaSiteApplyButton = vjaEnsureSiteApplyButton();
vjaSiteApplyButton?.addEventListener("click", vjaApplyNowOnSite);

const vjaMarkAppliedButton = $("markApplied");
if (vjaMarkAppliedButton && !vjaMarkAppliedButton.textContent.includes("Record")) {
  vjaMarkAppliedButton.textContent = "Record applied";
  vjaMarkAppliedButton.title = "Use only when you already submitted manually and only need to record it in the tracker.";
}

setTimeout(() => vjaRestoreSiteApplyResult().catch(() => {}), 500);
