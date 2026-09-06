let vjaPostFillRefreshBusy = false;

function vjaBuildCurrentReadiness() {
  if (!latestScan || !latestPlan || !window.vjaSubmissionReadiness) return null;
  return window.vjaSubmissionReadiness.build(latestScan, latestPlan, {
    recommendedName: latest?.draft?.recommendedCv || "",
    uploadedName: window.vjaLastUploadedCvName || ""
  });
}

function vjaReconcileCurrentFailures() {
  const result = window.vjaFillReconciliation?.reconcile?.(
    latestScan,
    latestPlan,
    window.vjaFieldVerification
  );
  if (result?.scan) latestScan = result.scan;
  return Number(result?.clearedFailures || 0);
}

function vjaSyncVisibleReadinessCounts(readiness) {
  if (!readiness) return;
  const review = Number(readiness.reviewCount || 0) + Number(readiness.failedCount || 0) + Number(readiness.requiredCount || 0);
  if ($("reviewCount")) $("reviewCount").textContent = String(review);
  if ($("blockedCount")) $("blockedCount").textContent = String(readiness.blockedCount || 0);
}

function vjaExtractFilledCount(message) {
  const match = String(message || "").match(/^Filled\s+(\d+)\s+safe field/i);
  return match ? Number(match[1]) : null;
}

async function vjaRefreshChecklistAfterFormAction(triggerMessage) {
  if (vjaPostFillRefreshBusy || !latest) return;
  vjaPostFillRefreshBusy = true;
  try {
    await refreshFieldPlan();
    const recovered = vjaReconcileCurrentFailures();
    const readiness = vjaBuildCurrentReadiness();
    vjaSyncVisibleReadinessCounts(readiness);
    window.vjaRenderSubmissionReadiness?.();

    const review = Number(readiness?.reviewCount || 0);
    const failed = Number(readiness?.failedCount || 0);
    const blocked = Number(readiness?.blockedCount || 0);
    const required = Number(readiness?.requiredCount || 0);
    const filled = vjaExtractFilledCount(triggerMessage);

    if (filled !== null) {
      const requiredText = required
        ? ` ${required} required field${required === 1 ? " is" : "s are"} still blank;`
        : "";
      $("fillNote").textContent = failed
        ? `Filled and verified ${filled} safe field${filled === 1 ? "" : "s"}.${requiredText} ${failed} autofill attempt${failed === 1 ? "" : "s"} still need manual verification; ${review} other field${review === 1 ? "" : "s"} need review and ${blocked} are manual-only.`
        : `Filled and verified ${filled} safe field${filled === 1 ? "" : "s"}.${requiredText} ${review} field${review === 1 ? "" : "s"} need review and ${blocked} are manual-only. Existing answers were not overwritten.`;
    } else {
      const recoveredText = recovered
        ? ` ${recovered} previous autofill warning${recovered === 1 ? " was" : "s were"} cleared because the current truthful value now matches.`
        : "";
      $("fillNote").textContent = review || failed || blocked || required
        ? `Checklist reconciled. ${required} required field${required === 1 ? "" : "s"} blank, ${review} need review, ${failed} autofill attempt${failed === 1 ? "" : "s"} need verification, and ${blocked} are manual-only.${recoveredText}`
        : `Checklist reconciled. No unresolved or detectably blank required fields were found.${recoveredText} Review the full employer form and attachment before submitting.`;
    }
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    vjaPostFillRefreshBusy = false;
  }
}

const vjaFillNoteNode = $("fillNote");
if (vjaFillNoteNode) {
  new MutationObserver(() => {
    if (vjaPostFillRefreshBusy) return;
    const message = vjaFillNoteNode.textContent || "";
    if (/^Filled\s+\d+\s+safe field/i.test(message) || /^Checklist refreshed\./i.test(message)) {
      vjaRefreshChecklistAfterFormAction(message);
    }
  }).observe(vjaFillNoteNode, { childList: true, characterData: true, subtree: true });
}
