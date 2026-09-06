let vjaSessionSaveTimer = null;
window.vjaCurrentStepHistory = Array.isArray(window.vjaCurrentStepHistory) ? window.vjaCurrentStepHistory : [];
window.vjaCandidateConfirmationState = window.vjaCandidateConfirmationState || null;

async function vjaSessionSlot() {
  if (!chrome.storage?.session || !window.vjaApplicationSession) return null;
  const tab = await activeTab();
  const key = window.vjaApplicationSession.slotKey(tab.id);
  return key ? { tab, key } : null;
}

function vjaShowSessionStatus(message) {
  const banner = $("sessionBanner");
  const status = $("sessionStatus");
  if (!banner || !status) return;
  if (!message) {
    banner.classList.add("hidden");
    status.textContent = "";
    return;
  }
  status.textContent = message;
  banner.classList.remove("hidden");
}

async function vjaSaveApplicationSession() {
  if (!latest || !latestPage?.url || !window.vjaApplicationSession) return;
  const slot = await vjaSessionSlot();
  if (!slot) return;

  const session = window.vjaApplicationSession.create({
    latest,
    latestPage,
    latestTrackedId,
    coverLetter: $("coverLetter")?.value || latest?.draft?.coverLetter || "",
    stepHistory: window.vjaCurrentStepHistory || [],
    candidateConfirmations: window.vjaCandidateConfirmationState
  });
  if (!session) return;
  await chrome.storage.session.set({ [slot.key]: session });
  vjaShowSessionStatus(`Multi-step session active for ${latestPage.company || latestPage.title || "this application"}.`);
}

function vjaScheduleSessionSave(delay = 180) {
  clearTimeout(vjaSessionSaveTimer);
  vjaSessionSaveTimer = setTimeout(() => {
    vjaSaveApplicationSession().catch(() => {});
  }, delay);
}

async function vjaClearApplicationSession({ resetUi = false } = {}) {
  const slot = await vjaSessionSlot();
  if (slot) await chrome.storage.session.remove(slot.key);
  vjaShowSessionStatus("");
  window.vjaCurrentStepHistory = [];
  window.vjaCandidateConfirmationState = null;
  window.vjaReviewNavigatorSelection = null;
  window.vjaRenderApplicationStep?.(null);
  window.vjaUpdateCandidateConfirmationUi?.(null);

  if (resetUi) {
    latest = null;
    latestPage = null;
    latestScan = null;
    latestPlan = null;
    latestTrackedId = null;
    $("result")?.classList.add("hidden");
    if ($("coverLetter")) $("coverLetter").value = "";
    window.vjaLastUploadedCvName = null;
    window.vjaLastAttributedApplicationKey = null;
  }
}

function vjaRenderRestoredAnalysis(session) {
  const analysis = session.latest;
  const page = session.latestPage;
  $("score").textContent = `${analysis.match?.score ?? "—"}/100`;
  $("recommendation").textContent = analysis.recommendation || "—";
  $("headline").textContent = analysis.draft?.recommendedHeadline || page.title || "";
  $("matchWhy").textContent = analysis.match?.why || "";
  $("coverLetter").value = session.coverLetter || analysis.draft?.coverLetter || "";
  chips($("matched"), analysis.match?.matched || []);
  chips($("missing"), analysis.match?.missing || []);
  $("result").classList.remove("hidden");

  const hh = isHhVacancy(page.url);
  const canDirectApply = hh && Number(analysis.match?.score || 0) >= 75;
  $("applyHh").classList.toggle("hidden", !canDirectApply);
  $("externalActions").classList.toggle("hidden", hh);
  $("trackJob").textContent = session.latestTrackedId ? "Saved ✓" : "Save to tracker";
  $("markApplied").textContent = "Mark applied";
}

async function vjaTakeSessionFromOpener(slot) {
  const openerTabId = Number(slot?.tab?.openerTabId);
  if (!Number.isFinite(openerTabId) || openerTabId < 0) return null;

  const sourceKey = window.vjaApplicationSession.slotKey(openerTabId);
  if (!sourceKey || sourceKey === slot.key) return null;

  const stored = await chrome.storage.session.get(sourceKey);
  const session = stored?.[sourceKey];
  if (!session) return null;

  if (!window.vjaApplicationSession.canHandoffFromOpener(
    session,
    slot.tab.url || "",
    openerTabId,
    slot.tab.openerTabId
  )) return null;

  await chrome.storage.session.set({ [slot.key]: session });
  await chrome.storage.session.remove(sourceKey);
  return session;
}

