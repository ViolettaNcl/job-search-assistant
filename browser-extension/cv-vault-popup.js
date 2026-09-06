window.vjaLastUploadedCvName = null;

async function vjaGetRecommendedStoredCv() {
  if (!latest?.draft) return { key: null, data: null, language: null };
  const language = latest.draft.language === "ru" ? "ru" : "en";
  const key = language === "ru" ? "cvVaultRu" : "cvVaultEn";
  const stored = await chrome.storage.local.get(key);
  return { key, data: stored[key] || null, language };
}

async function vjaRefreshCvVaultStatus() {
  const status = $("cvVaultStatus");
  if (!status) return;
  if (!latest?.draft) {
    status.textContent = "Analyze a vacancy to choose the CV";
    return;
  }
  const { data, language } = await vjaGetRecommendedStoredCv();
  if (data?.base64) {
    status.textContent = `${language === "ru" ? "Russian" : "English"} CV ready in local vault`;
  } else {
    status.textContent = `${language === "ru" ? "Russian" : "English"} CV not stored yet`;
  }
}

async function vjaUploadRecommendedCv() {
  clearError();
  if (!latest?.draft) return showError("Analyze the vacancy first.");
  const { data, language } = await vjaGetRecommendedStoredCv();
  if (!data?.base64) {
    $("cvVaultStatus").textContent = `${language === "ru" ? "Russian" : "English"} CV is not stored yet.`;
    await chrome.runtime.openOptionsPage();
    return;
  }

  $("uploadCv").disabled = true;
  try {
    const result = await sendToPage({ type: "uploadCv", fileData: data });
    if (!result?.success) throw new Error(result?.error || "The CV could not be inserted into this page.");
    window.vjaLastUploadedCvName = result.filename;
    $("cvVaultStatus").textContent = `Uploaded: ${result.filename}`;
    $("fillNote").textContent = `${result.filename} was inserted into the resume/CV upload field. Check that the site displays the correct attachment before submitting.`;
  } catch (error) {
    window.vjaLastUploadedCvName = null;
    showError(error?.message || String(error));
  } finally {
    $("uploadCv").disabled = false;
  }
}

$("setupCv")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
$("uploadCv")?.addEventListener("click", vjaUploadRecommendedCv);

const cvNameNode = $("cvName");
if (cvNameNode) {
  new MutationObserver(() => {
    window.vjaLastUploadedCvName = null;
    vjaRefreshCvVaultStatus();
  }).observe(cvNameNode, { childList: true, characterData: true, subtree: true });
}
vjaRefreshCvVaultStatus();
