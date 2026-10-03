/* Violetta 5.0 personal learning foundation. Rules + user labels; no fake ML claims. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaLearningCore=api;})(globalThis,function(){
  'use strict';
  const SCHEMA_VERSION=1;
  const TYPES=new Set(['VACANCY_APPLIED','VACANCY_SKIPPED','VACANCY_SAVED','VACANCY_REVIEWED','FIT_ACCEPTED','FIT_REJECTED','QUESTIONNAIRE_ACCEPTED','QUESTIONNAIRE_EDITED','COVER_LETTER_EDITED','CHAT_REPLY_EDITED','SALARY_CONFIRMED','OUTCOME_CHANGED','INTERVIEW_PREP_USED','MODEL_FEEDBACK']);
  const clean=(v,n=5000)=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const arr=v=>Array.isArray(v)?v:[];
  const uniq=a=>[...new Set(arr(a).filter(Boolean))];
  function event(input={}){
    const type=clean(input.type,80).toUpperCase();if(!TYPES.has(type))throw new Error('Unsupported learning event: '+type);
    const v=input.vacancy||{};
    return {schemaVersion:SCHEMA_VERSION,eventId:clean(input.eventId||`le-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,120),timestamp:Number(input.timestamp)||Date.now(),type,vacancyId:clean(input.vacancyId||v.vacancyId,120),company:clean(input.company||v.company,300),title:clean(input.title||v.title,500),provider:clean(input.provider||v.provider,80),contextType:clean(input.contextType||'vacancy',80),input:input.input??null,modelDecision:input.modelDecision??null,userAction:clean(input.userAction,120),originalValue:clean(input.originalValue,8000),correctedValue:clean(input.correctedValue,8000),accepted:input.accepted===true,rejected:input.rejected===true,edited:input.edited===true,source:clean(input.source||'extension',120),confidence:Number.isFinite(Number(input.confidence))?clamp(input.confidence,0,1):null,meta:input.meta&&typeof input.meta==='object'?input.meta:{}};
  }
  function positiveWeight(type){return ({VACANCY_APPLIED:3,VACANCY_SAVED:1.5,VACANCY_REVIEWED:.4,FIT_ACCEPTED:2,QUESTIONNAIRE_ACCEPTED:.5,SALARY_CONFIRMED:.4,INTERVIEW_PREP_USED:.5}[type]||0);}
  function negativeWeight(type){return ({VACANCY_SKIPPED:2.5,FIT_REJECTED:2}[type]||0);}
  function deriveSignals(events=[]){
    const roleWeights={},techWeights={},companyWeights={};let remote=0,calls=0,sales=0,total=0,positive=0,negative=0,edits=0;
    for(const raw of arr(events)){let e;try{e=event(raw);}catch{continue;}total++;const p=positiveWeight(e.type),n=negativeWeight(e.type);positive+=p;negative+=n;if(e.edited||/_EDITED$/.test(e.type))edits++;
      const f=e.meta?.features||e.modelDecision?.features||{};const role=clean(f.role,80);if(role)roleWeights[role]=(roleWeights[role]||0)+p-n;
      for(const t of uniq(f.technologies||[]).slice(0,30)){const k=clean(t,80).toLowerCase();if(k)techWeights[k]=(techWeights[k]||0)+p-n;}
      const c=clean(e.company,200).toLowerCase();if(c)companyWeights[c]=(companyWeights[c]||0)+(p-n)*.35;
      if(f.remote)remote+=p-n;if(f.calls==='calls')calls+=p-n;if(f.sales)sales+=p-n;
    }
    const capMap=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,clamp(v,-8,8)]));
    return {schemaVersion:SCHEMA_VERSION,total,positive,negative,edits,roleWeights:capMap(roleWeights),techWeights:capMap(techWeights),companyWeights:capMap(companyWeights),remoteWeight:clamp(remote,-8,8),callsWeight:clamp(calls,-8,8),salesWeight:clamp(sales,-8,8)};
  }
  function adjustFit(baseFit={},signals={},vacancy={}){
    const f=baseFit.features||{},reasons=[],risks=[];let delta=0;
    const role=clean(f.role,80);if(role&&signals.roleWeights?.[role]){const w=signals.roleWeights[role];delta+=w; (w>0?reasons:risks).push(`${w>0?'+':''}${Math.round(w)} персональный сигнал по роли`);}
    for(const tech of arr(f.technologies)){const w=signals.techWeights?.[clean(tech,80).toLowerCase()]||0;if(!w)continue;delta+=w*.45;(w>0?reasons:risks).push(`${w>0?'+':''}${Math.round(w*.45)} из прошлых решений по ${tech}`);}
    if(f.remote&&signals.remoteWeight){delta+=signals.remoteWeight*.5;(signals.remoteWeight>0?reasons:risks).push('Учтено предпочтение удалёнки из прошлых решений');}
    if(f.calls==='calls'&&signals.callsWeight){delta+=signals.callsWeight*.5;(signals.callsWeight>0?reasons:risks).push('Учтена история решений по вакансиям со звонками');}
    if(f.sales&&signals.salesWeight){delta+=signals.salesWeight*.5;(signals.salesWeight>0?reasons:risks).push('Учтена история решений по sales-вакансиям');}
    const c=clean(vacancy.company,200).toLowerCase();if(c&&signals.companyWeights?.[c])delta+=signals.companyWeights[c];
    delta=clamp(delta,-15,15);const score=Math.round(clamp(Number(baseFit.score||0)+delta,0,100));
    const min=Number(baseFit.preferences?.minimumFitScore||baseFit.minimumFitScore||80);const decision=score>=88?'STRONG_MATCH':score>=min?'MATCH':score>=60?'REVIEW':'SKIP';
    return {...baseFit,score,decision,learning:{delta:Math.round(delta),reasons:reasons.slice(0,4),risks:risks.slice(0,4),signalCount:Number(signals.total||0),mode:'personal-signals-v1'},algorithm:'rules-v1+personal-signals'};
  }
  function confidenceBand(confidence){const c=clamp(confidence,0,1);return c>=.9?'AUTO':c>=.65?'REVIEW':'ASK';}
  function normalizeQuestion(q=''){return clean(q,1200).toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9+#.]+/gi,' ').replace(/\s+/g,' ').trim();}
  function tokens(q=''){return new Set(normalizeQuestion(q).split(' ').filter(x=>x.length>=3));}
  function semanticSimilarity(a,b){const A=tokens(a),B=tokens(b);if(!A.size&&!B.size)return 1;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(1,A.size+B.size-i);}
  function summary(events=[]){const s=deriveSignals(events);const counts={};for(const e of arr(events)){const t=clean(e?.type,80);if(t)counts[t]=(counts[t]||0)+1;}return {...s,counts};}
  function datasetRows(events=[]){return arr(events).map(raw=>{let e;try{e=event(raw);}catch{return null;}const f=e.meta?.features||e.modelDecision?.features||{};let label=null;if(['VACANCY_APPLIED','VACANCY_SAVED','FIT_ACCEPTED'].includes(e.type))label=1;if(['VACANCY_SKIPPED','FIT_REJECTED'].includes(e.type))label=0;if(label===null)return null;return {eventId:e.eventId,timestamp:e.timestamp,vacancyId:e.vacancyId,title:e.title,company:e.company,role:clean(f.role,80),remote:Boolean(f.remote),calls:clean(f.calls,40),sales:Boolean(f.sales),senior:Boolean(f.senior),junior:Boolean(f.junior),requiredYears:Number(f.requiredYears||0),technologies:arr(f.technologies).slice(0,30),labelUserApply:label};}).filter(Boolean);}
  return {SCHEMA_VERSION,TYPES,event,deriveSignals,adjustFit,confidenceBand,normalizeQuestion,semanticSimilarity,summary,datasetRows};
});
