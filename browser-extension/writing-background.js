/* Integration with the existing worker/store. No second backend/database. */
'use strict';
const cpWritingCache=new Map();
async function cpCompleteVacancy(input,sender,{embedded=false}={}){
  let v=cpCore.vacancy(input);
  const covered=['full-dom','full-structured','full-fetch'].includes(v.descriptionCoverage);
  if(!covered||embedded){
    if(v.provider==='hh'&&typeof cpAcquireHhVacancy==='function'){
      v=(await cpAcquireHhVacancy(v,sender,{fast:Boolean(embedded)})).vacancy;
    }else v=await cpReadVacancy(v.url,sender,{fast:Boolean(embedded)});
  }
  if(!['full-dom','full-structured','full-fetch'].includes(v.descriptionCoverage)||String(v.description||'').trim().length<30||v.descriptionTruncated)throw new Error('Полное описание вакансии не прочитано. Сопроводительное письмо не отправлено: повторите попытку.');
  if(!cpCore.sameVacancy(v,input))throw new Error('Открылась другая вакансия. Подготовка остановлена.');
  return v;
}
async function cpCreateLetter(profile,v){
 const R=globalThis.vjaRelevance,T=globalThis.vjaCandidateTruth,X=globalThis.vjaContextReply;
 const selection=R.select(profile,v),lang=selection.analysis.language;
 const cacheKey=cpCore.vacancyKey(v)+'|'+selection.analysis.descriptionHash+'|'+T.revision(profile);
 const config=(await chrome.storage.local.get('vjaWritingProvider')).vjaWritingProvider||{};
 const key=cacheKey+'|'+JSON.stringify({mode:config.mode,model:config.model,endpoint:config.endpoint,consent:config.consent,updatedAt:config.updatedAt});
 if(cpWritingCache.has(key))return cpWritingCache.get(key);
 const task=(async()=>{
  let result=null,providerError='';
  try{
   const prompt=X.prompt(profile,v,selection,null,'cover');
   for(let attempt=0;attempt<2;attempt++){
    const ai=await globalThis.vjaWritingProvider.complete(prompt,{repair:result?.validation?.errors});
    if(!ai.available)break;
    if(prompt.factAliasMap)ai.factIds=(ai.factIds||[]).map(id=>prompt.factAliasMap[id]||id);
    const validation=R.verify(ai.text,profile,{vacancy:v,kind:'cover',factIds:ai.factIds,allowedFacts:prompt.allowedFacts});
    if(ai.factIds.some(id=>!prompt.allowedFacts.some(f=>f.id===id)))validation.errors.push('evidence-outside-selection');
    if(R.language(ai.text)!==lang)validation.errors.push('wrong-language');
    if(R.technical(selection.analysis.role,v)&&profile.github&&!ai.text.includes(profile.github))validation.errors.push('portfolio-missing');
    validation.ok=!validation.errors.length;
    result={...ai,validation,ok:validation.ok,selection};if(result.ok)break;
   }
  }catch(e){providerError=e.message;}
  if(!result?.ok){const rejected=result?.validation?.errors||[];result=R.localCover(profile,v,lang);result.providerWarning=providerError||rejected.join(', ');}
  if(!result.ok)throw new Error('Письмо не прошло проверку: '+(result.validation?.errors||result.errors||[]).join(', '));
  return {...result,audit:{version:'5.2.0',createdAt:Date.now(),profileRevision:T.revision(profile),vacancyHash:selection.analysis.descriptionHash,coverage:v.descriptionCoverage,source:result.source,factIds:result.factIds,facts:selection.allRanked.filter(x=>result.factIds.includes(x.fact.id)).map(x=>({id:x.fact.id,sourceId:x.fact.sourceId,reason:x.reason})),requirementMap:selection.requirementMap,excluded:selection.excluded,validation:result.validation,providerWarning:result.providerWarning||''}};
 })();
 cpWritingCache.set(key,task);task.then(result=>{if(result.providerWarning)cpWritingCache.delete(key);},()=>cpWritingCache.delete(key));if(cpWritingCache.size>40)cpWritingCache.delete(cpWritingCache.keys().next().value);return task;
}
async function cpAnswerCurrentChat(snapshot,style,sender,explicitUserRequest=false){
 cpAssertChatPage(sender,snapshot);
 const T=globalThis.vjaCandidateTruth,R=globalThis.vjaRelevance,X=globalThis.vjaContextReply;
 const c=cpCore.identity(snapshot),key=`${sender.tab.id}:${sender.frameId||0}`,token=crypto.randomUUID();cpAiRequests.set(key,token);
 const resolved=await cpResolve(snapshot,sender),currentData=await cpData(),profile=currentData.profile;
 if(!currentData.settings.aiConsent&&!explicitUserRequest)return {ok:false,code:'consent-required',error:'Разрешите разовый анализ нажатием основной кнопки или включите его в настройках.'};
 const app=resolved.application,context=X.build(profile,app.vacancy,snapshot,resolved.memory||{});
 if(!context.ok)return context;
 context.application={conversationId:c.conversationId||'',applicationId:app.applicationId||app.id||'',vacancyId:c.vacancyId||app.vacancy?.vacancyId||'',vacancyUrl:app.vacancy?.url||'',cvKnown:!resolved.cvUnknown,cvName:app.cvName||'',cvVersion:app.cvVersion||'',coverLetterSent:app.coverLetterMemory?.submittedText||app.coverLetter||'',profileRevisionAtApply:app.profileSnapshot?.profileRevision||''};
 const profileRevision=T.revision(profile);
 let result=null,providerError='';
 try{
  const prompt=X.prompt(profile,app.vacancy,context.selection,context,style||'dialog');
  prompt.payload.applicationContext=context.application;
  for(let attempt=0;attempt<2;attempt++){
   const ai=await globalThis.vjaWritingProvider.complete(prompt,{repair:result?.validation?.errors});
   if(!ai.available)break;
   const validation=R.verify(ai.text,profile,{vacancy:app.vacancy,kind:'reply',factIds:ai.factIds,allowedFacts:prompt.allowedFacts,latestInbound:context.latest.text});
   const coverage=X.verifyCoverage(ai,context);validation.errors.push(...coverage.errors);
   if(ai.factIds.some(id=>!prompt.allowedFacts.some(f=>f.id===id)))validation.errors.push('evidence-outside-selection');
   if(R.language(ai.text)!==context.language)validation.errors.push('wrong-language');
   validation.ok=!validation.errors.length;result={...ai,ok:validation.ok,validation};if(result.ok)break;
  }
 }catch(e){providerError=e.message;}
 if(cpAiRequests.get(key)!==token)return {ok:false,code:'stale',error:'Переписка изменилась. Старый ответ отклонён.'};
 if(!result?.ok){const failedValidation=result?.validation;result=X.local(profile,app.vacancy,context,style);result.providerWarning=providerError||(failedValidation?.errors||[]).join(', ');}
 if(!result?.ok)return {...result,readDiagnostics:snapshot.readDiagnostics,latestRead:context.latest.text,messageCount:context.messages.length};
 if(T.revision((await cpData()).profile)!==profileRevision)return {ok:false,code:'stale-profile',error:'Профиль обновлён во время анализа. Повторите запрос.'};
 if(cpAiRequests.get(key)!==token)return {ok:false,code:'stale',error:'Переписка изменилась.'};
 const threadKey=cpCore.conversationKey(c);
 // Weak identities can be used for an ephemeral draft, not long-term mappings.
 if(threadKey&&snapshot.identityConfidence!=='weak')await applicationStateChange(async()=>{
  if(cpAiRequests.get(key)!==token)return;
  const k='vjaConversation:'+threadKey,previous=(await chrome.storage.local.get(k))[k]||{};
  await chrome.storage.local.set({[k]:{...previous,memory:{...context.memory,questions:context.questions,lastDraft:{text:result.text,factIds:result.factIds,sent:false,source:result.source}},updatedAt:Date.now()}});
 });
 return {ok:true,context:c,requestId:snapshot.requestId,triage:{suggestedReply:result.text},source:result.source,providerWarning:result.providerWarning||'',missingFacts:result.missingFacts||[],evidenceIds:result.factIds||[],latestRead:context.latest.text,messageCount:context.messages.length,readDiagnostics:snapshot.readDiagnostics,stage:cpCore.stage(context.latest.text),historyPartial:context.historyPartial,cvUnknown:Boolean(resolved.cvUnknown),vacancy:app.vacancy,ephemeral:Boolean(resolved.ephemeral),validation:result.validation||null};
}

