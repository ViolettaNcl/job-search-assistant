function vjaEnsureSiteApplyButton() {
  let button = $("siteApplyNow");
  if (button) return button;
  const anchor = $("externalActions") || $("applyHh") || $("fillNote");
  if (!anchor) return null;
  button = document.createElement("button");
  button.id = "siteApplyNow";
  button.className = $("oneClickApply") ? "hidden" : "primary full";
  button.textContent = "Отправить сейчас";
  button.title = "Clicking this button is the confirmation to open the employer response, fill the tailored letter, select/attach the resume and submit when the form is clear.";
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
  if (reason === "cover-letter-not-persisted") return "The tailored cover letter did not stay in the employer form, so the assistant stopped before Send.";
  if (reason === "hh-resume-choice-required") return "HH.ru shows several resumes and none is selected. Select the resume once, then press Apply + send now again.";
  if (reason === "hh-resume-selection-not-persisted") return "HH.ru did not keep the selected resume. Select the resume once, then press Apply + send now again.";
  if (reason === "hh-cover-letter-action-not-found") return "HH.ru submitted the response, but its Add cover letter action was not available. Open the response and attach the prepared letter manually.";
  if (reason === "hh-cover-letter-action-ambiguous") return "HH.ru submitted the response, but showed several possible cover-letter actions. The assistant stopped instead of clicking the wrong one.";
  if (reason === "application-ui-not-found") return "The Apply action did not open a recognizable application form. The assistant stopped before any final click.";
  if (reason === "final-action-not-found") return "The application was filled, but no safe final Send/Submit/Откликнуться action was found.";
  if (reason === "final-action-ambiguous") return "Several possible final submission buttons were found. The assistant stopped instead of clicking the wrong one.";
  return reason || "The site needs a manual review before it can be submitted safely.";
}

