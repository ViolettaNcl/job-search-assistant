const $ = (id) => document.getElementById(id);
let latest = null;
let latestPage = null;
let latestScan = null;
let latestPlan = null;
let latestTrackedId = null;

async function getApiBase() {
  const stored = await chrome.storage.sync.get({ apiBase: "http://localhost:8080" });
  return String(stored.apiBase || "http://localhost:8080").replace(/\/$/, "");
}

async function saveApiBase() {
  const value = $("apiBase").value.trim().replace(/\/$/, "");
  await chrome.storage.sync.set({ apiBase: value });
  setDot(true);
  await refreshCandidateProfile();
}

async function getMemory() {
  const stored = await chrome.storage.local.get({ applicationMemory: {} });
  return stored.applicationMemory || {};
}

async function setMemory(memory) {
  await chrome.storage.local.set({ applicationMemory: memory || {} });
}

function setDot(ok) {
  $("statusDot").className = `dot ${ok ? "ok" : "bad"}`;
}

function showError(message) {
  $("error").textContent = message;
  $("error").classList.remove("hidden");
}

function clearError() {
  $("error").classList.add("hidden");
  $("error").textContent = "";
}

function setBusy(busy) {
  for (const id of ["oneClickApply", "analyze", "fillForm", "copyLetter", "applyHh", "findCv", "rememberAnswers", "clearMemory", "trackJob", "markApplied", "nextReviewField", "confirmReviewField"]) {
    if ($(id)) $(id).disabled = busy;
  }
  $("analyze").textContent = busy ? "Working…" : "Analyze this vacancy";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function sendToPage(message) {
  const tab = await activeTab();
  return await chrome.tabs.sendMessage(tab.id, message);
}

function chips(container, values) {
  container.innerHTML = "";
  for (const value of values || []) {
    const el = document.createElement("span");
    el.textContent = value;
    container.appendChild(el);
  }
}

function isHhVacancy(url) {
  try {
    const parsed = new URL(url);
    return /(^|\.)hh\.ru$/i.test(parsed.hostname) && /\/vacancy\/\d+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function prettyAts(value) {
  const labels = { hh: "HH.ru", greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", generic: "Generic form" };
  return labels[value] || value || "Generic form";
}

async function refreshCandidateProfile() {
  const node = $("profileStatus");
  if (!node) return;
  try {
    const api = await getApiBase();
    const response = await fetch(`${api}/api/candidate`);
    if (!response.ok) throw new Error(`Candidate profile returned ${response.status}.`);
    const candidate = await response.json();
    const readiness = candidate.readiness || {};
    if (readiness.coreReady === false) {
      const missing = (readiness.missingCoreFields || []).join(", ") || "required facts";
      node.textContent = `Profile incomplete: verify ${missing} before relying on autofill.`;
      return;
    }
    const optional = readiness.missingOptionalContacts || [];
    node.textContent = optional.length
      ? `Core profile ready. Still unverified: ${optional.join(", ")}. Those fields will require browser-confirmed memory or manual review.`
      : "Verified candidate profile ready, including phone and LinkedIn.";
  } catch (error) {
    node.textContent = `Could not verify candidate profile: ${error?.message || String(error)}`;
  }
}

async function refreshFieldPlan() {
  if (!latest || !latestPage) throw new Error("Analyze the vacancy first.");
  const api = await getApiBase();
  latestScan = await sendToPage({ type: "scanFields" });
  if (latestScan?.error) throw new Error(latestScan.error);
  if (window.vjaCandidateConfirmation?.annotate) {
    latestScan.fields = await window.vjaCandidateConfirmation.annotate(
      latestScan.fields || [],
      window.vjaCandidateConfirmationState
    );
  }

  const memory = await getMemory();
  const response = await fetch(`${api}/api/extension/resolve-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      country: latestPage.country || "",
      language: latest.draft.language,
      coverLetter: $("coverLetter").value || latest.draft.coverLetter,
      shortMessage: latest.draft.shortMessage,
      memory,
      fields: latestScan.fields || []
    })
  });
  if (!response.ok) throw new Error(`Field resolver returned ${response.status}.`);
  latestPlan = await response.json();

  $("atsName").textContent = prettyAts(latestScan.ats || latestPage.ats);
  $("autofillCount").textContent = latestPlan.autofillCount ?? 0;
  $("reviewCount").textContent = latestPlan.reviewCount ?? 0;
  $("blockedCount").textContent = latestPlan.blockedCount ?? 0;
  $("cvName").textContent = latest.draft.recommendedCv || "Choose CV manually";
  return latestPlan;
}

async function analyze() {
  clearError();
  setBusy(true);
  try {
    latestTrackedId = null;
    window.vjaCandidateConfirmationState = null;
    window.vjaReviewNavigatorSelection = null;
    window.vjaUpdateCandidateConfirmationUi?.(null);
    latestPage = await sendToPage({ type: "extractPage" });
    if (latestPage?.error) throw new Error(latestPage.error);
    const api = await getApiBase();
    const response = await fetch(`${api}/api/extension/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(latestPage)
    });
    if (!response.ok) throw new Error(`Backend returned ${response.status}. Is Job Search Assistant running?`);
    latest = await response.json();

    $("score").textContent = `${latest.match.score}/100`;
    $("recommendation").textContent = latest.recommendation;
    $("headline").textContent = latest.draft.recommendedHeadline;
    $("matchWhy").textContent = latest.match.why;
    $("coverLetter").value = latest.draft.coverLetter;
    chips($("matched"), latest.match.matched);
    chips($("missing"), latest.match.missing);
    $("result").classList.remove("hidden");

    await refreshFieldPlan();

    const hh = isHhVacancy(latestPage?.url);
    const canDirectApply = hh && latest.match.score >= 75;
    $("applyHh").classList.toggle("hidden", !canDirectApply);
    $("externalActions").classList.toggle("hidden", hh);
    $("trackJob").textContent = "Save to tracker";
    $("markApplied").textContent = "Mark applied";
    $("fillNote").textContent = latestPlan.reviewCount || latestPlan.blockedCount
      ? `${latestPlan.autofillCount} fields can be filled safely. ${latestPlan.reviewCount} need review and ${latestPlan.blockedCount} are intentionally blocked from automation.`
      : `${latestPlan.autofillCount} fields can be filled safely. Review the final form before submitting.`;
    setDot(true);
  } catch (error) {
    setDot(false);
    showError(error?.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function copyLetter() {
  clearError();
  try {
    await navigator.clipboard.writeText($("coverLetter").value);
    $("copyLetter").textContent = "Copied ✓";
    setTimeout(() => { $("copyLetter").textContent = "Copy letter"; }, 1200);
  } catch (error) {
    showError(error?.message || String(error));
  }
}

async function fillForm() {
  clearError();
  if (!latest) return showError("Analyze the vacancy first.");
  setBusy(true);
  try {
    await refreshFieldPlan();
    const result = await sendToPage({ type: "applyFieldPlan", resolutions: latestPlan.fields || [] });
    if (result?.error) throw new Error(result.error);
    $("fillNote").textContent = `Filled ${result?.filled || 0} safe fields. ${result?.review || 0} need your review; ${result?.blocked || 0} are intentionally left to you. Existing answers were not overwritten.`;
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function rememberAnswers() {
  clearError();
  if (!latest) return showError("Analyze the vacancy first.");
  setBusy(true);
  try {
    await refreshFieldPlan();
    const confirmed = await sendToPage({ type: "collectRememberable", resolutions: latestPlan.fields || [] });
    if (confirmed?.error) throw new Error(confirmed.error);
    const entries = Object.entries(confirmed || {}).filter(([, value]) => String(value || "").trim());
    if (!entries.length) {
      $("memoryNote").textContent = "Nothing new to remember. Fill a reusable field such as phone or LinkedIn first, then click this button.";
      return;
    }
    const memory = await getMemory();
    for (const [key, value] of entries) memory[key] = value;
    await setMemory(memory);
    $("memoryNote").textContent = `Saved ${entries.length} confirmed reusable answer${entries.length === 1 ? "" : "s"} in this browser. Sensitive and job-specific fields are excluded.`;
    await refreshFieldPlan();
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function clearMemory() {
  clearError();
  const confirmed = window.confirm("Clear the reusable application answers saved by this extension on this browser?");
  if (!confirmed) return;
  await setMemory({});
  $("memoryNote").textContent = "Saved application answers cleared. Verified candidate facts still come from the Job Search Assistant profile.";
  if (latest) {
    try { await refreshFieldPlan(); } catch { }
  }
}

async function findCvUpload() {
  clearError();
  if (!latest) return showError("Analyze the vacancy first.");
  try {
    const result = await sendToPage({ type: "highlightCvUpload", filename: latest.draft.recommendedCv });
    if (result?.error) throw new Error(result.error);
    if (!result?.found) {
      $("fillNote").textContent = `No visible file-upload field was found on this page. Recommended CV: ${latest.draft.recommendedCv}.`;
      return;
    }
    $("fillNote").textContent = `Highlighted the CV upload field. Choose ${latest.draft.recommendedCv}. Browsers do not allow extensions to silently select a local file for security reasons.`;
  } catch (error) {
    showError(error?.message || String(error));
  }
}

async function ensureTracked() {
  if (latestTrackedId) return latestTrackedId;
  if (!latestPage?.url) throw new Error("Analyze a vacancy first.");
  const api = await getApiBase();
  const hh = isHhVacancy(latestPage.url);
  const endpoint = hh ? `${api}/api/import/hh` : `${api}/api/import/browser`;
  const payload = hh
    ? { url: latestPage.url }
    : {
        url: latestPage.url,
        title: latestPage.title || null,
        company: latestPage.company || null,
        description: latestPage.description || null,
        country: latestPage.country || null,
        location: latestPage.location || null,
        remoteScope: latestPage.remoteScope || null,
        experience: latestPage.experience || null,
        source: latestPage.source || null,
        remote: Boolean(latestPage.remote)
      };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Could not save this vacancy to the tracker (${response.status}).`);
  const result = await response.json();
  latestTrackedId = result.id;
  return latestTrackedId;
}

async function trackJob() {
  clearError();
  if (!latest) return showError("Analyze the vacancy first.");
  setBusy(true);
  try {
    await ensureTracked();
    $("trackJob").textContent = "Saved ✓";
    $("fillNote").textContent = "Vacancy saved with its description, fit score and eligibility in Job Search Assistant.";
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function markApplied() {
  clearError();
  if (!latest) return showError("Analyze the vacancy first.");
  const confirmed = window.confirm("Mark this external vacancy as applied in Job Search Assistant? Do this after you have submitted the application on the employer site.");
  if (!confirmed) return;
  setBusy(true);
  try {
    const id = await ensureTracked();
    const api = await getApiBase();
    const response = await fetch(`${api}/api/vacancies/${id}/mark-applied`, { method: "POST" });
    if (!response.ok) throw new Error(`Could not mark the vacancy as applied (${response.status}).`);
    $("trackJob").textContent = "Saved ✓";
    $("markApplied").textContent = "Applied ✓";
    $("fillNote").textContent = "Application recorded in the CRM as Applied.";
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function applyOnHh() {
  clearError();
  if (!latestPage?.url || !isHhVacancy(latestPage.url)) return showError("Open an HH.ru vacancy first.");
  if (!latest || latest.match.score < 75) return showError("This vacancy is below the one-click apply threshold. Review it manually.");

  const confirmed = window.confirm(`Submit an application to this HH vacancy now?\n\nFit: ${latest.match.score}/100\n${latestPage.title || "Vacancy"}\n\nThis uses the selected HH resume and a vacancy-specific cover letter.`);
  if (!confirmed) return;

  setBusy(true);
  try {
    const api = await getApiBase();
    const importedResponse = await fetch(`${api}/api/import/hh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: latestPage.url })
    });
    if (!importedResponse.ok) throw new Error("Could not import this HH vacancy into Job Assistant.");
    const imported = await importedResponse.json();
    latestTrackedId = imported.id;

    const applyResponse = await fetch(`${api}/api/vacancies/${imported.id}/apply-tailored`, { method: "POST" });
    const payload = await applyResponse.json().catch(() => ({}));
    if (!applyResponse.ok) {
      const message = payload.errorText || payload.errorCode || `HH application failed (${applyResponse.status}).`;
      throw new Error(message);
    }

    $("applyHh").textContent = "Applied on HH ✓";
    $("applyHh").disabled = true;
    $("fillNote").textContent = "Application submitted through HH's official applicant API and recorded in Job Assistant.";
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    setBusy(false);
  }
}

(async function init() {
  $("apiBase").value = await getApiBase();
  $("saveApi").addEventListener("click", saveApiBase);
  $("analyze").addEventListener("click", analyze);
  $("copyLetter").addEventListener("click", copyLetter);
  $("fillForm").addEventListener("click", fillForm);
  $("rememberAnswers").addEventListener("click", rememberAnswers);
  $("clearMemory").addEventListener("click", clearMemory);
  $("findCv").addEventListener("click", findCvUpload);
  $("trackJob").addEventListener("click", trackJob);
  $("markApplied").addEventListener("click", markApplied);
  $("applyHh").addEventListener("click", applyOnHh);

  try {
    const api = await getApiBase();
    const response = await fetch(`${api}/health`);
    setDot(response.ok);
  } catch {
    setDot(false);
  }
  await refreshCandidateProfile();
})();
