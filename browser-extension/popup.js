const $ = (id) => document.getElementById(id);
let latest = null;
let latestPage = null;

async function getApiBase() {
  const stored = await chrome.storage.sync.get({ apiBase: "http://localhost:8080" });
  return String(stored.apiBase || "http://localhost:8080").replace(/\/$/, "");
}

async function saveApiBase() {
  const value = $("apiBase").value.trim().replace(/\/$/, "");
  await chrome.storage.sync.set({ apiBase: value });
  setDot(true);
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
  $("analyze").disabled = busy;
  $("fillForm").disabled = busy;
  $("copyLetter").disabled = busy;
  $("applyHh").disabled = busy;
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

async function analyze() {
  clearError();
  setBusy(true);
  try {
    latestPage = await sendToPage({ type: "extractPage" });
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

    const canDirectApply = isHhVacancy(latestPage?.url) && latest.match.score >= 75;
    $("applyHh").classList.toggle("hidden", !canDirectApply);
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
    const api = await getApiBase();
    const candidateResponse = await fetch(`${api}/api/candidate`);
    if (!candidateResponse.ok) throw new Error("Could not load candidate profile from backend.");
    const candidate = await candidateResponse.json();
    const result = await sendToPage({
      type: "fillApplication",
      candidate,
      draft: { ...latest.draft, coverLetter: $("coverLetter").value }
    });
    $("fillNote").textContent = `Filled ${result?.filled || 0} fields. Review every answer before pressing the site's final Submit/Apply button.`;
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
  $("applyHh").addEventListener("click", applyOnHh);

  try {
    const api = await getApiBase();
    const response = await fetch(`${api}/health`);
    setDot(response.ok);
  } catch {
    setDot(false);
  }
})();
