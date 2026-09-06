let vjaSessionSaveTimer = null;

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
    coverLetter: $("coverLetter")?.value || latest?.draft?.coverLetter || ""
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

async function vjaRestoreApplicationSession() {
  const slot = await vjaSessionSlot();
  if (!slot) return false;
  const stored = await chrome.storage.session.get(slot.key);
  const session = stored?.[slot.key];
  if (!session) return false;

  if (!window.vjaApplicationSession.canRestore(session, slot.tab.url || "")) {
    await chrome.storage.session.remove(slot.key);
    return false;
  }

  latest = session.latest;
  latestPage = session.latestPage;
  latestTrackedId = session.latestTrackedId || null;
  vjaRenderRestoredAnalysis(session);

  try {
    await refreshFieldPlan();
    window.vjaRenderSubmissionReadiness?.();
    const review = Number(latestPlan?.reviewCount || 0);
    const blocked = Number(latestPlan?.blockedCount || 0);
    $("fillNote").textContent = review || blocked
      ? `Restored this application session on the current ATS step. ${review} fields need review and ${blocked} are manual-only.`
      : "Restored this application session on the current ATS step. No unresolved fields were detected by the assistant; review the full form before submitting.";
    vjaShowSessionStatus(`Restored ${latestPage.company || latestPage.title || "application"} in this tab.`);
    setDot(true);
  } catch (error) {
    $("fillNote").textContent = `Application context restored, but this ATS step could not be scanned yet: ${error?.message || String(error)}`;
    vjaShowSessionStatus(`Restored ${latestPage.company || latestPage.title || "application"} in this tab.`);
  }
  return true;
}

const vjaResultNode = $("result");
if (vjaResultNode) {
  new MutationObserver(() => {
    if (!vjaResultNode.classList.contains("hidden") && latest && latestPage) vjaScheduleSessionSave();
  }).observe(vjaResultNode, { attributes: true, attributeFilter: ["class"] });
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