// Exercise the real background orchestration with isolated Chrome/HTTP fixtures.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function scenario({queued=false,pauseAfterImport=false,pending=false,letter=true}={}) {
  const data={},trace=[],queue=queued?[{vacancyId:'one',title:'Junior C#',url:'https://hh.ru/vacancy/1',matchScore:90,eligibilityStatus:'Eligible'}]:[];
  let enabled=false,nextTab=0;const tabs=new Map();
  const status=()=>({allowed:true,autoApplyEnabled:enabled,remainingToday:5,autoApplyMinimumScore:50,browserSearchQueries:['Junior C#']});
  const local={get:async k=>typeof k==='string'?{[k]:data[k]}:{...data},set:async v=>Object.assign(data,v),remove:async k=>[].concat(k).forEach(x=>delete data[x]),setAccessLevel:async()=>{}};
  const event={addListener:()=>{}};
  const context={console,URL,Date,Promise,AbortController,setTimeout,clearTimeout,self:{},chrome:{runtime:{onInstalled:event,onStartup:event,onMessage:event,getURL:p=>'chrome-extension://fixture/'+p},alarms:{create:async()=>{},onAlarm:event},storage:{local,sync:{get:async()=>({apiBase:'http://localhost:8080',vjaHhBrowserSearch:true})}},tabs:{
    create:async p=>{const t={id:++nextTab,status:'complete',url:p.url};tabs.set(t.id,t);trace.push('open:'+p.url);return t;},get:async id=>tabs.get(id),update:async(id,p)=>Object.assign(tabs.get(id),p),remove:async id=>tabs.delete(id),
    sendMessage:async(id,m)=>{const tab=tabs.get(id);if(m.type==='vjaReadHhDiscovery'){if(tab.url.includes('/search/'))return{pageUrl:tab.url,links:['https://hh.ru/vacancy/1','https://hh.ru/vacancy/2']};trace.push('read:'+tab.url);return{pageUrl:tab.url,vacancy:{title:'Junior C#',url:tab.url}};}
      trace.push('submit:'+m.plan.trackedId);return pending?{status:'submitted-needs-letter'}:{status:'confirmed',submitted:true,coverLetterFilled:letter};}
  }}};
  vm.createContext(context);context.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync(__dirname+'/'+p,'utf8'),context));
  context.fetch=async(url,options)=>{let value={};if(url.endsWith('/status')&&!options?.method)value=status();
    else if(url.includes('/api/application-queue?')){assert(url.includes('automaticOnly=true'));value=queue;}
    else if(url.endsWith('/api/import/browser')){const v=JSON.parse(options.body),id=new URL(v.url).pathname.split('/').pop();trace.push('import:'+id);queue.push({vacancyId:id,title:v.title,url:v.url,matchScore:90,eligibilityStatus:'Eligible'});if(pauseAfterImport)enabled=false;}
    else if(url.endsWith('/application-draft'))value={coverLetter:'Verified project letter. candidate@example.com'};
    else if(url.endsWith('/browser-auto-applied')){trace.push('receipt');queue.shift();}
    else if(url.endsWith('/status')&&options?.method){trace.push('review');queue.shift();}
    return {ok:true,text:async()=>JSON.stringify(value)};};
  vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),context);
  await new Promise(r=>setImmediate(r)); // initial disabled startup completes
  context.browserAutopilotWait=async()=>{};enabled=true;trace.length=0;
  await context.runBrowserAutopilot();return{trace,data};
}
(async()=>{
  const flow=await scenario();assert.equal(flow.trace.filter(x=>x==='receipt').length,2);assert(flow.trace.indexOf('receipt')<flow.trace.indexOf('read:https://hh.ru/vacancy/2'),'send and verify before reading next vacancy');
  const backlog=await scenario({queued:true});assert(backlog.trace.includes('receipt'));assert(!backlog.trace.some(x=>x.includes('/search/')),'queued applications come before more discovery');
  const paused=await scenario({pauseAfterImport:true});assert(!paused.trace.some(x=>x.startsWith('submit:')));assert(!paused.trace.includes('read:https://hh.ru/vacancy/2'));
  const unresolved=await scenario({pending:true});assert(!unresolved.trace.includes('receipt'));assert(!unresolved.trace.includes('read:https://hh.ru/vacancy/2'));assert(unresolved.data.vjaBrowserAutopilotActivePlan,'unverified submission retains continuation, not a duplicate');
  const noLetter=await scenario({letter:false});assert(!noLetter.trace.includes('receipt'));assert(noLetter.trace.includes('review'));
  console.log('Autopilot discovery -> immediate apply + letter -> confirmed receipt; queue priority, pause and review passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
