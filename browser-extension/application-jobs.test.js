// Exercise the production scheduler, storage bridge and HTTP receipts concurrently.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(test) {for(let i=0;i<100;i++){if(await test())return;await tick();}throw Error('Fixture did not progress');}
(async()=>{
  const data={},tabs=new Map(),gates=new Map(),sent=[],receipts=[],listeners=[];let next=10,active=0,peak=0,enabled=false;
  const event={addListener:()=>{}};
  const local={get:async keys=>keys===null?{...data}:Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])),set:async value=>Object.assign(data,value),remove:async keys=>[].concat(keys).forEach(k=>delete data[k]),setAccessLevel:async()=>{}};
  const id=n=>`${n}1111111-1111-4111-8111-111111111111`,url=n=>`https://hh.ru/vacancy/${n}`;
  const candidate=n=>({vacancyId:id(n),title:'Junior role '+n,url:url(n),matchScore:95,eligibilityStatus:'Eligible'});
  const context={console,URL,Date,Promise,AbortController,setTimeout,clearTimeout,self:{},chrome:{runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:f=>listeners.push(f)},getURL:p=>'chrome-extension://fixture/'+p},alarms:{create:async()=>{},onAlarm:event},storage:{local,sync:{get:async()=>({apiBase:'http://localhost:8080'})}},tabs:{
    create:async options=>{assert.equal(options.active,false);const tab={id:next++,url:options.url,status:'complete'};tabs.set(tab.id,tab);return tab;},
    get:async id=>{if(!tabs.has(id))throw Error('No tab');return tabs.get(id);},
    update:async(id,options)=>Object.assign(tabs.get(id),options),remove:async id=>tabs.delete(id),
    sendMessage:async(tabId,message)=>{
      if(message.type==='vjaDashboardApplyResult')return;
      if(message.type==='vjaSiteApplyReady')return {ok:true};
      assert.equal(message.type,'siteApplyNow');const plan=message.plan;
      const sender={tab:{id:tabId},frameId:0,url:tabs.get(tabId).url};
      const read=await context.applicationScopedStorage({key:'vjaPendingSiteApply',operation:'get'},sender);
      assert.equal(read.value.id,plan.id);assert.equal(read.value.coverLetter,plan.coverLetter);
      assert.equal(plan.coverLetter,'Letter '+plan.trackedId[0]);
      await assert.rejects(()=>context.applicationScopedStorage({key:'vjaPendingSiteApply',operation:'set',value:{id:'another-task'}},sender),/mismatch/);
      await context.applicationScopedStorage({key:'vjaPendingSiteApply',operation:'set',value:{...plan,finalClicked:true,coverLetterFilledBeforeFinal:true}},sender);
      sent.push(plan);active++;peak=Math.max(peak,active);
      try{await new Promise((resolve,reject)=>gates.set(plan.trackedId,{resolve,reject,tabId}));}finally{active--;}
      const result={submitted:true,status:'confirmed',coverLetterFilled:true,resumeLabel:'HH resume'};
      await context.applicationScopedStorage({key:'vjaSiteApplyResult',operation:'set',value:{id:plan.id,result}},sender);
      return result;
    }
  }}};
  context.fetch=async(url,options)=>{
    let value={};
    if(url.endsWith('/api/automation/status'))value={allowed:true,autoApplyEnabled:enabled,remainingToday:10,autoApplyMinimumScore:50};
    if(url.includes('/application-queue?'))value=[candidate(1)];
    const match=url.match(/vacancies\/(\d)1111111-/);const n=match?Number(match[1]):0;
    if(url.endsWith('/application-draft'))value={coverLetter:'Letter '+n};
    if(url.endsWith('/prepare-dashboard-apply'))value={ready:true,candidate:candidate(n),draft:{coverLetter:'Letter '+n}};
    if(/\/browser-(auto-)?applied$/.test(url)){const body=JSON.parse(options.body);assert.equal(body.coverLetter,'Letter '+n);receipts.push(n);}
    return {ok:true,text:async()=>JSON.stringify(value)};
  };
  vm.createContext(context);context.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync(__dirname+'/'+p,'utf8'),context));
  vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);await tick();context.browserAutopilotWait=async()=>{};
  enabled=true;const autopilot=context.runBrowserAutopilot();await until(()=>sent.length===1);
  const sender={tab:{id:1},frameId:0,url:'http://localhost:8080/'};
  const manual=[2,3,4,5].map(n=>context.runDashboardApply('http://localhost:8080',id(n),sender,'request-'+n));
  await until(()=>sent.length===3);assert.equal(active,3,'autopilot and two manual applications overlap');
  await context.runDashboardApply('http://localhost:8080',id(2),sender,'duplicate');assert.equal(sent.filter(p=>p.trackedId===id(2)).length,1);
  assert.equal((await context.applicationJobs()).filter(j=>j.state==='queued').length,2);
  gates.get(id(3)).resolve();await until(()=>sent.length===4);
  // Closed tab stops only its own attempt. Other queued work starts immediately.
  const closed=gates.get(id(2));tabs.delete(closed.tabId);closed.reject(Error('Tab closed'));
  await until(()=>sent.length===5);
  for(const n of [1,4,5])gates.get(id(n)).resolve();
  await Promise.all([autopilot,...manual]);
  assert.equal(peak,3);assert.deepEqual(receipts.slice().sort(),[1,3,4,5]);
  const jobs=await context.applicationJobs();assert.equal(jobs.find(j=>j.plan.trackedId===id(2)).state,'review');
  assert.equal(jobs.filter(j=>j.state==='confirmed').length,4);
  for(const j of jobs)assert.equal(j.plan.coverLetter,'Letter '+j.plan.trackedId[0]);
  // Another heartbeat never resubmits confirmed/unknown attempts.
  enabled=false;await context.runBrowserAutopilot();assert.equal(sent.length,5);
  // Reused tab ids cannot dispatch an old vacancy's plan into a different vacancy.
  const recovered={...context.self.vjaBrowserAutopilot.buildPlan(candidate(6),{coverLetter:'Letter 6'}),managed:true};
  const tab={id:99,url:url(7),status:'complete'};tabs.set(99,tab);
  await context.applicationLock(()=>context.insertApplicationJob({plan:recovered,api:'http://localhost:8080',pending:recovered,state:'waiting',tabId:99,dispatchedAt:Date.now(),createdAt:Date.now()}));
  await context.pumpApplicationJobs('http://localhost:8080');
  assert.equal((await context.applicationJob(recovered)).state,'review');assert.equal(sent.length,5);
  console.log('Concurrent jobs: 3 simultaneous manual/autopilot executions, queued drain, exact letters/receipts, closed-tab isolation, duplicate prevention and tab-id reuse passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
