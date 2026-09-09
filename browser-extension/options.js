const $ = id => document.getElementById(id);
const keys = { en: "cvVaultEn", ru: "cvVaultRu" };
const applicationMemoryKey = "applicationMemory";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function hasPdfSignature(buffer) {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

async function serializeFile(file) {
  if (!file) throw new Error("Choose a PDF first.");
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) throw new Error("Only PDF CV files are supported.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Please use a PDF smaller than 15 MB.");

  const buffer = await file.arrayBuffer();
  if (!hasPdfSignature(buffer)) throw new Error("This file does not contain a valid PDF signature.");

  return {
    name: file.name,
    type: "application/pdf",
    size: file.size,
    base64: arrayBufferToBase64(buffer),
    savedAt: new Date().toISOString()
  };
}

async function getApiBase() {
  const stored = await chrome.storage.sync.get({ apiBase: "http://localhost:8080" });
  return String(stored.apiBase || "http://localhost:8080").trim().replace(/\/$/, "");
}

async function getApplicationMemory() {
  const stored = await chrome.storage.local.get({ [applicationMemoryKey]: {} });
  return stored[applicationMemoryKey] || {};
}

async function setApplicationMemory(memory) {
  await chrome.storage.local.set({ [applicationMemoryKey]: memory || {} });
}

function normalizedHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!/^https?:$/.test(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function saveApiBase() {
  const value = normalizedHttpUrl($("apiBase").value);
  if (!value) {
    alert("Enter a valid http:// or https:// backend URL.");
    return;
  }
  await chrome.storage.sync.set({ apiBase: value });
  $("apiBase").value = value;
  await runSystemCheck();
}

async function safeFetchJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    let data = null;
    try { data = await response.json(); } catch { }
    return { reachable: true, ok: response.ok, status: response.status, data };
  } catch (error) {
    return { reachable: false, ok: false, status: 0, data: null, error: error?.message || String(error) };
  }
}

function renderReadiness(result) {
  const summary = $("readinessSummary");
  summary.dataset.state = result.state;
  summary.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = `${result.title} · ${result.passed}/${result.total} checks`;
  const detail = document.createElement("span");
  detail.textContent = result.detail;
  summary.append(title, detail);

  const capabilities = $("capabilities");
  capabilities.replaceChildren();
  const labels = [
    ["externalAts", "External ATS"],
    ["contactAutofill", "Phone"],
    ["cvAutoload", "Both CVs ready"],
    ["dailyQueue", "Daily queue"],
    ["hhDirect", "HH website apply"]
  ];
  for (const [key, label] of labels) {
    const chip = document.createElement("span");
    chip.className = `capability ${result.capabilities[key] ? "on" : ""}`;
    chip.textContent = `${result.capabilities[key] ? "✓" : "○"} ${label}`;
    capabilities.append(chip);
  }

  const list = $("readinessList");
  list.replaceChildren();
  for (const check of result.items) {
    const row = document.createElement("li");
    row.className = "readinessItem";
    const icon = document.createElement("span");
    icon.className = `readinessIcon ${check.ok ? "ok" : check.level === "required" ? "bad" : "warning"}`;
    icon.textContent = check.ok ? "✓" : check.level === "required" ? "!" : "○";
    const body = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = check.label;
    const detail = document.createElement("span");
    detail.textContent = check.detail;
    body.append(label, detail);
    row.append(icon, body);
    list.append(row);
  }
}

async function runSystemCheck() {
  const button = $("runReadiness");
  button.disabled = true;
  button.textContent = "Checking…";
  const summary = $("readinessSummary");
  summary.dataset.state = "neutral";
  summary.innerHTML = "<strong>Checking setup…</strong><span>Verifying backend, profile, phone, local CVs and the strong-job queue.</span>";

  try {
    const api = await getApiBase();
    $("apiBase").value = api;
    const local = await chrome.storage.local.get([keys.en, keys.ru, applicationMemoryKey]);

    const status = await safeFetchJson(`${api}/api/automation/status`);
    const minimumScore = status.data?.autoApplyMinimumScore ?? 75;
    const [health, candidate, queue] = await Promise.all([
      safeFetchJson(`${api}/health/ready`),
      safeFetchJson(`${api}/api/candidate`),
      safeFetchJson(`${api}/api/application-queue?limit=20&minScore=${minimumScore}`)
    ]);

    const contactState = window.vjaLocalContactProfile.resolve({
      candidate: candidate.data || {},
      memory: local[applicationMemoryKey] || {}
    });

    const result = window.vjaSetupReadiness.build({
      backend: { reachable: health.reachable, ready: health.ok },
      candidate: { coreReady: candidate.ok && candidate.data?.readiness?.coreReady === true },
      contacts: { phone: contactState.phoneReady },
      cv: { english: Boolean(local[keys.en]?.base64), russian: Boolean(local[keys.ru]?.base64) },
      queue: { minimumScore, strongCount: queue.ok && Array.isArray(queue.data) ? queue.data.length : 0 }
    });
    renderReadiness(result);
  } catch (error) {
    renderReadiness(window.vjaSetupReadiness.build({ backend: { reachable: false, ready: false } }));
  } finally {
    button.disabled = false;
    button.textContent = "Run system check";
  }
}

