/* Violetta 3.0 · Shared pure policy/domain layer. No network or DOM access. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.vjaCopilotCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const VERSION = '4.0.0';
  function newId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const b=new Uint8Array(16);globalThis.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
  const clean = v => String(v ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const clip = (v, n = 12000) => clean(v).slice(0, n);
  const hash = value => { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(16); };
  const domains = [
    ['hh', ['hh.ru','headhunter.kg']], ['linkedin', ['linkedin.com']], ['indeed', ['indeed.com','indeed.co.uk']],
    ['glassdoor', ['glassdoor.com','glassdoor.co.uk']], ['habr', ['career.habr.com']], ['superjob', ['superjob.ru']],
    ['geekjob', ['geekjob.ru']], ['greenhouse', ['greenhouse.io','greenhouse.com']], ['lever', ['lever.co']],
    ['workday', ['myworkdayjobs.com','myworkdaysite.com']], ['smartrecruiters', ['smartrecruiters.com']],
    ['teamtailor', ['teamtailor.com']], ['ashby', ['ashbyhq.com']], ['workable', ['workable.com']],
    ['bamboohr', ['bamboohr.com']], ['recruitee', ['recruitee.com']], ['personio', ['personio.de','personio.com']],
    ['comeet', ['comeet.com','comeet.co']], ['jobvite', ['jobvite.com']]
  ];
  function provider(url) {
    try { const h = new URL(url).hostname.toLowerCase(); return domains.find(([, ds]) => ds.some(d => h === d || h.endsWith('.' + d)))?.[0] || 'generic'; } catch { return 'generic'; }
  }
  function canonicalUrl(raw) {
    try {
      const u = new URL(raw);
      if (!/^https?:$/.test(u.protocol)) return '';
      u.username = ''; u.password = '';
      for (const k of [...u.searchParams.keys()]) if (/^(utm_.+|hhtmFrom.*|from|source|ref|referrer|trackingId|trk|gh_src|fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
      u.searchParams.sort();
      // Keep meaningful SPA fragments (a thread/job id can live there).
      if (!/(job|vacancy|thread|chat|message|conversation|application|requisition)/i.test(u.hash)) u.hash = '';
      u.hostname = u.hostname.toLowerCase();
      u.pathname = u.pathname.replace(/\/$/, '') || '/';
      return u.toString();
    } catch { return ''; }
  }
  function idFromUrl(raw) {
    try {
      const u = new URL(raw);
      for (const k of ['vacancyId','jobId','job_id','gh_jid','requisitionId','requisition','currentJobId','jk']) if (u.searchParams.get(k)) return clip(u.searchParams.get(k), 200);
      if(provider(raw)==='workday'){const segments=u.pathname.split('/').filter(Boolean);const at=segments.indexOf('job');if(at>=0){const last=segments.at(-1)||'';return last.match(/_(R[-_a-z0-9]+)$/i)?.[1]||last;}}
      if(['lever','ashby'].includes(provider(raw))){const last=u.pathname.split('/').filter(Boolean).at(-1)||'';if(/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(last))return last;}
      return u.pathname.match(/\/(?:vacancy|vacancies|jobs\/view|job|jobs|positions|posting)\/([^/?#]+)/i)?.[1] || '';
    } catch { return ''; }
  }
  function tenant(raw, p = provider(raw)) {
    try {
      const u = new URL(raw);
      if(p==='workday'&&u.hostname.endsWith('myworkdaysite.com')){const parts=u.pathname.split('/').filter(Boolean);const at=parts.indexOf('recruiting');return `${p}:${u.hostname}:${at>=0?parts.slice(at+1,at+3).join('/'):'unknown'}`;}
      if (['lever','ashby','greenhouse'].includes(p)) return `${p}:${u.hostname}:${u.pathname.split('/').filter(Boolean)[0] || ''}`;
      return p === 'hh' ? 'hh' : `${p}:${u.hostname}`;
    } catch { return p; }
  }
  function suspiciousVacancyTitle(value = '') {
    const t = clean(value);
    if (!t || t.length < 3) return true;
    return /^(?:найдено\s+[\d\s.,]+\s+ваканс(?:ий|ии|ия)|вакансии|поиск\s+вакансий|результаты\s+поиска|jobs?|job\s+search|search\s+jobs?)(?:\s|$)/i.test(t);
  }
  function vacancy(v = {}) {
    const url = canonicalUrl(v.url || v.vacancyUrl || v.sourceUrl || '');
    const p = v.provider || v.ats || provider(url);
    const id = clean(v.vacancyId || v.jobId || v.requisitionId || idFromUrl(url));
    return { ...v, provider:p, vacancyId:id, url, tenant:tenant(url,p), title:clip(v.title || v.jobTitle,300), company:clip(v.company || v.companyName,300), description:String(v.description||'').replace(/\u00a0/g,' ').trim().slice(0,60000) };
  }
  function vacancyKey(input = {}) {
    const v = vacancy(input);
    return v.vacancyId ? `${v.tenant}:job:${v.vacancyId}` : v.url ? `${v.tenant}:url:${v.url}` : '';
  }
  function sameVacancy(a, b) { const x = vacancyKey(a), y = vacancyKey(b); return Boolean(x && x === y); }
  function identity(input = {}) {
    return { provider:input.provider || provider(input.url), conversationId:clip(input.conversationId,400), applicationId:clip(input.applicationId,200), vacancyId:clip(input.vacancyId || input.vacancy?.vacancyId,200), vacancyUrl:canonicalUrl(input.vacancyUrl || input.vacancy?.url), url:canonicalUrl(input.url), documentId:clip(input.documentId,100) };
  }
  function contextKey(input = {}) { const c = identity(input); return [c.provider,c.url,c.documentId,c.conversationId,c.applicationId,c.vacancyId,c.vacancyUrl].join('|'); }
  function sameContext(a,b) { return Boolean(a && b && contextKey(a) === contextKey(b)); }
  function conversationKey(input = {}) {
    const c = identity(input); if (!c.conversationId) return '';
    let origin = ''; try { origin = new URL(c.url).origin; } catch { return ''; }
    return `${c.provider}:${origin}:${c.conversationId}`;
  }
  const roles = [
    ['technical_support', /technical support|support engineer|help\s?desk|service desk|технич\S*\s+поддерж|техподдерж|инженер.*поддерж/i],
    ['customer_support', /customer (?:support|success)|chat support|support (?:specialist|agent)|клиент|письменн.*поддерж|поддержк|оператор чата/i],
    ['qa', /\bqa\b|quality assurance|test engineer|тестиров|тестирован/i],
    ['implementation', /implementation|onboarding|внедрен|сопровожд/i],
    ['developer', /developer|engineer|разработ|программист|\.net|backend|frontend|full.?stack/i],
    ['education', /teacher|tutor|преподав|учител|обучени/i],
    ['operations', /operations|administrat|back.?office|data entry|операцион|администрат|ассистент/i],
    ['content', /content|marketing|moderat|контент|маркет|модера/i],
    ['sales', /sales|account manager|продаж/i]
  ];
  function classifyRole(title = '', description = '') {
    if(globalThis.vjaRelevance)return globalThis.vjaRelevance.route(title,description);
    for (const [id,re] of roles) if (re.test(title)) return id;
    for (const [id,re] of roles) if (re.test(description)) return id;
    return 'other';
  }
  function language(text = '') { const ru = (text.match(/[а-яё]/gi)||[]).length, en = (text.match(/[a-z]/gi)||[]).length; return ru >= Math.max(2,en*.3) ? 'ru' : 'en'; }
  const labels = { developer:'Разработка', technical_support:'Техническая поддержка',customer_support:'Клиентская поддержка',qa:'QA / тестирование',implementation:'Внедрение',education:'Обучение',operations:'Операционная работа',content:'Контент',sales:'Продажи',other:'Другое' };
  function profile(input = {}, defaults = {}) {
    const p = {...defaults,...input};
    const contacts = {...(defaults.contacts || {}),...(input.contacts || {})};
    const facts = (Array.isArray(p.facts) ? p.facts : []).filter(f => f && typeof f.id === 'string').slice(0,200).map(f => ({ ...f, id:clip(f.id,80),kind:clip(f.kind,40),text:clip(f.text,1800),status:['CONFIRMED','TRANSFERABLE','INFERENCE','UNKNOWN'].includes(f.status)?f.status:'UNKNOWN',roles:Array.isArray(f.roles)?f.roles.filter(x=>labels[x]):[],source:clip(f.source,200) }));
    return { ...p, version:4, fullName:clip(p.fullName,200),firstName:clip(p.firstName,100),lastName:clip(p.lastName,100),contacts:{email:clip(contacts.email,254),telegram:clip(contacts.telegram,100),phone:clip(contacts.phone,40),preferredContact:['platform_chat','telegram','email'],phoneAvailability:'limited'},location:clip(p.location,200),github:clip(p.github,500),portfolio:clip(p.portfolio,500),linkedin:clip(p.linkedin,500),facts,updatedAt:p.updatedAt||null };
  }
  function confirmed(p = {}, role = '') { if(globalThis.vjaCandidateTruth)return globalThis.vjaCandidateTruth.evidence(p,role); return (p.facts || []).filter(f => f.status === 'CONFIRMED' && (!role || !f.roles?.length || f.roles.includes(role))); }
  function roleProfile(p, role) { return {id:role,headline:labels[role]||role,factIds:confirmed(p,role).map(f=>f.id)}; }
  function cvSelection(role,lang,stored={}) {
    // 3.5 keeps CV choice intentionally simple: the bundled/user-replaced RU or EN
    // CV is selected from the vacancy language. Hidden legacy role-specific CV keys
    // are left untouched for backwards compatibility, but are no longer used.
    const languageKey=lang==='ru'?'cvVaultRu':'cvVaultEn';
    const file=stored[languageKey];
    if(file?.base64&&cvValid(file))return {key:languageKey,file,reason:'language-default',role,language:lang};
    const fallbackKey=lang==='ru'?'cvVaultEn':'cvVaultRu',fallback=stored[fallbackKey];
    if(fallback?.base64&&cvValid(fallback))return {key:fallbackKey,file:fallback,reason:'language-fallback',role,language:lang};
    return {key:'',file:null,reason:'missing',role,language:lang};
  }
  function cvKey(_role,lang,stored={}) { const key=lang==='ru'?'cvVaultRu':'cvVaultEn';return stored[key]?.base64?key:''; }
  function cvValid(f) {
    return Boolean(f?.name && /\.pdf$/i.test(f.name) && f.type === 'application/pdf' && f.size > 4 && f.size <= 15*1024*1024 && typeof f.base64 === 'string' && f.base64.startsWith('JVBERi0') && f.base64.length <= 21*1024*1024);
  }
  const RISK = /salary|compensation|expected.?pay|hourly.?rate|зарплат|оклад|доход|вознагражден|ожидаем.*сумм|authori[sz]|sponsor|visa|citizen|relocat|criminal|background.check|consent|privacy|terms|declar|agree|accept|signature|notice.period|start.date|available.*start|work.permit|passport|birth|gender|disabilit|ethnic|veteran|race\b|religio|соглас|разрешен|разрешён|гражданств|виз[ауы]|переезд|релокац|судим|провер.*данн|персональн|обработк.*данн|услови|подпис|дата.*выход|приступ|возраст|рождени|пол\b|инвалид|здоров|воин|паспорт|договор|достовер|приватност|конфиденц|legal|contract|offer/i;
  function highRisk(label) { return RISK.test(clean(label)); }
  function fieldDecision(f = {}, p = {}, ctx = {}) {
    const s = clean(f.label), type = f.type || 'text';
    if (highRisk(s) || ['password','date','datetime-local'].includes(type)) return {action:'review',reason:'personal-decision'};
    if (['checkbox','radio','radiogroup','combobox','multiselect','custom'].includes(type)) return {action:'review',reason:'manual-choice'};
    if (type === 'file') return {action:'review',reason:'cv-resolver'};
    if (/years?|лет|года|стаж|commercial|коммерческ/i.test(s)) return {action:'review',reason:'experience-unconfirmed'};
    const c = p.contacts || {};
    let value = '';
    if (/first.?name|given.?name|^имя(?:\s|$)/i.test(s)) value = p.firstName;
    else if (/last.?name|family.?name|surname|фамил/i.test(s)) value = p.lastName;
    else if (/full.?name|your.?name|фио|полное имя/i.test(s)) value = p.fullName;
    else if (/e.?mail|электронн.*почт/i.test(s) || type === 'email') value = c.email;
    else if (/telegram|телеграм/i.test(s)) value = c.telegram;
    else if (/phone|mobile|телефон/i.test(s) || type === 'tel') value = c.phone;
    else if (/github/i.test(s)) value = p.github;
    else if (/linkedin/i.test(s)) value = p.linkedin;
    else if (/portfolio|personal.?website|портфолио|личный сайт/i.test(s)) value = p.portfolio;
    else if (/location|current.?city|город|место.*прожив/i.test(s)) value = p.location;
    else if (/cover.?letter|сопровод/i.test(s)) value = ctx.coverLetter;
    else if (/education|образован/i.test(s)) value = confirmed(p).filter(f=>f.kind==='education').map(f=>f.text).join('; ');
    else if (/languages?|язык/i.test(s)) value = confirmed(p).filter(f=>f.kind==='language').map(f=>f.text).join(', ');
    else if (/skills?|technolog|навык|технологи/i.test(s)) value = confirmed(p,ctx.role).filter(f=>f.kind==='skill').map(f=>f.text).join(', ');
    else if (/why.*(?:work|join|interest)|tell.*(?:yourself|about you)|почему.*(?:работ|интерес)|расскаж.*о себе/i.test(s)) value = ctx.coverLetter;
    if (!clean(value)) return {action:'review',reason:'unknown'};
    if (f.maxLength > 0 && String(value).length > f.maxLength) return {action:'review',reason:'too-long'};
    return {action:'fill',value:clean(value),reason:'confirmed-profile'};
  }
  function safeNavigation(meta = {}) {
    const label = clean(meta.label);
    if (meta.inChat || highRisk(label)) return false;
    if (/send|submit|finish|complete|отправ|заверш|отклик|подать/i.test(label)) return false;
    if (meta.submitType || (meta.inForm && meta.explicitStep!==true)) return false; // a submit-type "Next" can post data, so fail closed
    return /^(next|continue|proceed|далее|продолжить)(\s*[→›>]?)$/i.test(label) && meta.explicitStep === true;
  }
  function safeApplyLink(meta={}) {
    if (meta.inForm || meta.submitType || !meta.href) return false;
    let u; try {u=new URL(meta.href,meta.base);}catch{return false;}
    if (!/^https?:$/.test(u.protocol)) return false;
    if (/(submit|send|response|respond|negotiation|accept|confirm)/i.test(u.pathname)) return false;
    return /apply|application/i.test(u.pathname) && /apply|application|заяв|анкет/i.test(meta.label || '');
  }
  function application(job={}) {
    const p = job.plan || {}; const v = vacancy(job.context?.vacancy || {url:p.sourceUrl,title:p.jobTitle,vacancyId:p.vacancyId,provider:p.provider});
    return { ...job.context, id:p.id||job.id, applicationId:job.context?.applicationId || p.applicationId || p.trackedId || '', vacancy:v, status:job.context?.status || (job.completed?'Applied':job.review?'Needs review':'Preparing'),cvProfileId:job.context?.cvProfileId||p.roleVariant,cvVersion:job.context?.cvVersion||'',coverLetter:job.context?.coverLetter||p.coverLetter||'',updatedAt:job.context?.updatedAt||p.createdAt||null };
  }
  function resolveConversation(c, apps, mapping=null) {
    const compatible = apps.filter(a => a.vacancy?.provider === c.provider && (['hh','linkedin','indeed'].includes(c.provider) || !c.url || a.vacancy.tenant===tenant(c.vacancyUrl||c.url,c.provider))); 
    const direct = (key,value,confidence,reason) => {
      if (!value) return null;
      const matches = compatible.filter(a => key==='applicationId' ? (a.applicationId === value || a.id === value) : key==='vacancyId' ? a.vacancy.vacancyId===value && (c.provider === 'hh' || !c.vacancyUrl || a.vacancy.tenant===tenant(c.vacancyUrl,c.provider)) : canonicalUrl(a.vacancy.url) === canonicalUrl(value));
      // If any direct identifier contradicts another, never silently choose.
      if(matches.length===1) {
        const a=matches[0];
        if(c.vacancyId && a.vacancy.vacancyId && c.vacancyId!==a.vacancy.vacancyId) return {matched:false,reason:'conflicting-identities',candidates:compatible};
        if(c.vacancyUrl && key !== 'vacancyUrl' && a.vacancy.url && !sameVacancy(a.vacancy,{url:c.vacancyUrl,vacancyId:c.vacancyId,provider:c.provider})) return {matched:false,reason:'conflicting-identities',candidates:compatible};
        return {matched:true,application:a,confidence,reason};
      }
      return matches.length>1?{matched:false,reason:'ambiguous-id',candidates:matches}:null;
    };
    for(const [key,confidence] of [['applicationId',.99],['vacancyId',.98],['vacancyUrl',.96]]) {const found=direct(key,c[key],confidence,key);if(found)return found;}
    if(mapping?.applicationKey) {
      const a=compatible.find(x=>x.id===mapping.applicationKey);
      if(a && (!c.vacancyId||c.vacancyId===a.vacancy.vacancyId) && (!c.vacancyUrl||sameVacancy(a.vacancy,{url:c.vacancyUrl,provider:c.provider}))) return {matched:true,application:a,confidence:.95,reason:'user-mapping'};
    }
    return {matched:false,reason:'needs-selection',candidates:compatible};
  }
  function stage(text='') {
    for(const [id,re] of [['rejection',/отказ|не готовы|друг.*кандидат|unfortunately|not moving forward|reject/i],['offer',/оффер|предложени.*работ|job offer/i],['salary',/зарплат|salary|compensation/i],['interview_scheduling',/собеседован|созвон|interview|time slot/i],['test_assignment',/тестов.*задан|test assignment|take.home/i],['experience_question',/опыт|стаж|experience|years/i],['availability',/когда.*(?:начать|приступ)|start date|notice/i],['application_review',/рассмотрим|обратн.*связ|review.*(?:resume|application)|get back/i],['technical_question',/как.*(?:реализ|работает)|how.*(?:implement|work)|\b(?:api|sql|debug)\b/i]])if(re.test(text))return id;
    return 'unknown';
  }
  function threadMemory(messages=[], previous={}) {
    const important=messages.filter(m=>/\d|salary|compensation|available|promise|agree|соглас|обещ|зарплат|удобно|готова|Jira|SQL|C#|\.NET/i.test(m.text||''));
    const facts = [...(previous.important || []), ...important.map(m=>({speaker:m.speaker,text:clip(m.text,900),timestamp:m.timestamp||'',id:m.id||''}))];
    const seen=new Set();
    const kept=facts.filter(f=>{const k=[f.id,f.speaker,f.timestamp,f.text].join('|');if(seen.has(k))return false;seen.add(k);return true;}).slice(-30);
    return { important:kept, stage:stage([...messages].reverse().find(m=>m.speaker==='employer')?.text||''), recent:messages.slice(-16), updatedAt:Date.now(), truncated:messages.length>16 || facts.length>30 };
  }
  function skillMentioned(skill, text='') {
    const value=clean(skill).toLowerCase();if(!value)return false;
    const hay=String(text||'').toLowerCase();
    const variants=[value,value.replace(/\.net/g,'dotnet'),value.replace(/asp\.net/g,'aspnet')];
    const normalized=hay.replace(/\.net/g,'dotnet').replace(/asp\.net/g,'aspnet');
    return variants.some(v=>normalized.includes(v));
  }
  function compactSkill(text='') {
    const value=clean(text);if(!value||value.length>70||/[.;]/.test(value))return '';
    return value;
  }
  function relevantSkills(p,role,v,limit=5){
    const facts=confirmed(p,role).filter(f=>f.kind==='skill').map(f=>compactSkill(f.text)).filter(Boolean);
    const hay=`${v.title||''} ${v.requirements||''} ${v.description||''}`;
    const matched=facts.filter(x=>skillMentioned(x,hay));
    const defaults={developer:['C#','.NET','ASP.NET Core','SQL Server','REST API','Entity Framework Core','Docker','JavaScript','TypeScript','React','Next.js','WPF','XAML'],qa:['Automated Testing','MSTest','C#','.NET','SQL Server','Docker','Git'],implementation:['C#','.NET','SQL Server','REST API','Git'],technical_support:['C#','.NET','SQL Server','REST API','Git'],customer_support:[]};
    const fallback=(defaults[role]||[]).filter(x=>facts.some(f=>f.toLowerCase()===x.toLowerCase()));
    const source=matched.length?matched:fallback;
    const out=[];for(const x of source)if(!out.some(y=>y.toLowerCase()===x.toLowerCase()))out.push(x);
    return out.slice(0,limit);
  }
  function projectSentence(p,role,v,lang){
    const facts=confirmed(p,role).filter(f=>f.kind==='project');
    if(!facts.length)return '';
    const hay=`${v.title||''} ${v.description||''}`.toLowerCase();
    const dental=facts.find(f=>/dentalclinic|dental-practice/i.test(f.text));
    const route=facts.find(f=>/smart route|route planner|osrm/i.test(f.text));
    const fleet=facts.find(f=>/fleetmanagement|wpf/i.test(f.text));
    let chosen=null;
    if(/wpf|xaml|desktop/.test(hay)&&fleet)chosen=fleet;
    else if(/php|pwa|machine learning|\bml\b|routing|osrm/.test(hay)&&route)chosen=route;
    else chosen=dental||route||fleet||facts[0];
    const t=chosen?.text||'';
    if(lang==='ru'){
      if(/dentalclinic|dental-practice/i.test(t))return 'В проекте DentalClinic реализовала full-stack платформу на ASP.NET Core, EF Core и SQL Server с REST API, JWT/RBAC, SignalR, Docker и автотестами.';
      if(/smart route|route planner|osrm/i.test(t))return 'В Smart Route Planner реализовала PWA с PHP/JavaScript, маршрутизацией OSRM, ML-алгоритмами и автоматизированными тестами.';
      if(/fleetmanagement|wpf/i.test(t))return 'В FleetManagement разработала C#/.NET desktop-приложение на WPF/XAML, EF6 и SQL Server с автоматизированными тестами.';
      return '';
    }
    if(/dentalclinic|dental-practice/i.test(t))return 'In DentalClinic I built a full-stack ASP.NET Core/EF Core/SQL Server platform with REST APIs, JWT/RBAC, SignalR, Docker and automated tests.';
    if(/smart route|route planner|osrm/i.test(t))return 'In Smart Route Planner I built a PHP/JavaScript PWA with OSRM routing, ML algorithms and automated tests.';
    if(/fleetmanagement|wpf/i.test(t))return 'In FleetManagement I built a C#/.NET desktop application with WPF/XAML, EF6, SQL Server and automated tests.';
    return '';
  }
  function isItVacancy(role,v={}) {
    if(['developer','qa','implementation','technical_support'].includes(role))return true;
    return /(?:\bit\b|software|saas|web|api|crm|help\s?desk|service\s?desk|технич|техподдерж|информационн.*технолог|программ)/i.test(`${v.title||''} ${v.description||''}`);
  }
  function githubSentence(p,role,v,lang){
    const link=clean(p?.github);if(!link||!isItVacancy(role,v))return '';
    return lang==='ru'?`GitHub с проектами: ${link}`:`GitHub projects: ${link}`;
  }
  function coverLetter(p, v, lang = language(v.title+' '+v.description)) {
    if(globalThis.vjaRelevance){const result=globalThis.vjaRelevance.localCover(p,v,lang);return result.ok?result.text:'';}
    const role=classifyRole(v.title,v.description),skills=relevantSkills(p,role,v,4),project=projectSentence(p,role,v,lang),github=githubSentence(p,role,v,lang);
    const title=clean(v.title)||(lang==='ru'?'эта вакансия':'this role');
    const company=clean(v.company);
    if(lang==='ru'){
      const intro=`Здравствуйте! Заинтересовала вакансия «${title}»${company?` в ${company}`:''}.`;
      if(['developer','qa','implementation'].includes(role)){
        const stack=skills.length?`Из релевантного опыта: ${skills.join(', ')}.`:'';
        return [intro,stack,project,github,'Буду рада обсудить задачи и рассказать о наиболее близком проекте.'].filter(Boolean).join(' ').slice(0,920);
      }
      if(role==='technical_support'||isItVacancy(role,v)){
        const stack=skills.length?`По технической части у меня есть практический опыт с ${skills.join(', ')}.`:'';
        return [intro,stack,project,github,'Буду рада обсудить задачи и формат работы.'].filter(Boolean).join(' ').slice(0,900);
      }
      const rel=skills.length?`Из релевантного: ${skills.join(', ')}.`:'';
      return [intro,rel,'Есть практический опыт общения с людьми и решения рабочих задач; быстро разбираюсь в новых процессах и стараюсь отвечать понятно и по делу.','Буду рада обсудить детали.'].filter(Boolean).join(' ').slice(0,820);
    }
    const intro=`Hello! I am interested in the ${title} role${company?` at ${company}`:''}.`;
    if(['developer','qa','implementation'].includes(role)){
      const stack=skills.length?`Relevant hands-on experience: ${skills.join(', ')}.`:'';
      return [intro,stack,project,github,'I would be glad to discuss the role and the most relevant project in more detail.'].filter(Boolean).join(' ').slice(0,900);
    }
    if(role==='technical_support'||isItVacancy(role,v)){
      const stack=skills.length?`On the technical side, I have hands-on experience with ${skills.join(', ')}.`:'';
      return [intro,stack,project,github,'I would be glad to discuss the responsibilities and work format.'].filter(Boolean).join(' ').slice(0,880);
    }
    const rel=skills.length?`Relevant skills include ${skills.join(', ')}.`:'';
    return [intro,rel,'I have practical experience communicating with people and handling day-to-day work tasks, and I learn new processes quickly.','I would be glad to discuss the details.'].filter(Boolean).join(' ').slice(0,780);
  }
  function guardDraft(text, p, context={}) {
    if(globalThis.vjaRelevance){const v=globalThis.vjaRelevance.verify(text,p,{...context,kind:'reply'});return {...v,text:String(text||'').trim(),reason:v.errors?.join(',')||''};}
    const draft=clip(text,4000); const evidence=confirmed(p).map(f=>f.text).join('\n');
    if(!draft)return {ok:false,reason:'empty'};
    // Numbers about experience/availability/pay must never be invented by an LLM.
    if(/\d+\s*(?:\+?\s*years?|лет|года?|месяц|months?|руб|доллар|евро|₽|\$|€)|(?:сегодня|завтра|today|tomorrow).*(?:могу|готов|available|can)/i.test(draft))return {ok:false,reason:'personal-commitment'};
    if(/(?:работал[аи]?|worked|employed)\s+(?:в|at|for)\s+/i.test(draft) && !confirmed(p).some(f=>f.kind==='experience'&&draft.includes(f.text)))return {ok:false,reason:'unverified-employment'};
    const tech=/\b(?:Jira|Zendesk|Salesforce|Kubernetes|Docker|React|Angular|Python|Java|SaaS|SQL|Azure|AWS|C\+\+)\b|C#|ASP\.NET/gi;
    for(const t of draft.match(tech)||[])if(!evidence.toLowerCase().includes(t.toLowerCase()) && /имею|умею|владею|работала|использовал|my skills|i have|i used|i worked|proficient/i.test(draft))return {ok:false,reason:'unverified-skill'};
    if(highRisk(draft) && /(?:согласна|подтверждаю|принимаю|i accept|i agree|i confirm|authorized to work)/i.test(draft))return {ok:false,reason:'personal-commitment'};
    return {ok:true,text:draft,needsReview:true};
  }
  return {VERSION,newId,clean,clip,hash,provider,domains,canonicalUrl,idFromUrl,tenant,suspiciousVacancyTitle,vacancy,vacancyKey,sameVacancy,identity,contextKey,sameContext,conversationKey,roles,labels,classifyRole,language,profile,confirmed,roleProfile,cvSelection,cvKey,cvValid,highRisk,fieldDecision,safeNavigation,safeApplyLink,application,resolveConversation,stage,threadMemory,isItVacancy,coverLetter,guardDraft};
});
