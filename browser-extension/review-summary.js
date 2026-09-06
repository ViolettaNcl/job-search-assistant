function vjaEnsureReadinessNode() {
  let node = document.getElementById("submissionReadiness");
  if (node) return node;

  node = document.createElement("section");
  node.id = "submissionReadiness";
  node.className = "readinessCard readiness-neutral";
  node.setAttribute("aria-live", "polite");

  const plan = document.querySelector(".formPlan");
  plan?.insertAdjacentElement("afterend", node);
  return node;
}

function vjaCurrentReadiness() {
  if (!latestPlan || !latestScan || !window.vjaSubmissionReadiness) return null;
  return window.vjaSubmissionReadiness.build(latestScan, latestPlan, {
    recommendedName: latest?.draft?.recommendedCv || "",
    uploadedName: window.vjaLastUploadedCvName || ""
  });
}

function vjaMakeReadinessRow(item) {
  const row = document.createElement("li");
  const kind = item.action === "blocked" ? "blocked" : item.action === "failed" ? "failed" : "review";
  row.className = `readinessItem readinessItem-${kind}`;

  const top = document.createElement("div");
  top.className = "readinessItemTop";

  const badge = document.createElement("span");
  badge.className = "readinessBadge";
  if (item.action === "blocked") badge.textContent = "Manual only";
  else if (item.action === "failed") badge.textContent = item.currentValuePresent ? "Verify fill" : "Autofill failed";
  else if (item.action === "required") badge.textContent = "Required";
  else badge.textContent = item.currentValuePresent ? "Verify" : "Review";

  const label = document.createElement("strong");
  label.textContent = item.label;

  top.append(badge, label);
  row.append(top);

  const reason = document.createElement("span");
  reason.className = "readinessReason";
  reason.textContent = item.currentValuePresent && item.action !== "required"
    ? `${item.reason} An answer is currently present; verify it is correct.`
    : item.reason;
  row.append(reason);
  return row;
}

function vjaRenderSubmissionReadiness() {
  const node = vjaEnsureReadinessNode();
  if (!node) return;
  node.replaceChildren();

  const result = vjaCurrentReadiness();
  if (!result) {
    node.className = "readinessCard readiness-neutral";
    const text = document.createElement("p");
    text.className = "readinessEmpty";
    text.textContent = "Submission checklist will appear after the vacancy and application form are analyzed.";
    node.append(text);
    return;
  }

  node.className = `readinessCard readiness-${result.state}`;

  const header = document.createElement("div");
  header.className = "readinessHeader";
  const heading = document.createElement("strong");
  heading.textContent = result.title;
  const state = document.createElement("span");
  state.className = "readinessState";
  state.textContent = result.state === "clear" ? "Checklist clear" : result.state === "blocked" ? "Manual action" : "Review needed";
  header.append(heading, state);
  node.append(header);

  const detail = document.createElement("p");
  detail.className = "readinessDetail";
  detail.textContent = result.detail;
  node.append(detail);

  if (result.items.length) {
    const list = document.createElement("ul");
    list.className = "readinessList";
    for (const item of result.items.slice(0, 8)) list.append(vjaMakeReadinessRow(item));
    node.append(list);

    if (result.items.length > 8) {
      const extra = document.createElement("p");
      extra.className = "readinessMore";
      extra.textContent = `+${result.items.length - 8} more field${result.items.length - 8 === 1 ? "" : "s"} require attention.`;
      node.append(extra);
    }
  }

  const cv = document.createElement("div");
  cv.className = `readinessCv readinessCv-${result.cvCheckpoint.status}`;
  const cvTitle = document.createElement("strong");
  cvTitle.textContent = result.cvCheckpoint.label;
  const cvDetail = document.createElement("span");
  cvDetail.textContent = result.cvCheckpoint.detail;
  cv.append(cvTitle, cvDetail);
  node.append(cv);

  const disclaimer = document.createElement("p");
  disclaimer.className = "readinessDisclaimer";
  disclaimer.textContent = "This checklist covers only controls detected by the extension. Always review the employer's full form and attachments before the final Submit/Apply action.";
  node.append(disclaimer);
}

async function vjaRecheckSubmissionReadiness() {
  const button = document.getElementById("recheckForm");
  if (!latest) return showError("Analyze the vacancy first.");
  clearError();
  if (button) {
    button.disabled = true;
    button.textContent = "Rechecking…";
  }
  try {
    await refreshFieldPlan();
    const result = vjaCurrentReadiness();
    vjaRenderSubmissionReadiness();
    const reviewCount = Number(result?.reviewCount || 0);
    const failedCount = Number(result?.failedCount || 0);
    const blockedCount = Number(result?.blockedCount || 0);
    const requiredCount = Number(result?.requiredCount || 0);
    const unresolved = reviewCount + failedCount + blockedCount + requiredCount;
    $("fillNote").textContent = unresolved
      ? `Checklist refreshed. ${requiredCount} required field${requiredCount === 1 ? "" : "s"} blank, ${reviewCount} need review, ${failedCount} autofill attempt${failedCount === 1 ? "" : "s"} need verification, and ${blockedCount} are manual-only.`
      : "Checklist refreshed. No unresolved or detectably blank required fields were found; review the full employer form and attachment before submitting.";
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Recheck submission checklist";
    }
  }
}

window.vjaRenderSubmissionReadiness = vjaRenderSubmissionReadiness;

document.getElementById("recheckForm")?.addEventListener("click", vjaRecheckSubmissionReadiness);

const vjaPlanNode = document.querySelector(".formPlan");
if (vjaPlanNode) {
  new MutationObserver(vjaRenderSubmissionReadiness).observe(vjaPlanNode, {
    childList: true,
    characterData: true,
    subtree: true
  });
}
vjaRenderSubmissionReadiness();
