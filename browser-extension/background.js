importScripts("candidate-seed.js", "candidate-truth.js", "relevance-engine.js", "context-reply.js", "writing-provider.js");
importScripts("copilot-core.js", "profile-defaults.js", "quick-replies.js", "bundled-cv.js", "followup-intelligence.js", "application-analytics.js", "application-state-machine.js");
importScripts("browser-autopilot.js", "hh-discovery-navigation.js", "hh-discovery-background.js", "application-executor.js", "dashboard-apply-background.js");

async function restrictLocalStorageAccess() {
  try {
    if (chrome.storage?.local?.setAccessLevel) {
      await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    }
  } catch (error) {
    console.warn("Violetta Apply Assistant: could not restrict local storage access", error);
  }
}

async function normalizeLocalApiBase() {
  try {
    if (!chrome.storage?.sync?.get || !chrome.storage?.sync?.set) return;
    const stored = await chrome.storage.sync.get({ apiBase: "" });
    const current = String(stored.apiBase || "").trim();
    if (!current || /^http:\/\/localhost:8080\/?$/i.test(current)) {
      await chrome.storage.sync.set({ apiBase: "http://127.0.0.1:8080" });
    }
  } catch (error) {
    console.warn("Violetta Apply Assistant: could not normalize local API address", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void restrictLocalStorageAccess();
  void normalizeLocalApiBase();
});

chrome.runtime.onStartup.addListener(() => {
  void restrictLocalStorageAccess();
  void normalizeLocalApiBase();
});

void restrictLocalStorageAccess();
void normalizeLocalApiBase();

const siteApplyStorageKeys = new Set(["vjaPendingSiteApply", "vjaSiteApplyResult"]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "vjaSiteApplyStorage" || !sender.tab?.id) return false;
  const key = String(message.key || "");
  if (!siteApplyStorageKeys.has(key)) {
    sendResponse({ ok: false, error: "storage-key-not-allowed" });
    return false;
  }

  (async () => {
    return applicationTabStorage(message, sender);
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
  const stored = await chrome.storage.sync.get({ apiBase: "http://127.0.0.1:8080" });
  return String(stored.apiBase || "http://127.0.0.1:8080").trim().replace(/\/$/, "");
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
  const job = await applicationJob(planId);
  return job?.result?.id === planId ? job.result.result : null;
}

async function waitForApplicationContent(tabId) {
  for (let attempt=0;attempt<30;attempt++) {
    try {
      const reply=await browserAutopilotWithTimeout(chrome.tabs.sendMessage(tabId,{type:'vjaSiteApplyReady'}),1000,'Page readiness timeout');
      if(reply?.ready)return;
    } catch { }
    await browserAutopilotWait(250);
  }
  throw new Error('Расширение не подключилось к вкладке вакансии. Повторите отклик.');
}

async function browserAutopilotSendPlan(tabId, plan) {
  let lastError = null;
  const storedResult = await browserAutopilotStoredResult(plan.id);
  if (storedResult && !['submitted-needs-letter','clicked-unverified','verification-needed'].includes(storedResult.status)) return storedResult;
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
    if (result && result.status !== storedResult?.status) return result;
    await browserAutopilotWait(1000);
  }
  throw lastError || new Error("The HH application page did not respond to the extension.");
}

async function browserAutopilotComplete(api, plan, result, tabId) {
  let backendRecorded=false;
  if(plan.trackedId){
    try{
      await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(plan.trackedId)}/${plan.automatic ? "browser-auto-applied" : "browser-applied"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: plan.coverLetter, resumeLabel: result.resumeLabel || "", vacancyTitle: plan.jobTitle, letterVersion:plan.letterVersion || "unknown", roleVariant:plan.roleVariant || "unknown" })
      });
      backendRecorded=true;
    }catch{/* Employer-site receipt remains authoritative even if the local dashboard is offline. */}
  }
  const completedJob=await applicationJob(plan.id);
  const now=Date.now(),oldContext=completedJob?.context||{},memory={...(oldContext.coverLetterMemory||{}),text:plan.coverLetter||oldContext.coverLetter||'',submittedText:plan.coverLetter||oldContext.coverLetter||'',submittedCvName:result.resumeLabel||oldContext.cvName||'',submittedAt:now,updatedAt:now};
  const applicationState=globalThis.vjaApplicationState?.transition?.(oldContext.applicationState||'SUBMITTING','CONFIRMED',{receipt:true,resumeLabel:result.resumeLabel||''},now)||{state:'CONFIRMED',updatedAt:now};
  await updateApplicationJob(plan.id,{completed:true,review:false,reason:null,pending:null,backendRecorded,context:{...oldContext,status:'Applied',statusSource:'site-confirmed',coverLetterMemory:memory,applicationState,updatedAt:now}});
  if(globalThis.vjaAppendJobTimeline)await globalThis.vjaAppendJobTimeline(plan.id,'submitted','Отклик подтверждён сайтом',{resumeLabel:result.resumeLabel||'',coverLetterFilled:Boolean(result.coverLetterFilled),backendRecorded});
  if (!plan.popup) { try { await chrome.tabs.remove(tabId); } catch { } }
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
  await browserAutopilotHeartbeat(api, true, `Открываю «${plan.jobTitle}» и готовлю отклик с письмом.`, plan.jobTitle).catch(()=>{});
  const savedResult=await browserAutopilotStoredResult(plan.id);
  if(savedResult?.submitted && savedResult.status==='confirmed' && savedResult.coverLetterFilled) {
    await browserAutopilotComplete(api,plan,savedResult,tabId);
    return {completed:true,message:`Отклик и письмо отправлены: ${plan.jobTitle}.`};
  }
  await browserAutopilotWaitForTab(tabId);
  await waitForApplicationContent(tabId);
  const job = await applicationJob(plan.id);
  let continuationPlan = job?.pending || plan;
  // The first command is persisted before dispatch. A restart can only inspect or
  // continue known progress; it must never repeat an unknown initial click.
  if (job?.dispatched && !continuationPlan.finalClicked && !continuationPlan.startClicked && !job.result)
    throw new Error('Результат предыдущей команды неизвестен');
  await updateApplicationJob(plan.id,{dispatched:true});
  if (continuationPlan.cvKey) {
    const files = await chrome.storage.local.get(continuationPlan.cvKey);
    continuationPlan = {...continuationPlan,fileData:files[continuationPlan.cvKey]};
  }
  let result = await browserAutopilotSendPlan(tabId, continuationPlan);
  const latest = await browserAutopilotStoredResult(plan.id);
  if (latest?.submitted && latest.status === 'confirmed' && latest.coverLetterFilled) result = latest;
  if(result) await updateApplicationJob(plan.id,{result:{id:plan.id,trackedId:plan.trackedId,sourceUrl:plan.sourceUrl,coverLetter:plan.coverLetter,createdAt:Date.now(),result}});
  if (result?.submitted && result?.status === "confirmed" && result?.coverLetterFilled) {
    await browserAutopilotComplete(api, plan, result, tabId);
    return { completed: true, message: `Отклик и письмо отправлены: ${plan.jobTitle}.` };
  }

  if (result?.status === "submitted-needs-letter" || result?.status === "clicked-unverified" || result?.status === "verification-needed") {
    return { completed: false, retry: true, message: `Продолжаю проверять письмо для «${plan.jobTitle}».` };
  }

  const message = result?.reason || result?.error || 'Форма требует проверки.';
  await archiveApplicationReview(api,plan,result,message);
  if (!plan.dashboard && !plan.automatic && !plan.popup) { try { await chrome.tabs.update(tabId, { active: true }); } catch { } }
  return { completed: false, retry: false, message };
}