async function openBackendPath(path) {
  const api = await getApiBase();
  const url = `${api}${path.startsWith("/") ? path : `/${path}`}`;
  window.open(url, "_blank", "noopener");
}

async function refreshLocalContacts() {
  const memory = await getApplicationMemory();
  $("localPhone").value = String(memory.phone || "");
  if ($("localLinkedIn")) $("localLinkedIn").value = "";
  const state = window.vjaLocalContactProfile.resolve({ candidate: {}, memory });
  const status = $("contactStatus");
  status.className = state.phoneReady ? "status ok" : "status";
  status.textContent = state.phoneReady
    ? "Phone is stored locally for reusable contact autofill."
    : "Add your phone once so the extension can reuse it in application forms.";
}

async function saveLocalContacts() {
  const status = $("contactStatus");
  status.className = "status";
  status.textContent = "Saving…";

  const raw = { phone: $("localPhone").value, linkedin: "" };
  if (!String(raw.phone || "").trim()) {
    status.className = "status warning";
    status.textContent = "Enter a phone number, or use Clear phone.";
    return;
  }

  const validation = window.vjaLocalContactProfile.validate(raw);
  if (!validation.ok) {
    status.className = "status warning";
    status.textContent = validation.errors.phone || "Check the phone number.";
    return;
  }

  const memory = await getApplicationMemory();
  const next = window.vjaLocalContactProfile.applyToMemory(memory, { phone: validation.values.phone, linkedin: "" });
  await setApplicationMemory(next);
  await refreshLocalContacts();
  await runSystemCheck();
}

async function clearLocalContacts() {
  if (!confirm("Clear the locally stored phone? Other remembered application answers will be kept.")) return;
  const memory = await getApplicationMemory();
  const next = window.vjaLocalContactProfile.applyToMemory(memory, { phone: "", linkedin: "" });
  await setApplicationMemory(next);
  await refreshLocalContacts();
  await runSystemCheck();
}

async function save(kind) {
  const fileInput = $(kind === "en" ? "enFile" : "ruFile");
  const status = $(kind === "en" ? "enStatus" : "ruStatus");
  status.className = "status";
  status.textContent = "Saving…";
  try {
    const data = await serializeFile(fileInput.files?.[0]);
    await chrome.storage.local.set({ [keys[kind]]: data });
    status.className = "status ok";
    status.textContent = `Stored locally: ${data.name} · ${formatBytes(data.size)}`;
    fileInput.value = "";
    await runSystemCheck();
  } catch (error) {
    status.className = "status warning";
    status.textContent = error?.message || String(error);
  }
}

async function refresh() {
  const stored = await chrome.storage.local.get([keys.en, keys.ru]);
  for (const [kind, statusId] of [["en", "enStatus"], ["ru", "ruStatus"]]) {
    const item = stored[keys[kind]];
    const status = $(statusId);
    if (item?.base64) {
      status.className = "status ok";
      status.textContent = `Stored locally: ${item.name} · ${formatBytes(item.size)}`;
    } else {
      status.className = "status";
      status.textContent = "No CV stored yet.";
    }
  }
  $("apiBase").value = await getApiBase();
  await refreshLocalContacts();
}

async function clearAll() {
  if (!confirm("Remove both stored CV copies from the extension?")) return;
  await chrome.storage.local.remove([keys.en, keys.ru]);
  await refresh();
  await runSystemCheck();
}

$("saveApi").addEventListener("click", saveApiBase);
$("runReadiness").addEventListener("click", runSystemCheck);
$("openDashboard").addEventListener("click", () => openBackendPath("/"));
$("openQueue").addEventListener("click", () => openBackendPath("/queue.html"));
$("connectHh").addEventListener("click", () => alert("HH.ru website application mode is enabled. Open an HH.ru vacancy and use Apply + send now. No HH OAuth connection is required."));
$("saveContacts").addEventListener("click", saveLocalContacts);
$("clearContacts").addEventListener("click", clearLocalContacts);
$("saveEn").addEventListener("click", () => save("en"));
$("saveRu").addEventListener("click", () => save("ru"));
$("clearAll").addEventListener("click", clearAll);

refresh().then(runSystemCheck).catch(() => {});
