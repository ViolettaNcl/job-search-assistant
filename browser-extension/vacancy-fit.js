/* Violetta 4.0 explainable vacancy fit/ranking. Deterministic rules only: no ML claims. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaVacancyFit=api;})(globalThis,function(){
  'use strict';
  const DEFAULTS=Object.freeze({
    schemaVersion:1,
    preferredRoles:['technical_support','developer','customer_support','qa','implementation'],
    dislikedRoles:['sales'],
    avoidCalls:true,
    avoidSales:true,
    remotePreferred:true,
    officeAllowed:true,
    minimumFitScore:80,
    batchConcurrency:3,
    maxBatchPerPage:80
  });
  const clean=(v,n=60000)=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
  const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const arr=v=>Array.isArray(v)?v:[];
  const lower=v=>clean(v).toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
  const roleLabels={technical_support:'Техподдержка',developer:'Разработка',customer_support:'Поддержка клиентов',qa:'QA',implementation:'Внедрение',education:'Обучение',content:'Контент',operations:'Операции',sales:'Продажи',other:'Другое'};
  const TECH_ALIASES={
    'c#':['c#','csharp'],'.net':['.net','dotnet'],'asp.net core':['asp.net core','aspnet core'],'ef core':['ef core','entity framework core'],
    'sql server':['sql server','mssql'],'sql':['sql'],'rest api':['rest api','restful api'],'api':['api'],'docker':['docker'],'git':['git'],'github actions':['github actions'],
    'javascript':['javascript','js'],'typescript':['typescript','ts'],'python':['python'],'java':['java'],'linux':['linux'],'windows':['windows'],'postman':['postman'],
    'jira':['jira'],'zendesk':['zendesk'],'react':['react'],'next.js':['next.js','nextjs'],'php':['php'],'redis':['redis'],'mongodb':['mongodb'],'kubernetes':['kubernetes'],
    'rabbitmq':['rabbitmq'],'kafka':['kafka'],'azure':['azure'],'aws':['aws'],'signalr':['signalr'],'jwt':['jwt'],'wpf':['wpf'],'xaml':['xaml']
  };
  function normalizePreferences(input={}){
    const p={...DEFAULTS,...(input||{})};
    p.preferredRoles=uniq(arr(p.preferredRoles).map(x=>clean(x,60))).slice(0,30);
    p.dislikedRoles=uniq(arr(p.dislikedRoles).map(x=>clean(x,60))).slice(0,30);
    p.avoidCalls=p.avoidCalls!==false;p.avoidSales=p.avoidSales!==false;p.remotePreferred=p.remotePreferred!==false;p.officeAllowed=p.officeAllowed!==false;
    p.minimumFitScore=clamp(p.minimumFitScore||80,50,100);
    p.batchConcurrency=clamp(p.batchConcurrency||3,1,4);
    p.maxBatchPerPage=clamp(p.maxBatchPerPage||80,10,150);
    return p;
  }
  function canonicalSkill(value){
    const x=lower(value);
    for(const [name,aliases] of Object.entries(TECH_ALIASES))if(aliases.some(a=>x===a||x.includes(a)))return name;
    return x.replace(/[^a-zа-я0-9#+.]+/gi,' ').trim();
  }
  function profileSignals(profile={}){
    const facts=arr(profile.facts).filter(f=>f&&f.status==='CONFIRMED'&&!f.pendingReview);
    const skills=uniq(facts.filter(f=>f.kind==='skill').map(f=>canonicalSkill(f.text||f.textEn||f.textRu)).filter(Boolean));
    const allText=lower(facts.map(f=>[f.text,f.textEn,f.textRu].filter(Boolean).join(' ')).join(' '));
    const roles=uniq(facts.flatMap(f=>arr(f.roles)).map(x=>clean(x,60)));
    return {skills,roles,allText,hasEnglish:/english|английск/.test(allText),hasSupport:/support|поддерж|troubleshoot|диагност/.test(allText)};
  }
  function yearsRequirement(text=''){
    const x=lower(text),matches=[...x.matchAll(/(?:от\s*)?(\d{1,2})\s*(?:\+\s*)?(?:лет|года|год|years?|yrs?)/g)].map(m=>Number(m[1])).filter(n=>n>0&&n<30);
    return matches.length?Math.max(...matches):0;
  }
  function extractFeatures(vacancy={},callAnalysis=null,analysis={}){
    const body=lower([vacancy.title,vacancy.description,vacancy.requirements].filter(Boolean).join('\n'));
    const technologies=uniq(arr(analysis.technologies).map(canonicalSkill).filter(Boolean));
    const role=clean(analysis.role||'other',60)||'other';
    const remote=Boolean(analysis.remote||vacancy.remote||/удален|удалён|remote|work\s*from\s*home|wfh/.test(body));
    const officeOnly=/только\s+офис|работа\s+в\s+офисе|office[- ]only|on[- ]site\s+only|только\s+в\s+офисе/.test(body)&&!remote;
    const sales=role==='sales'||/холодн.*продаж|активн.*продаж|sales manager|менеджер\s+по\s+продаж/.test(body);
    const senior=/\bsenior\b|\blead\b|\bstaff\b|\bprincipal\b|ведущ|старш/.test(body);
    const junior=/\bjunior\b|стажер|стажёр|младш/.test(body);
    const englishRequired=/английск[^.!?]{0,40}(?:b2|c1|c2|upper|свобод|fluent)|english[^.!?]{0,40}(?:b2|c1|c2|upper|fluent|required)/.test(body);
    const requiredYears=yearsRequirement(body);
    return {role,roleLabel:roleLabels[role]||role,technologies,remote,officeOnly,sales,senior,junior,englishRequired,requiredYears,calls:callAnalysis?.status||'unknown'};
  }
  function scoreVacancy(vacancy={},profile={},preferencesInput={},callAnalysis=null,relevanceAnalysis={}){
    const preferences=normalizePreferences(preferencesInput),candidate=profileSignals(profile),features=extractFeatures(vacancy,callAnalysis,relevanceAnalysis);
    let score=50;const reasons=[],risks=[];const matchedSkills=[],missingSkills=[];
    if(preferences.preferredRoles.includes(features.role)){score+=14;reasons.push(`Роль «${features.roleLabel}» входит в предпочтительные`);} 
    else if(features.role!=='other'){score+=2;reasons.push(`Определено направление: ${features.roleLabel}`);} 
    if(preferences.dislikedRoles.includes(features.role)){score-=35;risks.push(`Направление «${features.roleLabel}» отмечено как нежелательное`);} 
    if(features.sales&&preferences.avoidSales){score-=30;risks.push('В вакансии есть выраженный sales-фокус');}
    if(features.calls==='calls'){
      if(preferences.avoidCalls){score-=70;risks.push('Есть телефонные/голосовые звонки');}
      else {score-=8;risks.push('Есть звонки');}
    }else if(features.calls==='no-calls'){score+=10;reasons.push('В полном описании нет обязательных звонков');}
    else risks.push('Статус звонков пока не подтверждён');
    if(preferences.remotePreferred){
      if(features.remote){score+=10;reasons.push('Удалённый формат');}
      else if(features.officeOnly&&!preferences.officeAllowed){score-=28;risks.push('Требуется работа из офиса');}
      else if(features.officeOnly){score-=8;risks.push('Вакансия выглядит офисной');}
    }
    const candidateSkills=new Set(candidate.skills);
    for(const tech of features.technologies){if(candidateSkills.has(tech)){matchedSkills.push(tech);}else missingSkills.push(tech);}
    if(features.technologies.length){
      const ratio=matchedSkills.length/features.technologies.length;
      const skillBoost=Math.min(22,matchedSkills.length*4+Math.round(ratio*8));score+=skillBoost;
      if(matchedSkills.length)reasons.push(`Совпадают навыки: ${matchedSkills.slice(0,5).join(', ')}`);
      if(missingSkills.length){const penalty=Math.min(12,missingSkills.length*2);score-=penalty;risks.push(`Не подтверждены: ${missingSkills.slice(0,4).join(', ')}`);}
    }else reasons.push('Нет жёсткого списка технологий для сравнения');
    if(features.junior){score+=5;reasons.push('Junior / начальный уровень роли');}
    if(features.senior){score-=16;risks.push('В названии/описании есть Senior/Lead уровень');}
    if(features.requiredYears>=5){score-=16;risks.push(`Требуется около ${features.requiredYears}+ лет опыта`);}else if(features.requiredYears>=3){score-=8;risks.push(`Требуется около ${features.requiredYears}+ лет опыта`);}else if(features.requiredYears>0){score-=2;}
    if(features.englishRequired){if(candidate.hasEnglish){score+=4;reasons.push('Требование английского поддерживается профилем');}else{score-=12;risks.push('Требуется английский, но подтверждение не найдено в профиле');}}
    if(features.role==='technical_support'&&candidate.hasSupport){score+=4;reasons.push('Есть подтверждённый технический/support-контекст');}
    if(preferences.avoidCalls&&features.calls==='calls')score=Math.min(score,25);
    if(preferences.avoidSales&&features.sales)score=Math.min(score,35);
    score=Math.round(clamp(score));
    const decision=score>=88?'STRONG_MATCH':score>=preferences.minimumFitScore?'MATCH':score>=60?'REVIEW':'SKIP';
    const ready=(features.calls==='no-calls'||!preferences.avoidCalls)&&!features.sales&&score>=preferences.minimumFitScore;
    return {score,decision,ready,reasons:reasons.slice(0,6),risks:risks.slice(0,6),matchedSkills,missingSkills,features,preferencesVersion:1,algorithm:'rules-v1'};
  }
  function terminalApplication(state={}){state=state||{};const s=clean(state.status,80);return Boolean(state.completed||['Applied','Viewed','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(s));}
  function queueItems(records=[],preferencesInput={}){
    const preferences=normalizePreferences(preferencesInput);
    return arr(records).filter(r=>r?.fit&&r.fit.score>=preferences.minimumFitScore&&r.fit.ready&&r.analysis?.status!=='calls'&&!terminalApplication(r.application)&&r.decision!=='SKIPPED').sort((a,b)=>Number(b.fit.score)-Number(a.fit.score)||String(a.vacancy?.title||'').localeCompare(String(b.vacancy?.title||'')));
  }
  return {DEFAULTS,normalizePreferences,canonicalSkill,profileSignals,extractFeatures,scoreVacancy,terminalApplication,queueItems};
});
