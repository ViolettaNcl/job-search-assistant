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

function vjaMakeReadinessRow(item) {
  const row = document.createElement("li");
  row.className = `readinessItem ${item.action === "blocked" ? "readinessItem-blocked" : "readinessItem-review"}`;

  const top = document.createElement("div");
  top.className = "readinessItemTop";

  const badge = document.createElement("span");
  badge.className = "readinessBadge";
  badge.textContent = item.action === "blocked" ? "Manual only" : "Review";

  const label = document.createElement("strong");
  label.textContent = item.label;

  top.append(badge, label);
  row.append(top);

  const reason = document.createElement("span");
  reason.className = "readinessReason";
  reason.textContent = item.currentValuePresent
    ? `${item.reason} An answer is currently present; verify it is correct.`
    : item.reason;
  row.append(reason);
  return row;
}

function vjaRenderSubmissionReadiness() {
  const node = vjaEnsureReadinessNode();
  if (!node) return;
  node.replaceChildren();

  if (!latestPlan || !latestScan || !window.vjaSubmissionReadiness) {
    node.className = "readinessCard readiness-neutral";
    const text = document.createElement("p");
    text.className = "readinessEmpty";
    text.textContent = "Submission checklist will appear after the vacancy and application form are analyzed.";
    node.append(text);
    return;
  }

  const result = window.vjaSubmissionReadiness.build(latestScan, latestPlan, {
    recommendedName: latest?.draft?.recommendedCv || "",
    uploadedName: window.vjaLastUploadedCvName || ""
  });

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
  disclaimer.textContent = "This checklist covers only fields detected by the extension. Always review the employer's full form and attachments before the final Submit/Apply action.";
  node.append(disclaimer);
}

window.vjaRenderSubmissionReadiness = vjaRenderSubmissionReadiness;

const vjaPlanNode = document.querySelector(".formPlan");
if (vjaPlanNode) {
  new MutationObserver(vjaRenderSubmissionReadiness).observe(vjaPlanNode, {
    childList: true,
    characterData: true,
    subtree: true
  });
}
vjaRenderSubmissionReadiness();
