// Actual service worker integration. Fake Chrome/HTTP only. Killed cleanly after assertions.
const {spawn}=require('node:child_process'),readline=require('node:readline'),assert=require('node:assert/strict'),path=require('node:path');
const child=spawn(process.execPath,[path.join(__dirname,'worker-bridge.cjs')],{stdio:['pipe','pipe','inherit']});const pending=new Map();let id=0,passed=0;
readline.createInterface({input:child.stdout}).on('line',line=>{const r=JSON.parse(line),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.result);}});
function call(q){return new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});child.stdin.write(JSON.stringify({...q,id})+'\n');});}
function ok(name,v){assert.ok(v,name);passed++;console.log('PASS',name);}
const sender={url:'chrome-extension://fixture/product.html'};
(async()=>{
 await call({op:'set',data:{vjaLearningEventsV1:[]}});
 await call({op:'eval',code:"Promise.all(Array.from({length:40},(_,i)=>cpRecordLearningEvent({type:'VACANCY_APPLIED',eventId:'race-'+i,vacancyId:String(i)})))"});
 let state=await call({op:'get'});ok('40 concurrent learning writes retain all events',state.data.vjaLearningEventsV1.length===40);
 let r=await call({op:'message',message:{type:'vjaCopilot',op:'product-restore',data:{}},sender:{tab:{id:9},url:'https://hh.ru/vacancy/1'}});ok('web page cannot invoke backup restore',r?.ok===false);
 r=await call({op:'message',message:{type:'vjaCopilot',op:'questionnaire-memory',action:'remember',entry:{semanticKey:'ENGLISH:fixture',answer:'Fluent',category:'ENGLISH_LEVEL'}},sender:{tab:{id:9},url:'https://hh.ru/applicant/vacancy_response?vacancyId=1'}});ok('questionnaire answer saved through trusted worker',r?.ok&&r.value.answer==='Fluent');
 r=await call({op:'message',message:{type:'vjaCopilot',op:'questionnaire-memory',action:'get',key:'ENGLISH:fixture'},sender:{tab:{id:9},url:'https://hh.ru/applicant/vacancy_response?vacancyId=1'}});ok('questionnaire memory restored through worker',r?.value?.answer==='Fluent');
 const model={schemaVersion:1,modelType:'personal-vacancy-logreg',modelVersion:'fixture-model',dimension:256,weights:Array(256).fill(0),threshold:.5,trainedOnRealLabels:false,trainingLabels:100,testMetrics:{n:30,f1:.8}};
 r=await call({op:'message',message:{type:'vjaCopilot',op:'learning-model-import',model},sender});ok('candidate import computes hash',r?.ok&&r.entry?.sha256?.length===64);
 r=await call({op:'message',message:{type:'vjaCopilot',op:'learning-model-import',model:{...model,weights:Array(256).fill(1)}},sender});ok('same version with different model rejected',r?.ok===false);
 r=await call({op:'message',message:{type:'vjaCopilot',op:'learning-model-promote',version:'fixture-model'},sender});ok('synthetic model cannot be promoted',r?.ok===false);
 r=await call({op:'message',message:{type:'vjaCopilot',op:'product-model-shadow',version:'fixture-model'},sender});ok('explicit shadow assignment accepted without activation',r?.ok===true);
 r=await call({op:'eval',code:"cpCaptureShadow({vacancyId:'fixture',provider:'hh',title:'Support'},{features:{role:'support'},rulesScoreBeforeMl:90,preferences:{minimumFitScore:80}})"});state=await call({op:'get'});ok('shadow prediction recorded without active model',state.data.vjaShadowPredictionsV1.length===1&&!state.data.vjaModelRegistryV1.activeModel);
 r=await call({op:'eval',code:"cpRestoreProduct(vjaProductCore.snapshot({vjaJobPreferencesV1:{avoidCalls:true}}))"});ok('restore writes safe settings without submissions',r.paused===true);
 console.log(JSON.stringify({passed,boundary:'Actual JS worker; mocked Chrome/HTTP. No network submissions.'}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{child.kill('SIGKILL');});
setTimeout(()=>{console.error('Worker test deadline exceeded');child.kill('SIGKILL');process.exit(2);},15000).unref();
