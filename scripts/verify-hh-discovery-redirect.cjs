// Actual Chromium navigation and extension execution against intercepted fixtures only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
(async()=>{
  const imported=[];
  const status={autoApplyEnabled:true,allowed:true,remainingToday:5,autoApplyMinimumScore:50,dailyAutoApplyLimit:5,browserSearchQueries:['Junior C#']};
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/import/browser'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{imported.push(JSON.parse(body));res.end('{}');});return;}
    res.end(JSON.stringify(req.url==='/api/automation/status'?status:{}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`,extension=path.resolve('browser-extension');
  const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  let challenge=false,searchLoads=0;
  try{
    await context.route(/^https:\/\/(?:[^/]+\.)?hh\.ru\//,async route=>{
      const u=new URL(route.request().url());
      if(u.hostname==='hh.ru'){
        u.hostname='volgograd.hh.ru';u.pathname=u.pathname.replace(/\/$/,'')+'/';u.searchParams.set('hhtmFrom','fixture');
        await route.fulfill({status:302,headers:{location:u.href},body:''});return;
      }
      if(u.pathname.startsWith('/search/')){
        searchLoads++;
        await route.fulfill({contentType:'text/html; charset=utf-8',body:challenge?'<h1>Подтвердите, что вы человек</h1><input name="captcha">':'<h1>Результаты поиска</h1><a data-qa="serp-item__title" href="https://hh.ru/vacancy/123">Junior C#</a>'});return;
      }
      await route.fulfill({contentType:'text/html; charset=utf-8',body:'<h1 data-qa="vacancy-title">Junior C# Developer</h1><div data-qa="vacancy-company-name">Fixture employer</div><div data-qa="vacancy-view-location">Россия</div><div data-qa="vacancy-description">C# SQL ASP.NET Core REST. Удаленная работа по России. Разработка API, работа с базами данных и автоматические тесты.</div>'});
    });
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(async base=>{browserAutopilotRunning=true;await chrome.alarms.clearAll();await chrome.storage.sync.set({apiBase:base,vjaHhBrowserSearch:true});await chrome.storage.local.set({vjaHhDiscoveryBlocked:self.vjaHhNavigation.legacyRedirect,vjaHhDiscoveryAt:Date.now()});},base);
    const run=()=>worker.evaluate(async({base,status})=>await discoverHhInBrowser(base,status),{base,status});
    const result=await run();
    assert.equal(imported.length,1,'regional redirect must reach real content extraction and backend import');
    assert.equal(imported[0].title,'Junior C# Developer');assert.equal(new URL(imported[0].url).hostname,'volgograd.hh.ru');
    assert(result.includes('сохранено 1'));
    challenge=true;await worker.evaluate(async()=>{await chrome.storage.local.remove('vjaHhDiscoveryAt');});
    const blocked=await run();assert(blocked.includes('проверки безопасности'));assert.equal(imported.length,1);
    const before=searchLoads;await run();assert.equal(searchLoads,before,'CAPTCHA stop must persist, not auto-retry');
    console.log('Chromium HH redirect -> content extraction -> import, legacy recovery and CAPTCHA stop passed');
  }finally{await context.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
