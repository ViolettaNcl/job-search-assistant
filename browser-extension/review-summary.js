function vjaRenderReviewSummary() {
  let node = document.getElementById("reviewDetails");
  if (!node) {
    node = document.createElement("p");
    node.id = "reviewDetails";
    node.className = "note";
    const plan = document.querySelector(".formPlan");
    plan?.insertAdjacentElement("afterend", node);
  }
  if (!node) return;

  if (!latestPlan || !latestScan) {
    node.textContent = "Fields that need attention will be listed here after analysis.";
    return;
  }

  const scanned = new Map((latestScan.fields || []).map(x => [x.token, x]));
  const attention = (latestPlan.fields || []).filter(x => x.action === "review" || x.action === "blocked");
  if (!attention.length) {
    node.textContent = "No unresolved ATS fields detected. Still review the final form before submitting.";
    return;
  }

  const shown = attention.slice(0, 4).map(item => {
    const source = scanned.get(item.token);
    const label = String(source?.label || item.memoryKey || "Unidentified field").replace(/\s+/g, " ").trim();
    const shortLabel = label.length > 82 ? `${label.slice(0, 79)}…` : label;
    return `${item.action === "blocked" ? "Blocked" : "Review"}: ${shortLabel}`;
  });
  const extra = attention.length > shown.length ? ` +${attention.length - shown.length} more` : "";
  node.textContent = `Needs attention — ${shown.join(" · ")}${extra}`;
}

const vjaPlanNode = document.querySelector(".formPlan");
if (vjaPlanNode) {
  new MutationObserver(vjaRenderReviewSummary).observe(vjaPlanNode, {
    childList: true,
    characterData: true,
    subtree: true
  });
}
vjaRenderReviewSummary();
