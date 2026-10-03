const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('./vacancy-fit.js');
const profile={facts:[
 {kind:'skill',text:'C#',status:'CONFIRMED',roles:['developer','technical_support']},
 {kind:'skill',text:'SQL Server',status:'CONFIRMED',roles:['developer','technical_support']},
 {kind:'skill',text:'Docker',status:'CONFIRMED',roles:['developer']},
 {kind:'language',text:'English — Fluent',status:'CONFIRMED'},
 {kind:'experience',text:'Technical Support troubleshooting and integrations',status:'CONFIRMED',roles:['technical_support']}
]};

test('4.0 preference defaults are bounded and explainable',()=>{
 const p=F.normalizePreferences({minimumFitScore:200,batchConcurrency:20});
 assert.equal(p.minimumFitScore,100);assert.equal(p.batchConcurrency,4);assert.equal(p.avoidCalls,true);
});

test('4.0 strong remote no-call technical vacancy scores high with reasons',()=>{
 const v={title:'Junior .NET Technical Support',description:'Удаленная работа. C#, SQL Server, REST API. Английский B2.'};
 const fit=F.scoreVacancy(v,profile,{}, {status:'no-calls'}, {role:'technical_support',remote:true,technologies:['C#','SQL Server','REST API']});
 assert.ok(fit.score>=80,fit);assert.equal(fit.ready,true);assert.ok(fit.reasons.length>=2);assert.equal(fit.algorithm,'rules-v1');
});

test('4.0 calls are a hard negative when avoidCalls is enabled',()=>{
 const v={title:'Специалист поддержки',description:'Принимать входящие звонки клиентов.'};
 const fit=F.scoreVacancy(v,profile,{minimumFitScore:70}, {status:'calls'}, {role:'technical_support',remote:true,technologies:[]});
 assert.ok(fit.score<=25);assert.equal(fit.ready,false);assert.equal(fit.decision,'SKIP');assert.ok(fit.risks.some(x=>/звон/i.test(x)));
});

test('4.0 sales preference hardens ranking without pretending ML',()=>{
 const fit=F.scoreVacancy({title:'Sales manager',description:'Активные продажи'},profile,{}, {status:'no-calls'}, {role:'sales',technologies:[]});
 assert.ok(fit.score<=35);assert.equal(fit.algorithm,'rules-v1');assert.equal(fit.ready,false);
});

test('4.0 queue keeps ready, unapplied and non-skipped vacancies sorted by score',()=>{
 const q=F.queueItems([
  {vacancy:{title:'B'},fit:{score:88,ready:true},analysis:{status:'no-calls'},application:null},
  {vacancy:{title:'A'},fit:{score:94,ready:true},analysis:{status:'no-calls'},application:null},
  {vacancy:{title:'Applied'},fit:{score:99,ready:true},analysis:{status:'no-calls'},application:{status:'Applied',completed:true}},
  {vacancy:{title:'Skipped'},fit:{score:97,ready:true},analysis:{status:'no-calls'},decision:'SKIPPED'}
 ],{minimumFitScore:80});
 assert.deepEqual(q.map(x=>x.vacancy.title),['A','B']);
});
