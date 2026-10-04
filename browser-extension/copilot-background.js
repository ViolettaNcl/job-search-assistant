/* Extends the existing service worker and application-job store; no second backend. */
'use strict';
const cpCore=globalThis.vjaCopilotCore;
const cpFollow=globalThis.vjaFollowUpIntelligence;
const cpAnalytics=globalThis.vjaApplicationAnalytics;
const cpState=globalThis.vjaApplicationState;
const cpHhList=globalThis.vjaHhListQuickApply;
const cpFit=globalThis.vjaVacancyFit;
const cpLearning=globalThis.vjaLearningCore;
const cpModelRuntime=globalThis.vjaModelRuntime;
const cpModelMonitor=globalThis.vjaModelMonitor;
const cpDuplicate=globalThis.vjaDuplicateDetector;
const cpRecruiterIntel=globalThis.vjaRecruiterIntelligence;
const cpOutcome2=globalThis.vjaOutcomeAnalyticsV2;
const cpKey='vjaCandidateTruthProfile';
let cpInit=null;
const cpAiRequests=new Map();
const cpVacancyIntelInFlight=new Map();
const cpPreferencesKey='vjaJobPreferencesV1';
const cpLearningEventsKey='vjaLearningEventsV1';
const cpLearningSettingsKey='vjaLearningSettingsV1';
const cpModelRegistryKey='vjaModelRegistryV1';
const cpFeatureFlagsKey='vjaFeatureFlagsV1';
async function cpInitialize(){
  if(cpInit)return cpInit;
  cpInit=(async()=>{
    const stored=await chrome.storage.local.get([cpKey,'applicationMemory','vjaCopilotSettings','vjaPersonalReplies']);
    await globalThis.vjaBundledCv?.ensure?.().catch(()=>null);
    const base=stored[cpKey]||{};
    const migrated=globalThis.vjaCandidateTruth.migrate(base,globalThis.vjaCandidateSeed);
    if(migrated.changed){
      const p=cpCore.profile(migrated.profile);p.contacts.phone=stored.applicationMemory?.phone||p.contacts.phone;
      await chrome.storage.local.set({[cpKey]:p,...(stored[cpKey]?{'vjaProfileBefore380':stored[cpKey]}:{})});
    }
    const defaultReply={
      id:'default-feedback-ru',
      label:'Спасибо, буду ждать',
      language:'ru',
      text:'Здравствуйте! Спасибо за ответ. Буду ждать обратной связи.\n\nЕсли будет возможность, пожалуйста, напишите мне здесь в чате, в Telegram @Violet111 или на почту violettanicolaou@gmail.com. По обычному телефонному звонку могу не успеть ответить.'
    };
    const existing=Array.isArray(stored.vjaPersonalReplies)?stored.vjaPersonalReplies:[];
    const withoutSystemDefault=existing.filter(r=>r?.id!==defaultReply.id);
    if(!existing.some(r=>r?.id===defaultReply.id&&r?.text)){
      await chrome.storage.local.set({vjaPersonalReplies:[defaultReply,...withoutSystemDefault].slice(0,30)});
    }
    if(!stored.vjaCopilotSettings)await chrome.storage.local.set({vjaCopilotSettings:{aiConsent:false,debug:false,historyLimit:24,discoveryEnabled:false,floatingApplyMode:'auto',alwaysCoverLetter:true,compactApplyStatus:true,quickListCoverLetter:true}});
    const foundation=await chrome.storage.local.get([cpLearningEventsKey,cpLearningSettingsKey,cpModelRegistryKey,cpFeatureFlagsKey]);
    const initPatch={};
    if(!Array.isArray(foundation[cpLearningEventsKey]))initPatch[cpLearningEventsKey]=[];
    if(!foundation[cpLearningSettingsKey])initPatch[cpLearningSettingsKey]={enabled:true,explicitFeedback:true,implicitFeedback:true,maxEvents:5000,activeLearning:true};
    if(!foundation[cpModelRegistryKey])initPatch[cpModelRegistryKey]={schemaVersion:2,activeModel:null,activeModels:{preference:null,engagement:null},models:[],updatedAt:Date.now()};
    if(!foundation[cpFeatureFlagsKey])initPatch[cpFeatureFlagsKey]={batchAnalysis:true,personalRanking:true,learningEngine:true,outcomeLearning:true,recruiterCopilot:true,multiSite:true,mlRanking:false,modelMonitoring:true,preSubmitDiff:true,semanticQuestionMemory:true};
    if(Object.keys(initPatch).length)await chrome.storage.local.set(initPatch);
    else {const next={...stored.vjaCopilotSettings,historyLimit:Number(stored.vjaCopilotSettings.historyLimit)===8?24:(stored.vjaCopilotSettings.historyLimit||24),floatingApplyMode:'auto',alwaysCoverLetter:true,compactApplyStatus:true,quickListCoverLetter:stored.vjaCopilotSettings.quickListCoverLetter!==false};if(JSON.stringify(next)!==JSON.stringify(stored.vjaCopilotSettings))await chrome.storage.local.set({vjaCopilotSettings:next});}
  })().catch(e=>{cpInit=null;throw e;});return cpInit;
}
async function cpData(){
  await cpInitialize();const data=await chrome.storage.local.get([cpKey,'vjaPersonalReplies','vjaCopilotSettings','applicationMemory']);
  const p=cpCore.profile(data[cpKey]);
  // The existing phone editor remains the single authoritative phone memory.
  if(data.applicationMemory && Object.hasOwn(data.applicationMemory,'phone'))p.contacts.phone=data.applicationMemory.phone||'';
  return {profile:p,personalReplies:data.vjaPersonalReplies||[],settings:data.vjaCopilotSettings||{}};
}
function cpExtensionSender(sender){return String(sender.url||'').startsWith(chrome.runtime.getURL(''));}
function cpAssertPage(sender, url){
  if(!sender.tab?.id||!/^https?:\/\//i.test(sender.url||''))throw new Error('Откройте вакансию или переписку на разрешённом сайте.');
  if(url && cpCore.canonicalUrl(url)!==cpCore.canonicalUrl(sender.url))throw new Error('Контекст страницы изменился. Обновите его.');
}
function cpAssertChatPage(sender,snapshot={}){
  if(!sender.tab?.id||!/^https?:\/\//i.test(sender.url||''))throw new Error('Откройте переписку с работодателем.');
  let current,seen;try{current=new URL(sender.url);seen=new URL(snapshot.url||sender.url);}catch{throw new Error('Не удалось определить текущий чат.');}
  const currentProvider=cpCore.provider(current.href),seenProvider=snapshot.provider||cpCore.provider(seen.href);
  const sameProvider=currentProvider===seenProvider;
  const sameOrigin=current.origin===seen.origin;
  // HH and several ATS change chat query/hash routes while the same conversation is open.
  // A content script message already comes from the active tab/frame, so keep the
  // conversation identity strict but do not reject harmless SPA URL churn.
  if(!sameOrigin&&!sameProvider)throw new Error('Открыт другой сайт переписки.');
  if(snapshot.conversationId&&snapshot.provider&&snapshot.provider!==currentProvider)throw new Error('Открыт другой чат.');
}
function cpAssertEmbeddedVacancy(sender,vInput={}){
  if(!sender.tab?.id||!/^https?:\/\//i.test(sender.url||''))throw new Error('Откройте список вакансий на разрешённом сайте.');
  const v=cpCore.vacancy(vInput);let page,target;try{page=new URL(sender.url);target=new URL(v.url);}catch{throw new Error('Не удалось определить вакансию из списка.');}
  const pageProvider=cpCore.provider(page.href),targetProvider=cpCore.provider(target.href);
  if(pageProvider!==targetProvider)throw new Error('Вакансия относится к другому сайту.');
  if(pageProvider==='hh'){
    const hhHost=h=>/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(h);
    if(!hhHost(page.hostname)||!hhHost(target.hostname)||!v.vacancyId)throw new Error('Не удалось подтвердить HeadHunter-вакансию из списка.');
    if(cpCore.suspiciousVacancyTitle?.(v.title))throw new Error('Выбранная карточка не содержит название конкретной вакансии.');
    return;
  }
  if(page.origin!==target.origin)throw new Error('Вакансия относится к другой странице.');
}
function cpHhApiText(data={}){
  const skillText=(Array.isArray(data.key_skills)?data.key_skills:[]).map(x=>x?.name||'').filter(Boolean).join('. ');
  const meta=[data.schedule?.name,data.employment?.name,data.experience?.name].filter(Boolean).join('. ');
  return cpCore.clip(cpHhList?.htmlToText?.([data.name||'',data.description||'',data.branded_description||'',skillText,meta].filter(Boolean).join('\n'))||'',60000);
}
async function cpFetchHhVacancy(vInput,timeoutMs=4200){
  const v=cpCore.vacancy(vInput),apiUrl=cpHhList?.hhApiVacancyUrl?.(v.url,v.vacancyId);if(!apiUrl)throw new Error('Не удалось построить HH API-запрос для этой вакансии.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1200,Number(timeoutMs)||4200));
  try{
    const response=await fetch(apiUrl,{method:'GET',headers:{'Accept':'application/json','HH-User-Agent':'ViolettaApplyAssistant/5.2.0 (github.com/ViolettaNcl/job-search-assistant)'},signal:controller.signal,credentials:'omit',cache:'no-store'});
    if(!response?.ok)throw new Error(`HH API: ${response?.status||'error'}`);
    const data=await response.json(),id=String(data?.id||'');if(!id||id!==String(v.vacancyId))throw new Error('HH API вернул другую вакансию.');
    const title=cpCore.clip(data?.name||v.title,300);if(cpCore.suspiciousVacancyTitle?.(title))throw new Error('HH API не подтвердил название вакансии.');
    const description=cpHhApiText(data);if(!description)throw new Error('HH API не вернул полное описание вакансии.');
    return cpCore.vacancy({...v,title,company:cpCore.clip(data?.employer?.name||v.company,300),description,descriptionCoverage:'full-fetch',requirements:cpCore.clip((Array.isArray(data?.key_skills)?data.key_skills:[]).map(x=>x?.name||'').filter(Boolean).join(', '),5000),remote:Boolean(v.remote||/удален|remote/i.test([data?.schedule?.name,data?.work_format?.map?.(x=>x?.name).join(' ')].filter(Boolean).join(' ')))});
  }finally{clearTimeout(timer);}
}
async function cpAcquireHhVacancy(vInput,sender,{fast=false}={}){
  const selected=cpCore.vacancy(vInput);
  if(selected.provider!=='hh')return {vacancy:await cpReadVacancy(selected.url,sender,{fast}),source:'live-dom'};
  const apiTimeout=fast?6500:8500;
  const liveTask=cpReadVacancy(selected.url,sender,{fast}).then(vacancy=>({vacancy,source:'hh-live-dom'}));
  const apiTask=cpFetchHhVacancy(selected,apiTimeout).then(vacancy=>({vacancy,source:'hh-api'}));
  try{
    const result=await Promise.any([apiTask,liveTask]);
    if(!cpCore.sameVacancy(selected,result.vacancy))throw new Error('Получено описание другой вакансии.');
    return result;
  }catch(error){
    const messages=Array.isArray(error?.errors)?error.errors.map(x=>x?.message||String(x)).filter(Boolean):[error?.message||String(error)];
    throw new Error('Не удалось прочитать полную HH-вакансию: '+messages.join(' | '));
  }
}
function cpAssertHhListSender(sender){
  if(!sender.tab?.id||!/^https?:\/\//i.test(sender.url||''))throw new Error('Откройте список вакансий HeadHunter.');
  let u;try{u=new URL(sender.url);}catch{throw new Error('Не удалось определить страницу вакансий.');}
  if(!/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(u.hostname))throw new Error('Batch Analysis доступен на HeadHunter.');
}

async function cpLearningEvents(){
  const x=(await chrome.storage.local.get(cpLearningEventsKey))[cpLearningEventsKey];return Array.isArray(x)?x:[];
}
async function cpLearningSettings(){
  const x=(await chrome.storage.local.get(cpLearningSettingsKey))[cpLearningSettingsKey]||{};return {enabled:x.enabled!==false,explicitFeedback:x.explicitFeedback!==false,implicitFeedback:x.implicitFeedback!==false,maxEvents:Math.max(200,Math.min(10000,Number(x.maxEvents)||5000)),activeLearning:x.activeLearning!==false};
}
async function cpRecordLearningEvent(input){
  if(!cpLearning?.event)return null;const settings=await cpLearningSettings();if(!settings.enabled)return null;
  let e;try{e=cpLearning.event(input);}catch{return null;}const events=await cpLearningEvents();events.push(e);if(events.length>settings.maxEvents)events.splice(0,events.length-settings.maxEvents);await chrome.storage.local.set({[cpLearningEventsKey]:events});return e;
}
async function cpLearningSignals(){return cpLearning?.deriveSignals?.(await cpLearningEvents())||{total:0};}
async function cpModelRegistry(){
  const raw=(await chrome.storage.local.get(cpModelRegistryKey))[cpModelRegistryKey]||{};
  const reg={schemaVersion:2,activeModel:raw.activeModel||raw.activeModels?.preference||null,activeModels:{preference:raw.activeModels?.preference||raw.activeModel||null,engagement:raw.activeModels?.engagement||null},models:Array.isArray(raw.models)?raw.models:[],updatedAt:Number(raw.updatedAt)||Date.now()};
  if(JSON.stringify(raw)!==JSON.stringify(reg))await chrome.storage.local.set({[cpModelRegistryKey]:reg});return reg;
}
function cpModelKind(modelType=''){return modelType==='employer-engagement-logreg'?'engagement':'preference';}
async function cpActiveModel(kind='preference'){const reg=await cpModelRegistry(),version=reg.activeModels?.[kind]||(kind==='preference'?reg.activeModel:null),entry=reg.models.find(x=>x?.modelVersion===version);return entry?.model||null;}
async function cpImportModel(model){
  const checked=cpModelRuntime?.validate?.(model,{requireReal:false});if(!checked)throw new Error('Model runtime unavailable.');
  const reg=await cpModelRegistry(),kind=cpModelKind(checked.modelType),evaluation=checked.testMetrics||checked.validation||{},entry={modelVersion:String(checked.modelVersion||`model-${Date.now()}`),modelType:checked.modelType,kind,trainingLabels:Number(checked.trainingLabels||0),trainedOnRealLabels:checked.trainedOnRealLabels===true,validation:evaluation,testMetrics:checked.testMetrics||null,threshold:Number(checked.threshold??.5),calibration:checked.calibration||null,status:'candidate',importedAt:Date.now(),model:checked};
  reg.models=reg.models.filter(x=>x?.modelVersion!==entry.modelVersion).concat(entry).slice(-20);reg.updatedAt=Date.now();await chrome.storage.local.set({[cpModelRegistryKey]:reg});return {entry,registry:reg};
}
async function cpPromoteModel(version){
  const reg=await cpModelRegistry(),cand=reg.models.find(x=>x?.modelVersion===String(version||''));if(!cand)throw new Error('Candidate model not found.');if(cand.trainedOnRealLabels!==true)throw new Error('Promotion rejected: model is not trained on real labels.');
  const n=Number(cand.validation?.n||0),f1=Number(cand.validation?.f1||0);if(n<20||f1<.55)throw new Error(`Promotion rejected: validation n=${n}, f1=${f1.toFixed(3)}.`);
  const kind=cand.kind||cpModelKind(cand.modelType),activeVersion=reg.activeModels?.[kind],active=reg.models.find(x=>x?.modelVersion===activeVersion);if(active&&f1+1e-9<Number(active.validation?.f1||0))throw new Error('Promotion rejected: F1 regressed vs active model.');
  for(const x of reg.models){if((x.kind||cpModelKind(x.modelType))===kind&&x.status==='active')x.status='superseded';}cand.status='active';reg.activeModels[kind]=cand.modelVersion;if(kind==='preference')reg.activeModel=cand.modelVersion;reg.updatedAt=Date.now();
  const patch={[cpModelRegistryKey]:reg};if(kind==='preference'){const flags=(await chrome.storage.local.get(cpFeatureFlagsKey))[cpFeatureFlagsKey]||{};patch[cpFeatureFlagsKey]={...flags,mlRanking:true};}await chrome.storage.local.set(patch);return reg;
}
async function cpDisableModel(kind='preference'){
  const reg=await cpModelRegistry(),version=reg.activeModels?.[kind];const entry=reg.models.find(x=>x?.modelVersion===version);if(entry)entry.status='disabled';reg.activeModels[kind]=null;if(kind==='preference')reg.activeModel=null;reg.updatedAt=Date.now();const patch={[cpModelRegistryKey]:reg};if(kind==='preference'){const flags=(await chrome.storage.local.get(cpFeatureFlagsKey))[cpFeatureFlagsKey]||{};patch[cpFeatureFlagsKey]={...flags,mlRanking:false};}await chrome.storage.local.set(patch);return reg;
}
async function cpLearningSummary(){
  const events=await cpLearningEvents(),signals=cpLearning?.summary?.(events)||{total:events.length},rows=cpLearning?.datasetRows?.(events)||[],engagementRows=cpLearning?.engagementDatasetRows?.(events)||[],registry=await cpModelRegistry(),activePreference=await cpActiveModel('preference'),activeEngagement=await cpActiveModel('engagement'),monitor=cpModelMonitor?.summarize?.(events,activePreference,'preference')||null,engagementMonitor=cpModelMonitor?.summarize?.(events,activeEngagement,'engagement')||null;
  return {schemaVersion:2,events:events.length,labels:rows.length,engagementLabels:engagementRows.length,signals,registry,monitor,engagementMonitor,experimentalTrainingReady:rows.length>=20,trainingReady:rows.length>=100,engagementTrainingReady:engagementRows.length>=100,minimumRecommendedLabels:100};
}
async function cpLearningExport(){const events=await cpLearningEvents();return {schemaVersion:2,exportedAt:new Date().toISOString(),events,dataset:cpLearning?.datasetRows?.(events)||[],engagementDataset:cpLearning?.engagementDatasetRows?.(events)||[],summary:cpLearning?.summary?.(events)||{},preferences:await cpJobPreferences(),registry:await cpModelRegistry()};}
async function cpLearningImport(payload){
  if(!payload||![1,2].includes(Number(payload.schemaVersion))||!Array.isArray(payload.events))throw new Error('Некорректный learning backup.');const settings=await cpLearningSettings(),events=[];for(const raw of payload.events){try{events.push(cpLearning.event(raw));}catch{}}if(!events.length&&payload.events.length)throw new Error('Learning backup не содержит допустимых событий.');const merged=[...(await cpLearningEvents()),...events];const map=new Map();for(const e of merged)map.set(e.eventId,e);const out=[...map.values()].sort((a,b)=>Number(a.timestamp)-Number(b.timestamp)).slice(-settings.maxEvents);await chrome.storage.local.set({[cpLearningEventsKey]:out});return cpLearningSummary();
}
async function cpLearningReset(){await chrome.storage.local.set({[cpLearningEventsKey]:[],[cpModelRegistryKey]:{schemaVersion:2,activeModel:null,activeModels:{preference:null,engagement:null},models:[],updatedAt:Date.now()}});return cpLearningSummary();}
async function cpFindDuplicate(vacancy){
  if(!cpDuplicate?.bestMatch)return null;const keys=await chrome.storage.local.get(null),records=[];for(const [k,v] of Object.entries(keys))if(k.startsWith('vjaVacancyIntel:')&&v?.vacancy&&String(v.vacancy.vacancyId)!==String(vacancy.vacancyId))records.push(v);const best=cpDuplicate.bestMatch(vacancy,records);return best?.similarity?.repost?{vacancyId:best.vacancy.vacancyId,title:best.vacancy.title,company:best.vacancy.company,similarity:best.similarity}:null;
}
async function cpJobPreferences(){
  const stored=(await chrome.storage.local.get(cpPreferencesKey))[cpPreferencesKey]||{};
  const normalized=cpFit?.normalizePreferences?.(stored)||stored;
  if(JSON.stringify(stored)!==JSON.stringify(normalized))await chrome.storage.local.set({[cpPreferencesKey]:normalized});
  return normalized;
}
async function cpSaveJobPreferences(value,sender){
  cpAssertHhListSender(sender);const normalized=cpFit?.normalizePreferences?.(value||{})||value||{};
  await chrome.storage.local.set({[cpPreferencesKey]:normalized});return normalized;
}
function cpVacancyIntelKey(id){return 'vjaVacancyIntel:'+String(id||'');}
function cpVacancyDecisionKey(id){return 'vjaVacancyDecision:'+String(id||'');}
async function cpQuickListApplicationState(v){
  const jobs=await applicationJobs();const job=jobs.filter(j=>cpCore.sameVacancy(cpCore.application(j).vacancy,v)).sort((a,b)=>Number(b.context?.updatedAt||b.plan?.createdAt||0)-Number(a.context?.updatedAt||a.plan?.createdAt||0))[0]||null;
  if(!job)return null;const app=cpCore.application(job),site=job.result?.result||{},memory=job.context?.coverLetterMemory||{},formMemory=job.context?.formMemory||null;
  return {id:app.id,status:app.status,updatedAt:app.updatedAt||0,completed:Boolean(job.completed||site.submitted),coverLetterSubmitted:Boolean(memory.submittedAt||site.coverLetterFilled),employerAlreadyViewed:Boolean(site.employerAlreadyViewed),formMemory};
}
async function cpQuickListFullAnalysis(vInput,sender,{force=false}={}){
  cpAssertEmbeddedVacancy(sender,vInput);const selected=cpCore.vacancy(vInput),id=String(selected.vacancyId||'');if(!id)throw new Error('Не удалось определить vacancy ID.');
  const preferences=await cpJobPreferences(),intelKey=cpVacancyIntelKey(id),decisionKey=cpVacancyDecisionKey(id),stored=await chrome.storage.local.get([intelKey,decisionKey]);
  const cached=stored[intelKey],decision=stored[decisionKey]?.decision||'',preferenceKey=cpCore.hash(JSON.stringify(preferences));
  const fresh=cached?.vacancy?.vacancyId===id&&cached?.preferenceKey===preferenceKey&&Date.now()-Number(cached.at||0)<30*24*60*60*1000;
  if(fresh&&!force)return {...cached,application:await cpQuickListApplicationState(selected),decision,preferences,cached:true};
  if(cpVacancyIntelInFlight.has(id)&&!force)return cpVacancyIntelInFlight.get(id);
  const task=(async()=>{
    const acquired=await cpAcquireHhVacancy(selected,sender,{fast:true}),full=acquired.vacancy,source=acquired.source;
    if(!cpCore.sameVacancy(selected,full))throw new Error('Получено описание другой вакансии.');
    const analysis=cpHhList?.analyzeCallRequirement?.(`${full.title||''}\n${full.description||''}\n${full.requirements||''}`,full.descriptionCoverage||(source==='hh-api'?'full-fetch':'full-dom'))||{status:'unknown',hasCalls:null,canApply:false,confidence:0,reason:'Analysis недоступен.',evidence:''};
    const relevance=globalThis.vjaRelevance?.analyze?.(full)||{};
    const profile=(await cpData()).profile;
    const baseFit=cpFit?.scoreVacancy?.(full,profile,preferences,analysis,relevance)||{score:0,decision:'REVIEW',ready:false,reasons:[],risks:['Fit Score недоступен'],features:{},algorithm:'unavailable'};
    const signals=await cpLearningSignals();let fit=cpLearning?.adjustFit?.({...baseFit,preferences},signals,full)||baseFit;fit.baseScore=baseFit.score;fit.rulesScoreBeforeMl=fit.score;
    const flags=(await chrome.storage.local.get(cpFeatureFlagsKey))[cpFeatureFlagsKey]||{};if(cpModelRuntime?.predict){if(flags.mlRanking){const activeModel=await cpActiveModel('preference');if(activeModel){try{const pred=await cpModelRuntime.predict(activeModel,cpModelRuntime.rowFromFit(full,fit));fit=cpModelRuntime.blendFit(fit,pred,{weight:.25});}catch(error){fit.mlError=String(error?.message||error);}}}const engagementModel=await cpActiveModel('engagement');if(engagementModel){try{fit.engagement=await cpModelRuntime.predict(engagementModel,cpModelRuntime.rowFromFit(full,fit));}catch(error){fit.engagementError=String(error?.message||error);}}}
    fit.ready=(analysis.status==='no-calls'||!preferences.avoidCalls)&&!fit.features?.sales&&fit.score>=preferences.minimumFitScore;
    const vacancy={provider:full.provider,url:full.url,vacancyId:full.vacancyId,title:full.title,company:full.company||'',location:full.location||'',remote:Boolean(full.remote)};
    const duplicate=await cpFindDuplicate({...vacancy,description:full.description,requirements:full.requirements});
    const record={schemaVersion:2,vacancy,analysis:{...analysis,source,coverage:full.descriptionCoverage||(source==='hh-api'?'full-fetch':'full-dom')},fit,features:{...(fit.features||{}),descriptionHash:relevance.descriptionHash||'',descriptionCoverage:relevance.descriptionCoverage||full.descriptionCoverage||''},duplicate,preferenceKey,source,at:Date.now()};
    await chrome.storage.local.set({[intelKey]:record,[`vjaCallAnalysis:${id}`]:{vacancyId:id,url:selected.url,at:record.at,result:{vacancyId:id,title:full.title,status:analysis.status,hasCalls:analysis.hasCalls,canApply:analysis.canApply,confidence:analysis.confidence,reason:analysis.reason,evidence:analysis.evidence||'',source,coverage:record.analysis.coverage}}});
    return {...record,application:await cpQuickListApplicationState(selected),decision,preferences,cached:false};
  })();
  cpVacancyIntelInFlight.set(id,task);try{return await task;}finally{if(cpVacancyIntelInFlight.get(id)===task)cpVacancyIntelInFlight.delete(id);}
}
async function cpQuickListDecision(vInput,sender,decision){
  cpAssertEmbeddedVacancy(sender,vInput);const v=cpCore.vacancy(vInput),id=String(v.vacancyId||'');const allowed=new Set(['SAVED','SKIPPED','REVIEWED','']);
  decision=String(decision||'').toUpperCase();if(decision==='CLEAR')decision='';if(!allowed.has(decision))throw new Error('Неизвестное решение по вакансии.');
  const key=cpVacancyDecisionKey(id);if(!decision)await chrome.storage.local.remove(key);else await chrome.storage.local.set({[key]:{vacancyId:id,url:v.url,title:v.title,decision,at:Date.now()}});
  if(decision){const intel=(await chrome.storage.local.get(cpVacancyIntelKey(id)))[cpVacancyIntelKey(id)];const type=decision==='SAVED'?'VACANCY_SAVED':decision==='SKIPPED'?'VACANCY_SKIPPED':'VACANCY_REVIEWED';await cpRecordLearningEvent({type,vacancy:v,userAction:decision,source:'quick-list',modelDecision:{score:intel?.fit?.score,decision:intel?.fit?.decision,features:intel?.features||intel?.fit?.features||{},ml:intel?.fit?.ml||null},confidence:intel?.analysis?.confidence,meta:{features:intel?.features||intel?.fit?.features||{},fitScore:intel?.fit?.score,ml:intel?.fit?.ml||null}});}
  return {vacancyId:id,decision};
}
async function cpQuickListCallAnalysis(vInput,sender){
  try{const intel=await cpQuickListFullAnalysis(vInput,sender);return {...intel.analysis,fit:intel.fit,features:intel.features,cached:Boolean(intel.cached)};}
  catch(error){
    cpAssertEmbeddedVacancy(sender,vInput);const selected=cpCore.vacancy(vInput),analysis=cpHhList?.analyzeCallRequirement?.(`${selected.title||''}\n${selected.description||''}\n${selected.requirements||''}`,'snippet')||{status:'unknown',hasCalls:null,canApply:false,confidence:0,evidence:''};
    return {vacancyId:selected.vacancyId,title:selected.title,status:'unknown',hasCalls:null,canApply:false,confidence:analysis.confidence||0,reason:'Не удалось прочитать полную страницу выбранной вакансии ни в фоне, ни через HH API. Повторите Analysis.',evidence:analysis.evidence||'',source:'card-snippet',coverage:'snippet',liveError:error?.message||String(error)};
  }
}
const cpQuickListAnalysisTtl=30*24*60*60*1000;
function cpQuickListActiveKey(sender){return `vjaQuickListActive:${sender.tab.id}:${sender.frameId||0}`;}
function cpFormVacancyId(value){try{const u=new URL(value);return u.searchParams.get('vacancyId')||u.searchParams.get('vacancy_id')||u.searchParams.get('vacancy')||cpCore.idFromUrl(value)||'';}catch{return '';}}
function cpApplicationRoute(value){try{const u=new URL(value);return /(?:application|applicant|vacancy[_-]?response|response|respond|questionnaire|screening|negotiation|oneclick|apply|form)/i.test(u.pathname+u.search);}catch{return false;}}
function cpTitleMatchesPage(title,pageText=''){
  const stop=new Set(['специалист','менеджер','работы','работе','работа','developer','engineer','junior','senior','middle','the','and','для','with']);
  const tokens=String(title||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').split(/[^a-zа-я0-9#+.]+/i).filter(x=>x.length>=4&&!stop.has(x));
  if(!tokens.length)return false;const hay=String(pageText||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
  const need=Math.min(2,tokens.length);return tokens.filter(x=>hay.includes(x)).length>=need;
}
function cpIsQuickListContinuation(job,sender,pageText=''){
  if(!job?.plan?.quickList||job.tabId!==sender.tab.id||Number(job.frameId||0)!==Number(sender.frameId||0))return false;
  const app=cpCore.application(job),terminal=['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(app.status);if(terminal)return false;
  if(!cpApplicationRoute(sender.url))return false;
  const currentId=cpFormVacancyId(sender.url),expectedId=String(job.plan?.vacancyId||app.vacancy?.vacancyId||'');if(currentId&&expectedId&&String(currentId)!==expectedId)return false;
  const currentProvider=cpCore.provider(sender.url),expectedProvider=app.vacancy?.provider||job.plan?.provider||'';
  if(currentProvider===expectedProvider){if(currentId&&expectedId)return true;return cpTitleMatchesPage(app.vacancy?.title||job.plan?.jobTitle,pageText);}
  return cpTitleMatchesPage(app.vacancy?.title||job.plan?.jobTitle,pageText);
}
function cpCanRecoverQuickListExact(job,sender,currentId){
  if(!job?.plan?.quickList||!currentId||!cpApplicationRoute(sender.url))return false;const app=cpCore.application(job);
  if(['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(app.status))return false;
  const expectedId=String(job.plan?.vacancyId||app.vacancy?.vacancyId||'');if(String(currentId)!==expectedId)return false;
  return cpCore.provider(sender.url)===(app.vacancy?.provider||job.plan?.provider||'');
}
async function cpPendingPayload(job,extra={}){
  if(!job)return null;const file=(await chrome.storage.local.get(job.context?.cvKey||[]))[job.context?.cvKey];
  const cvVersion=file?`${file.savedAt||''}:${file.size}:${cpCore.hash(file.base64?.slice(-100)||'')}`:'';
  return {application:cpCore.application(job),context:job.context,profile:job.context?.profileSnapshot,coverLetter:job.context?.coverLetter,role:job.context?.role,cvFile:cvVersion===job.context?.cvVersion&&cpCore.cvValid(file)?file:null,...extra};
}
async function cpQuickListState(vInput,sender){
  cpAssertEmbeddedVacancy(sender,vInput);const v=cpCore.vacancy(vInput),id=String(v.vacancyId||''),cacheKey='vjaCallAnalysis:'+id,intelKey=cpVacancyIntelKey(id),decisionKey=cpVacancyDecisionKey(id);
  const stored=await chrome.storage.local.get([cacheKey,intelKey,decisionKey]),call=stored[cacheKey],intel=stored[intelKey],decision=stored[decisionKey]?.decision||'';
  const analysis=call?.result&&Date.now()-Number(call.at||0)<cpQuickListAnalysisTtl&&String(call.result.vacancyId||id)===id?{...call.result,cached:true,at:Number(call.at||0)}:(intel?.analysis&&Date.now()-Number(intel.at||0)<cpQuickListAnalysisTtl?{...intel.analysis,cached:true,at:Number(intel.at||0)}:null);
  const application=await cpQuickListApplicationState(v),preferences=await cpJobPreferences();
  return {vacancyId:id,analysis,fit:intel?.fit||null,features:intel?.features||null,duplicate:intel?.duplicate||null,intelAt:Number(intel?.at||0),decision,application,preferences};
}
function cpTimelineEvent(type,label,meta={}){return {id:`evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,at:Date.now(),type:cpCore.clip(type,60),label:cpCore.clip(label,220),meta};}
function cpWithTimeline(context,type,label,meta={}){const timeline=[...(context?.timeline||[]),cpTimelineEvent(type,label,meta)].slice(-40);return {...context,timeline,updatedAt:Date.now()};}
async function cpAppendJobTimeline(jobId,type,label,meta={}){if(!jobId)return false;const job=await applicationJob(jobId);if(!job)return false;await updateApplicationJob(jobId,{context:cpWithTimeline(job.context||{},type,label,meta)});return true;}
globalThis.vjaAppendJobTimeline=cpAppendJobTimeline;
function cpPublicApplication(a){return {id:a.id,title:a.vacancy?.title||'Вакансия',company:a.vacancy?.company||'',url:a.vacancy?.url||'',status:a.status,role:a.role||a.cvProfileId||'other',cvProfileId:a.cvProfileId||'',cvName:a.cvName||'',cvSelectionReason:a.cvSelectionReason||'',coverLetter:a.coverLetter||'',coverLetterMemory:a.coverLetterMemory||null,applicationState:a.applicationState||null,detectedStage:a.detectedStage||'',nextAction:cpFollow?.normalizeAction(a.nextAction)||null,timeline:(a.timeline||[]).slice(-40)};}
function cpStageLabel(stage){const labels={application_review:'Работодатель рассматривает отклик',hr_screening:'HR-этап',experience_question:'Вопрос об опыте',technical_question:'Технический вопрос',availability:'Доступность / дата выхода',salary:'Обсуждение условий',interview_scheduling:'Назначение интервью',test_assignment:'Тестовое задание',post_interview:'После интервью',follow_up:'Follow-up',offer:'Предложение',rejection:'Отказ'};return labels[stage]||'';}
async function cpObserveChat(snapshot,resolvedHint=null){
  if(!snapshot?.latestInbound||snapshot.identityConfidence==='weak')return null;
  const c=cpCore.identity(snapshot),threadKey=cpCore.conversationKey(c);if(!threadKey)return null;
  const storageKey='vjaConversation:'+threadKey,thread=(await chrome.storage.local.get(storageKey))[storageKey]||{};
  const apps=(await applicationJobs()).map(cpCore.application),resolved=resolvedHint?.matched?resolvedHint:cpCore.resolveConversation(c,apps,thread.mapping);
  if(!resolved?.matched||!resolved.application?.id)return null;
  const job=await applicationJob(resolved.application.id);if(!job)return null;
  const latest=cpCore.clip(snapshot.latestInbound,5000),messageHash=cpCore.hash([c.conversationId,c.vacancyId,c.applicationId,latest].join('|'));
  if(job.context?.lastObservedEmployerHash===messageHash)return cpCore.application(job);
  let context={...(job.context||{}),lastObservedEmployerHash:messageHash,lastObservedEmployerAt:Date.now()};
  const stage=cpCore.stage(latest);
  if(stage&&stage!=='unknown'&&stage!==context.detectedStage){context=cpWithTimeline({...context,detectedStage:stage},'chat-stage',`В чате: ${cpStageLabel(stage)||stage}`,{stage,autoDetected:true});}
  const terminal=['Offer','Rejected','Closed'].includes(context.status);
  if(!terminal&&['Applied','Viewed','Preparing','Ready','Needs review'].includes(context.status||'Preparing'))context=cpWithTimeline({...context,status:'Recruiter Replied',statusSource:'chat-observed'},'status','Статус: Recruiter Replied',{status:'Recruiter Replied',source:'chat-observed'});
  const action=cpFollow?.extract(latest,Date.now());
  if(action){
    const next={...action,createdAt:Date.now(),sourceHash:messageHash};
    if(!cpFollow.sameAction(context.nextAction,next)){const when=new Date(next.dueAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});context=cpWithTimeline({...context,nextAction:next},'next-action',`${next.label} · ${when}`,{type:next.type,dueAt:next.dueAt,source:'chat-explicit'});}
  }
  await updateApplicationJob(resolved.application.id,{context});
  await cpUpdateReminderBadge().catch(()=>{});
  return cpCore.application({...job,context});
}
async function cpChangeNextAction(id,mode,days=1){
  const job=await applicationJob(id);if(!job)throw new Error('Отклик не найден.');
  let context={...(job.context||{})},current=cpFollow?.normalizeAction(context.nextAction);
  if(mode==='manual'){
    if(['Offer','Rejected','Closed'].includes(context.status))throw new Error('Для закрытого отклика напоминание не требуется.');
    const due=cpFollow.addBusinessDays(new Date(),Math.max(1,Math.min(20,Math.floor(Number(days)||3))));due.setHours(18,0,0,0);
    const next={type:'feedback',dueAt:due.getTime(),label:'Уточнить обратную связь',sourceText:'Установлено пользователем',sourcePhrase:'',precision:'manual',confidence:1,source:'manual',createdAt:Date.now(),doneAt:0,dismissedAt:0};
    context=cpWithTimeline({...context,nextAction:next},'next-action','Follow-up запланирован',{type:'feedback',dueAt:next.dueAt,source:'manual'});
  }else{
    if(!current)throw new Error('Следующее действие не найдено.');
    if(mode==='done'){current={...current,doneAt:Date.now()};context=cpWithTimeline({...context,nextAction:current},'next-action-done','Следующее действие отмечено выполненным',{type:current.type});}
    else if(mode==='snooze'){current=cpFollow.snooze(current,days);context=cpWithTimeline({...context,nextAction:current},'next-action-snoozed',`Напоминание отложено на ${Math.max(1,Math.floor(Number(days)||1))} дн.`,{type:current.type,dueAt:current.dueAt});}
    else if(mode==='dismiss'){current={...current,dismissedAt:Date.now()};context=cpWithTimeline({...context,nextAction:current},'next-action-dismissed','Напоминание скрыто',{type:current.type});}
    else throw new Error('Неизвестное действие.');
  }
  await updateApplicationJob(id,{context});await cpUpdateReminderBadge().catch(()=>{});return cpPublicApplication(cpCore.application({...job,context}));
}
async function cpUpdateReminderBadge(){
  if(!chrome.action?.setBadgeText)return 0;
  const apps=(await applicationJobs()).map(cpCore.application).map(cpPublicApplication),count=cpFollow?.dueItems(apps,Date.now()).length||0;
  await chrome.action.setBadgeText({text:count?String(Math.min(99,count))+(count>99?'+':''):''});
  await chrome.action.setTitle?.({title:count?`Violetta Apply Assistant · ${count} действий требуют внимания`:'Violetta Apply Assistant'});
  return count;
}
function cpNeedsHhLetter(job){
  if(!job)return false;const app=cpCore.application(job),memory=job.context?.coverLetterMemory||{},site=job.result?.result||{};
  const applied=['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(app.status)||Boolean(job.completed||site.submitted);
  return applied&&app.vacancy?.provider==='hh'&&!memory.submittedAt&&!site.coverLetterFilled;
}
async function cpPrepare(vInput,sender,legacyPlan=null,options={}){
  if(options.embedded)cpAssertEmbeddedVacancy(sender,vInput);else cpAssertPage(sender,vInput.url);
  const v=options.safePreparation?cpCore.vacancy(vInput):await cpCompleteVacancy(vInput,sender,{embedded:Boolean(options.embedded)});if(!v.title||!cpCore.vacancyKey(v))throw new Error('Не удалось однозначно определить вакансию.');
  const previousJob=(await applicationJobs()).find(j=>cpCore.sameVacancy(cpCore.application(j).vacancy,v));
  if(previousJob&&['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(cpCore.application(previousJob).status)&&!cpNeedsHhLetter(previousJob))return {duplicate:true,application:cpCore.application(previousJob)};
  const data=await cpData(), role=cpCore.classifyRole(v.title,v.description),lang=cpCore.language(v.title+' '+v.description);
  const writing=await cpCreateLetter(data.profile,v);
  let record;
  await applicationStateChange(async()=>{
    const jobs=await applicationJobs();
    let job=jobs.find(j=>cpCore.sameVacancy(cpCore.application(j).vacancy,v));
    if(job && ['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(cpCore.application(job).status)&&!cpNeedsHhLetter(job)) {record={duplicate:true,application:cpCore.application(job)};return;}
    const p=data.profile;
    const cvKeys=['cvVaultRu','cvVaultEn'];
    const stored=await chrome.storage.local.get(cvKeys);
    const selected=job?.context?.cvKey&&stored[job.context.cvKey]?.base64?{key:job.context.cvKey,file:stored[job.context.cvKey],reason:job.context.cvSelectionReason||'remembered'}:cpCore.cvSelection(role,lang,stored);
    const key=selected.key,file=selected.file;
    const cvVersion=file?`${file.savedAt||''}:${file.size}:${cpCore.hash(file.base64?.slice(-100)||'')}`:'';
    const coverLetter=job?.context?.coverLetterSource==='user-edited'?job.context.coverLetter:writing.text;
    const check=globalThis.vjaRelevance.verify(coverLetter,p,{vacancy:v,kind:'cover'});if(!check.ok)throw new Error('Письмо требует проверки: '+check.errors.join(', '));
    const now=Date.now(),previousMemory=job?.context?.coverLetterMemory||{};
    const coverLetterMemory={...previousMemory,text:coverLetter,language:lang,role,cvKey:key,cvName:file?.name||'',cvSelectionReason:selected.reason,vacancyKey:cpCore.vacancyKey(v),evidenceAudit:writing.audit,profileRevision:p.profileRevision,source:job?.context?.coverLetterSource==='user-edited'?'user-edited':writing.source,generatedAt:previousMemory.generatedAt||now,updatedAt:now};
    let applicationState=cpState?.transition?.(job?.context?.applicationState||'IDLE','ANALYZING',{vacancyKey:cpCore.vacancyKey(v)},now)||{state:'ANALYZING',updatedAt:now};
    applicationState=cpState?.transition?.(applicationState,'CV_SELECTED',{cvKey:key,cvName:file?.name||'',reason:selected.reason},now)||applicationState;
    applicationState=cpState?.transition?.(applicationState,'LETTER_READY',{letterHash:cpCore.hash(coverLetter)},now)||applicationState;
    let context={...job?.context,vacancy:v,status:job?.context?.status||'Preparing',role,language:lang,cvProfileId:role,cvKey:key,cvVersion:job?.context?.cvVersion||cvVersion,cvName:file?.name||'',cvSelectionReason:selected.reason,profileSnapshot:p,evidenceAudit:writing.audit,coverLetter,coverLetterMemory,applicationState,updatedAt:now};
    if(!(context.timeline||[]).some(e=>e.type==='prepared'))context=cpWithTimeline(context,'prepared','Отклик подготовлен',{role,cvName:file?.name||'',cvSelectionReason:selected.reason,coverLetterHash:cpCore.hash(coverLetter)});
    const id=job?.plan?.id||legacyPlan?.id||`copilot-${Date.now()}-${crypto.randomUUID()}`;
    const plan={...(job?.plan||legacyPlan||{}),id,sourceUrl:v.url,sourcePageUrl:options.embedded?sender.url:(job?.plan?.sourcePageUrl||''),jobTitle:v.title,coverLetter,provider:v.provider,vacancyId:v.vacancyId,roleVariant:role,cvKey:key,resumeHint:v.provider==='hh'?v.title:(file?.name||v.title||''),createdAt:job?.plan?.createdAt||legacyPlan?.createdAt||Date.now(),automatic:false,quickList:Boolean(options.quickList)};
    const next={...job,plan,context,tabId:sender.tab.id,frameId:sender.frameId||0,review:false,dispatched:job?.dispatched||false};
    await chrome.storage.local.set({[applicationJobKey(id)]:next});
    record={application:cpCore.application(next),context,profile:p,coverLetter,cvFile:file&&cvVersion===context.cvVersion&&cpCore.cvValid(file)?file:null,cvChanged:Boolean(file&&cvVersion!==context.cvVersion),role,language:lang,duplicate:false};
  });
  return record;
}
async function cpAutoApply(vInput,sender){
  const prepared=await cpPrepare(vInput,sender);
  if(prepared?.duplicate)return {duplicate:true,application:prepared.application,result:null,message:'На эту вакансию уже сохранён отклик.'};
  if(!prepared?.application?.id)throw new Error('Не удалось создать контекст отклика.');
  if(!String(prepared.coverLetter||'').trim())throw new Error('Не удалось создать сопроводительное письмо.');
  const id=prepared.application.id;
  let job=await applicationJob(id);if(!job)throw new Error('Отклик не найден после подготовки.');
  const letterContinuation=cpNeedsHhLetter(job);
  if(letterContinuation){job=await updateApplicationJob(id,{completed:false,review:false,result:null,reason:null,dispatched:false})||job;}
  const oldResult=job.result?.result;
  if(oldResult?.reason==='user-submit-required'&&!job.dispatched){
    job=await updateApplicationJob(id,{review:false,result:null,reason:null});
  }
  const plan={...job.plan,coverLetter:prepared.coverLetter,cvKey:job.context?.cvKey||job.plan?.cvKey||'',fileData:prepared.cvFile||null,resumeHint:job.plan?.resumeHint||job.context?.vacancy?.title||vInput?.title||'',roleVariant:job.context?.role||job.plan?.roleVariant||'other',popup:true,direct:true,automatic:false};
  const submittingState=cpState?.transition?.(job.context?.applicationState||'LETTER_READY','SUBMITTING',{cvName:job.context?.cvName||'',coverLetterHash:cpCore.hash(prepared.coverLetter)})||{state:'SUBMITTING',updatedAt:Date.now()};
  await updateApplicationJob(id,{plan,pending:plan,review:false,reason:null,context:{...job.context,applicationState:submittingState}});
  const execution=await executeApplication(await browserAutopilotApiBase(),plan);
  let finalJob=await applicationJob(id);
  if(finalJob){const site=finalJob?.result?.result||null;const target=site?.submitted&&site?.status==='confirmed'?'CONFIRMED':(finalJob.review||site?.status==='needs-review'?'REVIEW_REQUIRED':(execution?.completed===false?'FAILED':null));if(target){let appState=cpState?.transition?.(finalJob.context?.applicationState||'SUBMITTING',target,{reason:site?.reason||execution?.message||''})||{state:target,updatedAt:Date.now()};let memory=finalJob.context?.coverLetterMemory||{};if(target==='CONFIRMED')memory={...memory,submittedAt:Date.now(),submittedText:prepared.coverLetter,submittedCvName:finalJob.context?.cvName||''};finalJob=await updateApplicationJob(id,{context:{...finalJob.context,applicationState:appState,coverLetterMemory:memory}})||finalJob;}}
  return {duplicate:false,application:cpCore.application(finalJob||job),execution:execution||null,result:finalJob?.result?.result||null,message:execution?.message||finalJob?.reason||''};
}

async function cpQuickListPrepare(vInput,sender){
  const prepared=await cpPrepare(vInput,sender,null,{embedded:true,quickList:true});
  if(prepared?.duplicate){
    const job=prepared.application?.id?await applicationJob(prepared.application.id):null;
    return {duplicate:true,application:prepared.application,coverLetter:job?.context?.coverLetter||prepared.application?.coverLetter||''};
  }
  if(prepared?.application?.id){const key=cpQuickListActiveKey(sender);await chrome.storage.session.set({[key]:{id:prepared.application.id,vacancyId:String(prepared.application.vacancy?.vacancyId||vInput?.vacancyId||''),sourceUrl:cpCore.canonicalUrl(vInput?.url),expires:Date.now()+30*60*1000}});}
  return prepared;
}
async function cpQuickListComplete(message,sender){
  const job=await applicationJob(message.id);if(!job)throw new Error('Контекст быстрого отклика не найден.');
  if(job.tabId!==sender.tab.id||Number(job.frameId||0)!==Number(sender.frameId||0))throw new Error('Быстрый отклик относится к другой вкладке.');
  const submitted=message.appliedConfirmed===true,letterSent=message.coverLetterSubmitted===true,employerAlreadyViewed=message.employerAlreadyViewed===true,now=Date.now();
  if(!submitted)throw new Error('Сайт не подтвердил отклик.');
  let memory={...(job.context?.coverLetterMemory||{}),text:job.context?.coverLetter||'',updatedAt:now};
  if(letterSent)memory={...memory,submittedAt:now,submittedText:job.context?.coverLetter||'',submittedCvName:job.context?.cvName||''};
  let context={...(job.context||{}),status:employerAlreadyViewed?'Viewed':'Applied',statusSource:employerAlreadyViewed?'hh-employer-viewed':'native-list-click',coverLetterMemory:memory,updatedAt:now};
  context=cpWithTimeline(context,employerAlreadyViewed?'hh-employer-viewed':'submitted-native-list',employerAlreadyViewed?'HH сообщил, что отклик уже просмотрен работодателем; окно сопроводительного письма закрыто автоматически.':(letterSent?'Быстрый отклик из списка + сопроводительное письмо отправлены':'Отклик из списка отправлен; сопроводительное письмо требует проверки'),{coverLetterSubmitted:letterSent,employerAlreadyViewed,vacancyId:job.plan?.vacancyId||''});
  const result={submitted:true,status:'confirmed',coverLetterFilled:letterSent,nativeList:true,employerAlreadyViewed};
  const reason=employerAlreadyViewed||letterSent?null:'Сопроводительное письмо не подтверждено сайтом.';
  const next=await updateApplicationJob(message.id,{context,completed:true,review:false,reason,pending:null,result:{id:message.id,trackedId:job.plan?.trackedId||job.plan?.vacancyId||'',sourceUrl:job.plan?.sourceUrl||'',coverLetter:job.context?.coverLetter||'',createdAt:now,result}});
  await chrome.storage.session.remove(cpQuickListActiveKey(sender)).catch(()=>{});
  const intel=(await chrome.storage.local.get(cpVacancyIntelKey(job.plan?.vacancyId||'')))[cpVacancyIntelKey(job.plan?.vacancyId||'')];await cpRecordLearningEvent({type:'VACANCY_APPLIED',vacancy:job.context?.vacancy||{},userAction:'APPLY',accepted:true,source:'quick-list',modelDecision:{score:intel?.fit?.score,decision:intel?.fit?.decision,features:intel?.features||intel?.fit?.features||{},ml:intel?.fit?.ml||null},confidence:intel?.analysis?.confidence,meta:{features:intel?.features||intel?.fit?.features||{},fitScore:intel?.fit?.score,ml:intel?.fit?.ml||null}});
  return {ok:true,application:cpPublicApplication(cpCore.application(next||job)),result};
}
async function cpVacancyStatus(vInput,sender){
  cpAssertPage(sender,vInput?.url);const v=cpCore.vacancy(vInput||{});if(!cpCore.vacancyKey(v))return {ok:true,applied:false};
  const jobs=await applicationJobs();const job=jobs.find(j=>cpCore.sameVacancy(cpCore.application(j).vacancy,v));if(!job)return {ok:true,applied:false};
  const app=cpCore.application(job),applied=['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(app.status)||Boolean(job.completed||job.result?.result?.submitted);
  return {ok:true,applied,application:cpPublicApplication(app)};
}
async function cpRememberPrepared(message,sender){
  cpAssertPage(sender,message.url);
  const job=await applicationJob(message.id);
  if(!job||job.tabId!==sender.tab.id||Number(job.frameId||0)!==Number(sender.frameId||0))throw new Error('Этот отклик принадлежит другой вкладке.');
  const savedVacancy=cpCore.application(job).vacancy;
  const same=cpCore.canonicalUrl(savedVacancy.url)===cpCore.canonicalUrl(sender.url)||cpCore.sameVacancy(savedVacancy,{url:sender.url,provider:job.context?.vacancy?.provider});
  const linked=await chrome.storage.session.get([`vjaCopilotPending:${sender.tab.id}:${sender.frameId||0}`,cpQuickListActiveKey(sender)]);
  const pending=linked[`vjaCopilotPending:${sender.tab.id}:${sender.frameId||0}`],quick=linked[cpQuickListActiveKey(sender)];
  const exactLinked=Boolean(pending&&pending.id===message.id&&pending.target===cpCore.canonicalUrl(sender.url));
  const quickLinked=Boolean(quick&&quick.id===message.id&&quick.expires>=Date.now()&&cpIsQuickListContinuation(job,sender,message.pageText||''));
  if(!same&&!exactLinked&&!quickLinked)throw new Error('Изменился адрес формы.');
  const reviewCount=Math.max(0,Number(message.reviewCount||0)),now=Date.now();
  const unresolved=Array.isArray(message.unresolved)?message.unresolved.slice(0,40).map(x=>({label:cpCore.clip(x?.label||'',180),reason:cpCore.clip(x?.reason||'',220),category:cpCore.clip(x?.category||'UNKNOWN',60),semanticKey:cpCore.clip(x?.semanticKey||'',240),required:Boolean(x?.required)})).filter(x=>x.label||x.reason):[];
  const currentFilled=Array.isArray(message.filledFields)?message.filledFields.slice(0,40).map(x=>({label:cpCore.clip(x?.label||'',180),category:cpCore.clip(x?.category||'UNKNOWN',60),semanticKey:cpCore.clip(x?.semanticKey||'',240),source:cpCore.clip(x?.source||'',100),required:Boolean(x?.required),answer:cpCore.clip(x?.answer||'',1200),evidenceIds:Array.isArray(x?.evidenceIds)?x.evidenceIds.slice(0,20).map(v=>cpCore.clip(v,100)):[]})):[];
  const previous=job.context?.formMemory||{};
  const mergeFields=(oldItems,newItems)=>{const map=new Map();for(const x of [...(oldItems||[]),...(newItems||[])]){const k=x?.semanticKey||`${x?.category||''}:${x?.label||''}`;if(k)map.set(k,x);}return [...map.values()].slice(-40);};
  const filledFields=mergeFields(previous.filledFields,currentFilled),confirmedFilledKeys=new Set(filledFields.filter(x=>!['human-fallback','existing-human-fallback'].includes(String(x?.source||''))).map(x=>x.semanticKey).filter(Boolean));
  const mergedUnresolved=mergeFields(previous.unresolved,unresolved).filter(x=>!x.semanticKey||!confirmedFilledKeys.has(x.semanticKey));
  const questionnaire={detected:Boolean(message.questionnaire?.detected||filledFields.length||mergedUnresolved.length),fieldCount:Math.max(0,Number(message.questionnaire?.fieldCount||filledFields.length+mergedUnresolved.length)),filledFields,unresolvedFields:mergedUnresolved,lastUpdated:now};
  const effectiveReview=mergedUnresolved.length,state=effectiveReview?'Needs review':'Ready';
  const formMemory={url:cpCore.canonicalUrl(sender.url),filled:Math.max(Number(previous.filled||0),Number(message.filled||0),filledFields.length),reviewCount:effectiveReview,unresolved:mergedUnresolved,filledFields,questionnaire,coverLetterFilled:Boolean(message.coverLetterFilled||previous.coverLetterFilled),cvUploaded:Boolean(message.cvUploaded||previous.cvUploaded),autoFilled:Boolean(message.autoFilled||previous.autoFilled),updatedAt:now};
  const changed=previous.url!==formMemory.url||previous.reviewCount!==formMemory.reviewCount||previous.filled!==formMemory.filled;
  let context={...job.context,status:state,formMemory,updatedAt:now};
  if(changed)context=cpWithTimeline(context,effectiveReview?'needs-review':'ready',effectiveReview?`${effectiveReview} полей требуют проверки`:'Форма автоматически заполнена и готова к проверке',{reviewCount:effectiveReview,filled:formMemory.filled,autoFilled:formMemory.autoFilled});
  await updateApplicationJob(message.id,{context,review:true,result:{id:job.plan.id,result:{submitted:false,status:'needs-review',reason:'user-submit-required',coverLetterFilled:Boolean(message.coverLetterFilled),formMemory}}});
  return {ok:true,status:state,formMemory};
}
async function cpWaitForVacancyReadable(tabId,expectedProvider,expectedId,timeoutMs=9000){
  const started=Date.now();let lastTab=null,lastUrl='';
  while(Date.now()-started<timeoutMs){
    try{
      lastTab=await chrome.tabs.get(tabId);lastUrl=cpCore.canonicalUrl(lastTab?.url||'');
      const loadedId=cpCore.idFromUrl(lastUrl),loadedProvider=cpCore.provider(lastUrl);
      if(loadedProvider===expectedProvider&&(!expectedId||loadedId===expectedId)){
        try{
          const probe=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>({readyState:document.readyState,hasBody:Boolean(document.body),textLength:String(document.body?.innerText||'').trim().length})});
          const state=probe?.[0]?.result||{};
          if(state.hasBody&&['interactive','complete'].includes(state.readyState)&&Number(state.textLength||0)>=80)return lastTab;
        }catch{/* The frame can be between navigations; retry without surfacing a false failure. */}
        if(lastTab?.status==='complete')return lastTab;
      }
    }catch{/* Tab may be replacing its document during HH navigation. */}
    await browserAutopilotWait(250);
  }
  throw new Error('HH vacancy page did not become readable in the background tab.');
}
async function cpReadVacancy(url,sender,options={}){
  const canonical=cpCore.canonicalUrl(url);if(!canonical)throw new Error('Некорректная ссылка на вакансию.');
  const fast=Boolean(options?.fast),loadTimeoutMs=fast?9000:14000,readTimeoutMs=fast?5000:7500,readAttempts=fast?4:5,retryDelayMs=fast?300:450;
  const expectedId=cpCore.idFromUrl(canonical), expectedProvider=cpCore.provider(canonical);
  const key='vjaVacancyCache:'+cpCore.hash(canonical);const cached=(await chrome.storage.local.get(key))[key];
  if(cached?.vacancy && ['full-dom','full-structured','full-fetch'].includes(cached.vacancy.descriptionCoverage) && cpCore.canonicalUrl(cached.vacancy.url)===canonical && (!expectedId||cached.vacancy.vacancyId===expectedId) && !cpCore.suspiciousVacancyTitle?.(cached.vacancy.title) && Date.now()-cached.at<15*60*1000)return cached.vacancy;
  const u=new URL(canonical), source=new URL(sender.url);
  // No access to arbitrary private-network endpoints on behalf of a web page.
  if(u.origin!==source.origin && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname))throw new Error('Небезопасный адрес вакансии.');
  if(!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw new Error('Откройте вакансию и включите помощника для её сайта один раз.');
  let tab;
  try{
    tab=await chrome.tabs.create({url:canonical,active:false});
    let loaded=null,lastLoadError=null;
    for(let attempt=0;attempt<2;attempt++){
      try{loaded=await cpWaitForVacancyReadable(tab.id,expectedProvider,expectedId,loadTimeoutMs);}
      catch(error){lastLoadError=error;if(attempt===0){await chrome.tabs.update(tab.id,{url:canonical}).catch(()=>{});await browserAutopilotWait(500);continue;}throw error;}
      const loadedUrl=cpCore.canonicalUrl(loaded?.url||'');
      const loadedId=cpCore.idFromUrl(loadedUrl),loadedProvider=cpCore.provider(loadedUrl);
      if(loadedProvider===expectedProvider&&(!expectedId||loadedId===expectedId))break;
      if(attempt===0){await chrome.tabs.update(tab.id,{url:canonical});await browserAutopilotWait(500);continue;}
      throw lastLoadError||new Error('HeadHunter открыл не выбранную вакансию. Письмо не создано.');
    }
    let result=null,lastReadError=null;
    for(let attempt=0;attempt<readAttempts;attempt++){
      try{
        await cpInject(tab.id);
        result=await browserAutopilotWithTimeout(chrome.tabs.sendMessage(tab.id,{type:'vjaCopilotPage',action:'vacancy',expectedVacancyId:expectedId},{frameId:0}),readTimeoutMs,'Не удалось прочитать вакансию.');
        const raw=result?.vacancy||{},v=cpCore.vacancy(raw);
        if(v.description&&String(v.description).trim().length>=30&&(!expectedId||v.vacancyId===expectedId)&&v.provider===expectedProvider&&!cpCore.suspiciousVacancyTitle?.(v.title)){
          if(!v.descriptionCoverage)v.descriptionCoverage='full-dom';
          await chrome.storage.local.set({[key]:{vacancy:v,at:Date.now()}});return v;
        }
      }catch(error){lastReadError=error;}
      await browserAutopilotWait(retryDelayMs);
    }
    if(cpCore.suspiciousVacancyTitle?.(result?.vacancy?.title))throw new Error('Вместо выбранной вакансии HeadHunter вернул заголовок страницы поиска. Письмо не отправлено.');
    throw lastReadError||new Error('Не удалось подтвердить полное описание именно выбранной вакансии.');
  }finally{if(tab?.id)await chrome.tabs.remove(tab.id).catch(()=>{});}
}
async function cpResolve(snapshot,sender){
  cpAssertChatPage(sender,snapshot);
  const data=await cpData(),c=cpCore.identity(snapshot),threadKey=cpCore.conversationKey(c);
  let thread={},apps=(await applicationJobs()).map(cpCore.application),result={matched:false,reason:'current-chat'};
  if(threadKey){
    const storageKey='vjaConversation:'+threadKey;
    thread=(await chrome.storage.local.get(storageKey))[storageKey]||{};
    if(snapshot.identityConfidence!=='weak')result=cpCore.resolveConversation(c,apps,thread.mapping);
  }
  if(result.matched){
    const observed=await cpObserveChat(snapshot,result).catch(()=>null),app=observed||result.application;
    return {...result,application:app,profile:data.profile,profileAtApplication:app.profileSnapshot||null,memory:thread.memory||{},recent:thread.recent||[],personalReplies:data.personalReplies,settings:data.settings,cvUnknown:!app.profileSnapshot||!app.cvVersion};
  }
  // If the active chat exposes one direct vacancy link, enrich the CURRENT chat
  // with that vacancy. This never chooses a different saved application.
  if(c.vacancyUrl&&result.reason!=='conflicting-identities'&&result.reason!=='ambiguous-id'){
    let v=apps.find(a=>cpCore.sameVacancy(a.vacancy,{url:c.vacancyUrl,provider:c.provider}))?.vacancy;
    if(!v?.description)try{v=await cpReadVacancy(c.vacancyUrl,sender);}catch{}
    if(v?.description)return {matched:true,ephemeral:!apps.some(a=>cpCore.sameVacancy(a.vacancy,v)),confidence:.94,reason:'direct-vacancy-link',application:{id:'',applicationId:'',vacancy:v,cvProfileId:'unknown',cvVersion:'unknown',coverLetter:'',status:'Unknown'},profile:data.profile,memory:thread.memory||{},recent:thread.recent||[],settings:data.settings,personalReplies:data.personalReplies,cvUnknown:true};
  }
  // Old chats and chats created before this extension was installed must still
  // have ✎ AI. Use only the active DOM conversation; do not ask the user to pick
  // a vacancy and do not borrow another saved application's CV/cover letter.
  const inline=snapshot.vacancy||{};
  const vacancy={
    provider:c.provider||cpCore.provider(snapshot.url),
    url:c.vacancyUrl||snapshot.url,
    vacancyId:c.vacancyId||'',
    title:cpCore.clip(inline.title||snapshot.jobTitle||'',500),
    company:cpCore.clip(inline.company||snapshot.company||'',500),
    description:cpCore.clip(inline.description||'',12000),
    location:cpCore.clip(inline.location||'',500),
    requirements:cpCore.clip(inline.requirements||'',5000)
  };
  return {matched:true,ephemeral:true,confidence:.5,reason:'active-chat-dom',application:{id:'',applicationId:c.applicationId||'',vacancy,cvProfileId:'unknown',cvVersion:'unknown',coverLetter:'',status:'Unknown'},profile:data.profile,memory:thread.memory||{},recent:thread.recent||[],personalReplies:data.personalReplies,settings:data.settings,cvUnknown:true};
}
async function cpAnalyze(snapshot,style,sender,explicitUserRequest=false){
  return cpAnswerCurrentChat(snapshot,style,sender,explicitUserRequest);
}
async function cpRememberTemplate(snapshot,id,sender){
  cpAssertChatPage(sender,snapshot);const key='vjaConversation:'+cpCore.conversationKey(snapshot);
  if(key.endsWith(':'))throw new Error('Чат не найден.');
  let applicationId='';
  await applicationStateChange(async()=>{
    const data=(await chrome.storage.local.get(key))[key]||{};
    await chrome.storage.local.set({[key]:{...data,recent:[...(data.recent||[]),{id:cpCore.clip(id,100),at:Date.now(),state:'inserted-not-sent'}].slice(-12)}});
    const apps=(await applicationJobs()).map(cpCore.application),resolved=cpCore.resolveConversation(cpCore.identity(snapshot),apps,data.mapping);
    if(resolved.matched)applicationId=resolved.application.id;
  });
  if(applicationId)await cpAppendJobTimeline(applicationId,'reply-draft','Быстрый ответ вставлен в чат',{templateId:cpCore.clip(id,100),sent:false});
  return {ok:true};
}
async function cpRememberAiDraft(snapshot,style,sender){
  cpAssertChatPage(sender,snapshot);const key='vjaConversation:'+cpCore.conversationKey(snapshot);
  if(key.endsWith(':'))throw new Error('Чат не найден.');
  let applicationId='';
  await applicationStateChange(async()=>{
    const data=(await chrome.storage.local.get(key))[key]||{},apps=(await applicationJobs()).map(cpCore.application),resolved=cpCore.resolveConversation(cpCore.identity(snapshot),apps,data.mapping);
    if(resolved.matched)applicationId=resolved.application.id;
  });
  if(applicationId)await cpAppendJobTimeline(applicationId,'ai-draft','AI-черновик вставлен в чат',{style:cpCore.clip(style||'neutral',40),sent:false});
  return {ok:true};
}
async function cpInject(tabId){
  const [script]=chrome.runtime.getManifest().content_scripts.filter(s=>s.js.includes('copilot-core.js'));
  try{const r=await chrome.tabs.sendMessage(tabId,{type:'vjaCopilotPage',action:'ping'},{frameId:0});if(r?.ok)return;}catch{}
  // Existing and future permitted frames are covered by manifest/dynamic scripts.
  // First activation injects the top frame only: never retry a partly executed
  // allFrames batch and redeclare legacy globals in an already loaded frame.
  await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:script.js});
}
async function cpRepairSupportedTabs(){
  if(!chrome.tabs?.query||!chrome.scripting?.executeScript)return;
  let tabs=[];
  try{tabs=await chrome.tabs.query({url:['https://hh.ru/*','https://*.hh.ru/*','https://headhunter.kg/*','https://*.headhunter.kg/*']});}catch{return;}
  for(const tab of tabs){
    if(!tab?.id)continue;
    try{await cpInject(tab.id);}catch{/* Chrome site access may still be set to On click. */}
  }
}
async function cpRepairHhTab(tabId,url,delays=[80,500,1400]){
  try{const u=new URL(url||'');if(!/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(u.hostname))return;}catch{return;}
  for(const delay of delays)setTimeout(()=>void cpInject(tabId).catch(()=>{}),delay);
}
async function cpRepairPermittedApplicationTab(tabId,url,delays=[120,650]){
  let u;try{u=new URL(url||'');if(!/^https?:$/.test(u.protocol)||/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(u.hostname)||!cpApplicationRoute(u.href))return;}catch{return;}
  const pattern=u.origin+'/*';try{if(!await chrome.permissions.contains({origins:[pattern]}))return;}catch{return;}
  for(const delay of delays)setTimeout(()=>void cpInject(tabId).catch(()=>{}),delay);
}
async function cpRegisterOrigin(origin){
  const pattern=new URL(origin).origin+'/*';
  if(!await chrome.permissions.contains({origins:[pattern]}))throw new Error('Разрешение на сайт не выдано.');
  const scripts=chrome.runtime.getManifest().content_scripts.find(s=>s.js.includes('copilot-core.js')).js;
  if(/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(new URL(origin).hostname))return {ok:true};
  const id='vja-site-'+cpCore.hash(pattern);
  const existing=await chrome.scripting.getRegisteredContentScripts({ids:[id]});
  if(!existing.length)await chrome.scripting.registerContentScripts([{id,matches:[pattern],js:scripts,allFrames:true,runAt:'document_idle',persistAcrossSessions:true}]);
  return {ok:true};
}
chrome.runtime.onInstalled.addListener(()=>setTimeout(()=>void cpRepairSupportedTabs(),250));
chrome.runtime.onStartup.addListener(()=>setTimeout(()=>void cpRepairSupportedTabs(),250));
chrome.tabs?.onUpdated?.addListener((tabId,change,tab)=>{
  if(!change.url&&change.status!=='loading'&&change.status!=='complete')return;
  const url=change.url||tab?.url||'';void cpRepairHhTab(tabId,url);void cpRepairPermittedApplicationTab(tabId,url);
});
chrome.tabs?.onActivated?.addListener(async info=>{
  try{const tab=await chrome.tabs.get(info.tabId);const url=tab?.url||'';void cpRepairHhTab(info.tabId,url,[20,350]);void cpRepairPermittedApplicationTab(info.tabId,url,[60,500]);}catch{}
});
// HH is a SPA: vacancy transitions can use history.pushState without a traditional
// page load. Repair the top-frame surfaces on those navigation events as well.
const cpHhNavigationFilter={url:[{schemes:['https'],hostSuffix:'hh.ru'},{schemes:['https'],hostSuffix:'headhunter.kg'}]};
chrome.webNavigation?.onHistoryStateUpdated?.addListener(details=>{
  if(details.frameId===0)void cpRepairHhTab(details.tabId,details.url,[0,120,500]);
},cpHhNavigationFilter);
chrome.webNavigation?.onCommitted?.addListener(details=>{
  if(details.frameId===0)void cpRepairHhTab(details.tabId,details.url,[40,450,1200]);
},cpHhNavigationFilter);
chrome.commands?.onCommand.addListener(async(command,tab)=>{
  try{
    if(!tab?.id)[tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)return;
    const key=`vjaCopilotFocus:${tab.id}`,focus=(await chrome.storage.session.get(key))[key];
    await chrome.tabs.sendMessage(tab.id,{type:'vjaCopilotPage',action:'command',command},{frameId:focus?.frameId||0});
  }catch{/* On ungranted sites the toolbar explains how to grant this site only. */}
});
chrome.permissions?.onRemoved?.addListener(async()=>{
  try{for(const script of await chrome.scripting.getRegisteredContentScripts())if(script.id.startsWith('vja-site-')&&!await chrome.permissions.contains({origins:script.matches}))await chrome.scripting.unregisterContentScripts({ids:[script.id]});}catch{}
});
chrome.permissions?.onAdded?.addListener(()=>setTimeout(()=>void cpRepairSupportedTabs(),80));
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='vjaCopilot')return false;
  (async()=>{
    const op=message.op;
    if(cpExtensionSender(sender)){
      if(op==='memory'){const data=await cpData();return {ok:true,profile:data.profile,writingProvider:(await chrome.storage.local.get('vjaWritingProvider')).vjaWritingProvider||{mode:'local'}};}
      if(op==='preview-letter'){const data=await cpData();const v=cpCore.vacancy(message.vacancy||{});return {ok:true,...await cpCreateLetter(data.profile,v)};}
      if(op==='source-preview'){const data=await cpData();return {ok:true,proposal:globalThis.vjaCandidateTruth.propose(data.profile,message.facts||[],message.source||{})};}
      if(op==='source-accept'){
        const data=await cpData(),source={...(message.source||{}),type:'user-confirmed'},proposal=globalThis.vjaCandidateTruth.propose(data.profile,message.facts||[],source);
        const p=globalThis.vjaCandidateTruth.accept(data.profile,proposal,message.acceptedIds,source);
        await chrome.storage.local.set({[cpKey]:p});cpWritingCache.clear();return {ok:true,profile:p};
      }

      if(op==='register-origin')return cpRegisterOrigin(message.origin);
      if(op==='inject'){await cpInject(message.tabId);return {ok:true};}
      if(op==='applications'){const apps=(await applicationJobs()).map(cpCore.application);return {ok:true,applications:apps.map(cpPublicApplication),analytics:cpAnalytics?.summarize(apps)||null,outcomeAnalytics:cpOutcome2?.summarize?.(apps)||null,dueCount:cpFollow?.dueItems(apps.map(cpPublicApplication),Date.now()).length||0};}
      if(op==='mark-status'){
        if(!['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(message.status))throw new Error('Неизвестный статус.');
        const j=await applicationJob(message.id);if(!j)throw new Error('Отклик не найден.');
        let nextAction=j.context?.nextAction;if(['Offer','Rejected','Closed'].includes(message.status)&&nextAction&&!nextAction.doneAt)nextAction={...nextAction,doneAt:Date.now()};
        const context=cpWithTimeline({...j.context,status:message.status,statusSource:'user-confirmed',nextAction},'status',`Статус: ${message.status}`,{status:message.status});
        await updateApplicationJob(message.id,{context,completed:message.status==='Applied'||j.completed});const outcomeVacancy=j.context?.vacancy||cpCore.application(j).vacancy||{};const outcomeIntel=(await chrome.storage.local.get(cpVacancyIntelKey(outcomeVacancy.vacancyId||'')))[cpVacancyIntelKey(outcomeVacancy.vacancyId||'')];await cpRecordLearningEvent({type:'OUTCOME_CHANGED',vacancy:outcomeVacancy,userAction:message.status,source:'user-status',modelDecision:{score:outcomeIntel?.fit?.score,decision:outcomeIntel?.fit?.decision,features:outcomeIntel?.features||outcomeIntel?.fit?.features||{},ml:outcomeIntel?.fit?.ml||null,engagement:outcomeIntel?.fit?.engagement||null},meta:{status:message.status,features:outcomeIntel?.features||outcomeIntel?.fit?.features||{},ml:outcomeIntel?.fit?.ml||null,engagement:outcomeIntel?.fit?.engagement||null}});await cpUpdateReminderBadge().catch(()=>{});return {ok:true};
      }
      if(op==='next-action')return {ok:true,application:await cpChangeNextAction(message.id,message.mode,Number(message.days)||1)};
      if(op==='set-followup')return {ok:true,application:await cpChangeNextAction(message.id,'manual',Number(message.days)||3)};
      if(op==='open-options'){await chrome.runtime.openOptionsPage();return {ok:true};}
      if(op==='learning-summary')return {ok:true,...await cpLearningSummary()};
      if(op==='learning-export')return {ok:true,data:await cpLearningExport()};
      if(op==='learning-import')return {ok:true,...await cpLearningImport(message.data)};
      if(op==='learning-reset')return {ok:true,...await cpLearningReset()};
      if(op==='learning-model-import')return {ok:true,...await cpImportModel(message.model)};
      if(op==='learning-model-promote')return {ok:true,registry:await cpPromoteModel(message.version)};
      if(op==='learning-model-disable')return {ok:true,registry:await cpDisableModel(message.kind||'preference')};
      if(op==='learning-settings'){if(message.value)await chrome.storage.local.set({[cpLearningSettingsKey]:{...(await cpLearningSettings()),...message.value}});return {ok:true,settings:await cpLearningSettings()};}
      if(op==='feature-flags'){const old=(await chrome.storage.local.get(cpFeatureFlagsKey))[cpFeatureFlagsKey]||{};if(message.value)await chrome.storage.local.set({[cpFeatureFlagsKey]:{...old,...message.value}});return {ok:true,flags:(await chrome.storage.local.get(cpFeatureFlagsKey))[cpFeatureFlagsKey]||old};}
      if(op==='interview-plan'){const j=await applicationJob(message.id);if(!j)throw new Error('Отклик не найден.');const data=await cpData(),vacancy=j.context?.vacancy||cpCore.application(j).vacancy;await cpRecordLearningEvent({type:'INTERVIEW_PREP_USED',vacancy,userAction:'OPEN_INTERVIEW_PREP',source:'interview-center'});return {ok:true,plan:cpRecruiterIntel?.interviewPlan?.(vacancy,data.profile)||null};}
    }
    const chatOps=new Set(['quick-context','observe-chat','resolve','analyze','remember-template','remember-ai-draft','map']);
    if(op==='questionnaire-correction'){if(!sender.tab?.id||!/^https?:\/\//i.test(sender.url||''))throw new Error('Questionnaire correction must come from a live application page.');}
    else if(op==='quick-list-prepare'||op==='quick-list-call-analysis'||op==='quick-list-state'||op==='quick-list-full-analysis'||op==='quick-list-decision'||op==='learning-feedback')cpAssertEmbeddedVacancy(sender,message.vacancy||{});
    else if(op==='job-preferences-get'||op==='job-preferences-save')cpAssertHhListSender(sender);
    else if(chatOps.has(op)&&message.snapshot)cpAssertChatPage(sender,message.snapshot);
    else cpAssertPage(sender,message.snapshot?.url||message.vacancy?.url||message.url);
    if(op==='bootstrap')return {ok:true,...await cpData()};
    if(op==='quick-context'){
      await cpObserveChat(message.snapshot).catch(()=>null);
      const data=await cpData(),key='vjaConversation:'+cpCore.conversationKey(message.snapshot);
      const thread=(await chrome.storage.local.get(key))[key]||{};
      return {ok:true,...data,recent:thread.recent||[]};
    }
    if(op==='observe-chat'){const app=await cpObserveChat(message.snapshot).catch(()=>null);return {ok:true,application:app?cpPublicApplication(app):null};}
    if(op==='list-context-applications')return {ok:true,reason:'needs-selection',candidates:(await applicationJobs()).map(cpCore.application).filter(a=>a.vacancy.provider===message.snapshot.provider).map(cpPublicApplication)};
    if(op==='update-letter'){
      const job=await applicationJob(message.id);if(!job||job.tabId!==sender.tab.id||Number(job.frameId||0)!==Number(sender.frameId||0))throw new Error('Отклик принадлежит другой вкладке.');
      const letter=cpCore.clip(message.text,8000),now=Date.now(),before=job.context?.coverLetter||'';const memory={...(job.context?.coverLetterMemory||{}),text:letter,source:'user-edited',updatedAt:now};await updateApplicationJob(message.id,{context:{...job.context,coverLetter:letter,coverLetterMemory:memory,coverLetterSource:'user-edited',updatedAt:now}});await cpRecordLearningEvent({type:'COVER_LETTER_EDITED',vacancy:job.context?.vacancy||{},originalValue:before,correctedValue:letter,edited:true,userAction:'EDIT',source:'cover-letter'});return {ok:true};
    }
    if(op==='focus'){await chrome.storage.session.set({[`vjaCopilotFocus:${sender.tab.id}`]:{frameId:sender.frameId||0,at:Date.now()}});return {ok:true};}
    if(op==='invalidate'){cpAiRequests.delete(`${sender.tab.id}:${sender.frameId||0}`);return {ok:true};}
    if(op==='prepare')return {ok:true,...await cpPrepare(message.vacancy,sender,message.legacyPlan,{safePreparation:true})};
    if(op==='auto-apply')return {ok:true,...await cpAutoApply(message.vacancy,sender)};
    if(op==='quick-list-prepare')return {ok:true,...await cpQuickListPrepare(message.vacancy,sender)};
    if(op==='quick-list-call-analysis')return {ok:true,...await cpQuickListCallAnalysis(message.vacancy,sender)};
    if(op==='quick-list-state')return {ok:true,...await cpQuickListState(message.vacancy,sender)};
    if(op==='quick-list-full-analysis')return {ok:true,...await cpQuickListFullAnalysis(message.vacancy,sender,{force:message.force===true})};
    if(op==='quick-list-decision')return {ok:true,...await cpQuickListDecision(message.vacancy,sender,message.decision)};
    if(op==='learning-feedback'){const v=cpCore.vacancy(message.vacancy||{}),accepted=String(message.sentiment||'').toLowerCase()==='accepted',rejected=String(message.sentiment||'').toLowerCase()==='rejected';if(!accepted&&!rejected)throw new Error('Неизвестная обратная связь.');const intel=(await chrome.storage.local.get(cpVacancyIntelKey(v.vacancyId)))[cpVacancyIntelKey(v.vacancyId)];const e=await cpRecordLearningEvent({type:accepted?'FIT_ACCEPTED':'FIT_REJECTED',vacancy:v,accepted,rejected,userAction:accepted?'ACCEPT':'REJECT',source:'fit-feedback',modelDecision:{score:intel?.fit?.score,decision:intel?.fit?.decision,features:intel?.features||intel?.fit?.features||{},ml:intel?.fit?.ml||null},confidence:intel?.analysis?.confidence,meta:{features:intel?.features||intel?.fit?.features||{},fitScore:intel?.fit?.score,ml:intel?.fit?.ml||null}});return {ok:true,event:e,summary:await cpLearningSummary()};}
    if(op==='questionnaire-correction'){const vacancyId=String(message.vacancyId||cpFormVacancyId(sender.url)||'');const jobs=(await applicationJobs()).filter(j=>String(j.plan?.vacancyId||j.context?.vacancy?.vacancyId||'')===vacancyId);const job=jobs.sort((a,b)=>Number(b.context?.updatedAt||0)-Number(a.context?.updatedAt||0))[0]||null;const vacancy=job?.context?.vacancy||{vacancyId,url:sender.url,title:'',company:'',provider:cpCore.provider(sender.url)};const e=await cpRecordLearningEvent({type:'QUESTIONNAIRE_EDITED',vacancy,originalValue:message.originalValue,correctedValue:message.correctedValue,edited:true,userAction:'EDIT',source:'questionnaire-user-correction',meta:{category:String(message.category||'UNKNOWN'),semanticKey:String(message.semanticKey||''),question:cpCore.clip(message.question||'',1000),pageUrl:cpCore.canonicalUrl(sender.url)}});return {ok:true,event:e};}
    if(op==='job-preferences-get')return {ok:true,preferences:await cpJobPreferences()};
    if(op==='job-preferences-save')return {ok:true,preferences:await cpSaveJobPreferences(message.preferences,sender)};
    if(op==='quick-list-complete')return cpQuickListComplete(message,sender);
    if(op==='vacancy-status')return cpVacancyStatus(message.vacancy,sender);
    if(op==='prepared')return cpRememberPrepared(message,sender);
    if(op==='resolve')return {ok:true,...await cpResolve(message.snapshot,sender)};
    if(op==='analyze')return cpAnalyze(message.snapshot,message.style,sender,message.explicitUserRequest===true);
    if(op==='remember-template')return cpRememberTemplate(message.snapshot,message.id,sender);
    if(op==='remember-ai-draft')return cpRememberAiDraft(message.snapshot,message.style,sender);
    if(op==='map'){
      const c=message.snapshot,key=cpCore.conversationKey(c);if(c.identityConfidence==='weak')throw new Error('Нельзя сохранять связь без надёжного идентификатора чата.');if(!key)throw new Error('Чат не определён.');
      const job=await applicationJob(message.id),app=cpCore.application(job);
      if(!job||app.vacancy.provider!==c.provider)throw new Error('Отклик не принадлежит этой платформе.');
      if(c.vacancyId&&app.vacancy.vacancyId&&c.vacancyId!==app.vacancy.vacancyId)throw new Error('В чате указана другая вакансия.');
      const storageKey='vjaConversation:'+key;
      await applicationStateChange(async()=>{const old=(await chrome.storage.local.get(storageKey))[storageKey]||{};await chrome.storage.local.set({[storageKey]:{...old,mapping:{applicationKey:message.id,source:'user',at:Date.now()}}});});return {ok:true};
    }
    if(op==='pending'){
      const key=`vjaCopilotPending:${sender.tab.id}:${sender.frameId||0}`;
      if(message.value){
        const j=await applicationJob(message.value.id);if(!j||j.tabId!==sender.tab.id)throw new Error('Неверный отклик.');
        const target=cpCore.canonicalUrl(message.value.target);if(!target)throw new Error('Некорректный адрес формы.');
        await chrome.storage.session.set({[key]:{id:message.value.id,target,expires:Date.now()+10*60*1000}});return {ok:true};
      }
      const sessionData=await chrome.storage.session.get([key,cpQuickListActiveKey(sender)]),p=sessionData[key];
      if(p&&p.expires>=Date.now()&&p.target===cpCore.canonicalUrl(sender.url)){const job=await applicationJob(p.id);if(job)return {ok:true,pending:await cpPendingPayload(job,{autoContinuation:false})};}
      const active=sessionData[cpQuickListActiveKey(sender)];
      if(active&&active.expires>=Date.now()){const job=await applicationJob(active.id);if(job&&cpIsQuickListContinuation(job,sender,message.pageText||''))return {ok:true,pending:await cpPendingPayload(job,{autoContinuation:true,quickList:true})};}
      const currentId=cpFormVacancyId(sender.url);if(currentId){const jobs=(await applicationJobs()).filter(j=>cpCanRecoverQuickListExact(j,sender,currentId));if(jobs.length===1){const rebound=await updateApplicationJob(jobs[0].plan.id,{tabId:sender.tab.id,frameId:sender.frameId||0})||jobs[0];await chrome.storage.session.set({[cpQuickListActiveKey(sender)]:{id:rebound.plan.id,vacancyId:String(currentId),sourceUrl:cpCore.canonicalUrl(rebound.plan.sourceUrl),expires:Date.now()+30*60*1000}});return {ok:true,pending:await cpPendingPayload(rebound,{autoContinuation:true,quickList:true,recovered:true})};}}
      return {ok:true,pending:null};
    }
    if(op==='open-options'){await chrome.runtime.openOptionsPage();return {ok:true};}
    throw new Error('Неизвестная операция.');
  })().then(respond).catch(e=>respond({ok:false,error:e?.message||'Не удалось выполнить действие.'}));return true;
});
const cpReminderAlarm='vja-followup-reminders';
chrome.alarms?.onAlarm.addListener(alarm=>{if(alarm?.name===cpReminderAlarm)void cpUpdateReminderBadge().catch(()=>{});});
async function cpEnsureReminderAlarm(){await chrome.alarms?.create(cpReminderAlarm,{delayInMinutes:1,periodInMinutes:30});await cpUpdateReminderBadge().catch(()=>{});}
chrome.runtime?.onInstalled.addListener(()=>{void cpEnsureReminderAlarm();});
chrome.runtime?.onStartup.addListener(()=>{void cpEnsureReminderAlarm();});
void cpInitialize().then(()=>cpEnsureReminderAlarm()).catch(()=>{});
