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
      'exp-appxite':{ru:'Есть опыт Technical Support / Integration Support: поддержка SaaS-платформы и внутренних систем.',en:'I have experience in Technical Support / Integration Support, including SaaS platforms and internal systems.'},
      'appxite-tickets':{ru:'Есть опыт поддержки SaaS: разбирала тикеты, воспроизводила ошибки и помогала пользователям с настройкой системы.',en:'I have SaaS-support experience handling tickets, reproducing bugs and helping users configure the system.'},
      'appxite-diagnostics':{ru:'При диагностике анализировала логи и данные, работала с SQL и базами данных.',en:'My troubleshooting experience includes log and data analysis, SQL and databases.'},
      'appxite-api':{ru:'Проверяла API, интеграции, авторизацию и обмен данными между системами.',en:'I have checked APIs, integrations, authentication and data exchange between systems.'},
      'appxite-testing':{ru:'Проверяла исправления и обновления, документировала технические проблемы и взаимодействовала с разработчиками по их устранению.',en:'I have tested fixes and updates, documented technical issues and collaborated with developers on resolution.'},
      'exp-freelance-dev':{ru:'Есть опыт разработки веб-приложений и программных решений для частных клиентов в формате фриланса.',en:'I have freelance experience developing web applications and software solutions for private clients.'},
      'freelance-backend':{ru:'В клиентских проектах использовала C#, .NET, ASP.NET Core, SQL Server и REST API.',en:'In client projects, I used C#, .NET, ASP.NET Core, SQL Server and REST APIs.'},
      'freelance-lifecycle':{ru:'Исправляла баги, тестировала изменения и сопровождала проекты после запуска.',en:'I fixed bugs, tested changes and supported projects after launch.'},
      'freelance-clients':{ru:'Самостоятельно общалась с клиентами, уточняла требования и доводила задачи от идеи до готового решения.',en:'I communicated directly with clients, clarified requirements and delivered tasks from idea to working solution.'},
      'exp-translator':{ru:'Есть опыт письменного и устного перевода для частных клиентов и международной коммуникации.',en:'I have experience with written and oral translation for private clients and international communication.'},
      'exp-crowne':{ru:'Есть опыт Customer Service с международными клиентами: обработка запросов, письменная коммуникация, работа с внутренними системами и координация решения нестандартных ситуаций.',en:'I have customer-service experience with international clients, including request handling, written communication, internal systems and coordination of non-standard cases.'},
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

  function feminineCover(text,lang='ru') {
    let value=trim(text,20000);
    if((lang||language(value))!=='ru')return value;
    // JavaScript's \b boundary is ASCII-oriented and does not reliably
    // delimit Cyrillic words. Use explicit Cyrillic-safe boundaries and keep
    // the original capitalization of the first-person phrase.
    const sameCase=(sample,next)=>{
      if(sample&&sample===sample.toUpperCase())return next.toUpperCase();
      if(/^[А-ЯЁ]/u.test(sample||''))return next.charAt(0).toUpperCase()+next.slice(1);
      return next;
    };
    const phrase=(source,next)=>[
      new RegExp(`(^|[^а-яё])(${source})(?=$|[^а-яё])`,'giu'),
      (_match,prefix,body)=>prefix+sameCase(body,next)
    ];
    const replacements=[
      phrase('буду\\s+рад','буду рада'),
      phrase('я\\s+готов','я готова'),
      [/(^|[^а-яё])(готов)(?=\s+(?:обсудить|рассмотреть|присоединиться|выполнить|работать|ответить|рассказать))/giu,(_match,prefix,body)=>prefix+sameCase(body,'готова')],
      phrase('заинтересован','заинтересована'),
      phrase('работал','работала'),
      phrase('занимался','занималась'),
      phrase('использовал','использовала'),
      phrase('разрабатывал','разрабатывала'),
      phrase('реализовал','реализовала'),
      phrase('подготовил','подготовила'),
      phrase('получил','получила'),
      phrase('окончил','окончила'),
      phrase('сделал','сделала'),
      phrase('настроил','настроила'),
      phrase('проверил','проверила')
    ];
    for(const [pattern,next] of replacements)value=value.replace(pattern,next);
    return value;
  }
  function contactFooter(p={},lang='ru') {
    const telegram=trim(p.contacts?.telegram,120),email=trim(p.contacts?.email,240);
    const parts=[];
    if(telegram&&/^@?[a-z0-9_]{3,}$/i.test(telegram))parts.push(lang==='en'?`Telegram ${telegram}`:`Telegram: ${telegram}`);
    if(email&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))parts.push(lang==='en'?`Email ${email}`:`email: ${email}`);
    if(!parts.length)return '';
    return lang==='en'?`Contacts: ${parts.join(' · ')}.`:`Связаться со мной можно: ${parts.join(' · ')}.`;
  }
  function personalizeCover(text,p={},lang='ru') {
    const l=lang==='en'?'en':'ru',telegram=trim(p.contacts?.telegram,120),email=trim(p.contacts?.email,240);
    let value=feminineCover(text,l);
    const contactValues=[telegram,email].filter(Boolean);
    if(contactValues.length){
      const lines=value.split(/\n+/).map(x=>x.trim()).filter(Boolean).filter(line=>!contactValues.some(contact=>line.toLowerCase().includes(contact.toLowerCase())));
      value=lines.join('\n\n');
      const footer=contactFooter(p,l);
      if(footer)value=[value,footer].filter(Boolean).join('\n\n');
    }
    return value.trim();
  }

  function localCover(p,v,lang){
    const s=select(p,v),a=s.analysis,l=lang||a.language;
    const facts=T.evidence(p),by=id=>facts.find(f=>f.id===id),say=f=>f?coverText(f,l):'';
    const intro=l==='ru'?`Здравствуйте! Откликаюсь на вакансию «${v.title}».`:`Hello! I am applying for the ${v.title} role.`;
    const selected=[],add=f=>{if(f&&!selected.some(x=>x.id===f.id))selected.push(f);};
    if(a.role==='developer'){add(by('exp-freelance-dev'));add(s.projects[0]?.fact);const task=s.allRanked.find(x=>x.fact.kind==='task'&&x.fact.employmentId==='exp-freelance-dev');add(task?.fact);add(by('education-top'));}
    else if(['technical_support','implementation'].includes(a.role)){add(by('exp-appxite'));const tasks=s.allRanked.filter(x=>x.fact.employmentId==='exp-appxite').slice(0,2);tasks.forEach(x=>add(x.fact));add(by('education-top'));if(!tasks.length)add(s.projects[0]?.fact);}
    else if(a.role==='qa'){add(by('appxite-testing'));add(by('appxite-api'));add(s.projects[0]?.fact?.id==='project-dental'?by('project-dental-api'):s.projects[0]?.fact);add(by('education-top'));}
    else if(a.role==='customer_support'){add(by('exp-appxite'));add(by('appxite-tickets'));add(by('exp-crowne'));if(a.topics.includes('english')||a.topics.includes('language'))add(by('language-ru-en-el'));}
    else if(a.role==='education'){if(a.topics.includes('english')||a.topics.includes('language'))add(by('language-ru-en-el'));add(by('education-top'));add(by('freelance-clients'));}
    else if(a.role==='content'){add(by('exp-translator'));add(by('language-ru-en-el'));add(by('freelance-clients'));}
    else if(['operations','sales'].includes(a.role)){add(by('exp-crowne'));add(by('freelance-clients'));if(a.topics.includes('english')||a.topics.includes('language'))add(by('language-ru-en-el'));}
    else {const items=s.allRanked.filter(x=>!['skill','project_detail'].includes(x.fact.kind));items.slice(0,3).forEach(x=>add(x.fact));}
    if(!selected.length){
      const focus={
        customer_support:{ru:'Заинтересовали задачи по работе с клиентскими запросами, координации и оперативному решению вопросов.',en:'I am interested in the customer-request, coordination and real-time problem-solving responsibilities described in the vacancy.'},
        technical_support:{ru:'Заинтересовали задачи по поддержке пользователей и разбору обращений.',en:'I am interested in the user-support and issue-resolution responsibilities described in the vacancy.'},
        implementation:{ru:'Заинтересовали задачи по сопровождению внедрения и взаимодействию с пользователями.',en:'I am interested in the implementation-support and user-facing responsibilities described in the vacancy.'},
        qa:{ru:'Заинтересовали задачи по проверке качества и анализу проблем.',en:'I am interested in the quality-assurance and issue-analysis responsibilities described in the vacancy.'},
        developer:{ru:'Заинтересовали задачи разработки и техническая часть вакансии.',en:'I am interested in the development responsibilities and technical scope of the vacancy.'},
        education:{ru:'Заинтересовали задачи обучения и объяснения материала.',en:'I am interested in the teaching and explanation responsibilities described in the vacancy.'},
        operations:{ru:'Заинтересовали задачи координации и организации рабочих процессов.',en:'I am interested in the coordination and operational responsibilities described in the vacancy.'},
        sales:{ru:'Заинтересовали задачи по работе с клиентскими запросами и сопровождению коммуникации.',en:'I am interested in the client-facing and communication responsibilities described in the vacancy.'},
        content:{ru:'Заинтересовали задачи, связанные с коммуникацией и работой с контентом.',en:'I am interested in the communication and content-related responsibilities described in the vacancy.'},
        other:{ru:'Заинтересовали задачи и формат работы, описанные в вакансии.',en:'I am interested in the responsibilities and working format described in the vacancy.'}
      };
      const body=(focus[a.role]||focus.other)[l==='en'?'en':'ru'];
      const closing=l==='ru'?'Буду рада обсудить детали вакансии. Спасибо за рассмотрение отклика.':'I would be glad to discuss the role in more detail. Thank you for considering my application.';
      const text=personalizeCover([intro,body,closing].filter(Boolean).join(' '),p,l);
      const validation=verify(text,p,{vacancy:v,kind:'cover',factIds:[],allowedFacts:[]});
      validation.warnings=[...new Set([...(validation.warnings||[]),'vacancy-only-no-confirmed-evidence'])];
      return {ok:validation.ok,text,source:'local-vacancy-only',factIds:[],selection:s,validation,version:'6.0.0-safe-vacancy-only'};
    }
    const topicLabels={
      ru:{tickets:'обращения и тикеты',bugs:'воспроизведение и описание ошибок',support:'поддержка пользователей',api:'API',integration:'интеграции',authentication:'авторизация',sql:'SQL и базы данных',logs:'анализ логов',diagnostics:'техническая диагностика',testing:'проверка исправлений',documentation:'техническая документация',collaboration:'взаимодействие с разработчиками',communication:'коммуникация с клиентами',client:'работа с клиентскими запросами',english:'английский язык',teaching:'объяснение материала',development:'разработка'},
      en:{tickets:'ticket handling',bugs:'bug reproduction and reporting',support:'user support',api:'APIs',integration:'integrations',authentication:'authentication',sql:'SQL and databases',logs:'log analysis',diagnostics:'technical troubleshooting',testing:'fix verification',documentation:'technical documentation',collaboration:'developer collaboration',communication:'client communication',client:'customer requests',english:'English',teaching:'clear explanation',development:'software development'}
    };
    const evidenceTopics=new Set(selected.flatMap(f=>[...(f.topics||[]),...topics((f.text||'')+' '+(f.textEn||''))]));
    const matched=[...new Set(a.topics.filter(t=>evidenceTopics.has(t)).map(t=>(topicLabels[l==='en'?'en':'ru']||{})[t]).filter(Boolean))].slice(0,4);
    const alignment=matched.length>=2?(l==='ru'?`По требованиям вакансии особенно релевантны: ${matched.join(', ')}.`:`The most relevant matches for this role are ${matched.join(', ')}.`):'';
    const github=technical(a.role,v)&&/^https:\/\/github\.com\/[a-z0-9-]+\/?$/i.test(p.github||'')?p.github:'';
    const closing=l==='ru'?'Буду рада обсудить, как мой опыт может быть полезен вашей команде.':'I would be glad to discuss how my experience can contribute to your team.';
    const body=[intro,...selected.map(say),alignment,closing].filter(Boolean).join(' ');
    const text=personalizeCover([body,github?(l==='ru'?`Проекты: ${github}`:`Projects: ${github}`):''].filter(Boolean).join('\n\n'),p,l);
    const validation=verify(text,p,{vacancy:v,kind:'cover',factIds:selected.map(f=>f.id),allowedFacts:selected});
    if(l==='en'&&selected.some(f=>!f.textEn&&/[а-яё]/i.test(f.text))){validation.errors.push('translation-required');validation.ok=false;}
    return {ok:validation.ok,text,source:'local-evidence',factIds:selected.map(f=>f.id),selection:s,validation,version:'6.0.0-evidence-professional'};
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
    if(kind==='cover'&&language(draft)==='ru'&&/(?:^|[^а-яё])(?:я\s+готов|буду\s+рад|заинтересован|работал|занимался|использовал|разрабатывал|реализовал|получил|окончил)(?=$|[^а-яё])/iu.test(draft))errors.push('masculine-candidate-form');
    if(kind==='cover'&&/(?:сейчас\s+работаю|в\s+настоящее\s+время\s+работаю|\bработаю\b|i\s+currently\s+work|currently\s+employed|i\s+am\s+working|i\s+work\s+(?:at|for|as|with)\b)/iu.test(draft))errors.push('current-employment-claim');
    if(kind==='cover'){const tg=trim(p.contacts?.telegram,120),mail=trim(p.contacts?.email,240);if(tg&&!draft.includes(tg))errors.push('telegram-missing');if(mail&&!draft.toLowerCase().includes(mail.toLowerCase()))errors.push('email-missing');}
    if(factIds.some(id=>!valid.has(id)))errors.push('unknown-evidence-id');
    if(kind==='cover'&&technical(a.role,vacancy)&&/crowne\s+plaza|front\s+desk|receptionist|официант|бармен|барбершоп|преподава/i.test(draft))errors.push('irrelevant-experience');
    if(kind==='cover'&&/appxite|crowne\s+plaza|top\s+academy|академи[яи]\s+топ/i.test(draft))errors.push('previous-employer-name');
    for(const match of draft.matchAll(/(\d+[.,]?\d*)\s*(?:\+?\s*years?|лет|года?|месяц|months?|руб|₽|€|\$)/ig)){
      const n=Number(match[1]),before=draft.slice(Math.max(0,match.index-45),match.index);
      const isCalendar=n>=1900&&n<=2100&&ground.includes(match[1])&&/январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|since|from/i.test(before);
      if(!isCalendar)errors.push('unverified-quantity');
    }
    if(/(?:идеальн[а-я]*\s+кандидат|ideal candidate|unique blend|уникальн[а-я]*\s+(?:опыт|сочетани)|results.driven|высокомотивирован)/i.test(draft))warnings.push('generic-promotional-language');
    const vacancyTitle=trim(vacancy.title,1000),vacancyTitleLower=vacancyTitle.toLowerCase();
    for(const t of TECH_CATALOG){if(hasTerm(t,draft)&&!hasTerm(t,ground)){
      const sentences=draft.split(/(?<=[.!?])\s+|\n+/).filter(x=>hasTerm(t,x));
      if(sentences.some(x=>{
        const lower=x.toLowerCase();
        const titleReference=kind==='cover'&&vacancyTitleLower&&lower.includes(vacancyTitleLower)&&/(?:ваканс|отклика|пишу\s+по|applying|role|position)/i.test(x);
        return !titleReference&&!/[?]$/.test(x)&&!/не\s+(?:указан|подтвержд)|уточнить|unknown|not confirmed/i.test(x);
      }))errors.push('unsupported-skill:'+t);
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
    if(words>(kind==='cover'?140:180))errors.push('too-long');
    if(kind==='cover'&&draft.length>1800)errors.push('too-long');
    if(kind==='cover'&&warnings.includes('generic-promotional-language'))errors.push('generic-promotional-language');
    return {ok:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],wordCount:words,evidenceIds:factIds,needsReview:kind==='reply',heuristic:true};
  }
  return {TOPICS,TECH_CATALOG,hasTerm,topics,language,route,technical,analyze,select,coverText,feminineCover,contactFooter,personalizeCover,localCover,vacancySpecificity,verify};
});
