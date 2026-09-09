importScripts("browser-autopilot.js", "hh-discovery-navigation.js", "hh-discovery-background.js");

async function restrictLocalStorageAccess() {
  try {
    if (chrome.storage?.local?.setAccessLevel) {
      await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    }
  } catch (error) {
    console.warn("Violetta Apply Assistant: could not restrict local storage access", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void restrictLocalStorageAccess();
});

chrome.runtime.onStartup.addListener(() => {
  void restrictLocalStorageAccess();
});

void restrictLocalStorageAccess();

const siteApplyStorageKeys = new Set(["vjaPendingSiteApply", "vjaSiteApplyResult"]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "vjaSiteApplyStorage" || !sender.tab?.id) return false;
  const key = String(message.key || "");
  if (!siteApplyStorageKeys.has(key)) {
    sendResponse({ ok: false, error: "storage-key-not-allowed" });
    return false;
  }

  (async () => {
    if (message.operation === "get") {
      const value = await chrome.storage.local.get(key);
      return { ok: true, value: value[key] };
    }
    if (message.operation === "set") {
      await chrome.storage.local.set({ [key]: message.value });
      return { ok: true };
    }
    if (message.operation === "remove") {
      await chrome.storage.local.remove(key);
      return { ok: true };
    }
    return { ok: false, error: "storage-operation-not-allowed" };
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

const browserAutopilotAlarm = "vja-browser-autopilot";
let browserAutopilotRunning = false;

function browserAutopilotWait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function browserAutopilotWithTimeout(promise, timeoutMs, message) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

async function browserAutopilotApiBase() {
  const stored = await chrome.storage.sync.get({ apiBase: "http://localhost:8080" });
  return String(stored.apiBase || "http://localhost:8080").trim().replace(/\/$/, "");
}

async function browserAutopilotJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...(options || {}), signal: controller.signal });
    const text = await response.text();
    let data;try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(typeof data === "string" ? data : data?.message || `Request failed (${response.status}).`);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The local Job Search Assistant did not answer within 15 seconds.");
    throw error;
  } finally { clearTimeout(timer); }
}

async function browserAutopilotHeartbeat(api, running, message, vacancyTitle = "") {
  return browserAutopilotJson(`${api}/api/browser-autopilot/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ running, message, vacancyTitle })
  });
}

async function browserAutopilotWaitForTab(tabId, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.status === "complete") return tab;
    await browserAutopilotWait(400);
  }
  throw new Error("HH vacancy page did not finish loading.");
}

async function browserAutopilotStoredResult(planId) {
  const stored = await chrome.storage.local.get("vjaSiteApplyResult");
  const envelope = stored.vjaSiteApplyResult;
  return envelope?.id === planId ? envelope.result : null;
}

async function browserAutopilotSendPlan(tabId, plan) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const storedResult = await browserAutopilotStoredResult(plan.id);
    if (storedResult) return storedResult;
    try {
      const result = await browserAutopilotWithTimeout(
        chrome.tabs.sendMessage(tabId, { type: "siteApplyNow", plan }),
        60000,
        "The HH application page did not answer within 60 seconds."
      );
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await browserAutopilotWait(1800);
  }

  for (let attempt = 0; attempt < 15; attempt++) {
    const result = await browserAutopilotStoredResult(plan.id);
    if (result) return result;
    await browserAutopilotWait(1000);
  }
  throw lastError || new Error("The HH application page did not respond to the extension.");
}

async function browserAutopilotComplete(api, plan, result, tabId) {
  await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(plan.trackedId)}/browser-auto-applied`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coverLetter: plan.coverLetter, resumeLabel: result.resumeLabel || plan.resumeHint, vacancyTitle: plan.jobTitle })
  });
  await chrome.storage.local.remove(["vjaBrowserAutopilotActivePlan", "vjaBrowserAutopilotTabId", "vjaPendingSiteApply", "vjaSiteApplyResult"]);
  try { await chrome.tabs.remove(tabId); } catch { }
}

