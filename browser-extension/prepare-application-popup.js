let vjaPreparationRunning = false;
let vjaPreparationPromise = null;

function vjaSetPreparationStatus(message, state = "") {
  const node = $("prepareStatus");
  if (!node) return;
  node.textContent = message || "";
  node.dataset.state = state || "";
}

async function vjaTryPrepareCv(detectedFields) {
  if (!detectedFields) return { state: "not-attempted", filename: null };
  if (typeof vjaGetRecommendedStoredCv !== "function") return { state: "failed", filename: null };

  const { data } = await vjaGetRecommendedStoredCv();
  const uploadCount = Number(latestScan?.uploadFields || 0);
  if (!data?.base64) {
    return { state: uploadCount > 0 ? "missing" : "no-field", filename: null };
  }

  const result = await sendToPage({ type: "uploadCv", fileData: data });
  if (result?.success) {
    window.vjaLastUploadedCvName = result.filename;
    window.vjaLastAttributedApplicationKey = null;
    if ($("cvVaultStatus")) $("cvVaultStatus").textContent = `Uploaded: ${result.filename}`;
    return { state: "uploaded", filename: result.filename };
  }

  const message = String(result?.error || "");
  if (/no unambiguous|upload field/i.test(message)) return { state: "no-field", filename: null };
  return { state: "failed", filename: null, error: message || "CV insertion failed." };
}

async function vjaPrepareCurrentApplicationOnce() {
  const button = $("prepareApplication");
  vjaPreparationRunning = true;
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing…";
  }
  vjaSetPreparationStatus("Reading the vacancy and building a tailored application…", "working");

  try {
    const tab = await activeTab();
    const canReuse = window.vjaPrepareApplication?.canReuseAnalysis?.({
      latest,
      latestPage,
      currentUrl: tab?.url || "",
      sessionApi: window.vjaApplicationSession,
      siteApplyApi: window.vjaSiteApply
    });

    if (!canReuse) {
      // Prevent a failed fresh analysis from accidentally falling back to an older vacancy context.
      latest = null;
      latestPage = null;
      latestScan = null;
      latestPlan = null;
      latestTrackedId = null;
      window.vjaCurrentStepHistory = [];
      await analyze();
    }
    if (!latest || !latestPage?.url) {
      throw new Error("The vacancy could not be analyzed. Check the backend connection and try again.");
    }

    // analyze() manages its own busy state. Lock the manual controls again for the rest of this explicit transaction.
    setBusy(true);
    if (button) button.disabled = true;

    if (!latestScan || !latestPlan) await refreshFieldPlan();
    const detectedFields = Number(latestScan?.fields?.length || 0);
    let fillResult = { filled: 0, failed: 0, review: 0, blocked: 0 };

    if (detectedFields && Number(latestPlan?.autofillCount || 0) > 0) {
      vjaSetPreparationStatus("Tailoring complete. Filling only fields classified as safe…", "working");
      const result = await sendToPage({ type: "applyFieldPlan", resolutions: latestPlan.fields || [] });
      if (result?.error) throw new Error(result.error);
      fillResult = { ...fillResult, ...(result || {}) };
    }

    vjaSetPreparationStatus("Checking the recommended CV and final form state…", "working");
    const cvResult = await vjaTryPrepareCv(detectedFields);

    // Re-read once after all form mutations. HH vacancy pages with no open form need no extra scan.
    if (detectedFields || cvResult.state === "uploaded") await refreshFieldPlan();
    window.vjaRenderSubmissionReadiness?.();
    await window.vjaCaptureApplicationStep?.();
    await window.vjaSaveApplicationSession?.();
    await vjaRefreshCvVaultStatus?.();

    const summary = window.vjaPrepareApplication.summarize({
      analyzed: true,
      detectedFields,
      filled: Number(fillResult?.filled || 0),
      failed: Number(fillResult?.failed || 0),
      review: Number(latestPlan?.reviewCount || 0),
      blocked: Number(latestPlan?.blockedCount || 0),
      cv: cvResult.state,
      hh: isHhVacancy(latestPage.url)
    });

    if (button) button.textContent = window.vjaPrepareApplication.buttonLabel(summary.state);
    vjaSetPreparationStatus(`${summary.message}. Review the employer form before any final Submit/Apply action.`, summary.state);
    $("fillNote").textContent = summary.message || "Application preparation completed.";
    setDot(true);
    return summary;
  } catch (error) {
    const summary = window.vjaPrepareApplication?.summarize?.({ analyzed: false }) || { state: "failed" };
    if (button) button.textContent = window.vjaPrepareApplication?.buttonLabel?.(summary.state) || "Preparation failed";
    vjaSetPreparationStatus(error?.message || String(error), "failed");
    showError(error?.message || String(error));
    return summary;
  } finally {
    setBusy(false);
    vjaPreparationRunning = false;
    if (button) button.disabled = false;
  }
}

function vjaPrepareCurrentApplication() {
  if (vjaPreparationPromise) return vjaPreparationPromise;
  vjaPreparationPromise = vjaPrepareCurrentApplicationOnce().finally(() => {
    vjaPreparationPromise = null;
  });
  return vjaPreparationPromise;
}

window.vjaResetPreparationState = () => {
  vjaPreparationRunning = false;
  vjaPreparationPromise = null;
};

$("prepareApplication")?.addEventListener("click", vjaPrepareCurrentApplication);
window.vjaPrepareCurrentApplication = vjaPrepareCurrentApplication;
