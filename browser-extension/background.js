importScripts("application-jobs.js", "browser-autopilot.js", "hh-discovery-navigation.js", "hh-discovery-background.js", "dashboard-apply-background.js");

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
    const scoped=await applicationScopedStorage(message,sender);
    if(scoped)return scoped;
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
  const job=await applicationJob({id:planId});
  if(job)return job.result?.id===planId?job.result.result:null;
  const stored = await chrome.storage.local.get("vjaSiteApplyResult");
  const envelope = stored.vjaSiteApplyResult;
  return envelope?.id === planId ? envelope.result : null;
}

async function waitForApplicationContent(tabId) {
  for(let attempt=0;attempt<20;attempt++) {
    try {
      const ready=await browserAutopilotWithTimeout(chrome.tabs.sendMessage(tabId,{type:'vjaSiteApplyReady'}),500,'content-not-ready');
      if(ready?.ok)return;
    }catch{}
    await browserAutopilotWait(250);
  }
  throw Error('Расширение не подключилось к вкладке вакансии. Отправка не начиналась.');
}
async function browserAutopilotSendPlan(tabId, plan) {
  let lastError = null;
  const storedResult = await browserAutopilotStoredResult(plan.id);
  if (storedResult) return storedResult;
  try {
    const result = await browserAutopilotWithTimeout(
      chrome.tabs.sendMessage(tabId, { type: "siteApplyNow", plan }),
      60000,
      "Страница HH не ответила за 60 секунд."
    );
    if (result) return result;
  } catch (error) { lastError = error; }
  // Navigation may close the message channel while a receipt is being persisted.
  // Poll the receipt only; never dispatch the application command again here.

  for (let attempt = 0; attempt < 15; attempt++) {
    const result = await browserAutopilotStoredResult(plan.id);
    if (result) return result;
    await browserAutopilotWait(1000);
  }
  throw lastError || new Error("The HH application page did not respond to the extension.");
}

async function browserAutopilotComplete(api, plan, result, tabId) {
  await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(plan.trackedId)}/${plan.dashboard ? "browser-applied" : "browser-auto-applied"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coverLetter: plan.coverLetter, resumeLabel: result.resumeLabel || plan.resumeHint, vacancyTitle: plan.jobTitle })
  });
  if(plan.managed)await updateApplicationJob(plan,{state:"confirmed",pending:null,result:{id:plan.id,result},message:`Отклик и письмо отправлены: ${plan.jobTitle}.`});
  else await chrome.storage.local.remove(["vjaBrowserAutopilotActivePlan", "vjaBrowserAutopilotTabId", "vjaPendingSiteApply", "vjaSiteApplyResult"]);
  try { await chrome.tabs.remove(tabId); } catch { }
}

async function browserAutopilotDefer(api, plan, reason) {
  const deferredUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(plan.trackedId)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Saved", note: `QueueDeferredUntil=${deferredUntil}\n${reason || "Нужна проверка формы HH"}` })
  }).catch(() => {});
  return `Нужна ручная проверка вакансии «${plan.jobTitle}»: ${reason || "HH изменил форму"}. Вакансия отложена на 4 часа, чтобы не открывать дубли.`;
}

async function browserAutopilotProcess(api, plan, tabId) {
  await browserAutopilotHeartbeat(api, true, `Открываю «${plan.jobTitle}» и готовлю отклик с письмом.`, plan.jobTitle);
  const savedResult=await browserAutopilotStoredResult(plan.id);
  if(savedResult?.submitted && savedResult.status==='confirmed' && savedResult.coverLetterFilled) {
    await browserAutopilotComplete(api,plan,savedResult,tabId);
    return {completed:true,message:`Отклик и письмо отправлены: ${plan.jobTitle}.`};
  }
  await browserAutopilotWaitForTab(tabId);
  const job=plan.managed?await applicationJob(plan):null;
  const pendingState=job?{vjaPendingSiteApply:job.pending}:await chrome.storage.local.get("vjaPendingSiteApply");
  const continuationPlan=pendingState.vjaPendingSiteApply?.id===plan.id?pendingState.vjaPendingSiteApply:plan;
  await waitForApplicationContent(tabId);
  if(job)await updateApplicationJob(plan,{dispatchedAt:job.dispatchedAt||Date.now()});
  const result=await browserAutopilotSendPlan(tabId,{...continuationPlan,resumeOnly:Boolean(job?.dispatchedAt)});
  if (result?.submitted && result?.status === "confirmed" && result?.coverLetterFilled) {
    await browserAutopilotComplete(api, plan, result, tabId);
    return { completed: true, message: `Отклик и письмо отправлены: ${plan.jobTitle}.` };
  }

  if (result?.status === "submitted-needs-letter" || result?.status === "clicked-unverified" || result?.status === "verification-needed") {
    if(plan.managed)await updateApplicationJob(plan,{result:null});
    else await chrome.storage.local.remove("vjaSiteApplyResult");
    return { completed: false, retry: true, message: `Продолжаю проверять письмо для «${plan.jobTitle}».` };
  }

  const message = await browserAutopilotDefer(api, plan, result?.reason || result?.error);
  await archiveApplicationReview(api,plan,result,message);
  if (!plan.dashboard) { try { await chrome.tabs.update(tabId, { active: true }); } catch { } }
  return { completed: false, retry: false, message };
}

