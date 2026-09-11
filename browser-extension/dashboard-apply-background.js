async function reconcileApplicationState(api) {
  await migrateApplicationJobs(api);
  await pumpApplicationJobs(api);
}
async function archiveApplicationReview(api,plan,result,reason) {
  if(plan.managed) {
    await updateApplicationJob(plan,{state:'review',pending:null,result:{id:plan.id,result},message:reason});
  } else {
    const stored=await chrome.storage.local.get('vjaApplicationReview');
    const reviews=stored.vjaApplicationReview || {};
    reviews[plan.trackedId || plan.sourceUrl || plan.id]={plan,result,reason,recordedAt:Date.now()};
    await chrome.storage.local.set({vjaApplicationReview:reviews});
    await chrome.storage.local.remove(applicationStateKeys);
  }
  if(plan.trackedId)await browserAutopilotDefer(api,plan,reason);
  await dashboardApplyNotify(plan,{message:reason});
}
async function applicationNeedsReview(candidate) {
  const job=(await applicationJobs()).find(j=>j.state==='review'&&sameApplication(j.plan,{trackedId:candidate.vacancyId,sourceUrl:candidate.url}));
  if(job)return {reason:job.message};
  const stored=await chrome.storage.local.get('vjaApplicationReview');
  return Object.values(stored.vjaApplicationReview || {}).find(entry=>
    (candidate.vacancyId && entry.plan?.trackedId===candidate.vacancyId) ||
    (candidate.url && entry.plan?.sourceUrl===candidate.url));
}
// A dashboard click reuses the existing executor and its persisted continuation; it never enables autopilot.
async function dashboardApplyNotify(plan, result) {
  const job=plan?.managed?await applicationJob(plan):null;
  const targets=[...(plan?.dashboard?[plan]:[]),...(job?.observers||[])];
  for(const target of targets) {
    if(!target.dashboardTabId)continue;
    try {await chrome.tabs.sendMessage(target.dashboardTabId,{type:'vjaDashboardApplyResult',requestId:target.dashboardRequestId,vacancyId:plan.trackedId,
      status:result.retry?'pending':result.completed?'confirmed':'review',message:result.message});}catch{}
  }
}
async function runDashboardApply(api, vacancyId, sender, requestId) {
  const stub={dashboard:true,dashboardTabId:sender.tab.id,dashboardRequestId:requestId,trackedId:vacancyId};
  try {
    await migrateApplicationJobs(api);
    const previous=await applicationNeedsReview({vacancyId});
    if(previous)throw new Error(previous.reason);
    const prepared=await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(vacancyId)}/prepare-dashboard-apply`,{method:'POST'});
    if(!prepared.ready || prepared.candidate?.vacancyId!==vacancyId || !prepared.draft?.coverLetter)throw new Error(prepared.message||'Вакансия не готова к отправке.');
    const priorUrl=await applicationNeedsReview(prepared.candidate);
    if(priorUrl)throw new Error(priorUrl.reason);
    const plan={...self.vjaBrowserAutopilot.buildPlan(prepared.candidate,prepared.draft),...stub,automatic:false};
    const {job,existing}=await admitApplication(api,plan);
    if(existing) {
      await dashboardApplyNotify(stub,{completed:job.state==='confirmed',retry:['queued','running','waiting'].includes(job.state),message:job.message||`Отклик «${job.plan.jobTitle}» уже принят. Повторная отправка не создаётся.`});
      // Reconnect this dashboard request to the already running application.
      await updateApplicationJob(job.plan,{observers:[...(job.observers||[]).filter(x=>x.dashboardTabId!==stub.dashboardTabId),stub]});
      return;
    } else await dashboardApplyNotify(stub,{retry:true,message:'Задание принято. До трёх откликов выполняются одновременно; остальные запускаются по мере освобождения вкладок.'});
    await pumpApplicationJobs(api);
  } catch(error) {await dashboardApplyNotify(stub,{message:error?.message||String(error)});}
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