async function browserAutopilotDefer(api, plan, reason) {
  const deferredUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(plan.trackedId)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Saved", note: `QueueDeferredUntil=${deferredUntil}` })
  }).catch(() => {});
  return `Нужна ручная проверка вакансии «${plan.jobTitle}»: ${reason || "HH изменил форму"}. Вакансия отложена на 4 часа, чтобы не открывать дубли.`;
}

async function browserAutopilotProcess(api, plan, tabId) {
  await browserAutopilotHeartbeat(api, true, `Открываю «${plan.jobTitle}» и готовлю отклик с письмом.`, plan.jobTitle);
  await browserAutopilotWaitForTab(tabId);
  const pendingState = await chrome.storage.local.get("vjaPendingSiteApply");
  const continuationPlan = pendingState.vjaPendingSiteApply?.id === plan.id
    ? pendingState.vjaPendingSiteApply
    : plan;
  const result = await browserAutopilotSendPlan(tabId, continuationPlan);
  if (result?.submitted && result?.status === "confirmed" && result?.coverLetterFilled) {
    await browserAutopilotComplete(api, plan, result, tabId);
    return { completed: true, message: `Отклик и письмо отправлены: ${plan.jobTitle}.` };
  }

  if (result?.status === "submitted-needs-letter" || result?.status === "clicked-unverified" || result?.status === "verification-needed") {
    await chrome.storage.local.remove("vjaSiteApplyResult");
    return { completed: false, retry: true, message: `Продолжаю проверять письмо для «${plan.jobTitle}».` };
  }

  const message = await browserAutopilotDefer(api, plan, result?.reason || result?.error);
  await chrome.storage.local.remove(["vjaBrowserAutopilotActivePlan", "vjaBrowserAutopilotTabId", "vjaPendingSiteApply", "vjaSiteApplyResult"]);
  try { await chrome.tabs.update(tabId, { active: true }); } catch { }
  return { completed: false, retry: false, message };
}

