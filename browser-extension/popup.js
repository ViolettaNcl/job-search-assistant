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

(async function init() {
  $("apiBase").value = await getApiBase();
  $("saveApi").addEventListener("click", saveApiBase);
  $("analyze").addEventListener("click", analyze);
  $("copyLetter").addEventListener("click", copyLetter);
  $("fillForm").addEventListener("click", fillForm);

  try {
    const api = await getApiBase();
    const response = await fetch(`${api}/health`);
    setDot(response.ok);
  } catch {
    setDot(false);
  }
})();