async function vjaHandleSiteApplyResult(envelope, cvName = "") {
  const result = envelope?.result || envelope || {};
  const note = $("fillNote");
  if (result.submitted && result.status === "confirmed") {
    const resumeLabel = result.resumeLabel || cvName || result?.cvResult?.filename || "";
    const recorded = await vjaRecordConfirmedSiteApply(envelope, resumeLabel);
    if (note) note.textContent = recorded
      ? "Application submitted with the tailored letter and selected resume/CV, then recorded as Applied."
      : "Application submitted on the employer site. The local tracker could not be updated automatically.";
    const button = $("siteApplyNow");
    if (button) {
      button.textContent = "Applied ✓";
      button.disabled = true;
    }
    return;
  }
  if (result.status === "clicked-unverified" || result.status === "verification-needed") {
    if (note) note.textContent = "The employer's final Send action was clicked, but the site did not expose a reliable confirmation signal. Check the page once before recording it as Applied.";
    return;
  }
  if (result.submitted && result.status === "submitted-needs-letter") {
    const recorded = await vjaRecordConfirmedSiteApply(envelope, result.resumeLabel || cvName || "");
    if (note) note.textContent = `${vjaSiteApplyReason(result)}${recorded ? " The application itself was recorded as Applied." : ""}`;
    const button = $("siteApplyNow");
    if (button) button.textContent = "Applied — add letter";
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

  const fit = Number(latest.match?.score || 0);
  if (fit < 65) {
    const proceed = window.confirm(`This vacancy is currently scored ${fit}/100 (${latest.recommendation || "low fit"}).\n\nSubmit anyway?`);
    if (!proceed) return;
  }

  const hhWebsite = Boolean(window.vjaSiteApply?.isHhUrl?.(latestPage.url)) || isHhVacancy(latestPage.url);
  const previous = await chrome.storage.local.get("vjaSiteApplyResult");
  const previousEnvelope = previous?.vjaSiteApplyResult;
  if (previousEnvelope?.result?.submitted && window.vjaSiteApply?.sameJobUrl?.(previousEnvelope.sourceUrl, latestPage.url)) {
    const note = $("fillNote");
    if (note) note.textContent = "Этот отклик уже был подтверждён и сохранён. Повторная отправка заблокирована.";
    return;
  }
  const language = latest.draft?.language === "ru" ? "ru" : "en";
  const cvKey = hhWebsite ? "" : (language === "ru" ? "cvVaultRu" : "cvVaultEn");
  let fileData = null;

  if (!hhWebsite) {
    const stored = await chrome.storage.local.get(cvKey);
    fileData = stored[cvKey];
    if (!fileData?.base64) {
      showError(`${language === "ru" ? "Russian" : "English"} CV is not stored in the CV Vault yet.`);
      await chrome.runtime.openOptionsPage();
      return;
    }
  }

  const button = vjaEnsureSiteApplyButton();
  if (button) {
    button.disabled = true;
    button.textContent = hhWebsite ? "Sending on HH…" : "Applying…";
  }

  const note = $("fillNote");
  if (note) note.textContent = hhWebsite
    ? "Opening HH response, filling the tailored cover letter, using the selected HH account resume and pressing Send…"
    : `Opening the application, attaching ${fileData?.name || "the recommended CV"}, filling the tailored cover letter and submitting…`;

  let trackedId = latestTrackedId || "";
  try { trackedId = await ensureTracked(); } catch { }

  let sourceHost = "";
  try { sourceHost = new URL(latestPage.url).hostname; } catch { }
  const pending = {
    id: `site-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    trackedId,
    sourceUrl: latestPage.url,
    sourceHost,
    jobTitle: latestPage.title || latest?.draft?.title || '',
    coverLetter: $("coverLetter")?.value || latest.draft?.coverLetter || "",
    cvKey,
    resumeHint: latest.draft?.recommendedCv || "",
    siteKind: hhWebsite ? "hh" : "generic",
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
    finalClicked: false
  };
  await chrome.storage.local.set({ vjaPendingSiteApply: pending });

  try {
    const plan = fileData ? { ...pending, fileData } : pending;
    const result = await sendToPage({ type: "siteApplyNow", plan });
    const envelope = { id: pending.id, trackedId, sourceUrl: pending.sourceUrl, result };
    await vjaHandleSiteApplyResult(envelope, result?.resumeLabel || fileData?.name || "");
  } catch (error) {
    if (note) note.textContent = "Application flow started. If the employer site navigated to a new step, the extension will resume there automatically.";
  } finally {
    if (button && !button.textContent.includes("Applied")) {
      button.disabled = false;
      button.textContent = "Отправить сейчас";
    }
  }
}

let vjaOneClickRunning = false;
async function vjaOneClickApply() {
  if (vjaOneClickRunning) return;
  const button = $("oneClickApply");
  const status = $("oneClickStatus");
  vjaOneClickRunning = true;
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Готовлю и отправляю…";
  }
  if (status) status.textContent = "Анализирую вакансию и создаю персональное сопроводительное письмо…";

  try {
    const summary = await window.vjaPrepareCurrentApplication?.();
    if (!latest || !latestPage?.url || summary?.state === "failed") {
      throw new Error("Не удалось подготовить отклик. Проверьте соединение с запущенной программой.");
    }
    if (status) status.textContent = "Открываю форму, выбираю резюме/CV, вставляю письмо и проверяю финальную отправку…";
    await vjaApplyNowOnSite();
    const submitted = $("siteApplyNow")?.disabled && $("siteApplyNow")?.textContent?.includes("Applied");
    if (submitted) {
      button.textContent = "Отклик отправлен ✓";
      status.textContent = "Работодатель получил отклик, резюме/CV и сопроводительное письмо; запись сохранена на дашборде.";
      return;
    }
    button.textContent = "Продолжить отклик";
    status.textContent = $("fillNote")?.textContent || "Расширение остановилось на обязательном шаге, который нужно проверить.";
  } catch (error) {
    showError(error?.message || String(error));
    if (button) button.textContent = "Повторить отправку";
    if (status) status.textContent = "Отклик не отправлен. Исправьте указанную проблему и повторите.";
  } finally {
    vjaOneClickRunning = false;
    if (button && !button.textContent.includes("отправлен")) button.disabled = false;
  }
}

async function vjaRestoreSiteApplyResult() {
  const stored = await chrome.storage.local.get("vjaSiteApplyResult");
  const envelope = stored.vjaSiteApplyResult;
  if (!envelope || Date.now() - Number(envelope.createdAt || 0) > 15 * 60 * 1000) return;
  await vjaHandleSiteApplyResult(envelope, envelope?.result?.resumeLabel || envelope?.result?.cvResult?.filename || "");
}

const vjaSiteApplyButton = vjaEnsureSiteApplyButton();
vjaSiteApplyButton?.addEventListener("click", vjaApplyNowOnSite);
$("oneClickApply")?.addEventListener("click", vjaOneClickApply);

const vjaMarkAppliedButton = $("markApplied");
if (vjaMarkAppliedButton && !vjaMarkAppliedButton.textContent.includes("Record")) {
  vjaMarkAppliedButton.textContent = "Record applied";
  vjaMarkAppliedButton.title = "Use only when you already submitted manually and only need to record it in the tracker.";
}

setTimeout(() => vjaRestoreSiteApplyResult().catch(() => {}), 500);

function vjaPreferWebsiteApplyForHh() {
  const button = $("applyHh");
  if (!button) return;
  button.classList.add("hidden");
  button.title = "Normal HH.ru applications use Apply + send now. Official HH API OAuth is not required.";
}

vjaPreferWebsiteApplyForHh();
const vjaHhApiButton = $("applyHh");
if (vjaHhApiButton) {
  new MutationObserver(vjaPreferWebsiteApplyForHh).observe(vjaHhApiButton, { attributes: true, attributeFilter: ["class"] });
}
