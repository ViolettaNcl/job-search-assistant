// Exercise the real background orchestration with isolated Chrome/HTTP fixtures.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function scenario({queued=false,pauseAfterImport=false,pending=false,letter=true,enabledAtRun=true,roles=['Junior C# Developer','Junior .NET Developer']}={}) {
  const data={},trace=[],queue=queued?[{vacancyId:'one',title:'Junior C# Developer',url:'https://hh.ru/vacancy/1',matchScore:90,eligibilityStatus:'Eligible',remote:true,description:'C# ASP.NET Core SQL Server REST API Docker remote'}]:[];
  let enabled=false,nextTab=0;const tabs=new Map();
  const status=()=>({allowed:true,autoApplyEnabled:enabled,remainingToday:5,autoApplyMinimumScore:50,browserSearchQueries:['Junior C#'],automationMode:'browser-extension'});
  const local={get:async k=>typeof k==='string'?{[k]:data[k]}:{...data},set:async v=>Object.assign(data,v),remove:async k=>[].concat(k).forEach(x=>delete data[x]),setAccessLevel:async()=>{}};
  const event={addListener:()=>{}};
  const context={console,URL,Date,Promise,AbortController,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,self:{},chrome:{runtime:{onInstalled:event,onStartup:event,onMessage:event,getManifest:()=>JSON.parse(fs.readFileSync(__dirname+'/manifest.json')),getURL:p=>'chrome-extension://fixture/'+p},alarms:{create:async()=>{},onAlarm:event},permissions:{contains:async()=>true,onRemoved:event},scripting:{executeScript:async()=>{}},storage:{local,sync:{get:async()=>({apiBase:'http://localhost:8080',vjaHhBrowserSearch:true})}},tabs:{
    create:async p=>{const t={id:++nextTab,status:'complete',url:p.url};tabs.set(t.id,t);trace.push('open:'+p.url);return t;},get:async id=>tabs.get(id),update:async(id,p)=>Object.assign(tabs.get(id),p),remove:async id=>tabs.delete(id),
    sendMessage:async(id,m)=>{const tab=tabs.get(id);if(m.type==='vjaReadHhDiscovery'){if(tab.url.includes('/search/'))return{pageUrl:tab.url,links:['https://hh.ru/vacancy/1','https://hh.ru/vacancy/2']};trace.push('read:'+tab.url);return{pageUrl:tab.url,vacancy:{title:roles[Number(new URL(tab.url).pathname.split('/').pop())-1],url:tab.url,remote:true,description:'C# ASP.NET Core SQL Server REST API Docker '.repeat(8)}};}
      if(m.type==='vjaCopilotPage'){const tab=tabs.get(id);if(m.action==='ping')return {ok:true};if(m.action==='vacancy')return {vacancy:{url:tab.url,vacancyId:new URL(tab.url).pathname.split('/').pop(),title:'Junior C# Developer',description:'C# ASP.NET Core SQL Server REST API Docker remote. Full description from the employer page.',descriptionCoverage:'full-dom'}};}
      if(m.type==='vjaSiteApplyReady')return {ready:true};
      assert(m.plan.coverLetter.length>40,'each vacancy must receive a prepared local letter');assert(!/Crowne|Front Desk|Receptionist/i.test(m.plan.coverLetter));trace.push('role:'+m.plan.jobTitle);trace.push('letter:'+m.plan.coverLetter);trace.push('submit:'+m.plan.trackedId);return pending?{status:'submitted-needs-letter'}:{status:'confirmed',submitted:true,coverLetterFilled:letter};}
  }}};
  vm.createContext(context);context.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync(__dirname+'/'+p,'utf8'),context));
  context.fetch=async(url,options)=>{let value={};if(url.endsWith('/status')&&!options?.method)value=status();
    else if(url.includes('/api/application-queue?')){assert(url.includes('automaticOnly=true'));value=queue;}
    else if(url.endsWith('/api/import/browser')){const v=JSON.parse(options.body),id=new URL(v.url).pathname.split('/').pop();trace.push('import:'+id);queue.push({vacancyId:id,title:v.title,url:v.url,matchScore:90,eligibilityStatus:'Eligible',remote:true,description:v.description});if(pauseAfterImport)enabled=false;}
    else if(url.endsWith('/application-draft'))value={coverLetter:'Verified project letter for '+new URL(url).pathname.split('/').at(-2)+'. candidate@example.com'};
    else if(url.endsWith('/browser-auto-applied')){trace.push('receipt');queue.shift();}
    else if(url.endsWith('/status')&&options?.method){trace.push('review');queue.shift();}
    return {ok:true,text:async()=>JSON.stringify(value)};};
  vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);
  await new Promise(r=>setImmediate(r)); // initial disabled startup completes
  context.browserAutopilotWait=async()=>{};enabled=enabledAtRun;trace.length=0;
  await context.runBrowserAutopilot();return{trace,data};
}
// v3.5 restores user-controlled automatic sending. It must stay completely idle until enabled.
(async()=>{
  const disabled=await scenario({enabledAtRun:false,queued:true});
  assert(!disabled.trace.some(x=>x.startsWith('submit:')),'disabled autopilot must never submit');
  assert(!disabled.trace.includes('receipt'),'disabled autopilot must never claim a submission');

  for(const opts of [{},{queued:true},{pending:true},{letter:false},{roles:['Junior QA Automation Engineer','Frontend Intern']}]){
    const flow=await scenario(opts);
    assert(flow.trace.some(x=>x.startsWith('submit:')),'explicitly enabled autopilot should dispatch a qualifying programming vacancy');
    assert(flow.trace.some(x=>x.startsWith('letter:')),'automatic submission should carry a local vacancy-specific cover letter');
  }
  const paused=await scenario({pauseAfterImport:true});
  assert(!paused.trace.some(x=>x.startsWith('submit:')),'autopilot must stop if the user disables it after discovery and before dispatch');
  console.log('v3.5 autopilot: disabled stays idle; enabled mode discovers, writes a local letter and dispatches qualifying jobs');
})().catch(e=>{console.error(e);process.exitCode=1;});