// The legacy dashboard/advanced popup use the same truth/evidence route before execution.
async function cpEnrichExistingPlan(plan){
 const data=await cpData();
 const vacancy=await cpCompleteVacancy({url:plan.sourceUrl,title:plan.jobTitle||'',provider:cpCore.provider(plan.sourceUrl),vacancyId:cpCore.idFromUrl(plan.sourceUrl)},{url:plan.sourceUrl});
 const writing=await cpCreateLetter(data.profile,vacancy);
 const role=writing.selection.analysis.role,language=writing.selection.analysis.language;
 const stored=await chrome.storage.local.get(['cvVaultRu','cvVaultEn']),cv=cpCore.cvSelection(role,language,stored);
 const version=cv.file?`${cv.file.savedAt||''}:${cv.file.size}:${cpCore.hash(cv.file.base64?.slice(-100)||'')}`:'';
 return {plan:{...plan,coverLetter:writing.text,letterVersion:'5.2.0-evidence',roleVariant:role,cvKey:cv.key,fileData:cv.file||null,resumeHint:vacancy.provider==='hh'?vacancy.title:(cv.file?.name||vacancy.title)},context:{vacancy,role,language,profileSnapshot:data.profile,cvKey:cv.key,cvVersion:version,cvName:cv.file?.name||'',coverLetter:writing.text,evidenceAudit:writing.audit,coverLetterMemory:{text:writing.text,source:writing.source,evidenceAudit:writing.audit,generatedAt:Date.now()},status:'Preparing'}};
}
