/* Evidence-based questionnaire answer engine (4.0.0). */
(function(root,factory){
  const api=factory(root.vjaQuestionnaireCore||((typeof require==='function')?require('./questionnaire-core.js'):null));
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.vjaQuestionnaireAnswerEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Q){
  'use strict';
  const clean=v=>Q?.clean?Q.clean(v):String(v||'').replace(/\s+/g,' ').trim();
  function facts(profile={}){return (profile.facts||[]).filter(f=>f&&f.status==='CONFIRMED');}
  function factText(f,lang='ru'){if(!f)return '';return clean((lang==='en'?f.textEn:f.textRu)||f.text||'');}
  function roleFacts(profile,role){return facts(profile).filter(f=>!role||!Array.isArray(f.roles)||!f.roles.length||f.roles.includes(role));}
  function byTopic(profile,topics,role='',allowGlobal=false){const ts=topics.map(x=>String(x).toLowerCase());const pool=allowGlobal?facts(profile):roleFacts(profile,role);return pool.filter(f=>{const hay=[f.kind,f.id,...(f.topics||[])].join(' ').toLowerCase();return ts.some(t=>hay.includes(t));});}
  function uniqueTexts(items,lang,max=3){const out=[];for(const f of items){const t=factText(f,lang);if(t&&!out.includes(t)){out.push(t);if(out.length>=max)break;}}return out;}
  function clipAnswer(value,maxLength=0){let s=clean(value);if(maxLength>0&&s.length>maxLength){const slice=s.slice(0,Math.max(1,maxLength));const cut=Math.max(slice.lastIndexOf('. '),slice.lastIndexOf('; '));s=(cut>Math.floor(maxLength*.55)?slice.slice(0,cut+1):slice).trim();}return s;}
  function salaryValue(profile,lang){
    const direct=clean(profile.salaryExpectation||profile.expectedSalary||profile.compensationExpectation||'');if(direct)return direct;
    const fs=facts(profile).filter(f=>f.kind==='salary'||(f.topics||[]).some(t=>/salary|compensation|зарплат/i.test(String(t)))||/зарплат|оклад|salary|compensation/i.test(f.id||''));
    return factText(fs[0],lang);
  }
  function projects(profile,lang,role){const base=facts(profile).filter(f=>f.kind==='project'&&(!role||!f.roles?.length||f.roles.includes(role)));const details=facts(profile).filter(f=>f.kind==='project_detail');const selected=base.slice(0,2);let texts=uniqueTexts(selected,lang,2);if(selected[0]){const d=details.find(x=>x.projectId===selected[0].id);if(d){const dt=factText(d,lang);if(dt)texts.splice(1,0,dt);}}return texts.slice(0,3);}
  function english(profile,lang){
    const languageFact=facts(profile).find(f=>f.kind==='language'&&(f.topics||[]).some(t=>String(t).toLowerCase()==='english'))||facts(profile).find(f=>/англий|english/i.test(f.text||''));
    if(!languageFact)return [];
    const usage=facts(profile).filter(f=>['exp-translator','exp-crowne'].includes(f.id)||(f.topics||[]).some(t=>['translation','international'].includes(String(t).toLowerCase())));
    return [factText(languageFact,lang),...uniqueTexts(usage,lang,1)].filter(Boolean);
  }
  function relevantTechnical(profile,question,role,lang){
    const q=String(question||'').toLowerCase();const pool=roleFacts(profile,role).filter(f=>['skill','task','project','project_detail','experience','communication'].includes(f.kind));
    const tokens=q.split(/[^a-zа-я0-9#+.]+/i).filter(x=>x.length>=3);const scored=pool.map(f=>{const hay=[f.id,f.kind,f.text,...(f.topics||[])].join(' ').toLowerCase();let score=0;for(const t of tokens)if(hay.includes(t))score++;if(f.kind==='skill')score+=.2;return {f,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    return uniqueTexts(scored.map(x=>x.f),lang,3);
  }
  function result(action,category,reason,extra={}){return {action,category,reason,source:'questionnaire-engine',confidence:action==='fill'?.9:0,...extra};}

  function humanFallback({category,question='',field={},profile={},context={},lang='ru'}={}){
    const type=String(field.type||'').toLowerCase();
    if(['checkbox','radio','radiogroup','combobox','multiselect','select','file'].includes(type))return '';
    if(['LEGAL','CONSENT','WORK_AUTHORIZATION'].includes(category))return '';
    if(type==='number')return '';
    const vacancy=context.vacancy||{},title=clean(vacancy.title),company=clean(vacancy.company),q=String(question||'');
    if(/(?:сколько|how many).{0,35}(?:лет|years)|(?:лет|years).{0,25}(?:опыт|experience)|стаж|commercial experience|коммерческ.*опыт/i.test(q))return '';
    const ru=lang==='ru';
    if(category==='SALARY')return ru?'Готова обсудить уровень дохода в зависимости от задач, формата работы и общего объёма ответственности.':'I am open to discussing compensation based on the responsibilities, work format and overall scope of the role.';
    if(['START_DATE','AVAILABILITY','SCHEDULE','RELOCATION','REMOTE_WORK'].includes(category))return ru?'Готова обсудить этот вопрос и подобрать подходящий вариант с учётом задач и условий позиции.':'I am open to discussing this and finding a suitable arrangement based on the role and its requirements.';
    if(['WHY_COMPANY','WHY_ROLE','MOTIVATION'].includes(category)){
      if(ru)return company?`Мне интересна эта позиция в ${company}: хочу работать с практическими задачами и развиваться в направлении, которое соответствует профилю вакансии.`:`Мне интересна ${title?`позиция «${title}»`:'эта позиция'}: хочу работать с практическими задачами и развиваться в этом направлении.`;
      return company?`I am interested in this position at ${company} because I want to work on practical tasks and grow in the direction described in the vacancy.`:`I am interested in ${title?`the ${title} role`:'this role'} because I want to work on practical tasks and continue developing in this area.`;
    }
    if(['EXPERIENCE','SUPPORT_EXPERIENCE','CUSTOMER_SERVICE','PROJECTS','TECH_STACK','PROGRAMMING_LANGUAGE','DATABASES','API','CRM','LINUX','WINDOWS','NETWORKING','AI','OTHER_TECHNICAL','ACHIEVEMENTS'].includes(category)){
      return ru?'По этому вопросу могу подробнее рассказать о релевантном опыте и задачах на интервью. Быстро разбираюсь в новых инструментах и стараюсь доводить задачи до понятного результата.':'I can discuss the most relevant experience and tasks in more detail during an interview. I learn new tools quickly and focus on bringing tasks to a clear result.';
    }
    if(category==='EDUCATION')return ru?'Могу подробнее рассказать об образовании и профильной подготовке на интервью.':'I can provide more detail about my education and relevant training during an interview.';
    if(category==='OTHER_LANGUAGE'||category==='ENGLISH_LEVEL')return ru?'Могу подробнее рассказать об уровне языка и о том, как использую его в работе, на интервью.':'I can provide more detail about my language level and how I use it in work during an interview.';
    if(category==='LOCATION')return ru?'Готова уточнить актуальную локацию и формат работы при общении с работодателем.':'I can confirm my current location and preferred work format directly with the employer.';
    if(['CONTACT','EMAIL','PHONE','TELEGRAM'].includes(category))return '';
    if(category==='UNKNOWN')return ru?'Готова подробнее обсудить этот вопрос на интервью и уточнить детали в контексте задач вакансии.':'I am happy to discuss this in more detail during an interview and clarify it in the context of the role.';
    return '';
  }
  function decide({question='',field={},profile={},context={},memoryEntry=null}={}){
    const category=Q.classify(question,field),lang=Q.language(question),role=context.role||'',vacancy=context.vacancy||{},vacancyKey=context.vacancyKey||vacancy.vacancyId||vacancy.url||'',vacancySpecific=Q.isVacancySpecific(category);
    const meta={category,lang,vacancySpecific,semanticKey:Q.semanticKey(category,question,vacancyKey)};
    if(memoryEntry?.userConfirmed&&clean(memoryEntry.answer)&&(!vacancySpecific||String(memoryEntry.vacancyKey||'')===String(vacancyKey))){return result('fill',category,'confirmed-question-memory',{...meta,value:clipAnswer(memoryEntry.answer,field.maxLength),source:'confirmed-question-memory',confidence:.99,evidenceIds:memoryEntry.evidenceIds||[]});}
    if(['checkbox','radio','radiogroup','combobox','multiselect','select'].includes(String(field.type||'').toLowerCase())&&!["EMAIL","PHONE","CONTACT","LOCATION"].includes(category))return result('review',category,'manual-choice',{...meta,confidence:0});
    if(category==='SALARY'){
      const value=salaryValue(profile,lang);
      if(value)return result('fill',category,'confirmed-salary',{...meta,value:clipAnswer(value,field.maxLength),evidenceIds:[]});
      const draft=humanFallback({category,question,field,profile,context,lang});
      return draft?result('fill',category,'human-fallback',{...meta,value:clipAnswer(draft,field.maxLength),source:'human-fallback',confidence:.35,requiresReview:true,evidenceIds:[]}):result('review',category,'salary-unconfirmed',{...meta,confidence:0});
    }
    if(['LEGAL','CONSENT','WORK_AUTHORIZATION'].includes(category))return result('review',category,'personal-decision',{...meta,confidence:0});
    if(['START_DATE','RELOCATION','AVAILABILITY','SCHEDULE','REMOTE_WORK'].includes(category)){
      const draft=humanFallback({category,question,field,profile,context,lang});
      return draft?result('fill',category,'human-fallback',{...meta,value:clipAnswer(draft,field.maxLength),source:'human-fallback',confidence:.3,requiresReview:true,evidenceIds:[]}):result('review',category,'personal-decision',{...meta,confidence:0});
    }
    const c=profile.contacts||{};let value='',evidenceIds=[];
    if(category==='EMAIL')value=c.email||'';
    else if(category==='PHONE')value=c.phone||'';
    else if(category==='TELEGRAM')value=c.telegram||'';
    else if(category==='CONTACT')value=c.telegram||c.email||c.phone||'';
    else if(category==='LOCATION')value=profile.location||'';
    else if(category==='COVER_LETTER')value=context.coverLetter||'';
    else if(category==='EDUCATION'){const fs=facts(profile).filter(f=>f.kind==='education');value=uniqueTexts(fs,lang,2).join(' ');evidenceIds=fs.slice(0,2).map(f=>f.id);}
    else if(category==='PROJECTS'){const fs=facts(profile).filter(f=>['project','project_detail'].includes(f.kind));const ps=projects(profile,lang,role);value=ps.length?(lang==='ru'?'Да. ':'Yes. ')+ps.join(' '):'';evidenceIds=fs.slice(0,4).map(f=>f.id);}
    else if(category==='ENGLISH_LEVEL'){const fs=facts(profile).filter(f=>f.kind==='language'||['exp-translator','exp-crowne'].includes(f.id));const xs=english(profile,lang);value=xs.join(' ');evidenceIds=fs.filter(f=>/english|англий|translation|international/i.test([f.id,f.text,...(f.topics||[])].join(' '))).slice(0,4).map(f=>f.id);}
    else if(category==='OTHER_LANGUAGE'){const fs=facts(profile).filter(f=>f.kind==='language');value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='TECH_STACK'||category==='PROGRAMMING_LANGUAGE'){const fs=roleFacts(profile,role).filter(f=>f.kind==='skill');value=uniqueTexts(fs,lang,10).join(', ');evidenceIds=fs.slice(0,10).map(f=>f.id);}
    else if(category==='SUPPORT_EXPERIENCE'){const fs=byTopic(profile,['support','troubleshoot','bugs','documentation','testing'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='CUSTOMER_SERVICE'){const fs=roleFacts(profile,'customer_support').filter(f=>['experience','task','communication'].includes(f.kind));value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='DATABASES'){const fs=byTopic(profile,['sql','database','postgres','sqlite'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='API'){const fs=byTopic(profile,['api','integration'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='CRM'){const fs=byTopic(profile,['crm'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='LINUX'){const fs=byTopic(profile,['linux','ubuntu'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='WINDOWS'){const fs=byTopic(profile,['windows'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='NETWORKING'){const fs=byTopic(profile,['network','vpn','routing'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='AI'){const fs=byTopic(profile,['ai','gemini'],role);value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(category==='EXPERIENCE'){const fs=roleFacts(profile,role).filter(f=>f.kind==='experience');value=uniqueTexts(fs,lang,3).join(' ');evidenceIds=fs.slice(0,3).map(f=>f.id);}
    else if(['WHY_COMPANY','WHY_ROLE','MOTIVATION'].includes(category)){
      const rel=relevantTechnical(profile,[question,vacancy.title,vacancy.description].join(' '),role,lang),company=clean(vacancy.company),title=clean(vacancy.title);
      if(rel.length){const lead=lang==='ru'?(category==='WHY_COMPANY'&&company?`Интересна эта позиция в ${company}, потому что её задачи соответствуют моему подтверждённому опыту.`:`Эта позиция ${title?`«${title}» `:''}интересна мне, потому что её задачи совпадают с моим опытом.`):(category==='WHY_COMPANY'&&company?`I am interested in this position at ${company} because its responsibilities match my confirmed experience.`:`I am interested in ${title?`the ${title} role `:'this role '}because its responsibilities match my experience.`);value=[lead,rel[0]].join(' ');}
    }
    else if(category==='ACHIEVEMENTS'){const fs=facts(profile).filter(f=>f.kind==='project'||f.kind==='education');value=uniqueTexts(fs,lang,2).join(' ');evidenceIds=fs.slice(0,2).map(f=>f.id);}
    else if(category==='OTHER_TECHNICAL'){const fs=relevantTechnical(profile,question,role,lang);value=fs.join(' ');}
    if(!clean(value)){
      const draft=humanFallback({category,question,field,profile,context,lang});
      if(draft)return result('fill',category,'human-fallback',{...meta,value:clipAnswer(draft,field.maxLength),source:'human-fallback',confidence:.3,requiresReview:true,evidenceIds:[]});
      return result('review',category,'unknown',{...meta,confidence:0});
    }
    value=clipAnswer(value,field.maxLength);if(!value)return result('review',category,'unknown',{...meta,confidence:0});
    if(String(field.type||'').toLowerCase()==='number'&&!/^-?\d+(?:[.,]\d+)?$/.test(value))return result('review',category,'numeric-value-unconfirmed',{...meta,confidence:0});
    return result('fill',category,'confirmed-profile',{...meta,value,evidenceIds});
  }
  return {decide,facts,factText,projects,english,relevantTechnical,humanFallback};
});
