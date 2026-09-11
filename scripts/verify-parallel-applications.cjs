// Real extension worker + content scripts + isolated synthetic HH pages. No employer traffic.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const candidate=n=>({vacancyId:id(n),title:'Junior C# '+n,url:'https://hh.ru/vacancy/'+n,matchScore:90,eligibilityStatus:'Verify'});
async function until(check,message,timeout=45000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error(message);}
(async()=>{
  const receipts=[],submissions=[],pending=[];let enabled=false,release=false;
  const status=()=>({autoApplyEnabled:enabled,allowed:true,remainingToday:20-receipts.length,autoApplyMinimumScore:50});
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    let result={};
    if(req.url==='/api/automation/status')result=status();
    else if(req.url.startsWith('/api/application-queue?'))result=[1,2].filter(n=>!receipts.some(r=>r.id===id(n))).map(candidate);
    else if(req.url.endsWith('/prepare-dashboard-apply')){const n=parseInt(req.url.split('/')[3]);result={ready:true,candidate:candidate(n),draft:{coverLetter:'Letter for '+id(n)}};}
    else if(req.url.endsWith('/application-draft'))result={coverLetter:'Letter for '+req.url.split('/')[3]};
    else if(/\/browser-(auto-)?applied$/.test(req.url))receipts.push({id:req.url.split('/')[3],...JSON.parse(body)});
    else if(!req.url.startsWith('/api/')){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Dashboard fixture</title><h1>Dashboard</h1>');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const extension=path.resolve('browser-extension');
  const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===base)return route.continue();
      if(url.origin!=='https://hh.ru')return route.abort();
      if(url.pathname==='/fixture-submit'){
        submissions.push(JSON.parse(route.request().postData()));
        if(!release)await new Promise(resolve=>pending.push(resolve));
        await route.fulfill({contentType:'application/json',body:'{}'}).catch(()=>{});return;
      }
      const n=Number(url.pathname.split('/').pop());
      if(!/^\/vacancy\/\d+$/.test(url.pathname))return route.abort();
      return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><title>Junior C# ${n}</title>
        <h1>Junior C# ${n}</h1><form><label>Сопроводительное письмо<textarea required name="letter"></textarea></label>
        <label><input name="resume" type="radio" checked>Резюме C#</label><button type="submit">Отправить отклик</button></form>
        <script>window.sendCount=0;document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();window.sendCount++;
        await fetch('/fixture-submit',{method:'POST',body:JSON.stringify({n:${n},letter:document.querySelector('textarea').value})});
        document.querySelector('form').remove();document.body.insertAdjacentHTML('beforeend','<p>Отклик отправлен</p>');});</script>`});
    });
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(async base=>{await chrome.alarms.clearAll();await chrome.storage.sync.set({apiBase:base});},base);
    await until(()=>worker.evaluate(()=>!browserAutopilotRunning),'startup did not settle');
    const dashboard=await context.newPage();await dashboard.goto(base+'/index.html');
    await dashboard.evaluate(()=>{window.results=[];addEventListener('message',e=>{if(e.data?.type==='vjaDashboardApplyResult')window.results.push(e.data);});});
    enabled=true;
    await worker.evaluate(()=>{void runBrowserAutopilot();});
    await until(()=>submissions.length===2,'two automatic submissions must overlap');
    const send=async n=>dashboard.evaluate(({vacancyId,n})=>window.postMessage({type:'vjaDashboardApplyRequest',vacancyId,requestId:'parallel-'+n},location.origin),{vacancyId:id(n),n});
    await Promise.all([3,4,5,6].map(send));
    await until(()=>submissions.length===5,'three manual submissions must overlap the two automatic submissions');
    assert.equal(receipts.length,0,'workers overlap before any receipt is confirmed');
    const closed=context.pages().find(page=>page.url()==='https://hh.ru/vacancy/3');assert(closed);await closed.close();
    enabled=false;release=true;pending.splice(0).forEach(resolve=>resolve());
    await until(()=>receipts.length===5,'remaining applications and overflow must finish despite the closed tab');
    await until(()=>worker.evaluate(async()=>Boolean((await applicationJobs()).find(job=>job.plan.trackedId.startsWith('00000003'))?.review)),'closed uncertain application must be isolated');
    assert.equal(new Set(submissions.map(s=>s.n)).size,6);
    assert.equal(submissions.length,6,'one final click per vacancy');
    for(const item of submissions)assert.equal(item.letter,'Letter for '+id(item.n),'letters must not cross tabs');
    assert(!receipts.some(item=>item.id===id(3)),'closed page without receipt is not counted as success');
    for(const item of receipts)assert.equal(item.coverLetter,'Letter for '+item.id);
    await send(7);await until(()=>receipts.length===6,'new manual vacancy remains usable with autopilot disabled');
    await send(1);
    await until(()=>dashboard.evaluate(()=>window.results.some(r=>r.requestId==='parallel-1'&&r.status==='confirmed')),'a completed automatic application is surfaced without resending');
    assert.equal(submissions.length,7,'completed duplicate never sends again');
    console.log('Chromium: two automatic + three manual submissions overlap; overflow, closed-tab isolation, separate letters, duplicate prevention and paused manual flow pass.');
  }catch(error){console.error({submissions,receipts});throw error;}
  finally{await context.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