let vjaAutopilotSessionFallback={count:0,startedAt:Date.now()};
async function browserAutopilotPreferences(){
  const stored=await chrome.storage.sync.get('vjaAutopilotPreferences').catch(()=>({}));
  return self.vjaBrowserAutopilot.normalizePreferences(stored.vjaAutopilotPreferences||{});
}
async function browserAutopilotSession(){
  if(chrome.storage.session?.get){
    const data=await chrome.storage.session.get('vjaAutopilotSession');
    return data.vjaAutopilotSession||{count:0,startedAt:Date.now()};
  }
  return vjaAutopilotSessionFallback;
}
async function browserAutopilotSessionAdd(amount=1){
  const state=await browserAutopilotSession();const next={count:Number(state.count||0)+amount,startedAt:state.startedAt||Date.now(),updatedAt:Date.now()};
  if(chrome.storage.session?.set)await chrome.storage.session.set({vjaAutopilotSession:next});else vjaAutopilotSessionFallback=next;
  return next;
}

async function browserAutopilotApplyNext(api) {
  const status = await browserAutopilotJson(`${api}/api/automation/status`);
  if (!self.vjaBrowserAutopilot.shouldRun(status)) return {stopped:true};
  const prefs=await browserAutopilotPreferences();
  const session=await browserAutopilotSession();
  const sessionRemaining=Math.max(0,prefs.sessionLimit-Number(session.count||0));
  if(sessionRemaining<=0)return {stopped:true,message:`Лимит этой сессии (${prefs.sessionLimit}) достигнут.`};
  const jobs = await applicationJobs();
  const active = jobs.filter(job=>!job.review && !job.completed);
  const capacity = Math.min(2-active.filter(job=>job.plan.automatic).length,
    Number(status.remainingToday)-active.length,sessionRemaining);
  if(capacity<=0)return {stopped:true};
  const queue = await browserAutopilotJson(`${api}/api/application-queue?limit=50&source=hh&automaticOnly=true&minScore=${encodeURIComponent(status.autoApplyMinimumScore || 75)}`);
  const tasks=[];
  for(const candidate of queue) {
    if(tasks.length>=capacity)break;
    if(applicationClaims.has(candidate.vacancyId) || jobs.some(job=>sameApplication(job.plan,{trackedId:candidate.vacancyId,sourceUrl:candidate.url})) || await applicationNeedsReview(candidate))continue;
    if(!self.vjaBrowserAutopilot.selectCandidate([candidate],status.autoApplyMinimumScore,prefs))continue;
    applicationClaims.add(candidate.vacancyId);
    try {
      const backendDraft=await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(candidate.vacancyId)}/application-draft`);
      const data=await cpData(),truthProfile=data.profile;
      const seedVacancy=globalThis.vjaCopilotCore.vacancy({url:candidate.url,vacancyId:globalThis.vjaCopilotCore.idFromUrl(candidate.url),title:candidate.title,company:candidate.company,description:candidate.description||''});
      const letterVacancy=await cpCompleteVacancy(seedVacancy,{url:candidate.url});
      const writing=await cpCreateLetter(truthProfile,letterVacancy);
      const draft={...backendDraft,coverLetter:writing.text,letterVersion:'3.8-evidence'};
      const live=await browserAutopilotJson(`${api}/api/automation/status`);
      const reservations=(await applicationJobs()).filter(job=>!job.review&&!job.completed).length;
      if(!self.vjaBrowserAutopilot.shouldRun(live) || Number(live.remainingToday)<=reservations)break;
      if(!self.vjaBrowserAutopilot.selectCandidate([candidate],live.autoApplyMinimumScore,prefs))continue;
      const plan=self.vjaBrowserAutopilot.buildPlan(candidate,draft);
      if(!plan.coverLetter)throw new Error('Не удалось подготовить письмо.');
      await registerApplication(plan);
      const cvStore=await chrome.storage.local.get(['cvVaultRu','cvVaultEn']);const cv=globalThis.vjaCopilotCore.cvSelection(globalThis.vjaRelevance.route(letterVacancy.title,letterVacancy.description),globalThis.vjaRelevance.language(letterVacancy.description),cvStore);
      plan.cvKey=cv.key;plan.fileData=cv.file||null;plan.resumeHint=letterVacancy.title;
      await updateApplicationJob(plan.id,{plan,context:{vacancy:letterVacancy,profileSnapshot:truthProfile,evidenceAudit:writing.audit,cvKey:cv.key,cvName:cv.file?.name||'',coverLetter:writing.text,coverLetterMemory:{text:writing.text,evidenceAudit:writing.audit,generatedAt:Date.now(),source:writing.source}}});
      await browserAutopilotSessionAdd(1);
      tasks.push(executeApplication(api,plan));
    } finally {applicationClaims.delete(candidate.vacancyId);}
  }
  if(!tasks.length)return null;
  const results=await Promise.all(tasks);
  return {completed:results.some(r=>r?.completed),retry:results.some(r=>r?.retry),message:'Проверка текущих откликов завершена.'};
}

async function runBrowserAutopilot() {
  if (browserAutopilotRunning) return;
  browserAutopilotRunning = true;
  let api = "";
  let continuations = Promise.resolve();
  try {
    api = await browserAutopilotApiBase();
    await browserAutopilotHeartbeat(api, false, "Расширение Chrome подключено. Автопилот запускается только после вашего включения.").catch(()=>{});
    let status = await browserAutopilotJson(`${api}/api/automation/status`);
    await reconcileApplicationState(api);
    const active = (await applicationJobs()).filter(job=>!job.completed&&!job.review);
    continuations = Promise.allSettled(active.filter(job=>job.plan.automatic && self.vjaBrowserAutopilot.shouldRun(status)).map(job=>executeApplication(api,job.plan)));
    if(!self.vjaBrowserAutopilot.shouldRun(status))return;

    const prefs=await browserAutopilotPreferences();
    const session=await browserAutopilotSession();
    if(Number(session.count||0)>=prefs.sessionLimit){
      await browserAutopilotHeartbeat(api,false,`Автопилот на паузе: лимит этой сессии ${prefs.sessionLimit} откликов достигнут.`).catch(()=>{});return;
    }

    // Process already-qualified work before collecting more vacancies.
    const queuedResult = await browserAutopilotApplyNext(api);
    if (queuedResult && !queuedResult.stopped) return;

    const discoverySettings = await chrome.storage.sync.get(['vjaHhBrowserSearch','vjaAutopilotPreferences']);
    let discoveryMessage = '';
    if (discoverySettings.vjaHhBrowserSearch !== false) {
      let applicationResult = null;
      discoveryMessage = await discoverHhInBrowser(api, status, async () => {
        try {
          const result = await browserAutopilotApplyNext(api);
          if (result) applicationResult = result;
          return !result?.retry && !result?.stopped;
        } catch (error) {
          applicationResult = { stopped: true, message: `Автопилот остановил текущую вакансию: ${error.message}` };
          return false;
        }
      });
      if (applicationResult?.message) await browserAutopilotHeartbeat(api, Boolean(applicationResult.retry), applicationResult.message).catch(()=>{});
      if (applicationResult && !applicationResult.stopped) return;
      if ((await chrome.storage.local.get('vjaHhDiscoveryBlocked')).vjaHhDiscoveryBlocked) {await browserAutopilotHeartbeat(api,false,discoveryMessage).catch(()=>{});return;}
    }

    const refreshed = await browserAutopilotJson(`${api}/api/automation/status`);
    if (!self.vjaBrowserAutopilot.shouldRun(refreshed)) return;
    status = refreshed;
    const lastCollected = status.lastCollectedAt ? Date.parse(status.lastCollectedAt) : 0;
    if (discoverySettings.vjaHhBrowserSearch === false && !status.collection?.running && (!lastCollected || Date.now() - lastCollected > 30 * 60 * 1000) && (!status.collection?.startedAt || Date.now() - Date.parse(status.collection.startedAt) > 60000)) {
      await browserAutopilotJson(`${api}/api/collect/start`, { method: "POST" });
    }
    const result = await browserAutopilotApplyNext(api);
    if (!result || result.stopped) {
      const issue = status.collection?.error || status.collection?.result?.errors?.join(" ");
      await browserAutopilotHeartbeat(api, false, result?.message || discoveryMessage || issue || 'Нет подходящих удалённых programming-вакансий выше выбранного порога. Следующий поиск — по расписанию.').catch(()=>{});
    }
  } catch (error) {
    if (api) await browserAutopilotHeartbeat(api, false, `Автопилот остановился: ${error?.message || String(error)}`).catch(() => {});
  } finally {
    await continuations;
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
  if(message?.type !== 'vjaAutopilotControlWake')return false;
  const senderUrl=String(sender.url||'');
  if(![chrome.runtime.getURL('popup.html'),chrome.runtime.getURL('home.html')].some(url=>senderUrl.startsWith(url))){respond({ok:false,error:'invalid-autopilot-control'});return false;}
  void runBrowserAutopilot();respond({ok:true});return false;
});

// Old popup callers must use the context-bound on-page pencil in v3.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'vjaRecruiterChatAnalyze') return false;
  respond({ok:false,error:'Откройте ✎ AI непосредственно в переписке для проверки контекста.'});
  return false;
});
importScripts("writing-background.js", "copilot-background.js");
