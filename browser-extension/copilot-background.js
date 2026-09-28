/* Extends the existing service worker and application-job store; no second backend. */
'use strict';
const cpCore=globalThis.vjaCopilotCore;
const cpFollow=globalThis.vjaFollowUpIntelligence;
const cpAnalytics=globalThis.vjaApplicationAnalytics;
const cpState=globalThis.vjaApplicationState;
const cpKey='vjaCandidateTruthProfile';
let cpInit=null;
const cpAiRequests=new Map();
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
    if(!/(^|\.)hh\.ru$/i.test(page.hostname)||!/(^|\.)hh\.ru$/i.test(target.hostname)||!v.vacancyId)throw new Error('Не удалось подтвердить HH-вакансию из списка.');
    return;
  }
  if(page.origin!==target.origin)throw new Error('Вакансия относится к другой странице.');
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
async function cpPrepare(vInput,sender,legacyPlan=null,options={}){
  if(options.embedded)cpAssertEmbeddedVacancy(sender,vInput);else cpAssertPage(sender,vInput.url);
  const v=options.safePreparation?cpCore.vacancy(vInput):await cpCompleteVacancy(vInput,sender,{embedded:Boolean(options.embedded)});if(!v.title||!cpCore.vacancyKey(v))throw new Error('Не удалось однозначно определить вакансию.');
  const previousJob=(await applicationJobs()).find(j=>cpCore.sameVacancy(cpCore.application(j).vacancy,v));
  if(previousJob&&['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(cpCore.application(previousJob).status))return {duplicate:true,application:cpCore.application(previousJob)};
  const data=await cpData(), role=cpCore.classifyRole(v.title,v.description),lang=cpCore.language(v.title+' '+v.description);
  const writing=await cpCreateLetter(data.profile,v);
  let record;
  await applicationStateChange(async()=>{
    const jobs=await applicationJobs();
    let job=jobs.find(j=>cpCore.sameVacancy(cpCore.application(j).vacancy,v));
    if(job && ['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(cpCore.application(job).status)) {record={duplicate:true,application:cpCore.application(job)};return;}
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
  return prepared;
}
async function cpQuickListComplete(message,sender){
  const job=await applicationJob(message.id);if(!job)throw new Error('Контекст быстрого отклика не найден.');
  if(job.tabId!==sender.tab.id||Number(job.frameId||0)!==Number(sender.frameId||0))throw new Error('Быстрый отклик относится к другой вкладке.');
  const submitted=message.appliedConfirmed===true,letterSent=message.coverLetterSubmitted===true,now=Date.now();
  if(!submitted)throw new Error('Сайт не подтвердил отклик.');
  let memory={...(job.context?.coverLetterMemory||{}),text:job.context?.coverLetter||'',updatedAt:now};
  if(letterSent)memory={...memory,submittedAt:now,submittedText:job.context?.coverLetter||'',submittedCvName:job.context?.cvName||''};
  let context={...(job.context||{}),status:'Applied',statusSource:'native-list-click',coverLetterMemory:memory,updatedAt:now};
  context=cpWithTimeline(context,'submitted-native-list',letterSent?'Быстрый отклик из списка + сопроводительное письмо отправлены':'Отклик из списка отправлен; сопроводительное письмо требует проверки',{coverLetterSubmitted:letterSent,vacancyId:job.plan?.vacancyId||''});
  const result={submitted:true,status:'confirmed',coverLetterFilled:letterSent,nativeList:true};
  const next=await updateApplicationJob(message.id,{context,completed:true,review:false,reason:letterSent?null:'Сопроводительное письмо не подтверждено сайтом.',pending:null,result:{id:message.id,trackedId:job.plan?.trackedId||job.plan?.vacancyId||'',sourceUrl:job.plan?.sourceUrl||'',coverLetter:job.context?.coverLetter||'',createdAt:now,result}});
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
  const linked=await chrome.storage.session.get(`vjaCopilotPending:${sender.tab.id}:${sender.frameId||0}`);
  const pending=linked[`vjaCopilotPending:${sender.tab.id}:${sender.frameId||0}`];
  if(!same&&(!pending||pending.id!==message.id||pending.target!==cpCore.canonicalUrl(sender.url)))throw new Error('Изменился адрес формы.');
  const state=message.reviewCount?'Needs review':'Ready';
  const context=cpWithTimeline({...job.context,status:state},message.reviewCount?'needs-review':'ready',message.reviewCount?`${message.reviewCount} полей требуют проверки`:'Форма готова к проверке',{reviewCount:Number(message.reviewCount||0)});
  await updateApplicationJob(message.id,{context,review:true,result:{id:job.plan.id,result:{submitted:false,status:'needs-review',reason:'user-submit-required',coverLetterFilled:Boolean(message.coverLetterFilled)}}});
  return {ok:true,status:state};
}
async function cpReadVacancy(url,sender){
  const canonical=cpCore.canonicalUrl(url);if(!canonical)throw new Error('Некорректная ссылка на вакансию.');
  const key='vjaVacancyCache:'+cpCore.hash(canonical);const cached=(await chrome.storage.local.get(key))[key];
  if(cached?.vacancy && ['full-dom','full-structured','full-fetch'].includes(cached.vacancy.descriptionCoverage) && cpCore.canonicalUrl(cached.vacancy.url)===canonical && Date.now()-cached.at<15*60*1000)return cached.vacancy;
  const u=new URL(canonical), source=new URL(sender.url);
  // No access to arbitrary private-network endpoints on behalf of a web page.
  if(u.origin!==source.origin && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname))throw new Error('Небезопасный адрес вакансии.');
  if(!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw new Error('Откройте вакансию и включите помощника для её сайта один раз.');
  let tab;
  try{
    tab=await chrome.tabs.create({url:canonical,active:false});
    await browserAutopilotWaitForTab(tab.id,10000);
    await cpInject(tab.id);
    const result=await browserAutopilotWithTimeout(chrome.tabs.sendMessage(tab.id,{type:'vjaCopilotPage',action:'vacancy'},{frameId:0}),6000,'Не удалось прочитать вакансию.');
    if(!result?.vacancy?.description)throw new Error('Сайт не предоставил текст вакансии.');
    const v=cpCore.vacancy(result.vacancy);
    if(!v.descriptionCoverage)v.descriptionCoverage='full-dom';
    if(v.provider!==cpCore.provider(canonical)||cpCore.idFromUrl(canonical)&&v.vacancyId!==cpCore.idFromUrl(canonical))throw new Error('Ссылка открыла другую вакансию.');
    await chrome.storage.local.set({[key]:{vacancy:v,at:Date.now()}});return v;
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
async function cpRegisterOrigin(origin){
  const pattern=new URL(origin).origin+'/*';
  if(!await chrome.permissions.contains({origins:[pattern]}))throw new Error('Разрешение на сайт не выдано.');
  const scripts=chrome.runtime.getManifest().content_scripts.find(s=>s.js.includes('copilot-core.js')).js;
  if(['hh.ru','www.hh.ru'].includes(new URL(origin).hostname)||new URL(origin).hostname.endsWith('.hh.ru'))return {ok:true};
  const id='vja-site-'+cpCore.hash(pattern);
  const existing=await chrome.scripting.getRegisteredContentScripts({ids:[id]});
  if(!existing.length)await chrome.scripting.registerContentScripts([{id,matches:[pattern],js:scripts,allFrames:true,runAt:'document_idle',persistAcrossSessions:true}]);
  return {ok:true};
}
chrome.commands?.onCommand.addListener(async(command,tab)=>{
  try{
    if(!tab?.id)[tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)return;
    const key=`vjaCopilotFocus:${tab.id}`,focus=(await chrome.storage.session.get(key))[key];
    await chrome.tabs.sendMessage(tab.id,{type:'vjaCopilotPage',action:'command',command},{frameId:focus?.frameId||0});
  }catch{/* On ungranted sites the toolbar explains how to grant this site only. */}
});
chrome.permissions?.onRemoved.addListener(async()=>{
  try{for(const script of await chrome.scripting.getRegisteredContentScripts())if(script.id.startsWith('vja-site-')&&!await chrome.permissions.contains({origins:script.matches}))await chrome.scripting.unregisterContentScripts({ids:[script.id]});}catch{}
});
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
      if(op==='applications'){const apps=(await applicationJobs()).map(cpCore.application);return {ok:true,applications:apps.map(cpPublicApplication),analytics:cpAnalytics?.summarize(apps)||null,dueCount:cpFollow?.dueItems(apps.map(cpPublicApplication),Date.now()).length||0};}
      if(op==='mark-status'){
        if(!['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(message.status))throw new Error('Неизвестный статус.');
        const j=await applicationJob(message.id);if(!j)throw new Error('Отклик не найден.');
        let nextAction=j.context?.nextAction;if(['Offer','Rejected','Closed'].includes(message.status)&&nextAction&&!nextAction.doneAt)nextAction={...nextAction,doneAt:Date.now()};
        const context=cpWithTimeline({...j.context,status:message.status,statusSource:'user-confirmed',nextAction},'status',`Статус: ${message.status}`,{status:message.status});
        await updateApplicationJob(message.id,{context,completed:message.status==='Applied'||j.completed});await cpUpdateReminderBadge().catch(()=>{});return {ok:true};
      }
      if(op==='next-action')return {ok:true,application:await cpChangeNextAction(message.id,message.mode,Number(message.days)||1)};
      if(op==='set-followup')return {ok:true,application:await cpChangeNextAction(message.id,'manual',Number(message.days)||3)};
      if(op==='open-options'){await chrome.runtime.openOptionsPage();return {ok:true};}
    }
    const chatOps=new Set(['quick-context','observe-chat','resolve','analyze','remember-template','remember-ai-draft','map']);
    if(op==='quick-list-prepare')cpAssertEmbeddedVacancy(sender,message.vacancy||{});
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
      const letter=cpCore.clip(message.text,8000),now=Date.now();const memory={...(job.context?.coverLetterMemory||{}),text:letter,source:'user-edited',updatedAt:now};await updateApplicationJob(message.id,{context:{...job.context,coverLetter:letter,coverLetterMemory:memory,coverLetterSource:'user-edited',updatedAt:now}});return {ok:true};
    }
    if(op==='focus'){await chrome.storage.session.set({[`vjaCopilotFocus:${sender.tab.id}`]:{frameId:sender.frameId||0,at:Date.now()}});return {ok:true};}
    if(op==='invalidate'){cpAiRequests.delete(`${sender.tab.id}:${sender.frameId||0}`);return {ok:true};}
    if(op==='prepare')return {ok:true,...await cpPrepare(message.vacancy,sender,message.legacyPlan,{safePreparation:true})};
    if(op==='auto-apply')return {ok:true,...await cpAutoApply(message.vacancy,sender)};
    if(op==='quick-list-prepare')return {ok:true,...await cpQuickListPrepare(message.vacancy,sender)};
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
      const p=(await chrome.storage.session.get(key))[key];
      if(!p||p.expires<Date.now()||p.target!==cpCore.canonicalUrl(sender.url))return {ok:true,pending:null};
      const job=await applicationJob(p.id);if(!job)return {ok:true,pending:null};
      const file=(await chrome.storage.local.get(job.context.cvKey||[]))[job.context.cvKey];
      const cvVersion=file?`${file.savedAt||''}:${file.size}:${cpCore.hash(file.base64?.slice(-100)||'')}`:'';
      return {ok:true,pending:{application:cpCore.application(job),context:job.context,profile:job.context.profileSnapshot,coverLetter:job.context.coverLetter,role:job.context.role,cvFile:cvVersion===job.context.cvVersion&&cpCore.cvValid(file)?file:null}};
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
