// Actual worker orchestration with deterministic Chrome and backend fixtures. No real applications.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const id='11111111-1111-4111-8111-111111111111';
async function fixture({letter=true,pending=false,createFails=false,apiBase='http://localhost:8080'}={}) {
  const data={},trace=[],messages=[],listeners=[],tabs=new Map();
  const event={addListener:()=>{}},local={get:async()=>({...data}),set:async x=>Object.assign(data,x),remove:async keys=>[].concat(keys).forEach(k=>delete data[k]),setAccessLevel:async()=>{}};
  const context={console,URL,Date,Promise,AbortController,setTimeout,clearTimeout,self:{},chrome:{runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:f=>listeners.push(f)},getURL:p=>'chrome-extension://test/'+p},alarms:{create:async()=>{},onAlarm:event},storage:{local,sync:{get:async()=>({apiBase})}},tabs:{
    create:async p=>{trace.push(['create',p]);if(createFails)throw Error('tab unavailable');const tab={id:2,status:'complete',url:p.url};tabs.set(2,tab);return tab;},
    get:async n=>tabs.get(n),remove:async n=>{trace.push(['close',n]);tabs.delete(n);},update:async(n,p)=>trace.push(['activate',p]),
    sendMessage:async(n,m)=>{if(n===1){messages.push(m);return;}assert.equal(m.plan.automatic,false);assert.equal(m.plan.trackedId,id);assert.equal(m.plan.coverLetter,'Verified letter for selected vacancy');trace.push(['send',m.plan]);return pending?{status:'submitted-needs-letter'}:{submitted:true,status:'confirmed',coverLetterFilled:letter};}
  }}};
  context.fetch=async(url,options)=>{
    trace.push(['http',url,options?.body]);let value={};
    if(url.endsWith('/api/automation/status'))value={autoApplyEnabled:false,allowed:false,apiReady:true};
    if(url.endsWith('/prepare-dashboard-apply'))value={ready:true,candidate:{vacancyId:id,title:'Junior C#',url:'https://hh.ru/vacancy/123',matchScore:90,eligibilityStatus:'Eligible'},draft:{coverLetter:'Verified letter for selected vacancy'}};
    return {ok:true,text:async()=>JSON.stringify(value)};
  };
  vm.createContext(context);context.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync(__dirname+'/'+p,'utf8'),context));
  vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);
  await new Promise(r=>setImmediate(r));context.browserAutopilotWait=async()=>{};trace.length=0;
  const sender={tab:{id:1},frameId:0,url:'http://localhost:8080/'};
  return {context,data,trace,messages,sender,listeners,setPending:value=>{pending=value;},request:async(overrides={})=>new Promise(resolve=>listeners[0]({type:'vjaDashboardApply',vacancyId:id,requestId:'test',...overrides.message},{...sender,...overrides.sender},resolve))};
}
(async()=>{
  const f=await fixture();await f.context.runDashboardApply('http://localhost:8080',id,f.sender,'one');
  assert.equal(f.trace.find(x=>x[0]==='create')[1].active,false);
  assert(f.trace.some(x=>x[0]==='http'&&x[1].endsWith('/browser-applied')&&JSON.parse(x[2]).coverLetter==='Verified letter for selected vacancy'));
  assert(!f.trace.some(x=>x[0]==='http'&&x[1].includes('browser-auto-applied')));
  assert(f.trace.some(x=>x[0]==='close'));assert(!f.trace.some(x=>x[0]==='activate'));
  assert.equal(f.messages.at(-1).status,'confirmed');assert(!f.data.vjaBrowserAutopilotActivePlan);
  const noLetter=await fixture({letter:false});await noLetter.context.runDashboardApply('http://localhost:8080',id,noLetter.sender,'two');
  assert.equal(noLetter.messages.at(-1).status,'review');assert(!noLetter.trace.some(x=>x[0]==='http'&&x[1].endsWith('/browser-applied')));assert(!noLetter.trace.some(x=>x[0]==='activate'));
  const resume=await fixture({pending:true});await resume.context.runDashboardApply('http://localhost:8080',id,resume.sender,'three');
  assert.equal(resume.messages.at(-1).status,'pending');assert(resume.data.vjaBrowserAutopilotActivePlan);
  const count=resume.trace.filter(x=>x[0]==='send').length;await resume.context.runDashboardApply('http://localhost:8080',id,resume.sender,'duplicate');assert.equal(resume.trace.filter(x=>x[0]==='send').length,count);
  resume.setPending(false);await resume.context.runBrowserAutopilot();assert.equal(resume.messages.at(-1).status,'confirmed','manual continuation must run with autopilot off and API ready');
  assert.equal(resume.trace.filter(x=>x[0]==='create').length,1,'continue existing tab');
  for(const sender of [{url:'https://evil.example/'},{url:'http://localhost.evil.example:8080/'},{url:'http://127.0.0.2:8080/'},{url:'https://127.0.0.1:8080/'},{url:'http://localhost:9999/'},{url:'http://localhost:8080/other'},{frameId:1}]){
    const blocked=await fixture();assert.equal((await blocked.request({sender})).ok,false);assert(!blocked.trace.some(x=>x[0]==='create'));
  }
  for(const [apiBase,url] of [
    ['http://localhost:8080','http://127.0.0.1:8080/'],
    ['http://127.0.0.1:8080','http://localhost:8080/index.html'],
    ['http://localhost:8080','http://[::1]:8080/'],
    ['http://localhost','http://127.0.0.1:80/?view=all']]) {
    const alias=await fixture({apiBase});assert.equal((await alias.request({sender:{url}})).ok,true,url);
    await new Promise(r=>setImmediate(r));assert.equal(alias.messages.at(-1).status,'confirmed',url);
    assert(alias.trace.some(x=>x[0]==='http'&&x[1]===apiBase+'/api/vacancies/'+id+'/prepare-dashboard-apply'));
  }
  const valid=await fixture();assert.equal((await valid.request()).ok,true);await new Promise(r=>setImmediate(r));assert.equal(valid.messages.at(-1).status,'confirmed');
  const failed=await fixture({createFails:true});await failed.context.runDashboardApply('http://localhost:8080',id,failed.sender,'failed');assert(!failed.data.vjaPendingSiteApply);assert(!failed.data.vjaBrowserAutopilotActivePlan);assert.equal(failed.messages.at(-1).status,'review');
  console.log('Dashboard manual apply: exact vacancy/letter, inactive tab, verified receipt, no-letter stop, duplicate prevention, continuation and origin restriction passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
