let vjaStepCaptureTimer = null;

function vjaRenderApplicationStep(summary) {
  const card = $("stepCard");
  const title = $("stepTitle");
  const meta = $("stepMeta");
  if (!card || !title || !meta) return;

  if (!summary) {
    card.classList.add("hidden");
    title.textContent = "";
    meta.textContent = "";
    return;
  }

  card.classList.remove("hidden");
  title.textContent = `Application stage ${summary.stage}`;

  const parts = [`${summary.fieldCount} detected field${summary.fieldCount === 1 ? "" : "s"}`];
  if (summary.autofillCount) parts.push(`${summary.autofillCount} safe`);
  if (summary.reviewCount) parts.push(`${summary.reviewCount} review`);
  if (summary.failedCount) parts.push(`${summary.failedCount} verify-fill`);
  if (summary.blockedCount) parts.push(`${summary.blockedCount} manual-only`);
  if (summary.isNew && summary.stage > 1) {
    const changes = [];
    if (summary.added) changes.push(`+${summary.added} new`);
    if (summary.removed) changes.push(`-${summary.removed} previous`);
    if (changes.length) parts.push(changes.join(" / "));
  }
  meta.textContent = parts.join(" · ");
}

async function vjaCaptureApplicationStep() {
  if (!latest || !latestPage?.url || !latestScan || !latestPlan || !window.vjaApplicationStepIntelligence) return null;
  const tab = await activeTab();
  const snapshot = window.vjaApplicationStepIntelligence.buildSnapshot(latestScan, latestPlan, {
    jobUrl: latestPage.url,
    currentUrl: tab?.url || latestPage.url,
    ats: latestScan.ats || latestPage.ats,
    at: Date.now()
  });
  const result = window.vjaApplicationStepIntelligence.advance(window.vjaCurrentStepHistory || [], snapshot);
  window.vjaCurrentStepHistory = result.history;
  const summary = window.vjaApplicationStepIntelligence.publicSummary(result);
  vjaRenderApplicationStep(summary);
  window.vjaSaveApplicationSession?.().catch(() => {});
  return summary;
}

function vjaScheduleStepCapture(delay = 220) {
  clearTimeout(vjaStepCaptureTimer);
  vjaStepCaptureTimer = setTimeout(() => {
    vjaCaptureApplicationStep().catch(() => {});
  }, delay);
}

for (const id of ["autofillCount", "reviewCount", "blockedCount", "atsName"]) {
  const node = $(id);
  if (!node) continue;
  new MutationObserver(() => vjaScheduleStepCapture()).observe(node, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

const stepResult = $("result");
if (stepResult) {
  new MutationObserver(() => {
    if (!stepResult.classList.contains("hidden")) vjaScheduleStepCapture();
  }).observe(stepResult, { attributes: true, attributeFilter: ["class"] });
}

window.vjaCaptureApplicationStep = vjaCaptureApplicationStep;
window.vjaRenderApplicationStep = vjaRenderApplicationStep;