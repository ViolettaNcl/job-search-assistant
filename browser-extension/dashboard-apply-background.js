// A dashboard click reuses the existing executor and its persisted continuation; it never enables autopilot.
async function dashboardApplyNotify(plan, result) {
  if (!plan?.dashboard || !plan.dashboardTabId) return;
  try { await chrome.tabs.sendMessage(plan.dashboardTabId, {type:'vjaDashboardApplyResult',requestId:plan.dashboardRequestId,vacancyId:plan.trackedId,
    status:result.retry?'pending':result.completed?'confirmed':'review',message:result.message}); } catch { }
}
async function runDashboardApply(api, vacancyId, sender, requestId) {
  const stub={dashboard:true,dashboardTabId:sender.tab.id,dashboardRequestId:requestId,trackedId:vacancyId};
  if (browserAutopilotRunning) {await dashboardApplyNotify(stub,{message:'Сейчас выполняется другой отклик. Дождитесь результата и повторите.'});return;}
  browserAutopilotRunning=true;
  let plan,tabId;
  try {
    const active=await chrome.storage.local.get(['vjaBrowserAutopilotActivePlan','vjaPendingSiteApply']);
    if (active.vjaBrowserAutopilotActivePlan || active.vjaPendingSiteApply) throw new Error('Предыдущая отправка ещё не завершена. Проверьте её результат перед новым откликом.');
    const prepared=await browserAutopilotJson(`${api}/api/vacancies/${encodeURIComponent(vacancyId)}/prepare-dashboard-apply`,{method:'POST'});
    if(!prepared.ready || prepared.candidate?.vacancyId!==vacancyId || !prepared.draft?.coverLetter) throw new Error(prepared.message||'Вакансия не готова к отправке.');
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
    // If a plan exists, keep it for receipt/letter recovery rather than risk a repeated submission.
    await dashboardApplyNotify(plan||stub,{retry:Boolean(plan),message:error?.message||String(error)});
  } finally {browserAutopilotRunning=false;}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='vjaDashboardApply')return false;
  (async()=>{
    const api=await browserAutopilotApiBase(),base=new URL(api),page=new URL(sender.url||'');
    // Windows opens 127.0.0.1 while extension defaults to localhost. Only loopback
    // aliases of the same protocol/port are equivalent; never trust arbitrary hosts.
    const loopback = url => ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    const sameLocalServer = loopback(base) && loopback(page)
      && ['http:','https:'].includes(base.protocol) && page.protocol===base.protocol && page.port===base.port;
    if(!sender.tab?.id || sender.frameId!==0 || !sameLocalServer || !['/','/index.html'].includes(page.pathname)
      || !/^[0-9a-f-]{36}$/i.test(message.vacancyId||'') || typeof message.requestId!=='string' || message.requestId.length>100)
      throw new Error('Запрос разрешён только с локального дашборда этой программы.');
    void runDashboardApply(api,message.vacancyId,sender,message.requestId);
    return {ok:true};
  })().then(respond).catch(error=>respond({ok:false,message:error.message}));
  return true;
});