async function runBrowserAutopilot() {
  if (browserAutopilotRunning) return;
  browserAutopilotRunning = true;
  let api = "";
  try {
    api = await browserAutopilotApiBase();
    await browserAutopilotHeartbeat(api, false, "Расширение Chrome подключено и готово к браузерному автопилоту.");
    let status = await browserAutopilotJson(`${api}/api/automation/status`);
    if (!self.vjaBrowserAutopilot?.shouldRun?.(status)) return;

    const active = await chrome.storage.local.get(["vjaBrowserAutopilotActivePlan", "vjaBrowserAutopilotTabId"]);
    if (active.vjaBrowserAutopilotActivePlan && active.vjaBrowserAutopilotTabId) {
      try {
        const continuation = await browserAutopilotProcess(api, active.vjaBrowserAutopilotActivePlan, active.vjaBrowserAutopilotTabId);
        await browserAutopilotHeartbeat(api, Boolean(continuation.retry), continuation.message, active.vjaBrowserAutopilotActivePlan.jobTitle);
        return;
      } catch (error) {
        const message = await browserAutopilotDefer(api, active.vjaBrowserAutopilotActivePlan, error?.message || String(error));
        await chrome.storage.local.remove(["vjaBrowserAutopilotActivePlan", "vjaBrowserAutopilotTabId", "vjaPendingSiteApply", "vjaSiteApplyResult"]);
        await browserAutopilotHeartbeat(api, false, message, active.vjaBrowserAutopilotActivePlan.jobTitle);
        try { await chrome.tabs.update(active.vjaBrowserAutopilotTabId, { active: true }); } catch { }
        return;
      }
    }

    const discoverySettings = await chrome.storage.sync.get('vjaHhBrowserSearch');
    let discoveryMessage = '';
    if (discoverySettings.vjaHhBrowserSearch) {
      discoveryMessage = await discoverHhInBrowser(api, status);
      if ((await chrome.storage.local.get('vjaHhDiscoveryBlocked')).vjaHhDiscoveryBlocked) {await browserAutopilotHeartbeat(api,false,discoveryMessage);return;}
    }
    const refreshed = await browserAutopilotJson(`${api}/api/automation/status`);
    if (!self.vjaBrowserAutopilot.shouldRun(refreshed)) return;
    status = refreshed;
    const lastCollected = status.lastCollectedAt ? Date.parse(status.lastCollectedAt) : 0;
    if (!discoverySettings.vjaHhBrowserSearch && !status.collection?.running && (!lastCollected || Date.now() - lastCollected > 30 * 60 * 1000) && (!status.collection?.startedAt || Date.now() - Date.parse(status.collection.startedAt) > 60000)) {
      await browserAutopilotJson(`${api}/api/collect/start`, { method: "POST" });
    }

    const queue = await browserAutopilotJson(`${api}/api/application-queue?limit=50&source=hh&minScore=${encodeURIComponent(status.autoApplyMinimumScore || 75)}`);
    const candidate = self.vjaBrowserAutopilot?.selectCandidate?.(queue, status.autoApplyMinimumScore || 75);
    if (!candidate) {
      const issue = status.collection?.error || status.collection?.result?.errors?.join(" ");
      const message = discoveryMessage || (status.collection?.running ? "Ищу вакансии. Очередь обновится после завершения поиска."
        : issue || `Ожидание: в очереди нет подходящих вакансий от ${status.autoApplyMinimumScore}/100. Найдено HH: ${status.collection?.result?.hhFound ?? status.diagnostics?.newHhVacancies ?? 0}.`);
      await browserAutopilotHeartbeat(api, false, message);
      return;
    }

    const draft = await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(candidate.vacancyId)}/application-draft`);
    const plan = self.vjaBrowserAutopilot.buildPlan(candidate, draft);
    if (!plan.coverLetter) throw new Error("Персональное сопроводительное письмо не было создано.");

    await chrome.storage.local.remove("vjaSiteApplyResult");
    await chrome.storage.local.set({ vjaPendingSiteApply: plan, vjaBrowserAutopilotActivePlan: plan });
    const tab = await chrome.tabs.create({ url: plan.sourceUrl, active: false });
    if (!tab?.id) throw new Error("Не удалось открыть HH-вакансию.");
    await chrome.storage.local.set({ vjaBrowserAutopilotTabId: tab.id });
    const result = await browserAutopilotProcess(api, plan, tab.id);
    await browserAutopilotHeartbeat(api, Boolean(result.retry), result.message, plan.jobTitle);
  } catch (error) {
    if (api) {
      await browserAutopilotHeartbeat(api, false, `Автопилот остановился: ${error?.message || String(error)}`).catch(() => {});
    }
  } finally {
    browserAutopilotRunning = false;
  }
}

async function ensureBrowserAutopilotAlarm() {
  await chrome.alarms.create(browserAutopilotAlarm, { delayInMinutes: 0.1, periodInMinutes: 0.5 });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "vjaBrowserAutopilotWake" || !sender.tab?.id) return false;
  runBrowserAutopilot().then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === browserAutopilotAlarm) void runBrowserAutopilot();
});
chrome.runtime.onInstalled.addListener(() => {
  void ensureBrowserAutopilotAlarm();
  void runBrowserAutopilot();
});
chrome.runtime.onStartup.addListener(() => {
  void ensureBrowserAutopilotAlarm();
  void runBrowserAutopilot();
});

void ensureBrowserAutopilotAlarm();
void runBrowserAutopilot();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "vjaPanelContext") return false;
  if (!sender.tab?.id || !String(sender.url || "").startsWith(chrome.runtime.getURL("popup.html"))) {
    respond({error:"invalid-panel-context"});return false;
  }
  respond({tab:{id:sender.tab.id,url:sender.tab.url}});return false;
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if(message?.type !== 'vjaAutopilotControlWake' || !sender.url?.startsWith(chrome.runtime.getURL('popup.html')))return false;
  void runBrowserAutopilot();respond({ok:true});return false;
});
