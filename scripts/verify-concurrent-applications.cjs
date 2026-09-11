// All HH traffic is intercepted with synthetic forms. No real employer submissions.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
(async()=>{
  const id=n=>`${n}1111111-1111-4111-8111-111111111111`;
  const candidate=n=>({vacancyId:id(n),title:`Junior fixture ${n}`,url:`https://hh.ru/vacancy/${n}`,matchScore:95,eligibilityStatus:'Eligible'});
  let enabled=false;const receipts=[],submissions=[],held=[];
  const server=http.createServer((req,res)=>{
    const send=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    const n=Number(req.url.match(/vacancies\/(\d)1111111-/)?.[1]);
    if(req.url==='/api/automation/status')return send({allowed:true,autoApplyEnabled:enabled,remainingToday:10,autoApplyMinimumScore:50});
    if(req.url.includes('/application-queue?'))return send([candidate(1)]);
    if(req.url.endsWith('/prepare-dashboard-apply'))return send({ready:true,candidate:candidate(n),draft:{coverLetter:`Verified letter ${n}`}});
    if(req.url.endsWith('/application-draft'))return send({coverLetter:`Verified letter ${n}`});
    if(/\/browser-(auto-)?applied$/.test(req.url)){let body='';req.on('data',c=>body+=c);req.on('end',()=>{receipts.push({n,body:JSON.parse(body)});send({ok:true});});return;}
    if(req.url.startsWith('/api/'))return send({});
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1>Concurrent application fixture dashboard</h1>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const extension=path.resolve('browser-extension');
  const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try {
    await context.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.origin===base)return route.continue();
      if(u.hostname!=='hh.ru')return route.abort();
      if(u.pathname==='/fixture-submit') {
        const body=JSON.parse(route.request().postData());submissions.push(body);
        if(submissions.length<=3)held.push(route);else await route.fulfill({json:{ok:true}});
        return;
      }
      const n=Number(u.pathname.split('/').pop());
      return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Junior fixture ${n}</title><h1>Junior fixture ${n}</h1>
        <form><h2>Сопроводительное письмо</h2><label><input type="radio" name="resume" checked>Резюме Junior</label><textarea aria-label="Сопроводительное письмо"></textarea><button type="submit">Отправить</button></form>
        <script>document.querySelector('form').onsubmit=async event=>{event.preventDefault();document.querySelector('button').disabled=true;await fetch('/fixture-submit',{method:'POST',body:JSON.stringify({n:${n},letter:document.querySelector('textarea').value})});document.querySelector('form').remove();document.body.append('Отклик отправлен');};</script>`});
    });
    let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(async base=>{await chrome.alarms.clearAll();await chrome.storage.sync.set({apiBase:base});},base);
    const dashboard=await context.newPage();await dashboard.goto(base+'/index.html');
    await dashboard.evaluate(()=>{window.results=[];window.addEventListener('message',e=>{if(e.data?.type==='vjaDashboardApplyResult')window.results.push(e.data);});});
    enabled=true;
    await worker.evaluate(()=>{void runBrowserAutopilot();});
    for(let i=0;i<100&&held.length<1;i++)await new Promise(r=>setTimeout(r,100));
    assert.equal(held.length,1,'autopilot reaches its own form before manual requests');
    await dashboard.evaluate(()=>{for(let n=2;n<=5;n++)window.postMessage({type:'vjaDashboardApplyRequest',vacancyId:`${n}1111111-1111-4111-8111-111111111111`,requestId:'manual-'+n},location.origin);});
    await dashboard.waitForFunction(async()=>{
      const r=await fetch('/api/automation/status');return r.ok;
    });
    for(let i=0;i<100&&held.length<3;i++)await new Promise(r=>setTimeout(r,100));
    assert.equal(held.length,3,JSON.stringify(await worker.evaluate(()=>applicationJobs())));
    assert.equal(await worker.evaluate(()=>applicationWorkers.size),3);
    assert(submissions.some(x=>x.n===1),'autopilot and manual forms must run together');
    for(const route of held)await route.fulfill({json:{ok:true}});
    await dashboard.waitForFunction(()=>window.results.filter(x=>x.status==='confirmed').length===4,{},{timeout:30000});
    for(let i=0;i<100&&receipts.length<5;i++)await new Promise(r=>setTimeout(r,100));
    assert.equal(receipts.length,5);assert.equal(submissions.length,5);
    for(const x of submissions)assert.equal(x.letter,`Verified letter ${x.n}`);
    for(const x of receipts)assert.equal(x.body.coverLetter,`Verified letter ${x.n}`);
    assert.equal(new Set(submissions.map(x=>x.n)).size,5);
    // Restart the real service worker. Persisted completed jobs must not resubmit.
    enabled=false;const cdp=await context.newCDPSession(dashboard);
    await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');
    await dashboard.evaluate(()=>window.postMessage({type:'vjaDashboardBridgeHello',requestId:'after-restart'},location.origin));
    // Hello reconnect and the next manual click must return the existing receipt.
    await dashboard.evaluate(()=>window.postMessage({type:'vjaDashboardApplyRequest',vacancyId:'21111111-1111-4111-8111-111111111111',requestId:'duplicate-after-restart'},location.origin));
    await dashboard.waitForFunction(()=>window.results.some(x=>x.requestId==='duplicate-after-restart'&&x.status==='confirmed'));
    assert.equal(submissions.length,5);
    console.log('Real Chromium: five jobs, three concurrent HH forms, manual + autopilot overlap, unique letters/receipts and worker-restart duplicate prevention passed');
  }finally{await context.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
