'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const C=require('./copilot-core.js'),Q=require('./quick-replies.js');
const p=C.profile({fullName:'Fixture Candidate',firstName:'Fixture',lastName:'Candidate',contacts:{email:'candidate@example.test',telegram:'@fixture'},facts:[{id:'s',kind:'skill',text:'SQL',status:'CONFIRMED',roles:['developer']},{id:'u',kind:'experience',text:'Worked for imaginary company',status:'UNKNOWN'},{id:'i',kind:'skill',text:'Jira',status:'INFERENCE'},{id:'t',kind:'communication',text:'Can help customers',status:'TRANSFERABLE'}]});
const V=(id,company='One',title='Support')=>C.vacancy({url:'https://hh.ru/vacancy/'+id,vacancyId:id,company,title});
const A=(id,applicationId='app-'+id)=>({id:'record-'+id,applicationId,vacancy:V(id)});
for(const [input,role] of [['Technical Support Specialist','technical_support'],['Junior .NET Developer','developer'],['Helpdesk agent','technical_support'],['Customer Support','customer_support'],['Manual QA','qa'],['Implementation specialist','implementation'],['Back office administrator','operations'],['Преподаватель программирования','education']])test('role: '+input,()=>assert.equal(C.classifyRole(input,'Developer tools, SQL'),role));
test('role title beats incidental stack in description',()=>assert.equal(C.classifyRole('Technical Support','C# .NET development'),'technical_support'));
test('provider uses domain boundary, not substring',()=>assert.equal(C.provider('https://hh.ru.attacker.invalid/vacancy/1'),'generic'));
test('HeadHunter.kg is the same HH provider family',()=>{assert.equal(C.provider('https://headhunter.kg/vacancy/137861116'),'hh');assert.equal(C.provider('https://evilheadhunter.kg.attacker.invalid/vacancy/1'),'generic');});
test('query identities are not stripped',()=>assert.notEqual(C.canonicalUrl('https://example.test/jobs?jobId=1'),C.canonicalUrl('https://example.test/jobs?jobId=2')));
test('tracking canonicalization retains vacancy identity',()=>assert.equal(C.canonicalUrl('https://hh.ru/vacancy/1?utm_source=x&hhtmFrom=z'),C.canonicalUrl('https://hh.ru/vacancy/1')));
test('same title and company never merge distinct job IDs',()=>assert.equal(C.sameVacancy(V('1'),V('2')),false));
test('same ID different generic tenants does not merge',()=>assert.equal(C.sameVacancy({url:'https://a.test/jobs/1'},{url:'https://b.test/jobs/1'}),false));
test('Workday IDs are requisitions, not shared city',()=>{assert.equal(C.idFromUrl('https://example.wd5.myworkdayjobs.com/Careers/job/Paris/Support_R100'),'R100');assert.equal(C.sameVacancy({url:'https://example.wd5.myworkdayjobs.com/Careers/job/Paris/Support_R100'},{url:'https://example.wd5.myworkdayjobs.com/Careers/job/Paris/Support_R101'}),false);});
test('shared Workday hosting separates employers',()=>assert.notEqual(C.tenant('https://wd3.myworkdaysite.com/recruiting/companyA/jobs/job/X_R1'),C.tenant('https://wd3.myworkdaysite.com/recruiting/companyB/jobs/job/X_R1')));
test('direct application binds its vacancy',()=>assert.equal(C.resolveConversation({provider:'hh',applicationId:'app-2'},[A('1'),A('2')]).application.id,'record-2'));
test('conflicting application and vacancy identifiers fail closed',()=>assert.equal(C.resolveConversation({provider:'hh',applicationId:'app-1',vacancyId:'2'},[A('1'),A('2')]).reason,'conflicting-identities'));
test('ambiguous duplicate IDs need selection',()=>assert.equal(C.resolveConversation({provider:'hh',vacancyId:'1'},[A('1'),{...A('1'),id:'second'}]).matched,false));
test('no direct identity means no title-only match',()=>assert.equal(C.resolveConversation({provider:'hh',jobTitle:'Support',company:'One'},[A('1')]).matched,false));
test('explicit mapping persists without guessing',()=>assert.equal(C.resolveConversation({provider:'hh'},[A('1'),A('2')],{applicationKey:'record-2'}).application.id,'record-2'));
test('changed direct identity overrides old mapping',()=>assert.equal(C.resolveConversation({provider:'hh',vacancyId:'2'},[A('1'),A('2')],{applicationKey:'record-1'}).application.id,'record-2'));
test('same job ID at another provider is not selected',()=>assert.equal(C.resolveConversation({provider:'generic',url:'https://other.test/chat/1',vacancyId:'1'},[A('1')]).matched,false));
test('thread ID and document ID are part of stale protection',()=>{const a={url:'https://hh.ru/chat',conversationId:'a',documentId:'one'};assert.equal(C.sameContext(a,{...a,conversationId:'b'}),false);assert.equal(C.sameContext(a,{...a,documentId:'two'}),false);});
test('truth source excludes inference transferable and unknown claims',()=>assert.deepEqual(C.confirmed(p).map(f=>f.id),['s']));
for(const label of ['Expected salary','Work authorization','Visa sponsorship','I agree to terms','Background check','Дата выхода','Обработка персональных данных','Passport number','Notice period','How many years commercial experience'])test('manual risk field: '+label,()=>assert.equal(C.fieldDecision({label,type:'text'},p).action,'review'));
for(const type of ['checkbox','radio','date','password','combobox','multiselect'])test('manual control: '+type,()=>assert.equal(C.fieldDecision({label:'Email',type},p).action,'review'));
test('confirmed email can fill',()=>assert.equal(C.fieldDecision({label:'Email',type:'email'},p).value,p.contacts.email));
test('Russian name label works without ASCII word boundary',()=>assert.equal(C.fieldDecision({label:'Имя',type:'text'},p).value,'Fixture'));
test('unknown phone is not fabricated',()=>assert.equal(C.fieldDecision({label:'Phone',type:'tel'},p).action,'review'));
test('field length limit does not truncate facts',()=>assert.equal(C.fieldDecision({label:'Email',type:'email',maxLength:2},p).action,'review'));
test('CV selection is language-only and ignores legacy role CVs',()=>{const f={base64:'x'};assert.equal(C.cvKey('qa','ru',{'cvVaultEn':f,'cvVaultRu':f,'cvVaultRole:qa:ru':f}),'cvVaultRu');assert.equal(C.cvKey('qa','ru',{'cvVaultEn':f}),'');});
test('file cannot be arbitrary non PDF',()=>assert.equal(C.cvValid({name:'cover-letter.txt',type:'text/plain',size:8,base64:'Zml4dHVyZQ=='}),false));
for(const label of ['Submit','Send application','Finish','Complete','Отправить','Откликнуться','Accept offer'])test('final action not navigable: '+label,()=>assert.equal(C.safeNavigation({label,explicitStep:true}),false));
test('only explicit intermediate type=button steps can navigate',()=>{assert(C.safeNavigation({label:'Next',explicitStep:true,inForm:true,submitType:false}));assert.equal(C.safeNavigation({label:'Next',explicitStep:true,submitType:true}),false);assert.equal(C.safeNavigation({label:'Next',explicitStep:false}),false);});
test('HH immediate response link is never followed automatically',()=>assert.equal(C.safeApplyLink({label:'Apply',href:'https://hh.ru/applicant/vacancy_response?vacancyId=1'}),false));
test('generic explicit application navigation is allowed',()=>assert.equal(C.safeApplyLink({label:'Apply',href:'https://company.test/jobs/1/application'}),true));
test('unsafe numerical experience rejected',()=>assert.equal(C.guardDraft('I have 3 years of commercial experience.',p).ok,false));
test('unknown employment rejected',()=>assert.equal(C.guardDraft('I worked at Imaginary Inc.',p).ok,false));
test('unknown skill rejected',()=>assert.equal(C.guardDraft('I have experience with Jira.',p).ok,false));
test('short non-binding reply allowed',()=>assert(C.guardDraft('Thank you for the update.',p).ok));
test('local cover letter never adds unknown experience',()=>{const text=C.coverLetter(p,V('1'),'en');assert.doesNotMatch(text,/imaginary|Jira|Can help customers/);});
for(const [message,intent] of [['Мы рассмотрим ваше резюме','WAIT_FOR_FEEDBACK'],['Пришлите ваш Telegram','REQUEST_TELEGRAM'],['Please share your email','REQUEST_EMAIL'],['Когда вам удобно созвониться?','INTERVIEW'],['Какая зарплата вас устроит?','CUSTOM'],['Do you have support experience?','CUSTOM'],['Пришлю тестовое задание сегодня','CUSTOM'],['Какой следующий этап?','CUSTOM']])test('quick intent: '+intent,()=>assert.equal(Q.intent(message),intent));
test('default feedback quick reply contains preferred contacts and phone note',()=>{const item=Q.suggest('Спасибо, мы рассмотрим ваше резюме и дадим обратную связь.','ru',p.contacts)[0];assert.equal(item.id,'feedback_default');assert.equal(item.text,'Здравствуйте! Спасибо за ответ. Буду ждать обратной связи.\n\nЕсли будет возможность, пожалуйста, напишите мне здесь в чате, в Telegram @fixture или на почту candidate@example.test. По обычному телефонному звонку могу не успеть ответить.');});
test('unknown template variables are not silently dropped',()=>assert.equal(Q.render('Hello {{recruiterName}}',{}),''));
test('quick reply library is Russian-only and capped at five',()=>{const lib=Q.library('en',{email:'candidate@example.test',telegram:'@fixture'},[{id:'default-feedback-ru',label:'Мой ответ',language:'ru',text:'Привет'}]);assert.equal(lib.length,5);assert.equal(lib[0].label,'Мой ответ');assert.equal(lib.some(x=>x.label==='My reply'),false);});
test('default Russian feedback reply is prefilled with Violetta contacts',()=>{assert.match(Q.defaultPersonalReply.text,/Здравствуйте! Спасибо за ответ/);assert.match(Q.defaultPersonalReply.text,/@Violet111/);assert.match(Q.defaultPersonalReply.text,/violettanicolaou@gmail\.com/);assert.match(Q.defaultPersonalReply.text,/телефонному звонку могу не успеть ответить/);});
test('quick replies avoid recently inserted and sent repetition',()=>{assert.equal(Q.suggest('Мы рассмотрим резюме','ru',p.contacts,[{id:'feedback_default',at:Date.now()}]).some(x=>x.id==='feedback_default'),false);const exact=Q.library('ru',p.contacts)[0].text;assert.equal(Q.suggest('Мы рассмотрим резюме','ru',p.contacts,[],[],[{text:exact}]).some(x=>x.id==='feedback_default'),false);});
test('contact reply uses one authoritative profile',()=>assert(Q.library('ru',p.contacts).find(t=>t.id==='contacts').text.includes('@fixture')));
test('memory retains material promises and latest messages',()=>{const m=C.threadMemory([{id:'1',speaker:'employer',text:'Interview on 12/10 at 14:00'},{id:'2',speaker:'candidate',text:'I will confirm the time.'}]);assert.equal(m.important[0].id,'1');assert.equal(m.recent.at(-1).id,'2');});

