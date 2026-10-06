/* Productization utilities. Pure functions: no network, storage or automatic submission. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaProductCore=api;})(globalThis,function(){
  'use strict';
  const SCHEMA=2, MAX_BYTES=32*1024*1024;
  const transient=/^(?:vjaPending|vjaSiteApplyResult|vjaBrowserAutopilot(?:ActivePlan|TabId)|vjaCopilotFocus:|vjaAutopilotSession|vjaIndexRetryRequired)/;
  const permanent={test:key=>/^(?:vja[A-Z]|cvVault(?:En|Ru)$|applicationMemory$)/.test(key)&&!transient.test(key)};
  const secret=/password|passwd|secret|token|authorization|cookie|api[_-]?key|encryptionkey/i;
  const forbidden=new Set(['__proto__','constructor','prototype']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  function assertTree(value,depth=0){
    if(depth>30)throw new Error('Слишком глубокая структура файла.');
    if(value===null||typeof value==='string'||typeof value==='boolean'||finite(value))return;
    if(Array.isArray(value)){if(value.length>100000)throw new Error('Слишком большой массив.');value.forEach(v=>assertTree(v,depth+1));return;}
    if(!obj(value))throw new Error('Допустимы только JSON-данные.');
    for(const [k,v] of Object.entries(value)){if(forbidden.has(k))throw new Error('Недопустимый ключ данных.');assertTree(v,depth+1);}
  }
  function scrub(value){
    if(Array.isArray(value))return value.map(scrub);
    if(obj(value)){const out={};for(const [k,v] of Object.entries(value))if(!secret.test(k)&&!forbidden.has(k))out[k]=scrub(v);return out;}
    return value;
  }
  function snapshot(storage={}, {includeCV=true, includeProfile=true, sync={}, now=Date.now()}={}){
    assertTree(storage);const local={},excluded=[];
    for(const [k,v] of Object.entries(storage)){
      if(!permanent.test(k)||(!includeCV&&/^cvVault/.test(k))||(!includeProfile&&/^(vjaCandidateTruthProfile|vjaProfileBefore380|applicationMemory)$/.test(k))){excluded.push(k);continue;}
      local[k]=scrub(v);
    }
    const out={format:'violetta-backup',schemaVersion:SCHEMA,createdAt:now,local,sync:scrub(sync),excludedKeys:excluded.length};
    if(new TextEncoder().encode(JSON.stringify(out)).length>MAX_BYTES)throw new Error('Резервная копия превышает 32 MiB. Экспортируйте CV отдельно.');
    return out;
  }
  function validateBackup(payload){
    assertTree(payload);
    if(payload?.format!=='violetta-backup'||![1,SCHEMA].includes(payload.schemaVersion)||!obj(payload.local))throw new Error('Неизвестный формат или версия backup.');
    if(new TextEncoder().encode(JSON.stringify(payload)).length>MAX_BYTES)throw new Error('Backup превышает 32 MiB.');
    for(const k of Object.keys(payload.local))if(!permanent.test(k))throw new Error('Неподдерживаемый ключ backup: '+k);
    if(payload.sync!==undefined&&!obj(payload.sync))throw new Error('Invalid sync settings.');
    return payload;
  }
  function restorePlan(payload,current={}){
    validateBackup(payload);const patch=scrub(clone(payload.local)),conflicts=[],added=[];
    for(const [key,val] of Object.entries(patch)){
      if(key in current&&JSON.stringify(current[key])!==JSON.stringify(val))conflicts.push(key);else if(!(key in current))added.push(key);
      // A restored snapshot must never revive a tab, a pending send or an automatic application.
      if(key.startsWith('vjaApplicationJob:')){val.review=true;val.tabId=null;delete val.frameId;delete val.running;delete val.lease;delete val.claim;if(val.plan){val.plan.automatic=false;delete val.plan.tabId;}val.restoredAt=Date.now();}
    }
    if(patch.vjaModelRegistryV1){const r=patch.vjaModelRegistryV1;r.activeModel=null;r.activeModels={preference:null,engagement:null};r.models=(r.models||[]).map(x=>({...x,status:'candidate'}));}
    patch.vjaFeatureFlagsV1={...(current.vjaFeatureFlagsV1||{}),...(patch.vjaFeatureFlagsV1||{}),mlRanking:false};
    patch.vjaCopilotSettings={...(current.vjaCopilotSettings||{}),...(patch.vjaCopilotSettings||{}),aiConsent:false,discoveryEnabled:false};
    patch.vjaProductSettingsV1={...(current.vjaProductSettingsV1||{}),...(patch.vjaProductSettingsV1||{}),shadowModel:null};
    patch.vjaAutomationPolicyV1={...(patch.vjaAutomationPolicyV1||{}),mode:'assist',paused:true,explicitOptIn:false};
    const syncPatch=scrub(clone(payload.sync||{}));
    // Restoring a backup never enables a remote backend destination implicitly.
    if(syncPatch.apiBase&&!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(syncPatch.apiBase))delete syncPatch.apiBase;
    syncPatch.vjaHhBrowserSearch=false;
    return {patch,syncPatch,conflicts,added,keyCount:Object.keys(patch).length};
  }
  function identity(x={}){return `${String(x.provider||'hh').toLowerCase()}:${x.vacancyId||x.eventId||''}`;}
  function datasetQuality(rows=[],label='labelUserApply'){
    const labels={0:0,1:0},ids=new Set();let invalid=0,duplicates=0,missing=0;const times=[];
    for(const r of rows){if(!r||![0,1].includes(r[label])){invalid++;continue;}labels[r[label]]++;const k=identity(r);if(ids.has(k))duplicates++;ids.add(k);if(!r.role&&!(r.technologies||[]).length)missing++;if(finite(r.timestamp)&&r.timestamp>0)times.push(r.timestamp);}
    const n=labels[0]+labels[1],issues=[];
    if(n<100)issues.push('Менее 100 размеченных вакансий');if(Math.min(labels[0],labels[1])<10)issues.push('Нужно не менее 10 примеров каждого класса');
    if(duplicates)issues.push('Повторяющиеся вакансии');if(invalid)issues.push('Неверные labels');if(n&&missing/n>.25)issues.push('Много строк без признаков');if(!times.length&&n)issues.push('Нет временных меток');
    return {trainingStatus:issues.length?'NOT READY':n<500?'EXPERIMENTAL':'READY',n,labels,unique:ids.size,duplicates,invalid,missing,issues,ready:!issues.length,minTime:times.length?Math.min(...times):null,maxTime:times.length?Math.max(...times):null};
  }
  function summarize(storage={}){
    const intel=[],jobs=[],events=Array.isArray(storage.vjaLearningEventsV1)?storage.vjaLearningEventsV1:[];
    for(const [k,v] of Object.entries(storage)){if(k.startsWith('vjaVacancyIntel:')&&obj(v))intel.push(v);if(k.startsWith('vjaApplicationJob:')&&obj(v))jobs.push(v);}
    const timeline=[];for(const j of jobs){const c=j.context||{},v=c.vacancy||{};for(const e of c.timeline||[])timeline.push({...e,applicationId:j.plan?.id||'',title:v.title||j.plan?.title||'',company:v.company||'',at:Number(e.at||e.timestamp)||0});}
    timeline.sort((a,b)=>b.at-a.at);
    const prefs=storage.vjaJobPreferencesV1||{},decisions=storage;
    const ready=intel.filter(r=>r.fit?.ready&&r.fit?.score>=(prefs.minimumFitScore||80)&&r.analysis?.status==='no-calls'&&decisions['vjaVacancyDecision:'+r.vacancy?.vacancyId]?.decision!=='SKIPPED'&&!jobs.some(j=>String(j.context?.vacancy?.vacancyId)===String(r.vacancy?.vacancyId)&&(j.completed||['Applied','Viewed','Offer','Rejected','Closed'].includes(j.context?.status))));
    return {intel,jobs,events,timeline,ready,calls:intel.filter(x=>x.analysis?.status==='calls').length,noCalls:intel.filter(x=>x.analysis?.status==='no-calls').length,unknown:intel.filter(x=>!['calls','no-calls'].includes(x.analysis?.status)).length};
  }
  function weekly(storage={},now=Date.now()){
    const x=summarize(storage),start=now-7*86400000,inWindow=t=>Number(t)>=start&&Number(t)<=now;
    const events=x.events.filter(e=>inWindow(e.timestamp)),unique=type=>new Set(events.filter(e=>e.type===type).map(identity)).size;
    return {start,end:now,analyzed:x.intel.filter(r=>inWindow(r.at)).length,applied:unique('VACANCY_APPLIED'),saved:unique('VACANCY_SAVED'),skipped:unique('VACANCY_SKIPPED'),corrections:events.filter(e=>e.type==='QUESTIONNAIRE_EDITED').length,outcomes:events.filter(e=>e.type==='OUTCOME_CHANGED').length,events:events.length};
  }
  function diagnostics(storage={},manifest={},environment={}){
    const x=summarize(storage);return {format:'violetta-diagnostics',schemaVersion:SCHEMA,version:manifest.version||'',versionName:manifest.version_name||'',generatedAt:new Date().toISOString(),counts:{vacancies:x.intel.length,applications:x.jobs.length,learningEvents:x.events.length,models:(storage.vjaModelRegistryV1?.models||[]).length},permissions:{hhApi:(manifest.host_permissions||[]).includes('https://api.hh.ru/*')},environment:{indexedDB:environment.indexedDB===true,webCrypto:environment.webCrypto===true},privacy:'No CV, profile text, questions, email, job titles, URLs or tokens in this report.'};
  }
  function compareModels(reg={}){return (reg.models||[]).map(e=>{const m=e.testMetrics||e.model?.testMetrics||e.validation||{};return {version:String(e.modelVersion||''),kind:e.kind||'',status:e.status||'candidate',real:e.trainedOnRealLabels===true,n:Number(m.n)||0,f1:finite(m.f1)?m.f1:null,brier:finite(m.brier)?m.brier:null,active:Object.values(reg.activeModels||{}).includes(e.modelVersion)};});}
  return {SCHEMA,MAX_BYTES,assertTree,scrub,snapshot,validateBackup,restorePlan,identity,datasetQuality,summarize,weekly,diagnostics,compareModels};
});
