const $ = id => document.getElementById(id);
const keys = { en: "cvVaultEn", ru: "cvVaultRu" };

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
}

async function clearAll() {
  if (!confirm("Remove both stored CV copies from the extension?")) return;
  await chrome.storage.local.remove([keys.en, keys.ru]);
  await refresh();
}

$("saveEn").addEventListener("click", () => save("en"));
$("saveRu").addEventListener("click", () => save("ru"));
$("clearAll").addEventListener("click", clearAll);
refresh();
