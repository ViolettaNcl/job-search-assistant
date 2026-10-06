/* Actual service-worker safety gate; Chrome storage/HTTP mocked, no real submissions. */
'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),readline=require('node:readline');
const child=spawn(process.execPath,[path.join(__dirname,'worker-bridge.cjs')]);let seq=0,passed=0;const pending=new Map();
readline.createInterface({input:child.stdout}).on('line',s=>{const r=JSON.parse(s),p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.result);});
function call(data){return new Promise((resolve,reject)=>{data.id=++seq;pending.set(seq,{resolve,reject});child.stdin.write(JSON.stringify(data)+'\n');});}
function check(name,value){assert.ok(value,name);passed++;console.log('PASS '+name);}
(async()=>{try{
 const sender={tab:{id:7},frameId:0,url:'https://hh.ru/vacancy/1100'};
 const job={plan:{id:'safety-fixture',vacancyId:'1100',sourceUrl:sender.url},tabId:7,frameId:0,context:{role:'technical_support',vacancy:{provider:'hh',vacancyId:'1100',title:'Fixture',url:sender.url}}};
 const base={mode:'autopilot',explicitOptIn:true,paused:false,approvedCategories:['technical_support'],dailyLimit:20};
 await call({op:'set',data:{'vjaApplicationJob:safety-fixture':job,'vjaVacancyIntel:1100':{fit:{score:95}}}});
 const authorize=(s=sender,risks={},userInitiated=false,intent=userInitiated?'quick-list-apply-letter':'')=>call({op:'message',sender:s,message:{type:'vjaSubmitAuthorization',planId:'safety-fixture',vacancyId:'1100',userInitiated,intent,risks}});
 check('default Assist refuses background submission',!(await authorize()).allowed);
 check('default Assist accepts the explicit Apply + letter click',(await authorize(sender,{},true)).allowed);
 await call({op:'set',data:{vjaAutomationPolicyV1:base}});check('explicit approved high-Fit HH application can be authorized',(await authorize()).allowed);
 for(const key of ['captcha','legal','unknownRequiredFact','payment','identityVerification','unexpectedUpload','unresolvedReview'])check(key+' blocks even approved Autopilot',!(await authorize(sender,{[key]:true})).allowed);
 check('different tab cannot reuse application binding',!(await authorize({...sender,tab:{id:99}})).allowed);
 check('unknown external origin cannot submit',!(await authorize({...sender,url:'https://unexpected.example/application'})).allowed);
 check('HeadHunter.kg is a trusted HH application origin',(await authorize({...sender,url:'https://headhunter.kg/vacancy/1100'}, {}, true)).allowed);
 await call({op:'set',data:{'vjaVacancyIntel:1100':{fit:{score:89}}}});check('Fit below threshold refuses final action',!(await authorize()).allowed);
 await call({op:'set',data:{'vjaVacancyIntel:1100':{fit:{score:95}},vjaAutomationPolicyV1:{...base,paused:true}}});check('global pause blocks background final action',!(await authorize()).allowed);check('global pause does not cancel the one-shot Apply + letter click',(await authorize(sender,{},true)).allowed);check('unrecognized submit intent remains blocked',!(await authorize(sender,{},true,'unknown')).allowed);
 await call({op:'set',data:{vjaAutomationPolicyV1:{...base,approvedCategories:['developer']}}});check('unapproved role refuses final action',!(await authorize()).allowed);
 await call({op:'set',data:{vjaAutomationPolicyV1:{...base,explicitOptIn:false}}});check('missing explicit opt-in refuses final action',!(await authorize()).allowed);
 console.log(JSON.stringify({passed,boundary:'Real worker JavaScript; mocked Chrome/HTTP, no live site'}));
 }finally{child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
