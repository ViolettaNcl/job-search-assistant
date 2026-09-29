/* Vacancy-first evidence selection and bounded, source-grounded writing. */
(function(root,factory){const T=root.vjaCandidateTruth||(typeof require==='function'?require('./candidate-truth.js'):null);const api=factory(T);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaRelevance=api;})(globalThis,function(T){
  'use strict';
  const trim=(v,n=60000)=>String(v??'').replace(/\u00a0/g,' ').trim().slice(0,n);
  const TOPICS={
    telegram:/telegram|телеграм/i,email:/email|e-mail|почт/i,contact:/контакт|contact/i,
    dotnet:/c#|\.net|aspnet|asp\.net|ef\s?core|entity framework/i,
    api:/\b(?:rest|api|webhook|swagger|postman)\b/i,
    sql:/\bsql\b|database|баз[а-я]*\s+данн|запрос[а-я]*\s+к\s+баз/i,
    logs:/\blog(?:s|ging)?\b|лог[а-я]*|журнал[а-я]*\s+ошиб/i,
    diagnostics:/troubleshoot|diagnos|диагност|поиск.*(?:причин|ошиб)|разбор.*обращ/i,
    integration:/integrat|интеграц|обмен\s+данн/i,
    authentication:/authenticat|authoriz|авторизац|аутентификац|jwt|rbac/i,
    support:/support|help\s?desk|service\s?desk|поддерж|сопровожд/i,
    saas:/\bsaas\b|облачн[а-я]*\s+(?:платформ|сервис)/i,
    tickets:/tickets?|тикет|обращени|заявк[аиу]/i,
    bugs:/bugs?|debug|reproduc|ошиб|баг|воспроизвод/i,
    testing:/\bqa\b|test(?:s|ing|er)?\b|тест|провер.*исправ/i,
    documentation:/document|документ|описани[ея]\s+ошиб/i,
    collaboration:/collabor|разработчиками|команд[а-я]*|team/i,
    crm:/\bcrm\b|админ|admin|личн[а-я]*\s+кабинет/i,
    communication:/communicat|общени|коммуникац|пользовател|клиент|customers?|users?/i,
    client:/clients?|клиент|заказчик/i,
    english:/english|английск/i,greek:/greek|греческ/i,french:/french|француз/i,
    language:/languages?|язык/i,
    translation:/translat|перевод/i,
    education:/educat|degree|diploma|образован|диплом/i,
    teaching:/teach|tutor|преподав|обучать|учител/i,
    development:/develop|engineer|разработ|программ/i,
    frontend:/frontend|front.end|интерфейс/i,
    php:/\bphp\b/i,javascript:/javascript|\bjs\b/i,typescript:/typescript|\bts\b/i,
    react:/\breact\b/i,next:/next\.?js/i,wpf:/\bwpf\b|\bxaml\b/i,desktop:/desktop|настольн/i,
    pwa:/\bpwa\b/i,ml:/\bml\b|machine learning|нейросет|машинн/i,
    docker:/docker|container|контейнер/i,
    salary:/salary|compensation|зарплат|оклад|вилк/i,
    availability:/start date|notice period|available|когда.*(?:приступ|выйти|начать)|дата\s+выход/i,
    schedule:/schedule|time\s*zone|график|часов[а-я]*\s+пояс|рабоч[а-я]*\s+врем/i,
    experience:/experience|опыт|стаж|работал/i
  };
  const TECH_CATALOG=['C#','.NET','ASP.NET Core','EF Core','SQL Server','SQL','REST API','API','JWT','RBAC','SignalR','Docker','CI/CD','Git','GitHub Actions','WPF','XAML','EF6','JavaScript','TypeScript','React','Next.js','PHP','MSTest','E2E','Postman','Jira','Zendesk','Kubernetes','Kafka','RabbitMQ','Azure','AWS','Python','Java','Angular','C++','Go','MongoDB','Redis','Linux','SaaS'];
  function hasTerm(term,text){const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^\\p{L}\\p{N}])'+escaped+'(?=$|[^\\p{L}\\p{N}])','iu').test(String(text));}
  function topics(text){return Object.keys(TOPICS).filter(k=>TOPICS[k].test(text||''));}
  function language(text){const ru=(String(text).match(/[а-яё]/ig)||[]).length,latin=(String(text).match(/[a-z]/ig)||[]).length;return ru>=Math.max(2,latin*.28)?'ru':'en';}
  function route(title='',description=''){
    const rules=[
      ['education',/teacher|tutor|преподав|учител|репетитор|обучающ/i],
      ['technical_support',/technical\s*support|integration\s*support|support\s*engineer|help\s?desk|service\s?desk|техподдерж|техническ.*поддерж|инженер.*поддерж|поддерж.*(?:api|интеграц|saas)/i],
      ['qa',/\bqa\b|quality assurance|test engineer|tester|тестиров|тестирован/i],
      ['implementation',/implementation|integration specialist|внедрен|интегратор/i],
      ['developer',/developer|engineer|разработ|программист|backend|back.end|frontend|full.?stack|\.net|devops/i],
      ['customer_support',/customer\s*(support|service|success)|support|поддерж|оператор чата/i],
      ['content',/translator|interpreter|переводчик|контент|content|маркетинг|marketing/i],
      ['operations',/operations|administrat|office|операцион|администрат|ассистент/i],
      ['sales',/sales|продаж|account manager/i]
    ];
    for(const [role,re] of rules)if(re.test(title))return role;
    for(const [role,re] of rules)if(re.test(description))return role;
    return 'other';
  }
  function technical(role,v){
    // Teaching is excluded by default, including IT teaching: portfolio is opt-in there.
    if(role==='education')return false;
    if(['developer','qa','technical_support','implementation'].includes(role))return true;
    return role==='customer_support'&&/\bsaas\b|api|техническ.*поддерж|интеграци/i.test(v.description||'');
  }
  function analyze(v={}){
    const raw=String(v.description||''),description=trim(raw),title=trim(v.title,350),body=title+'\n'+description+'\n'+trim(v.requirements);
    const role=route(title,description),found=topics(body),lines=description.split(/\n+|(?<=[.!?;])\s+/).map(x=>trim(x,1600)).filter(Boolean);
    const requirements=lines.filter(x=>!/будет плюсом|желател|nice.to.have|preferred|bonus/i.test(x)&&/треб|обяз|нуж|опыт|знан|умени|require|must|experience|proficien|knowledge/i.test(x));
    return {role,subrole:role==='developer'?(/back.?end|backend/i.test(title)?'backend':/full.?stack/i.test(title)?'fullstack':'developer'):role,language:language(body),title,topics:found,technologies:TECH_CATALOG.filter(t=>hasTerm(t,body)),requirements:requirements.slice(0,6),niceToHave:lines.filter(x=>/будет плюсом|желател|nice.to.have|preferred|bonus/i.test(x)).slice(0,4),seniority:(title.match(/junior|middle|senior|lead|staff|principal|младш|старш|ведущ/ig)||[]),remote:/remote|удален|удалён/i.test(body),descriptionLength:raw.length,descriptionHash:T.hash(description),descriptionCoverage:v.descriptionCoverage||'unknown',truncated:raw.length>60000};
  }
  function select(p,v,query=''){
    const a=analyze(v),qt=topics(query),desired=[...new Set([...a.topics,...qt])];
    const directQuestion=Boolean(query),askCompany=/crowne|plaza|appxite|перевод|translator|преподав|teaching/i.test(query);
    const excluded=[],ranked=[];
    for(const f of T.evidence(p)){
      const txt=f.text+' '+(f.textEn||''),ft=[...(f.topics||[]),...topics(txt)];
      const matches=desired.filter(t=>ft.includes(t));
      let blocked=f.kind==='contact'&&!directQuestion;
      if(f.id==='language-fr'&&!desired.includes('french'))blocked=true;
      if(technical(a.role,v)&&(/crowne|plaza|receptionist|front desk|отел|гостиниц/i.test(txt)||f.kind==='teaching')&&!askCompany)blocked=true;
      if(a.role==='education'&&(f.id==='exp-crowne'||f.kind==='task'||f.kind==='project_detail'))blocked=true;
      if(blocked){excluded.push({id:f.id,reason:'Нерелевантная история для текущей роли'});continue;}
      const roleFit=!f.roles?.length||f.roles.includes(a.role);
      let score=(roleFit?6:0)+matches.length*2+qt.filter(t=>ft.includes(t)).length*3;
      if(a.role==='technical_support'||a.role==='implementation'){if(f.employmentId==='exp-appxite'||f.id==='exp-appxite')score+=6;}
      if(a.role==='developer'){if(f.employmentId==='exp-freelance-dev'||f.id==='exp-freelance-dev')score+=6;}
      if(a.role==='qa'&&ft.includes('testing'))score+=5;
      if(f.kind==='skill'){score-=2;if(hasTerm(f.text,v.title+' '+v.description+' '+query))score+=5;else score-=8;}
      if(!roleFit&&!matches.length)score=-1;
      if(!directQuestion&&f.kind==='experience'&&['exp-translator','exp-crowne'].includes(f.id)&&!['customer_support','operations','content'].includes(a.role))score=-1;
      if(score>0)ranked.push({fact:f,score,matches,reason:matches.length?'Совпадение с задачами: '+matches.join(', '):'Прямой опыт для '+a.role});
      else excluded.push({id:f.id,reason:'Нет прямой связи с требованиями'});
    }
    ranked.sort((x,y)=>y.score-x.score||x.fact.id.localeCompare(y.fact.id));
    const core=ranked.filter(x=>!['project','project_detail','communication','language'].includes(x.fact.kind)).slice(0,5);
    const projects=ranked.filter(x=>x.fact.kind==='project').slice(0,2);
    // A desktop/PHP/frontend vacancy must not always get the DentalClinic project.
    const projectHint=/wpf|xaml|desktop/i.test(v.title+' '+v.description)?'project-fleet':/\bphp\b|osrm|route planner|machine learning/i.test(v.title+' '+v.description)?'project-route':/front.?end|next\.?js|\breact\b/i.test(v.title)&&!/full.?stack/i.test(v.title)?'project-cv':'project-dental';
    const preferred=ranked.find(x=>x.fact.id===projectHint);
    if(preferred&&['developer','qa','implementation','technical_support'].includes(a.role)){const i=projects.findIndex(x=>x.fact.id===preferred.fact.id);if(i>=0)projects.splice(i,1);projects.unshift(preferred);projects.splice(2);}
    const supporting=ranked.filter(x=>['communication','language'].includes(x.fact.kind)).slice(0,1);
    const chosen=[...core,...projects,...supporting];
    return {analysis:a,core,projects,supporting,excluded,evidence:chosen.map(x=>x.fact),allRanked:ranked,requirementMap:a.requirements.map(r=>({text:r,evidenceIds:chosen.filter(x=>topics(r).some(t=>x.matches.includes(t))).map(x=>x.fact.id)}))};
  }
  function coverText(f,lang='ru') {
    if(!f)return '';
    const l=lang==='en'?'en':'ru';
    const neutral={
      'exp-appxite':{ru:'Сейчас работаю как Technical Support / Integration Support Specialist с SaaS-платформой и внутренними системами.',en:'I currently work as a Technical Support / Integration Support Specialist with a SaaS platform and internal systems.'},
      'exp-crowne':{ru:'Есть опыт Customer Service с международными клиентами: обработка запросов, письменная и телефонная коммуникация, работа с внутренними системами и координация решения нестандартных ситуаций.',en:'I have customer-service experience with international clients, including request handling, written and phone communication, internal systems and coordination of non-standard cases.'},
      'education-top':{ru:'У меня профильное образование в области информационных систем и программирования, квалификация программиста и диплом с отличием.',en:'I have a technical education in Information Systems and Programming, a programmer qualification and an honours diploma.'}
    };
    if(neutral[f.id])return neutral[f.id][l];
    let text=T.factText(f,l);
    if(f.company){
      const escaped=String(f.company).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      text=text.replace(new RegExp(escaped,'ig'),'').replace(/\s{2,}/g,' ').replace(/\b(?:в|at|for)\s+(?=[,.;])/ig,'').trim();
    }
    return text;
  }
  function localCover(p,v,lang){
    const s=select(p,v),a=s.analysis,l=lang||a.language;
    const facts=T.evidence(p),by=id=>facts.find(f=>f.id===id),say=f=>f?coverText(f,l):'';
    const variant=parseInt(T.hash((v.url||v.vacancyId||'')+'|'+v.title),16)%3;
    const intro=l==='ru'?[`Здравствуйте! Откликаюсь на вакансию «${v.title}».`,`Здравствуйте! Пишу по вакансии «${v.title}».`,`Здравствуйте! Хочу обсудить вакансию «${v.title}».`][variant]:`Hello! I am applying for the ${v.title} role.`;
    const selected=[],add=f=>{if(f&&!selected.some(x=>x.id===f.id))selected.push(f);};
    if(a.role==='developer'){add(by('exp-freelance-dev'));add(s.projects[0]?.fact);const task=s.allRanked.find(x=>x.fact.kind==='task'&&x.fact.employmentId==='exp-freelance-dev');add(task?.fact);add(by('education-top'));}
    else if(['technical_support','implementation'].includes(a.role)){add(by('exp-appxite'));const tasks=s.allRanked.filter(x=>x.fact.employmentId==='exp-appxite').slice(0,2);tasks.forEach(x=>add(x.fact));add(by('education-top'));if(!tasks.length)add(s.projects[0]?.fact);}
    else if(a.role==='qa'){add(by('appxite-testing'));add(by('appxite-api'));add(s.projects[0]?.fact?.id==='project-dental'?by('project-dental-api'):s.projects[0]?.fact);add(by('education-top'));}
    else {const items=s.allRanked.filter(x=>!['skill','project','project_detail'].includes(x.fact.kind));items.slice(0,3).forEach(x=>add(x.fact));}
    if(!selected.length)return {ok:false,text:'',code:'no-evidence',selection:s,errors:['Недостаточно подтверждённых фактов для этой вакансии.']};
    const github=technical(a.role,v)&&/^https:\/\/github\.com\/[a-z0-9-]+\/?$/i.test(p.github||'')?p.github:'';
    const parts=[intro,...selected.map(say),github?(l==='ru'?`Проекты: ${github}`:`Projects: ${github}`):''].filter(Boolean);
    const text=[parts.slice(0,github?-1:parts.length).join(' '),github?parts.at(-1):''].filter(Boolean).join('\n\n');
    const validation=verify(text,p,{vacancy:v,kind:'cover',factIds:selected.map(f=>f.id),allowedFacts:selected});
    if(l==='en'&&selected.some(f=>!f.textEn&&/[а-яё]/i.test(f.text))){validation.errors.push('translation-required');validation.ok=false;}
    return {ok:validation.ok,text,source:'local-evidence',factIds:selected.map(f=>f.id),selection:s,validation,version:'3.9.5-evidence'};
  }
  function vacancySpecificity(text,vacancy={}){
    const draft=trim(text,20000).toLowerCase(),title=trim(vacancy.title,500).toLowerCase(),desc=trim(vacancy.description,16000).toLowerCase();
    if(!draft||!title)return {ok:false,matches:[]};
    if(draft.includes(title))return {ok:true,matches:[title]};
    const stop=new Set(['вакансия','вакансии','работа','работе','работы','позиция','позиции','специалист','менеджер','сотрудник','компания','команде','работодатель','работодателя','with','the','and','for','role','position','job','company','specialist','manager']);
    const words=(title+' '+desc).match(/[a-zа-яё0-9#+.]{4,}/gi)||[];
    const candidates=[...new Set(words.map(x=>x.toLowerCase()).filter(x=>!stop.has(x)))].slice(0,120);
    const matches=candidates.filter(x=>draft.includes(x)).slice(0,12);
    return {ok:matches.length>=1,matches};
  }
  function verify(text,p,{vacancy={},kind='reply',factIds=[],allowedFacts=null,latestInbound=''}={}){
    const draft=trim(text,20000),errors=[],warnings=[],a=analyze(vacancy);
    const facts=T.evidence(p),valid=new Set(facts.map(f=>f.id)),ground=facts.map(f=>[f.text,f.textEn,f.textRu,f.company,f.startDate,f.endDate].filter(Boolean).join(' ')).join('\n');
    if(!draft)errors.push('empty');
    if(kind==='cover'&&draft&&!vacancySpecificity(draft,vacancy).ok)errors.push('vacancy-specificity');
    if(factIds.some(id=>!valid.has(id)))errors.push('unknown-evidence-id');
    if(kind==='cover'&&technical(a.role,vacancy)&&/crowne\s+plaza|front\s+desk|receptionist|официант|бармен|барбершоп|преподава/i.test(draft))errors.push('irrelevant-experience');
    if(kind==='cover'&&/appxite|crowne\s+plaza|top\s+academy|академи[яи]\s+топ/i.test(draft))errors.push('previous-employer-name');
    for(const match of draft.matchAll(/(\d+[.,]?\d*)\s*(?:\+?\s*years?|лет|года?|месяц|months?|руб|₽|€|\$)/ig)){
      const n=Number(match[1]),before=draft.slice(Math.max(0,match.index-45),match.index);
      const isCalendar=n>=1900&&n<=2100&&ground.includes(match[1])&&/январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|since|from/i.test(before);
      if(!isCalendar)errors.push('unverified-quantity');
    }
    if(/(?:идеальн[а-я]*\s+кандидат|ideal candidate|unique blend|уникальн[а-я]*\s+(?:опыт|сочетани)|results.driven|высокомотивирован)/i.test(draft))warnings.push('generic-promotional-language');
    for(const t of TECH_CATALOG){if(hasTerm(t,draft)&&!hasTerm(t,ground)){
      const sentences=draft.split(/(?<=[.!?])\s+|\n+/).filter(x=>hasTerm(t,x));
      if(sentences.some(x=>!/[?]$/.test(x)&&!/не\s+(?:указан|подтвержд)|уточнить|unknown|not confirmed/i.test(x)))errors.push('unsupported-skill:'+t);
    }}
    const employers=[...draft.matchAll(/(?:работа(?:ю|ла|л)|worked|working|employed)\s+(?:в|at|for)\s+([A-ZА-Я][\wА-Яа-яё.-]*(?:\s+[A-Z][\w.-]*){0,3})/gi)].map(m=>m[1]);
    for(const name of employers)if(!ground.toLowerCase().includes(name.toLowerCase()))errors.push('unsupported-employer:'+name);
    if(/(?:подтверждаю|согласна|принимаю|i accept|i agree).*(?:договор|offer|terms|офер|оффер|согласие|правил)/i.test(draft))errors.push('binding-commitment');
    if(/(?:французск[а-я]*.{0,30}(?:свободн|fluent)|fluent.{0,35}French|French.{0,35}fluent|свободн[а-я]*.{0,35}французск)/i.test(draft)&&!/beginner|начальн/i.test(draft))errors.push('french-level');
    if(/(?:готова|могу).{0,30}(?:приступить|выйти на работу|начать работу)|I can start|available to start/i.test(draft)&&!facts.some(f=>(f.topics||[]).includes('availability')))errors.push('unconfirmed-availability');
    if(/(?:имею|есть|получила).{0,35}сертификат|I (?:hold|have).{0,35}certifi|certified (?:professional|specialist)/i.test(draft)&&!facts.some(f=>/сертификат|certifi/i.test(f.text+' '+f.textEn)))errors.push('unconfirmed-certification');
    if(/authorized to work|EU citizenship|есть.{0,25}(?:право|разрешение).{0,25}работ|гражданка|имею.{0,15}виз/i.test(draft)&&!facts.some(f=>f.kind==='legal'&&f.status==='CONFIRMED'))errors.push('unconfirmed-legal-status');
    if(kind==='cover'&&a.role==='education'&&/github\.com/i.test(draft))errors.push('irrelevant-portfolio');
    const words=draft.split(/\s+/).length;
    if(words>(kind==='cover'?120:180))errors.push('too-long');
    if(kind==='cover'&&draft.length>1800)errors.push('too-long');
    if(kind==='cover'&&warnings.includes('generic-promotional-language'))errors.push('generic-promotional-language');
    return {ok:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],wordCount:words,evidenceIds:factIds,needsReview:kind==='reply',heuristic:true};
  }
  return {TOPICS,TECH_CATALOG,hasTerm,topics,language,route,technical,analyze,select,coverText,localCover,vacancySpecificity,verify};
});
