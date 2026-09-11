// Manual clicks take priority at the next safe discovery boundary.
var dashboardApplyWaiting = 0;
const applicationStateKeys = ['vjaBrowserAutopilotActivePlan','vjaBrowserAutopilotTabId','vjaPendingSiteApply','vjaSiteApplyResult'];
// Retain uncertain attempts per vacancy, rather than locking every future application.
// Never retry an archived vacancy automatically or interpret an expired plan as success.
async function reconcileApplicationState(api) {
  const state=await chrome.storage.local.get(applicationStateKeys);
  const plan=state.vjaBrowserAutopilotActivePlan || state.vjaPendingSiteApply;
  if(!plan)return;
  const envelope=state.vjaSiteApplyResult;
  const result=envelope?.id===plan.id?envelope.result:null;
  if(state.vjaBrowserAutopilotActivePlan && result?.submitted && result.status==='confirmed' && result.coverLetterFilled) {
    await browserAutopilotComplete(api,plan,result,state.vjaBrowserAutopilotTabId);
    await dashboardApplyNotify(plan,{completed:true,message:`Отклик и письмо отправлены: ${plan.jobTitle}.`});
    return;
  }
  let missingTab=false;
  if(state.vjaBrowserAutopilotActivePlan) {
    try {missingTab=!state.vjaBrowserAutopilotTabId || !await chrome.tabs.get(state.vjaBrowserAutopilotTabId);}catch{missingTab=true;}
  }
  const expired=Number(plan.expiresAt)>0 && Number(plan.expiresAt)<=Date.now();
  if(!missingTab&&!expired)return;
  const reason=`Предыдущая попытка для «${plan.jobTitle || 'вакансии'}» остановлена: ${missingTab?'вкладка закрыта':'истёк срок задания'}. Проверьте отклики и письмо на HH перед повторной отправкой. Другие вакансии доступны.`;
  await archiveApplicationReview(api,plan,result,reason);
}
async function archiveApplicationReview(api,plan,result,reason) {
  const stored=await chrome.storage.local.get('vjaApplicationReview');
  const reviews=stored.vjaApplicationReview || {};
  const key=plan.trackedId || plan.sourceUrl || plan.id;
  reviews[key]={plan,result,reason,recordedAt:Date.now()};
  await chrome.storage.local.set({vjaApplicationReview:reviews});
  await chrome.storage.local.remove(applicationStateKeys);
  if(plan.trackedId)await browserAutopilotDefer(api,plan,reason);
  await dashboardApplyNotify(plan,{message:reason});
}
async function applicationNeedsReview(candidate) {
  const stored=await chrome.storage.local.get('vjaApplicationReview');
  return Object.values(stored.vjaApplicationReview || {}).find(entry=>
    (candidate.vacancyId && entry.plan?.trackedId===candidate.vacancyId) ||
    (candidate.url && entry.plan?.sourceUrl===candidate.url));
}
// A dashboard click reuses the existing executor and its persisted continuation; it never enables autopilot.
async function dashboardApplyNotify(plan, result) {
  if (!plan?.dashboard || !plan.dashboardTabId) return;
  try { await chrome.tabs.sendMessage(plan.dashboardTabId, {type:'vjaDashboardApplyResult',requestId:plan.dashboardRequestId,vacancyId:plan.trackedId,
    status:result.retry?'pending':result.completed?'confirmed':'review',message:result.message}); } catch { }
}
async function runDashboardApply(api, vacancyId, sender, requestId) {
  const stub={dashboard:true,dashboardTabId:sender.tab.id,dashboardRequestId:requestId,trackedId:vacancyId};
  // Opening the dashboard wakes a short heartbeat. Let it finish before claiming the
  // shared executor; never run concurrently or wait indefinitely behind an application.
  dashboardApplyWaiting++;
  try {for(let attempt=0;attempt<50&&browserAutopilotRunning;attempt++)await browserAutopilotWait(100);}
  finally {dashboardApplyWaiting--;}
  if (browserAutopilotRunning) {await dashboardApplyNotify(stub,{message:'Сейчас выполняется другой отклик. Дождитесь результата и повторите.'});return;}
  browserAutopilotRunning=true;
  let plan,tabId;
  try {
    await reconcileApplicationState(api);
    const previous=await applicationNeedsReview({vacancyId});
    if(previous)throw new Error(previous.reason);
    const active=await chrome.storage.local.get(['vjaBrowserAutopilotActivePlan','vjaPendingSiteApply']);
    if (active.vjaBrowserAutopilotActivePlan || active.vjaPendingSiteApply) {
      const current=active.vjaBrowserAutopilotActivePlan || active.vjaPendingSiteApply;
      throw new Error(`Ещё выполняется отклик «${current.jobTitle || 'предыдущая вакансия'}». Дождитесь проверки письма; если вкладка закрыта, повторите запрос для восстановления.`);
    }
    const prepared=await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(vacancyId)}/prepare-dashboard-apply`,{method:'POST'});
    if(!prepared.ready || prepared.candidate?.vacancyId!==vacancyId || !prepared.draft?.coverLetter) throw new Error(prepared.message||'Вакансия не готова к отправке.');
    const priorUrl=await applicationNeedsReview(prepared.candidate);
    if(priorUrl)throw new Error(priorUrl.reason);
    plan={...self.vjaBrowserAutopilot.buildPlan(prepared.candidate,prepared.draft),...stub,automatic:false};
    await chrome.storage.local.remove('vjaSiteApplyResult');
    await chrome.storage.local.set({vjaPendingSiteApply:plan,vjaBrowserAutopilotActivePlan:plan});
    const tab=await chrome.tabs.create({url:plan.sourceUrl,active:false});
    tabId=tab?.id;
    if(!tabId) throw new Error('Не удалось открыть фоновую вкладку HH.');
    await chrome.storage.local.set({vjaBrowserAutopilotTabId:tab.id});
    await dashboardApplyNotify(plan,{retry:true,message:'Отправляю резюме и письмо. Можно оставаться в дашборде.'});
    await dashboardApplyNotify(plan,await browserAutopilotProcess(api,plan,tab.id));
  } catch(error) {
    if(plan && !tabId) {
      await chrome.storage.local.remove(['vjaPendingSiteApply','vjaBrowserAutopilotActivePlan']);
      plan=null;
    }
    if(plan) {
      // A lost execution channel has an unknown result. Quarantine this vacancy,
      // release the worker, and do not send the same plan again on the next heartbeat.
      const message=`Связь с откликом «${plan.jobTitle}» прервалась. Проверьте результат и письмо на HH. Другие вакансии доступны. ${error?.message || ''}`;
      await archiveApplicationReview(api,plan,await browserAutopilotStoredResult(plan.id),message);
    } else await dashboardApplyNotify(stub,{message:error?.message||String(error)});
  } finally {browserAutopilotRunning=false;}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!['vjaDashboardApply','vjaDashboardBridgeHello'].includes(message?.type))return false;
  (async()=>{
    const api=await browserAutopilotApiBase();
    if(!sender.tab?.id || sender.frameId!==0 || !dashboardBridgeAllowed(api,sender.url))
      throw new Error('Откройте дашборд подключённого локального сервера в этом браузере.');
    if(message.type==='vjaDashboardBridgeHello')return {ok:true,version:chrome.runtime.getManifest().version};
    if(!/^[0-9a-f-]{36}$/i.test(message.vacancyId||'') || typeof message.requestId!=='string' || message.requestId.length>100)
      throw new Error('Запрос разрешён только с локального дашборда этой программы.');
    void runDashboardApply(api,message.vacancyId,sender,message.requestId);
    return {ok:true};
  })().then(respond).catch(error=>respond({ok:false,message:error.message}));
  return true;
});

function dashboardBridgeAllowed(api, pageUrl) {
  try {
    const base=new URL(api),page=new URL(pageUrl);
    const local=url=>['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    return local(base)&&local(page)&&['http:','https:'].includes(base.protocol)
      &&base.protocol===page.protocol&&base.port===page.port&&['/','/index.html'].includes(page.pathname);
  } catch {return false;}
}
// Content scripts do not attach retroactively to tabs already open during an extension update.
// Reattach only this bridge, only to top-level dashboards of the configured local server.
async function repairDashboardBridges() {
  if(!chrome.tabs.query || !chrome.scripting?.executeScript)return;
  try {
    const api=await browserAutopilotApiBase();
    for(const tab of await chrome.tabs.query({})) {
      if(!tab.id||!dashboardBridgeAllowed(api,tab.url))continue;
      try {
        const reply=await chrome.tabs.sendMessage(tab.id,{type:'vjaDashboardBridgePing'},{frameId:0});
        if(reply?.ok)continue;
      } catch { }
      try {await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},files:['dashboard-apply-content.js']});}catch{ }
    }
  }catch{ }
}
chrome.runtime.onInstalled.addListener(()=>void repairDashboardBridges());
chrome.runtime.onStartup.addListener(()=>void repairDashboardBridges());
chrome.tabs.onUpdated?.addListener((_id,change)=>{if(change.status==='complete')void repairDashboardBridges();});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='vja-browser-autopilot')void repairDashboardBridges();});
void repairDashboardBridges();