async function browserAutopilotApplyNext(api) {
  if(applicationWorkers.size>=applicationParallelism)return {stopped:true};
  const status = await browserAutopilotJson(`${api}/api/automation/status`);
  if (!self.vjaBrowserAutopilot.shouldRun(status)) return { stopped: true };
    const queue = await browserAutopilotJson(`${api}/api/application-queue?limit=50&source=hh&automaticOnly=true&minScore=${encodeURIComponent(status.autoApplyMinimumScore || 75)}`);
    const available=[];
    const existing=await applicationJobs();
    for(const item of queue)if(!await applicationNeedsReview(item)&&!existing.some(j=>j.state!=="failed"&&sameApplication(j.plan,{trackedId:item.vacancyId,sourceUrl:item.url})))available.push(item);
    const candidate = self.vjaBrowserAutopilot?.selectCandidate?.(available, status.autoApplyMinimumScore || 75);
    if (!candidate) return null;
    // Recheck after queue preparation so Pause/quota changes do not start another job.
    const live = await browserAutopilotJson(`${api}/api/automation/status`);
    if (!self.vjaBrowserAutopilot.shouldRun(live)) return { stopped: true };
    const draft = await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(candidate.vacancyId)}/application-draft`);
    const current = await browserAutopilotJson(`${api}/api/automation/status`);
    if (!self.vjaBrowserAutopilot.shouldRun(current) || !self.vjaBrowserAutopilot.selectCandidate([candidate], current.autoApplyMinimumScore)) return { stopped: true };
    const plan = self.vjaBrowserAutopilot.buildPlan(candidate, draft);
    if (!plan.coverLetter) throw new Error("Персональное сопроводительное письмо не было создано.");

    const admitted=await admitApplication(api,plan);
    await pumpApplicationJobs(api);
    const job=await applicationJob(admitted.job.plan);
    return {completed:job.state==='confirmed',retry:job.state==='waiting',message:job.message};
}

async function runBrowserAutopilot() {
  if (browserAutopilotRunning) return;
  browserAutopilotRunning = true;
  let api = "";
  try {
    api = await browserAutopilotApiBase();
    await browserAutopilotHeartbeat(api, false, "Расширение Chrome подключено и готово к браузерному автопилоту.");
    let status = await browserAutopilotJson(`${api}/api/automation/status`);
    await migrateApplicationJobs(api);
    if(self.vjaBrowserAutopilot.shouldRun(status))for(const job of await applicationJobs())if(job.state==='paused')await updateApplicationJob(job.plan,{state:'queued'});
    await pumpApplicationJobs(api);
    if(!self.vjaBrowserAutopilot.shouldRun(status))return;

    // Finish useful work already queued before spending time on another search.
    const queuedResult = await browserAutopilotApplyNext(api);
    if (queuedResult) return;

    const discoverySettings = await chrome.storage.sync.get('vjaHhBrowserSearch');
    let discoveryMessage = '';
    if (discoverySettings.vjaHhBrowserSearch) {
      let applicationResult = null;
      discoveryMessage = await discoverHhInBrowser(api, status, async () => {
        try {
          const result = await browserAutopilotApplyNext(api);
          if (result) applicationResult = result;
          return !result?.retry && !result?.stopped;
        } catch (error) {
          applicationResult = { stopped: true, message: `Отправка остановлена: ${error.message}` };
          return false;
        }
      });
      if (applicationResult?.message) await browserAutopilotHeartbeat(api, Boolean(applicationResult.retry), applicationResult.message);
      if (applicationResult) return;
      if ((await chrome.storage.local.get('vjaHhDiscoveryBlocked')).vjaHhDiscoveryBlocked) {await browserAutopilotHeartbeat(api,false,discoveryMessage);return;}
    }
    const refreshed = await browserAutopilotJson(`${api}/api/automation/status`);
    if (!self.vjaBrowserAutopilot.shouldRun(refreshed)) return;
    status = refreshed;
    const lastCollected = status.lastCollectedAt ? Date.parse(status.lastCollectedAt) : 0;
    if (!discoverySettings.vjaHhBrowserSearch && !status.collection?.running && (!lastCollected || Date.now() - lastCollected > 30 * 60 * 1000) && (!status.collection?.startedAt || Date.now() - Date.parse(status.collection.startedAt) > 60000)) {
      await browserAutopilotJson(`${api}/api/collect/start`, { method: "POST" });
    }

    const result = await browserAutopilotApplyNext(api);
    if (!result) {
      const issue = status.collection?.error || status.collection?.result?.errors?.join(" ");
      await browserAutopilotHeartbeat(api, false, discoveryMessage || issue || 'Нет вакансий, готовых к автоматической отправке. Следующий поиск — по расписанию.');
    }

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