test('complex test-assignment message is delegated to AI instead of canned replies',()=>{const items=Q.suggest('Отправляю тестовое задание','ru',p.contacts);assert.deepEqual(items.map(x=>x.id),[]);});


test('developer cover letter is short, vacancy-specific and excludes unrelated hospitality history',()=>{
  const profile=C.profile({fullName:'Violetta Nicolaou',contacts:{email:'violettanicolaou@gmail.com',telegram:'@Violet111'},facts:[
    {id:'csharp',kind:'skill',text:'C#',status:'CONFIRMED',roles:['developer','qa']},
    {id:'dotnet',kind:'skill',text:'.NET',status:'CONFIRMED',roles:['developer','qa']},
    {id:'asp',kind:'skill',text:'ASP.NET Core',status:'CONFIRMED',roles:['developer']},
    {id:'sql',kind:'skill',text:'SQL Server',status:'CONFIRMED',roles:['developer','qa']},
    {id:'rest',kind:'skill',text:'REST API',status:'CONFIRMED',roles:['developer']},
    {id:'dental',kind:'project',text:'DentalClinic full-stack client project with ASP.NET Core, EF Core, SQL Server, REST API, JWT/RBAC, SignalR, Docker and automated tests.',status:'CONFIRMED',roles:['developer','qa','implementation']},
    {id:'hotel',kind:'experience',text:'Front Desk Receptionist, Crowne Plaza Limassol',status:'CONFIRMED',roles:['technical_support','customer_support','operations']}
  ]});
  const vacancy=C.vacancy({url:'https://hh.ru/vacancy/55',title:'Junior .NET Backend Developer',company:'Example',description:'C# ASP.NET Core REST API SQL Server Docker backend'});
  const text=C.coverLetter(profile,vacancy,'en');
  assert.match(text,/Junior \.NET Backend Developer/);assert.match(text,/C#|ASP\.NET Core/);assert.match(text,/DentalClinic/);
  assert.doesNotMatch(text,/Crowne|Front Desk|Receptionist|Translator/i);assert(text.length<850);
});

test('IT cover letters include the configured GitHub portfolio and remain vacancy-specific',()=>{
  const profile=C.profile({fullName:'Violetta Nicolaou',github:'https://github.com/ViolettaNcl',facts:[
    {id:'csharp2',kind:'skill',text:'C#',status:'CONFIRMED',roles:['developer','technical_support']},
    {id:'dotnet2',kind:'skill',text:'.NET',status:'CONFIRMED',roles:['developer','technical_support']},
    {id:'dental2',kind:'project',text:'DentalClinic full-stack client project with ASP.NET Core and SQL Server.',status:'CONFIRMED',roles:['developer','technical_support']}
  ]});
  const dev=C.coverLetter(profile,C.vacancy({url:'https://hh.ru/vacancy/99',title:'Junior C# .NET Developer',description:'C# .NET ASP.NET Core'}),'ru');
  assert.match(dev,/github\.com\/ViolettaNcl/);assert.match(dev,/C#|\.NET/);assert.doesNotMatch(dev,/Crowne|Front Desk/i);
  const tech=C.coverLetter(profile,C.vacancy({url:'https://hh.ru/vacancy/100',title:'Technical Support Engineer',description:'API SQL troubleshooting SaaS'}),'en');
  assert.match(tech,/github\.com\/ViolettaNcl/);assert.match(tech,/technical|GitHub/i);
});

test('non-IT generic support letter does not force a GitHub link',()=>{
  const profile=C.profile({fullName:'Violetta Nicolaou',github:'https://github.com/ViolettaNcl',facts:[]});
  const text=C.coverLetter(profile,C.vacancy({url:'https://hh.ru/vacancy/101',title:'Customer Support Agent',description:'Answer customer questions in chat'}),'en');
  assert.doesNotMatch(text,/github\.com\/ViolettaNcl/);
});
