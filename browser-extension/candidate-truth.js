/* Candidate memory shared by Apply, chat and form assistance. Pure, testable policy. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaCandidateTruth=api;})(globalThis,function(){
  'use strict';
  const SCHEMA=1;
  const str=(v,n=6000)=>String(v??'').trim().slice(0,n);
  const copy=v=>JSON.parse(JSON.stringify(v));
  const statuses=['CONFIRMED','TRANSFERABLE','INFERENCE','UNKNOWN'];
  function hash(v){let n=2166136261;for(const c of String(v))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16);}
  function normalizeFact(f={}){
    return {...f,id:str(f.id||'fact-'+hash(f.text),100),kind:str(f.kind||'other',40),text:str(f.text),textRu:str(f.textRu),textEn:str(f.textEn),status:statuses.includes(f.status)?f.status:'UNKNOWN',roles:Array.isArray(f.roles)?f.roles.slice(0,20):[],topics:Array.isArray(f.topics)?f.topics.slice(0,25):[],source:str(f.source,500),sourceId:str(f.sourceId,160),priority:Number(f.priority)||0,origin:str(f.origin,100)};
  }
  function factText(f,lang='ru'){return str(lang==='ru'?(f.textRu||f.text):(f.textEn||f.text));}
  function revision(p={}){return hash(JSON.stringify({facts:p.facts,contacts:p.contacts,github:p.github,deletedFactIds:p.deletedFactIds}));}
  function migrate(old={},seed={},now=Date.now()){
    if(old.seedRevision===seed.revision)return {profile:copy(old),changed:false,warnings:old.sourceWarnings||[]};
    const fresh=(seed.facts||[]).map(normalizeFact),known=new Map(fresh.map(f=>[f.id,f]));
    const archived=[...(old.archivedFacts||[])],deleted=new Set(old.deletedFactIds||[]),warnings=[];
    for(const raw of old.facts||[]){
      const f=normalizeFact(raw);
      if(deleted.has(f.id))continue;
      if(f.origin==='user-confirmed'||f.priority>=100){known.set(f.id,f);continue;}
      if(known.has(f.id))continue;
      // Older builds marked a large hardcoded profile as confirmed. Preserve it
      // for review, but don't silently convert those claims into fresh evidence.
      if(/Imported from|v2\.9|seed/i.test(f.source)||!f.origin){
        if(!archived.some(a=>a.id===f.id&&a.text===f.text))archived.push({...f,status:'UNKNOWN',reviewReason:'Legacy fact not re-confirmed by current CV/HH sources.'});
      }else known.set(f.id,f);
    }
    if(archived.length)warnings.push('Старые импортированные сведения сохранены в архиве. В письмах используются новые CV/HH и ваши явные правки.');
    const profile={...seed,...old,version:4,schemaVersion:SCHEMA,seedRevision:seed.revision,sources:[...(seed.sources||[]),...(old.sources||[]).filter(s=>!(seed.sources||[]).some(t=>t.id===s.id))],facts:[...known.values()].filter(f=>!deleted.has(f.id)),archivedFacts:archived.slice(-250),sourceWarnings:warnings,updatedAt:now};
    for(const field of ['fullName','firstName','lastName','location','github','portfolio','linkedin'])profile[field]=old[field]??seed[field]??'';
    profile.contacts={...(seed.contacts||{}),...(old.contacts||{})};
    profile.profileRevision=revision(profile);
    return {profile,changed:true,warnings};
  }
  function evidence(p={},role=''){
    const contacts=[];
    if(/^@?[a-z0-9_]{3,}$/i.test(p.contacts?.telegram||''))contacts.push({id:'contact-telegram',kind:'contact',status:'CONFIRMED',sourceId:'confirmed-contact-profile',text:'Мой Telegram: '+p.contacts.telegram,textEn:'My Telegram: '+p.contacts.telegram,topics:['telegram','contact'],roles:[]});
    if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.contacts?.email||''))contacts.push({id:'contact-email',kind:'contact',status:'CONFIRMED',sourceId:'confirmed-contact-profile',text:'Моя почта: '+p.contacts.email,textEn:'My email: '+p.contacts.email,topics:['email','contact'],roles:[]});
    return [...(p.facts||[]),...contacts].filter(f=>f.status==='CONFIRMED'&&!f.pendingReview&&(!role||!f.roles?.length||f.roles.includes(role)));
  }
  function sourcePriority(s={}){
    if(s.type==='user-confirmed')return 100;
    if(s.type==='hh-reviewed')return 90;
    if(s.type==='cv-reviewed')return 70;
    return 0; // webpage/AI text alone cannot promote global candidate facts
  }
  function propose(p={},rows=[],source={}){
    const existing=new Map((p.facts||[]).map(f=>[f.id,f]));
    return rows.slice(0,150).map(raw=>{
      const f=normalizeFact({...raw,sourceId:source.id,source:source.name,priority:sourcePriority(source)}),old=existing.get(f.id);
      const comparable=x=>JSON.stringify({text:x.text,textRu:x.textRu||'',textEn:x.textEn||'',startDate:x.startDate||'',endDate:x.endDate||'',roles:x.roles||[],status:x.status});
      const action=old&&comparable(old)!==comparable(f)?'conflict':old?'unchanged':'add';
      return {fact:f,action,previous:old||null,requiresConfirmation:action!=='unchanged'};
    });
  }
  function accept(p,proposal,ids,source,now=Date.now()){
    if(!sourcePriority(source))throw new Error('Источник требует явного подтверждения пользователя.');
    const accepted=new Set(ids||[]),next=copy(p),facts=new Map((next.facts||[]).map(f=>[f.id,f]));
    for(const row of proposal){if(!accepted.has(row.fact.id))continue;facts.set(row.fact.id,{...row.fact,origin:'user-confirmed',status:'CONFIRMED',priority:100,confirmedAt:now,pendingReview:false});}
    next.facts=[...facts.values()];next.sources=[...(next.sources||[]).filter(s=>s.id!==source.id),source];next.updatedAt=now;next.profileRevision=revision(next);return next;
  }
  function monthSpan(start,end,asOf=new Date()){
    const a=/^(\d{4})-(\d{2})$/.exec(start||''),b=/^(\d{4})-(\d{2})$/.exec(end||'');
    if(!a||Number(a[2])<1||Number(a[2])>12)return null;
    const n=b?Number(b[1])*12+Number(b[2])-1:asOf.getUTCFullYear()*12+asOf.getUTCMonth();
    return Math.max(0,n-(Number(a[1])*12+Number(a[2])-1));
  }
  function structuredMemory(messages=[],previous={}){
    const safe=messages.map(m=>({id:str(m.id,300),speaker:['candidate','employer'].includes(m.speaker)?m.speaker:'unknown',text:str(m.text,7000),timestamp:str(m.timestamp,150)}));
    const keep=safe.filter(m=>/\d|зарплат|salary|интервью|interview|обещ|дедлайн|deadline|график|schedule|SQL|API|\.NET|AppXite/i.test(m.text));
    const unique=new Map([...(previous.important||[]),...keep].map(m=>[[m.speaker,m.id||'',m.text].join('|'),m]));
    return {scope:'conversation-only',important:[...unique.values()].slice(-80),recent:safe.slice(-20),lastRecruiterMessage:[...safe].reverse().find(m=>m.speaker==='employer')||null,discussedTopics:[],updatedAt:Date.now(),truncated:safe.length>20};
  }
  return {SCHEMA,hash,normalizeFact,factText,revision,migrate,evidence,sourcePriority,propose,accept,monthSpan,structuredMemory};
});
