/* Source-compatible reliability additions for the existing worker. */
'use strict';
let vjaIndexQueue=Promise.resolve();
async function vjaRebuildIndex(force=false){
  if(!globalThis.indexedDB)return {available:false};
  const run=vjaIndexQueue.then(async()=>{
    const retry=(await chrome.storage.local.get('vjaIndexRetryRequired')).vjaIndexRetryRequired;
    if(!force&&!retry&&await vjaProductStore.meta('legacyIndexedV3'))return {available:true};
    try{
      await vjaProductStore.mirror(await chrome.storage.local.get(null));
      await vjaProductStore.meta('legacyIndexedV3',{at:Date.now()});
      await chrome.storage.local.remove('vjaIndexRetryRequired');return {available:true};
    }catch(e){await chrome.storage.local.set({vjaIndexRetryRequired:true});throw e;}
  });vjaIndexQueue=run.catch(()=>{});return run;
}
function vjaScheduleIndex(items){
  if(!globalThis.indexedDB)return Promise.resolve();
  const next=vjaIndexQueue.then(async()=>{try{await vjaProductStore.mirror(items);}catch{await chrome.storage.local.set({vjaIndexRetryRequired:true});await vjaStructuredLog.write({level:'WARN',module:'index',code:'INDEX_WRITE_DEFERRED'});}});
  vjaIndexQueue=next.catch(()=>{});return next;
}
chrome.storage?.onChanged?.addListener((changes,area)=>{if(area!=='local')return;const items={};for(const [k,v] of Object.entries(changes))if(/^(vjaVacancyIntel:|vjaApplicationJob:|vjaVacancyDecision:|vjaConversation:)/.test(k))items[k]=v.newValue;if(Object.keys(items).length)void vjaScheduleIndex(items);});
async function vjaPolicy(){return vjaAutomationPolicy.normalize((await chrome.storage.local.get(vjaAutomationPolicy.KEY))[vjaAutomationPolicy.KEY]||{});}
async function vjaAdminMessage(message,sender){
  if(!cpExtensionSender(sender))throw new Error('Extension page required.');
  if(message.op==='os-queue-decision'){
    if(!['SAVED','SKIPPED'].includes(message.decision))throw Error('Invalid decision.');
    const id=String(message.vacancyId||'');if(!id||id.length>100)throw Error('Invalid vacancy.');
    const key='vjaVacancyIntel:'+id,record=(await chrome.storage.local.get(key))[key];if(!record?.vacancy||String(record.vacancy.vacancyId)!==id)throw Error('Vacancy not found.');
    await chrome.storage.local.set({['vjaVacancyDecision:'+id]:{vacancyId:id,decision:message.decision,at:Date.now(),source:'control-center'}});
    await cpRecordLearningEvent({type:message.decision==='SAVED'?'VACANCY_SAVED':'VACANCY_SKIPPED',vacancy:record.vacancy,userAction:message.decision,source:'control-center',meta:{features:record.features||record.fit?.features||{},fitScore:record.fit?.score}});return {ok:true};
  }
  if(message.op==='os-profile-import'){
    const current=await chrome.storage.local.get(null);const patch=vjaPrivateProfile.plan(message.data,current,{confirmed:message.confirmed,replaceCV:message.replaceCV});
    return applicationStateChange(async()=>{
      try{await chrome.storage.local.set(patch);const read=await chrome.storage.local.get(Object.keys(patch));for(const k of Object.keys(patch))if(JSON.stringify(read[k])!==JSON.stringify(patch[k]))throw new Error('Verification failed.');cpInit=null;await cpInitialize();return {ok:true,facts:patch.vjaCandidateTruthProfile.facts.length};}
      catch(e){const previous={};for(const k of Object.keys(patch))if(k in current)previous[k]=current[k];await chrome.storage.local.set(previous);await chrome.storage.local.remove(Object.keys(patch).filter(k=>!(k in current)));throw e;}
    });
  }
  if(message.op==='os-policy-save'){
    const p=vjaAutomationPolicy.normalize(message.policy||{});
    if(p.mode==='autopilot'&&(!p.explicitOptIn||!p.approvedCategories.length))throw new Error('Подтвердите Autopilot и выберите категории.');
    await chrome.storage.local.set({[vjaAutomationPolicy.KEY]:p});return {ok:true,policy:p};
  }
  if(message.op==='os-index-query'){await vjaRebuildIndex();await vjaIndexQueue;return {ok:true,...await vjaProductStore.query(message.query||{})};}
  if(message.op==='os-index-rebuild'){await vjaRebuildIndex(true);return {ok:true,...await vjaProductStore.stats()};}
  if(message.op==='os-diagnostics'){
    let idb={available:false};try{await vjaRebuildIndex();idb={available:true,...await vjaProductStore.stats()};}catch{}
    const data=await chrome.storage.local.get(['vjaLastMigration','vjaIndexRetryRequired',vjaAutomationPolicy.KEY,'vjaModelRegistryV1']);
    let permissions=null;try{if(chrome.permissions?.getAll)permissions=await chrome.permissions.getAll();}catch{}
    return {ok:true,diagnostics:{version:chrome.runtime.getManifest().version_name,indexedDB:idb,lastMigration:data.vjaLastMigration||null,indexRetryRequired:!!data.vjaIndexRetryRequired,automationMode:(data[vjaAutomationPolicy.KEY]||{}).mode||'assist',activeModel:!!data.vjaModelRegistryV1?.activeModels?.preference,permissions:permissions?{hh:permissions.origins?.some(x=>x==='https://hh.ru/*'),habr:permissions.origins?.includes('https://career.habr.com/*')}:null,hhLiveAccess:'NOT_LIVE_VALIDATED',backgroundReader:'NOT_LIVE_VALIDATED',logs:await vjaStructuredLog.list()}};
  }
  throw new Error('Unknown OS operation.');
}
chrome.runtime.onMessage.addListener((m,s,r)=>{if(m?.type!=='vjaOS')return false;vjaAdminMessage(m,s).then(r).catch(()=>r({ok:false,error:'Операция недоступна. Проверьте диагностику.'}));return true;});
void vjaRebuildIndex().catch(()=>vjaStructuredLog.write({level:'WARN',module:'index',code:'INDEX_INIT_DEFERRED'}).catch(()=>{}));
chrome.runtime.onMessage.addListener((m,s,r)=>{
  if(m?.type!=='vjaSubmitAuthorization')return false;
  (async()=>{
    cpAssertPage(s,s.url);
    const jobs=await applicationJobs();const job=jobs.find(j=>j.tabId===s.tab.id&&(!m.planId||j.plan?.id===m.planId)&&(!m.vacancyId||String(j.context?.vacancy?.vacancyId||j.plan?.vacancyId||j.plan?.trackedId)===String(m.vacancyId)));
    if(!job)return {allowed:false,reason:'application-context-missing'};
    const v=job.context?.vacancy||{},intelKey='vjaVacancyIntel:'+(v.vacancyId||job.plan?.vacancyId||job.plan?.trackedId||'');
    const intel=(await chrome.storage.local.get(intelKey))[intelKey];
    const today=new Date().setHours(0,0,0,0),appliedToday=jobs.filter(j=>j.completed&&Number(j.context?.coverLetterMemory?.submittedAt||j.context?.updatedAt)>=today).length;
    const risk=vjaAutomationPolicy.pageRisks({url:s.url,text:'',knownOrigins:['https://hh.ru','https://career.habr.com'],knownHostSuffixes:['hh.ru','headhunter.kg','career.habr.com']});
    for(const key of ['captcha','legal','unknownRequiredFact','payment','identityVerification','unexpectedUpload','unresolvedReview'])risk[key]=risk[key]===true||m.risks?.[key]===true;
    const decision=vjaAutomationPolicy.decide(await vjaPolicy(),{...risk,action:'submit',userInitiated:m.userInitiated===true,intent:String(m.intent||''),category:job.context?.role||job.plan?.roleVariant,confidence:Number(intel?.fit?.score||0)/100,appliedToday});
    if(!decision.allowed)await vjaStructuredLog.write({level:'INFO',module:'submission',code:'FINAL_ACTION_REVIEW',vacancyId:v.vacancyId});
    return decision;
  })().then(r).catch(()=>r({allowed:false,reason:'authorization-failed'}));return true;
});
