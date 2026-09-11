// Persist each application separately. Only short state mutations are serialized;
// network requests and different vacancy tabs run independently.
const applicationJobPrefix = 'vjaApplicationJob:';
const applicationLocks = new Map();
const applicationClaims = new Set();
let applicationStateTail = Promise.resolve();
function applicationStateChange(action) {
  const next = applicationStateTail.then(action);
  applicationStateTail = next.catch(() => {});
  return next;
}
function applicationJobKey(id) { return applicationJobPrefix + id; }
async function applicationJobs() {
  const stored = await chrome.storage.local.get(null);
  return Object.entries(stored).filter(([key]) => key.startsWith(applicationJobPrefix)).map(([, job]) => job);
}
async function applicationJob(id) {
  return (await chrome.storage.local.get(applicationJobKey(id)))[applicationJobKey(id)];
}
async function updateApplicationJob(id, patch) {
  return applicationStateChange(async () => {
    const job = await applicationJob(id);
    if (!job) return null;
    const next = {...job, ...patch};
    await chrome.storage.local.set({[applicationJobKey(id)]: next});
    return next;
  });
}
function sameApplication(a, b) {
  if (a.trackedId && a.trackedId === b.trackedId) return true;
  const vacancy = url => { try { const u = new URL(url); return /(^|\.)hh\.ru$/.test(u.hostname) ? u.pathname.match(/^\/vacancy\/(\d+)/)?.[1] : u.origin + u.pathname; } catch {return null;} };
  const left = vacancy(a.sourceUrl), right = vacancy(b.sourceUrl);
  return Boolean(left && left === right);
}
async function registerApplication(plan, tabId = null) {
  return applicationStateChange(async () => {
    if ((await applicationJobs()).some(job => sameApplication(job.plan, plan)))
      throw new Error('Отклик на эту вакансию уже выполняется или сохранён. Другие вакансии можно отправлять одновременно.');
    const job = {plan, pending: plan, tabId, dispatched: false};
    await chrome.storage.local.set({[applicationJobKey(plan.id)]: job});
    return job;
  });
}
async function migrateLegacyApplication() {
  await applicationStateChange(async () => {
    const state = await chrome.storage.local.get(applicationStateKeys);
    const plan = state.vjaBrowserAutopilotActivePlan || state.vjaPendingSiteApply;
    if (!plan) return;
    const key = applicationJobKey(plan.id);
    if (!await applicationJob(plan.id)) await chrome.storage.local.set({[key]: {
      plan, pending: state.vjaPendingSiteApply, tabId: state.vjaBrowserAutopilotTabId,
      result: state.vjaSiteApplyResult?.id === plan.id ? state.vjaSiteApplyResult : null,
      // Old versions did not persist dispatch boundaries. Never assume no send.
      dispatched: true
    }});
    await chrome.storage.local.remove(applicationStateKeys);
  });
}
// A content script may only access the application assigned to its top-level tab.
async function applicationTabStorage(message, sender) {
  if (sender.frameId !== 0)
    return {ok:false, error:'invalid-application-tab'};
  return applicationStateChange(async () => {
    const job = (await applicationJobs()).find(item => item.tabId === sender.tab.id);
    if (!job) return {ok:message.operation === 'get', value:undefined, error:'application-not-assigned'};
    let originAllowed=false;
    try {
      const page=new URL(sender.url),source=new URL(job.plan.sourceUrl);
      originAllowed=page.origin===source.origin || (/^(.*\.)?hh\.ru$/.test(page.hostname)&&/^(.*\.)?hh\.ru$/.test(source.hostname));
      const vacancyId=page.pathname.match(/^\/vacancy\/(\d+)/)?.[1] || page.searchParams.get('vacancyId');
      if (/(^|\.)hh\.ru$/.test(page.hostname) && vacancyId && vacancyId !== source.pathname.match(/^\/vacancy\/(\d+)/)?.[1]) originAllowed=false;
    }catch{}
    if(!originAllowed)return {ok:false,error:'application-origin-mismatch'};
    const field = message.key === 'vjaPendingSiteApply' ? 'pending' : 'result';
    if (message.operation === 'get') return {ok:true, value:job[field]};
    if (message.operation === 'set') {
      if (message.value?.id !== job.plan.id) return {ok:false,error:'application-id-mismatch'};
      // A page can update progress, never the selected vacancy, letter or destination.
      job[field] = field === 'pending' ? {...message.value, id:job.plan.id, trackedId:job.plan.trackedId,
        sourceUrl:job.plan.sourceUrl, coverLetter:job.plan.coverLetter} : message.value;
    } else if (message.operation === 'remove') job[field] = null;
    else return {ok:false,error:'storage-operation-not-allowed'};
    await chrome.storage.local.set({[applicationJobKey(job.plan.id)]:job});
    return {ok:true};
  });
}
function applicationPool(limit) {
  let running = 0;
  const queue = [];
  return async action => {
    if (running >= limit) await new Promise(resolve => queue.push(resolve));
    else running++;
    try {return await action();}
    finally {const next = queue.shift(); if (next) next(); else running--;}
  };
}
const manualApplicationPool = applicationPool(3);
const automaticApplicationPool = applicationPool(2);
async function executeApplication(api, plan) {
  if (applicationLocks.has(plan.id)) return applicationLocks.get(plan.id);
  const pool = plan.automatic ? automaticApplicationPool : manualApplicationPool;
  const task = pool(async () => {
    let job = await applicationJob(plan.id);
    if (!job || job.completed || job.review) return;
    try {
      // A persisted receipt needs bookkeeping only, even if its tab is gone.
      if (job.result?.result?.submitted && job.result.result.status === 'confirmed' && job.result.result.coverLetterFilled) {
        await browserAutopilotComplete(api, plan, job.result.result, job.tabId);
        const result = {completed:true,message:`Отклик и письмо отправлены: ${plan.jobTitle}.`};
        await dashboardApplyNotify(plan,result);
        return result;
      }
      if (!job.dispatched) {
        plan = {...job.plan,expiresAt:Date.now()+10*60*1000};
        job = await updateApplicationJob(plan.id,{plan,pending:plan});
      }
      // Reserve a blank tab before navigation so page scripts cannot read another job.
      if (!job.tabId) {
        if (job.dispatched) throw new Error('Вкладка закрыта после начала отправки.');
        const tab = await chrome.tabs.create({url:'about:blank', active:false});
        if (!tab?.id) throw new Error('Не удалось открыть вкладку HH. Повторите отклик.');
        job = await updateApplicationJob(plan.id, {tabId:tab.id});
        await chrome.tabs.update(tab.id, {url:plan.sourceUrl});
      }
      const result = await browserAutopilotProcess(api, plan, job.tabId);
      await dashboardApplyNotify(plan, result);
      return result;
    } catch (error) {
      job = await applicationJob(plan.id);
      if (job?.result?.result?.status === 'confirmed') {
        // Keep the receipt if only the local backend is unavailable; retry bookkeeping.
        await dashboardApplyNotify(plan,{retry:true,message:'Отклик сохранён. Ожидаю подключения программы для записи результата.'});
        return {retry:true};
      }
      if (job && !job.dispatched) {
        await chrome.storage.local.remove(applicationJobKey(plan.id));
        if(job.tabId)try {await chrome.tabs.remove(job.tabId);}catch{}
        await dashboardApplyNotify(plan,{message:'Не удалось открыть страницу. Можно повторить отклик. ' + error.message});
        return {completed:false};
      }
      const message = `Проверьте результат отклика «${plan.jobTitle}» на HH: ${error.message}. Остальные отклики продолжаются.`;
      await archiveApplicationReview(api,plan,job?.result?.result,message);
      return {completed:false,message};
    }
  });
  applicationLocks.set(plan.id,task);
  try {return await task;} finally {applicationLocks.delete(plan.id);}
}

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!['vjaRegisterSiteApply','vjaGetSiteApply'].includes(message?.type))return false;
  if(sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('popup.html')) {respond({ok:false,error:'invalid-popup'});return false;}
  (async()=>{
    const tab=await chrome.tabs.get(message.tabId);
    if(!tab?.id)throw new Error('Вкладка закрыта.');
    await migrateLegacyApplication();
    const existing=(await applicationJobs()).find(job=>job.tabId===tab.id || (message.plan && sameApplication(job.plan,message.plan)));
    if(message.type==='vjaGetSiteApply')return {ok:true,job:existing};
    if(existing) {
      if(existing.tabId!==tab.id || existing.review || existing.completed || (existing.dispatched && !existing.pending?.startClicked && !existing.pending?.finalClicked))
        throw new Error(existing.reason || 'Отклик уже запущен или сохранён. Проверьте его результат.');
      await executeApplication(await browserAutopilotApiBase(),existing.plan);
      return {ok:true,job:await applicationJob(existing.plan.id)};
    }
    if(!sameApplication(message.plan,{sourceUrl:tab.url}))throw new Error('Вкладка изменилась. Откройте выбранную вакансию.');
    const previous=await applicationNeedsReview({vacancyId:message.plan.trackedId,url:message.plan.sourceUrl});
    if(previous)throw new Error(previous.reason);
    const plan={...message.plan,automatic:false,popup:true};
    await registerApplication(plan,tab.id);
    await executeApplication(await browserAutopilotApiBase(),plan);
    return {ok:true,job:await applicationJob(plan.id)};
  })().then(respond).catch(error=>respond({ok:false,error:error.message}));
  return true;
});