async function vjaRestoreApplicationSession() {
  const slot = await vjaSessionSlot();
  if (!slot) return false;

  let restoredViaHandoff = false;
  const stored = await chrome.storage.session.get(slot.key);
  let session = stored?.[slot.key];

  if (session && !window.vjaApplicationSession.canRestore(session, slot.tab.url || "")) {
    await chrome.storage.session.remove(slot.key);
    session = null;
  }

  if (!session) {
    session = await vjaTakeSessionFromOpener(slot);
    restoredViaHandoff = Boolean(session);
  }

  if (!session) return false;

  latest = session.latest;
  latestPage = session.latestPage;
  latestTrackedId = session.latestTrackedId || null;
  window.vjaCurrentStepHistory = Array.isArray(session.stepHistory) ? session.stepHistory : [];
  window.vjaCandidateConfirmationState = window.vjaApplicationSession.sanitizeCandidateConfirmations(session.candidateConfirmations);
  window.vjaReviewNavigatorSelection = null;
  vjaRenderRestoredAnalysis(session);

  const restoredLabel = restoredViaHandoff
    ? `Handoff restored ${latestPage.company || latestPage.title || "application"} from the opener tab.`
    : `Restored ${latestPage.company || latestPage.title || "application"} in this tab.`;

  try {
    await refreshFieldPlan();
    window.vjaRenderSubmissionReadiness?.();
    window.vjaCaptureApplicationStep?.();
    window.vjaUpdateCandidateConfirmationUi?.(null);
    const readiness = typeof vjaCurrentReadiness === "function" ? vjaCurrentReadiness() : null;
    const review = Number(readiness?.reviewCount ?? latestPlan?.reviewCount ?? 0) + Number(readiness?.failedCount || 0);
    const blocked = Number(readiness?.blockedCount ?? latestPlan?.blockedCount ?? 0);
    const confirmed = Number(readiness?.confirmedCount || 0);
    $("fillNote").textContent = review || blocked
      ? `Restored this application session on the current ATS step. ${review} fields need review and ${blocked} are manual-only.${confirmed ? ` ${confirmed} previously reviewed checkpoint${confirmed === 1 ? " is" : "s are"} still confirmed.` : ""}`
      : `Restored this application session on the current ATS step.${confirmed ? ` ${confirmed} candidate-reviewed checkpoint${confirmed === 1 ? " remains" : "s remain"} confirmed.` : " No unresolved fields were detected by the assistant;"} Review the full form before submitting.`;
    vjaShowSessionStatus(restoredLabel);
    setDot(true);
  } catch (error) {
    $("fillNote").textContent = `Application context restored, but this ATS step could not be scanned yet: ${error?.message || String(error)}`;
    vjaShowSessionStatus(restoredLabel);
  }
  return true;
}

const vjaResultNode = $("result");
if (vjaResultNode) {
  new MutationObserver(() => {
    if (!vjaResultNode.classList.contains("hidden") && latest && latestPage) vjaScheduleSessionSave();
  }).observe(vjaResultNode, { attributes: true, attributeFilter: ["class"] });
}

const vjaScoreNode = $("score");
if (vjaScoreNode) {
  new MutationObserver(() => {
    if (latest && latestPage) vjaScheduleSessionSave();
  }).observe(vjaScoreNode, { childList: true, characterData: true, subtree: true });
}

$("coverLetter")?.addEventListener("input", () => vjaScheduleSessionSave(300));

for (const id of ["trackJob", "markApplied", "applyHh"]) {
  const node = $(id);
  if (!node) continue;
  new MutationObserver(() => {
    const text = node.textContent || "";
    if (/Applied/i.test(text)) vjaClearApplicationSession().catch(() => {});
    else if (/Saved/i.test(text)) vjaScheduleSessionSave(0);
  }).observe(node, { childList: true, characterData: true, subtree: true });
}

$("clearSession")?.addEventListener("click", async () => {
  await vjaClearApplicationSession({ resetUi: true });
  vjaShowSessionStatus("");
});

setTimeout(() => {
  vjaRestoreApplicationSession().catch(() => {});
}, 0);

window.vjaSaveApplicationSession = vjaSaveApplicationSession;
window.vjaClearApplicationSession = vjaClearApplicationSession;
window.vjaRestoreApplicationSession = vjaRestoreApplicationSession;
