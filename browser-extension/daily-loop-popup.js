let vjaNextQueueJob = null;
let vjaQueueRefreshTimer = null;

function vjaQueueCardNodes() {
  return {
    card: $("dailyLoopCard"),
    title: $("nextJobTitle"),
    company: $("nextJobCompany"),
    score: $("nextJobScore"),
    meta: $("nextJobMeta"),
    status: $("queueLoopStatus"),
    open: $("openNextJob"),
    refresh: $("refreshNextJob")
  };
}

function vjaQueueExclusions(activeUrl = "") {
  return [
    activeUrl,
    latestPage?.url || ""
  ].filter(Boolean);
}

function vjaRenderNextJob(item, message = "") {
  const nodes = vjaQueueCardNodes();
  if (!nodes.card) return;
  vjaNextQueueJob = item || null;
  nodes.card.classList.remove("hidden");

  if (!item) {
    nodes.title.textContent = "No strong unapplied job ready";
    nodes.company.textContent = "The 75+ queue is currently empty after excluding this vacancy.";
    nodes.score.textContent = "—";
    nodes.meta.textContent = "Open the full queue or collect fresh vacancies from the dashboard.";
    nodes.open.disabled = true;
    nodes.open.textContent = "No next job";
    nodes.status.textContent = message || "Queue checked.";
    return;
  }

  nodes.title.textContent = item.title || "Untitled vacancy";
  nodes.company.textContent = item.company || "Unknown company";
  nodes.score.textContent = `${Number(item.matchScore || 0)}/100`;
  const details = [item.country, item.location, item.priority, item.eligibilityStatus]
    .map(x => String(x || "").trim())
    .filter(Boolean);
  nodes.meta.textContent = details.join(" · ") || "Strong unapplied job from the ranked queue.";
  nodes.open.disabled = false;
  nodes.open.textContent = "Open next strong job";
  nodes.status.textContent = message || "Ranked by the backend application queue.";
}

async function vjaLoadNextStrongJob({ quiet = false } = {}) {
  const nodes = vjaQueueCardNodes();
  if (!nodes.card || !window.vjaDailyQueue) return null;
  if (!quiet) {
    nodes.card.classList.remove("hidden");
    nodes.status.textContent = "Checking ranked queue…";
    nodes.refresh.disabled = true;
  }

  try {
    const [api, tab] = await Promise.all([getApiBase(), activeTab()]);
    const response = await fetch(`${api}/api/application-queue?limit=20&minScore=75`);
    if (!response.ok) throw new Error(`Queue returned ${response.status}.`);
    const queue = await response.json();
    const next = window.vjaDailyQueue.selectNext(queue, {
      minScore: 75,
      excludeUrls: vjaQueueExclusions(tab?.url || "")
    });
    vjaRenderNextJob(next, next ? `${Array.isArray(queue) ? queue.length : 0} strong queue item${Array.isArray(queue) && queue.length === 1 ? "" : "s"} checked.` : "No other 75+ unapplied vacancy is ready right now.");
    return next;
  } catch (error) {
    vjaNextQueueJob = null;
    nodes.card.classList.remove("hidden");
    nodes.title.textContent = "Daily queue unavailable";
    nodes.company.textContent = "The backend queue could not be loaded.";
    nodes.score.textContent = "—";
    nodes.meta.textContent = "Your current application workflow is unaffected.";
    nodes.status.textContent = error?.message || String(error);
    nodes.open.disabled = true;
    nodes.open.textContent = "Open next strong job";
    return null;
  } finally {
    nodes.refresh.disabled = false;
  }
}

async function vjaOpenNextStrongJob() {
  const nodes = vjaQueueCardNodes();
  clearError();
  if (!vjaNextQueueJob?.url) {
    await vjaLoadNextStrongJob();
    if (!vjaNextQueueJob?.url) return;
  }

  const safeUrl = window.vjaDailyQueue?.normalizeUrl?.(vjaNextQueueJob.url) || "";
  if (!safeUrl) return showError("The next queue item does not have a valid web URL.");

  nodes.open.disabled = true;
  try {
    await chrome.tabs.create({ url: safeUrl, active: true });
    nodes.open.textContent = "Opened ✓";
    nodes.status.textContent = "Opened in a new tab so this application tab remains available until you are finished.";
    setTimeout(() => {
      if (nodes.open) {
        nodes.open.disabled = false;
        nodes.open.textContent = "Open next strong job";
      }
    }, 1400);
  } catch (error) {
    nodes.open.disabled = false;
    showError(error?.message || String(error));
  }
}

function vjaScheduleQueueRefresh(delay = 350) {
  clearTimeout(vjaQueueRefreshTimer);
  vjaQueueRefreshTimer = setTimeout(() => {
    vjaLoadNextStrongJob({ quiet: true }).catch(() => {});
  }, delay);
}

$("openNextJob")?.addEventListener("click", vjaOpenNextStrongJob);
$("refreshNextJob")?.addEventListener("click", () => vjaLoadNextStrongJob());
$("openFullQueue")?.addEventListener("click", async () => {
  const api = await getApiBase();
  await chrome.tabs.create({ url: `${api}/queue.html`, active: true });
});

for (const id of ["markApplied", "applyHh"]) {
  const node = $(id);
  if (!node) continue;
  new MutationObserver(() => {
    if (/Applied/i.test(node.textContent || "")) vjaScheduleQueueRefresh();
  }).observe(node, { childList: true, characterData: true, subtree: true });
}

const vjaDailyScoreNode = $("score");
if (vjaDailyScoreNode) {
  new MutationObserver(() => vjaScheduleQueueRefresh(150)).observe(vjaDailyScoreNode, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

setTimeout(() => {
  vjaLoadNextStrongJob().catch(() => {});
}, 0);

window.vjaLoadNextStrongJob = vjaLoadNextStrongJob;