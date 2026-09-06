function vjaBase64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function vjaUploadLabel(input) {
  const parts = [input.name || "", input.id || "", input.getAttribute("aria-label") || "", input.getAttribute("accept") || ""];
  if (input.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label) parts.push(label.innerText || label.textContent || "");
    } catch { }
  }
  const parent = input.closest("label");
  if (parent) parts.push(parent.innerText || parent.textContent || "");
  const container = input.parentElement;
  if (container) parts.push(container.innerText || container.textContent || "");
  return parts.join(" ").toLowerCase();
}

function vjaFindResumeInput() {
  const inputs = [...document.querySelectorAll('input[type="file"]')]
    .filter(input => !input.disabled && input.offsetParent !== null);
  if (!inputs.length) return null;
  const resumeWords = /\b(resume|cv|curriculum|application file)\b|резюме|резюм|currículo|lebenslauf/i;
  return inputs.find(input => resumeWords.test(vjaUploadLabel(input))) || inputs[0];
}

function vjaUploadCv(fileData) {
  if (!fileData?.base64 || !fileData?.name) return { success: false, error: "Stored CV data is missing." };
  const input = vjaFindResumeInput();
  if (!input) return { success: false, error: "No visible file-upload field was found on this page." };

  const bytes = vjaBase64ToBytes(fileData.base64);
  const file = new File([bytes], fileData.name, { type: fileData.type || "application/pdf", lastModified: Date.now() });
  const transfer = new DataTransfer();
  transfer.items.add(file);

  input.files = transfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.style.outline = "3px solid #16a34a";
  input.style.outlineOffset = "3px";
  input.scrollIntoView({ behavior: "smooth", block: "center" });

  return { success: true, filename: file.name, size: file.size, fieldLabel: vjaUploadLabel(input).slice(0, 180) };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "uploadCv") return false;
  try {
    sendResponse(vjaUploadCv(message.fileData));
  } catch (error) {
    sendResponse({ success: false, error: error?.message || String(error) });
  }
  return true;
});
