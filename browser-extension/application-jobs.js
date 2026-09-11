// Persist each application separately. The lock protects storage updates only, never
// a network request or a page interaction. At most three browser executions overlap.
const applicationJobPrefix = 'vjaApplicationJob:';
const applicationWorkers = new Map();
let applicationMutation = Promise.resolve();
let applicationMigration;
const applicationParallelism = 3;
function applicationLock(action) {
  const result=applicationMutation.then(action);
  applicationMutation=result.catch(()=>{});
  return result;
}
function applicationJobKey(plan) { return applicationJobPrefix+plan.id; }
async function applicationJobs() {
  const index=(await chrome.storage.local.get('vjaApplicationJobKeys')).vjaApplicationJobKeys||[];
  const data=await chrome.storage.local.get(index);
  return Object.entries(data).filter(([key])=>key.startsWith(applicationJobPrefix)).map(([,job])=>job);
}
async function insertApplicationJob(job) {
  const key=applicationJobKey(job.plan);
  const index=(await chrome.storage.local.get('vjaApplicationJobKeys')).vjaApplicationJobKeys||[];
  await chrome.storage.local.set({[key]:job,vjaApplicationJobKeys:[...new Set([...index,key])]});
}
async function applicationJob(plan) {
  const key=applicationJobKey(plan);
  return (await chrome.storage.local.get(key))[key];
}
async function updateApplicationJob(plan,patch) {
  return applicationLock(async()=>{
    const job=await applicationJob(plan);
    if(!job)return null;
    const next={...job,...patch,updatedAt:Date.now()};
    await chrome.storage.local.set({[applicationJobKey(plan)]:next});return next;
  });
}
function sameApplication(a,b) {
  if(a.trackedId&&b.trackedId&&a.trackedId===b.trackedId)return true;
  const vacancy=url=>{try {const u=new URL(url);return /(^|\.)hh\.ru$/i.test(u.hostname)?u.pathname.match(/^\/vacancy\/(\d+)/)?.[1]:null;}catch{return null;}};
  const id=vacancy(a.sourceUrl);return Boolean(id&&id===vacancy(b.sourceUrl));
}
async function admitApplication(api,plan) {
  await migrateApplicationJobs(api);
  return applicationLock(async()=>{
    const existing=(await applicationJobs()).find(job=>sameApplication(job.plan,plan));
    if(existing && existing.state!=='failed')return {job:existing,existing:true};
    if(existing)await chrome.storage.local.remove(applicationJobKey(existing.plan));
    const job={plan:{...plan,managed:true},pending:{...plan,managed:true},api,state:'queued',createdAt:Date.now()};
    await insertApplicationJob(job);return {job,existing:false};
  });
}
async function migrateApplicationJobs(api) {
  if(applicationMigration)return applicationMigration;
  applicationMigration=applicationLock(async()=>{
    const keys=['vjaBrowserAutopilotActivePlan','vjaBrowserAutopilotTabId','vjaPendingSiteApply','vjaSiteApplyResult'];
    const old=await chrome.storage.local.get(keys);
    const plans=[old.vjaBrowserAutopilotActivePlan,old.vjaPendingSiteApply].filter((p,i,all)=>p&&all.findIndex(x=>x?.id===p.id)===i);
    for(const plan of plans) {
      if(await applicationJob(plan))continue;
      const owned=old.vjaBrowserAutopilotActivePlan?.id===plan.id;
      const pending=old.vjaPendingSiteApply?.id===plan.id?old.vjaPendingSiteApply:plan;
      const result=old.vjaSiteApplyResult?.id===plan.id?old.vjaSiteApplyResult:null;
      const message='Предыдущая попытка сохранена отдельно. Проверьте её результат и письмо на HH; остальные вакансии доступны.';
      await insertApplicationJob({plan:{...plan,managed:true},pending:owned?{...pending,managed:true}:null,result,api,tabId:owned?old.vjaBrowserAutopilotTabId:null,state:owned?'waiting':'review',message,dispatchedAt:plan.createdAt||Date.now(),createdAt:plan.createdAt||Date.now()});
    }
    if(plans.length)await chrome.storage.local.remove(keys);

  }).finally(()=>{applicationMigration=null;});
  return applicationMigration;
}
async function applicationJobForTab(tabId) {
  return (await applicationJobs()).find(job=>job.tabId===tabId);
}
async function applicationScopedStorage(message,sender) {
  const job=await applicationJobForTab(sender.tab.id);
  if(!job)return null;
  if(sender.frameId!==0)throw Error('application-top-frame-required');
  if(!/(^|\.)hh\.ru$/i.test(new URL(sender.url).hostname))throw Error('application-origin-mismatch');
  const field=message.key==='vjaPendingSiteApply'?'pending':'result';
  if(message.operation==='get')return {ok:true,value:field==='pending'&&!['running','waiting'].includes(job.state)?undefined:job[field]};
  if(message.operation==='set') {
    if(message.value?.id!==job.plan.id)throw Error('application-id-mismatch');
    if(!['running','waiting'].includes(job.state))throw Error('application-no-longer-running');
    // Candidate identity, URL and letter belong to the backend plan, not the page.
    const value=field==='pending'?{...job.plan,finalClicked:Boolean(message.value.finalClicked),finalClickedAt:message.value.finalClickedAt,coverLetterFilledBeforeFinal:Boolean(message.value.coverLetterFilledBeforeFinal),resumeLabel:message.value.resumeLabel}: {...message.value,coverLetter:job.plan.coverLetter,trackedId:job.plan.trackedId,sourceUrl:job.plan.sourceUrl};
    await updateApplicationJob(job.plan,{[field]:value});return {ok:true};
  }
  if(message.operation==='remove'){await updateApplicationJob(job.plan,{[field]:null});return {ok:true};}
  throw Error('invalid-application-storage-operation');
}
async function executeApplicationJob(job) {
  // Another pump may have completed the persisted job since this snapshot was read.
  job=await applicationJob(job.plan);
  if(!job||!['queued','running','waiting'].includes(job.state))return;
  const {plan,api}=job;
  try {
    if(job.result?.result?.submitted&&job.result.result.status==='confirmed'&&job.result.result.coverLetterFilled) {
      await browserAutopilotComplete(api,plan,job.result.result,job.tabId);
      await dashboardApplyNotify(plan,{completed:true,message:`Отклик и письмо отправлены: ${plan.jobTitle}.`});return;
    }
    if(job.state!=='queued') {
      let tab;try {tab=job.tabId?await chrome.tabs.get(job.tabId):null;}catch{}
      if(!tab || Number(plan.expiresAt)<=Date.now())throw Error('Вкладка закрыта или срок задания истёк. Проверьте результат на HH.');
      // A reused Chrome tab id must never receive a plan belonging to another job.
      const host=new URL(tab.url||plan.sourceUrl).hostname;
      if(!/(^|\.)hh\.ru$/i.test(host) || (/\/vacancy\/\d+/.test(new URL(tab.url||plan.sourceUrl).pathname)&&!sameApplication(plan,{sourceUrl:tab.url})))throw Error('Вкладка перешла на другой сайт. Проверьте предыдущий отклик.');
    }
    if(job.state==='queued') {
      if(plan.automatic) {
        const status=await browserAutopilotJson(`${api}/api/automation/status`);
        if(!self.vjaBrowserAutopilot.shouldRun(status)){await updateApplicationJob(plan,{state:'paused'});return;}
      }
      // Bind an empty tab before navigating, so document_idle cannot read another job.
      plan.expiresAt=Date.now()+10*60*1000;
      await updateApplicationJob(plan,{plan,pending:plan});
      const tab=await chrome.tabs.create({url:'about:blank',active:false});
      if(!tab?.id)throw Error('Не удалось создать вкладку HH.');
      job=await updateApplicationJob(plan,{tabId:tab.id,state:'running'});
      await chrome.tabs.update(tab.id,{url:plan.sourceUrl,active:false});
    } else await updateApplicationJob(plan,{state:'running'});
    await dashboardApplyNotify(plan,{retry:true,message:`Отправляю резюме и письмо: ${plan.jobTitle}. Другие отклики можно запускать одновременно.`});
    const outcome=await browserAutopilotProcess(api,plan,job.tabId);
    if(outcome.retry)await updateApplicationJob(plan,{state:'waiting'});
    await dashboardApplyNotify(plan,outcome);
  } catch(error) {
    const latest=await applicationJob(plan);
    const reason=`Отклик «${plan.jobTitle}»: ${error?.message||error}. Остальные вакансии продолжают обрабатываться.`;
    if(!latest?.dispatchedAt && !latest?.result) {
      await updateApplicationJob(plan,{state:'failed',pending:null,message:reason});
      await dashboardApplyNotify(plan,{message:reason+' Отправка ещё не начиналась; можно повторить.'});
    } else await archiveApplicationReview(api,plan,latest?.result?.result,reason);
  }
}
async function pumpApplicationJobs(api) {
  await migrateApplicationJobs(api);
  const jobs=await applicationJobs();
  const candidates=jobs.filter(j=>['queued','waiting','running'].includes(j.state));
  // Existing receipts/continuations first, then manual requests before unattended jobs.
  candidates.sort((a,b)=>(b.state==='queued')-(a.state==='queued')||Number(a.plan.automatic)-Number(b.plan.automatic)||a.createdAt-b.createdAt);
  const started=[];
  for(const job of candidates) {
    if(applicationWorkers.size>=applicationParallelism)break;
    if(applicationWorkers.has(job.plan.id))continue;
    // Set the reservation synchronously before the first awaited operation.
    const work=Promise.resolve().then(()=>executeApplicationJob(job)).finally(()=>{
      applicationWorkers.delete(job.plan.id);
      void applicationJobs().then(all=>{if(all.some(j=>j.state==='queued'&&!j.plan.automatic))void pumpApplicationJobs(api);}).catch(()=>{});
    });
    applicationWorkers.set(job.plan.id,work);started.push(work);
  }
  await Promise.allSettled(started);
  // Drain queued manual requests immediately when a slot becomes available. Waiting
  // receipt checks resume on heartbeat, not in a tight loop.
  if((await applicationJobs()).some(j=>j.state==='queued'&&!j.plan.automatic)&&applicationWorkers.size<applicationParallelism)
    await pumpApplicationJobs(api);
}
chrome.tabs.onRemoved?.addListener(tabId=>{
  void (async()=>{
    const job=await applicationJobForTab(tabId);
    if(!job||!['running','waiting'].includes(job.state)||applicationWorkers.has(job.plan.id))return;
    await executeApplicationJob(job);
    void pumpApplicationJobs(job.api);
  })().catch(()=>{});
});
