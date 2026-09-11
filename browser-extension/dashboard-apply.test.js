// Real worker code with isolated Chrome/HTTP fixtures; no employer traffic.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function fixture({data={},tabs=new Map(),pending=false,letter=true,createFails=false,apiBase='http://localhost:8080'}={}) {
  const trace=[],messages=[],listeners=[];let nextTab=10,enabled=false,gate=null,queue=[],failRecord=false;
  const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  const event={addListener:()=>{}},local={get:async()=>clone(data),set:async x=>Object.assign(data,clone(x)),remove:async keys=>[].concat(keys).forEach(k=>delete data[k]),setAccessLevel:async()=>{}};
  const context={console,URL,Date,Promise,AbortController,setTimeout,clearTimeout,self:{},chrome:{runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:f=>listeners.push(f)},getManifest:()=>({version:'2.7.12'}),getURL:p=>'chrome-extension://test/'+p},alarms:{create:async()=>{},onAlarm:event},storage:{local,sync:{get:async()=>({apiBase})}},tabs:{
    create:async p=>{trace.push(['create',p]);if(createFails)throw Error('tab unavailable');const tab={id:++nextTab,status:'complete',url:p.url};tabs.set(tab.id,tab);return tab;},
    get:async n=>tabs.get(n),remove:async n=>{trace.push(['close',n]);tabs.delete(n);},update:async(n,p)=>{trace.push(['update',n,p]);Object.assign(tabs.get(n),p);return tabs.get(n);},
    sendMessage:async(n,m)=>{if(n===1){messages.push(m);return;}
      if(m.type==='vjaSiteApplyReady')return {ready:true};
      assert.equal(m.plan.coverLetter,'Letter for '+m.plan.trackedId);trace.push(['send',n,clone(m.plan)]);
      if(gate)await gate.promise;
      return pending?{status:'submitted-needs-letter'}:{submitted:true,status:'confirmed',coverLetterFilled:letter};}
  }}};
  context.fetch=async(url,options)=>{
    trace.push(['http',url,options?.body]);let value={},ok=true;
    if(url.endsWith('/api/automation/status'))value={autoApplyEnabled:enabled,allowed:true,remainingToday:10,autoApplyMinimumScore:50};
    if(url.includes('/api/application-queue?'))value=queue;
    if(url.endsWith('/application-draft'))value={coverLetter:'Letter for '+url.split('/').at(-2)};
    if(url.endsWith('/prepare-dashboard-apply')){const vacancyId=url.split('/').at(-2);value={ready:true,candidate:{vacancyId,title:'Junior C# '+vacancyId,url:'https://hh.ru/vacancy/'+parseInt(vacancyId),matchScore:90,eligibilityStatus:'Verify'},draft:{coverLetter:'Letter for '+vacancyId}};}
    if(url.endsWith('/browser-applied')||url.endsWith('/browser-auto-applied')){if(failRecord)ok=false;else queue=queue.filter(j=>!url.includes(j.vacancyId));}
    return {ok,text:async()=>JSON.stringify(value)};
  };
  vm.createContext(context);context.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync(__dirname+'/'+p,'utf8'),context));
  vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);
  await tick();context.browserAutopilotWait=async()=>{};trace.length=0;
  const sender={tab:{id:1},frameId:0,url:'http://localhost:8080/'};
  return {context,data,trace,messages,sender,tabs,send:(n=1)=>context.runDashboardApply(apiBase,id(n),sender,'request-'+n),
    jobs:()=>Object.entries(data).filter(([k])=>k.startsWith('vjaApplicationJob:')).map(([,v])=>v),
    setPending:v=>pending=v,setGate:v=>gate=v,setRecordFailure:v=>failRecord=v,
    enable:items=>{enabled=true;queue=items;},
    request:async(message,s=sender)=>new Promise(resolve=>{for(const f of listeners)if(f(message,s,resolve))return;resolve(undefined);})};
}
(async()=>{
  const f=await fixture();await f.send();
  assert.equal(f.trace.find(x=>x[0]==='create')[1].active,false);
  assert(f.trace.some(x=>x[0]==='http'&&x[1].endsWith('/browser-applied')&&JSON.parse(x[2]).coverLetter==='Letter for '+id(1)));
  assert.equal(f.messages.at(-1).status,'confirmed');assert(f.jobs()[0].completed);
  assert(!f.trace.some(x=>x[0]==='update'&&x[2].active));
  await f.send();assert.equal(f.trace.filter(x=>x[0]==='send').length,1,'completed duplicate never resends');
  const noLetter=await fixture({letter:false});await noLetter.send();assert(noLetter.jobs()[0].review);assert(!noLetter.trace.some(x=>x[0]==='http'&&x[1].endsWith('/browser-applied')));
  const busy=await fixture(),gate=deferred();busy.setGate(gate);
  const tasks=[1,2,3,4,5].map(n=>busy.send(n));await tick();
  assert.equal(busy.trace.filter(x=>x[0]==='send').length,3,'three manual applications start before any finishes');
  assert.equal(busy.jobs().length,5,'overflow persists in queue');
  assert(busy.messages.filter(x=>x.status==='pending').length>=5);
  gate.resolve();await Promise.all(tasks);
  assert.equal(busy.jobs().filter(j=>j.completed).length,5);
  assert.equal(new Set(busy.trace.filter(x=>x[0]==='send').map(x=>x[1])).size,5);
  const concurrent=await fixture(),held=deferred();concurrent.setGate(held);
  concurrent.enable([7,8].map(n=>({vacancyId:id(n),title:'Junior C#',url:'https://hh.ru/vacancy/'+n,matchScore:90,eligibilityStatus:'Verify'})));
  const auto=concurrent.context.runBrowserAutopilot();await tick();
  assert.equal(concurrent.trace.filter(x=>x[0]==='send').length,2,'two autopilot jobs overlap');
  const manual=concurrent.send(9);await tick();
  assert.equal(concurrent.trace.filter(x=>x[0]==='send').length,3,'manual sends while autopilot is waiting');
  held.resolve();await Promise.all([auto,manual]);assert.equal(concurrent.jobs().filter(j=>j.completed).length,3);
  const duplicate=await fixture(),hold=deferred();duplicate.setGate(hold);const a=duplicate.send(1);await tick();await duplicate.send(1);assert.equal(duplicate.trace.filter(x=>x[0]==='send').length,1);hold.resolve();await a;
  // Each tab writes only its own progress, including simultaneous continuations.
  const isolated=await fixture(),pause=deferred();isolated.setGate(pause);const runs=[isolated.send(1),isolated.send(2)];await tick();
  const jobs=isolated.jobs();
  const storage=(job,key,value,overrides={})=>isolated.request({type:'vjaSiteApplyStorage',operation:'set',key,value},{tab:{id:job.tabId},frameId:0,url:job.plan.sourceUrl,...overrides});
  const writes=await Promise.all(jobs.map(job=>storage(job,'vjaPendingSiteApply',{...job.plan,finalClicked:true,coverLetter:'wrong'})));
  assert(writes.every(x=>x.ok));assert(isolated.jobs().every(j=>j.pending.finalClicked&&j.pending.coverLetter===j.plan.coverLetter));
  assert.equal((await storage(jobs[0],'vjaSiteApplyResult',{id:jobs[1].plan.id,result:{submitted:true}})).ok,false);
  assert.equal((await storage(jobs[0],'vjaPendingSiteApply',jobs[0].plan,{frameId:1})).ok,false);
  assert.equal((await storage(jobs[0],'vjaPendingSiteApply',jobs[0].plan,{url:'https://evil.test/'})).ok,false);
  pause.resolve();await Promise.all(runs);
  const failed=await fixture({createFails:true});await failed.send();assert.equal(failed.jobs().length,0);assert.equal(failed.messages.at(-1).status,'review');
  // Lost backend after a confirmed receipt preserves it and retries bookkeeping only.
  const receipt=await fixture();receipt.setRecordFailure(true);await receipt.send();assert(receipt.jobs()[0].result.result.submitted);assert(!receipt.jobs()[0].review);
  receipt.setRecordFailure(false);await receipt.context.runBrowserAutopilot();assert(receipt.jobs()[0].completed);assert.equal(receipt.trace.filter(x=>x[0]==='send').length,1);
  // A safe pre-dispatch closed tab is reopened, unknown post-dispatch is isolated.
  for(const dispatched of [false,true]) {
    const closed=await fixture();const plan=closed.context.self.vjaBrowserAutopilot.buildPlan({vacancyId:id(2),title:'Junior C#',url:'https://hh.ru/vacancy/2'},{coverLetter:'Letter for '+id(2)});plan.automatic=false;
    await closed.context.registerApplication(plan,999);await closed.context.updateApplicationJob(plan.id,{dispatched});
    await closed.context.runBrowserAutopilot();const job=closed.jobs()[0];assert(dispatched?job.review:job.completed);
    await closed.send(1);assert(closed.jobs().some(j=>j.plan.trackedId===id(1)&&j.completed));
  }
  // Migrate 2.7.11 once; receipt survives tab closure, unknown legacy attempt stays isolated.
  for(const confirmed of [true,false]){
    const legacy=await fixture();const plan={id:'old',trackedId:id(2),sourceUrl:'https://hh.ru/vacancy/2',jobTitle:'Old job',coverLetter:'Letter for '+id(2)};
    legacy.data.vjaBrowserAutopilotActivePlan=plan;
    if(confirmed)legacy.data.vjaSiteApplyResult={id:'old',result:{submitted:true,status:'confirmed',coverLetterFilled:true}};
    await legacy.context.reconcileApplicationState('http://localhost:8080');assert(!legacy.data.vjaBrowserAutopilotActivePlan);assert(confirmed?legacy.jobs()[0].completed:legacy.jobs()[0].review);
  }
  const timeout=await fixture();let attempts=0;timeout.context.chrome.tabs.sendMessage=async()=>{attempts++;throw Error('lost channel');};
  await assert.rejects(()=>timeout.context.browserAutopilotSendPlan(2,{id:'timeout'}),/lost channel/);assert.equal(attempts,1);
  for(const changes of [{url:'https://evil.example/'},{url:'http://localhost.evil.example:8080/'},{url:'http://127.0.0.2:8080/'},{url:'http://localhost:9999/'},{url:'http://localhost:8080/other'},{frameId:1}]) {
    const blocked=await fixture();assert.equal((await blocked.request({type:'vjaDashboardApply',vacancyId:id(1),requestId:'test'},{...blocked.sender,...changes})).ok,false);assert.equal(blocked.jobs().length,0);
  }
  for(const url of ['http://127.0.0.1:8080/','http://[::1]:8080/','http://localhost:8080/index.html']) {
    const alias=await fixture();assert.equal((await alias.request({type:'vjaDashboardBridgeHello'},{...alias.sender,url})).ok,true);
  }
  console.log('Dashboard: parallel manual/autopilot, bounded queue, duplicate protection, tab isolation, closed-tab recovery, legacy migration, persisted receipts and origin checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
