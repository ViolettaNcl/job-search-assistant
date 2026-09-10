// Local synthetic API only: no candidate data or employer submissions.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs');
(async()=>{
  const found='2026-09-09T08:00:00Z',sent='2026-09-10T10:30:00Z';
  const vacancy={id:'fixture',title:'Junior C# Developer',company:'Example Studio',source:'hh',sourceLabel:'HH',url:'https://example.invalid/vacancy/1',firstSeenAt:found,matchScore:86,eligibilityStatus:'Eligible',eligibilityReason:'Verified project evidence',marketLabel:'Россия',opportunityTypeLabel:'Полная занятость'};
  const pipeline=[{...vacancy,appliedAt:sent,updatedAt:sent,status:'Applied',automatic:true,coverLetterIncluded:true}];
  const automation={allowed:true,ready:true,autoApplyEnabled:true,browserConnected:true,automationMode:'browser-extension',autoApplyMinimumScore:75,dailyAutoApplyLimit:15,appliedToday:1,remainingToday:14,lastMessage:'Отклик и письмо отправлены: Junior C# Developer.',collection:{},diagnostics:{}};
  const errors=[],directRequests=[];
  const server=http.createServer((req,res)=>{
    if(req.url==='/'||req.url==='/operator.css'||req.url==='/dashboard-apply.js'){res.setHeader('Content-Type',req.url==='/'?'text/html; charset=utf-8':req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync('src/JobSearchAssistant/wwwroot/'+(req.url==='/'?'index.html':req.url.slice(1))));return;}
    if(req.url.endsWith('/apply-tailored'))directRequests.push(req.url);
    let data=[];
    if(req.url==='/api/dashboard')data={stats:{applied:pipeline.length,interviews:0,offers:0},state:{},pipeline};
    else if(req.url==='/api/automation/status')data=automation;
    else if(req.url==='/api/operator/today')data={applicationsRecordedToday:1,needsReview:1,best:[]};
    else if(req.url.includes('/api/vacancies?status=New'))data=[vacancy];
    else if(req.url.includes('/api/vacancies?status=Saved'))data=[{...vacancy,id:'review',title:'Junior QA — проверить вопрос',status:'Saved',reviewNote:'QueueDeferredUntil=2026-09-10T12:00:00Z\nУточните дату выхода на работу.'}];
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1360,height:1000},timezoneId:'UTC'});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#pipeline .card').waitFor();
    assert(await page.locator('#pipelineView').isVisible());assert(!(await page.locator('#vacancyView').isVisible()));
    const dates=await page.locator('#pipeline .dates').innerText();assert(dates.includes('09.09.2026')&&dates.includes('10.09.2026'));
    await page.locator('#autoScore').fill('50');await page.evaluate(()=>refreshDashboard());assert.equal(await page.locator('#autoScore').inputValue(),'50');
    pipeline.push({...vacancy,id:'unknown-date',title:'Recruiter conversation',status:'HrContact',updatedAt:sent,appliedAt:null});
    await page.evaluate(()=>refreshDashboard());assert.equal(await page.locator('#countPipeline').innerText(),'2');assert((await page.locator('#pipeline').innerText()).includes('Нет подтверждённой даты'));
    await page.locator('[data-view="review"]').click();assert((await page.locator('#jobs').innerText()).includes('Уточните дату выхода'));assert(!(await page.locator('#jobs').innerText()).includes('QueueDeferredUntil'));
    await page.locator('[data-view="all"]').click();assert((await page.locator('#jobs .dates').innerText()).includes('09.09.2026'));
    // A local bridge fixture exercises the actual dashboard without any employer connection.
    await page.evaluate(()=>{
      window.requests=[];
      window.addEventListener('message',e=>{if(e.data?.type==='vjaDashboardApplyRequest')window.requests.push(e.data);});
    });
    const dashboardUrl=page.url();
    await page.locator('[data-apply-id="fixture"]').click();
    await page.waitForFunction(()=>window.requests.length===1);
    assert(await page.locator('[data-apply-id="fixture"]').isDisabled());
    await page.evaluate(()=>{const r=window.requests[0];window.postMessage({...r,type:'vjaDashboardApplyResult',status:'review',message:'Уточните дату выхода.'},location.origin);});
    await page.waitForFunction(()=>!document.querySelector('[data-apply-id="fixture"]').disabled);
    assert((await page.locator('#jobs').innerText()).includes('Уточните дату выхода.'));
    await page.locator('[data-apply-id="fixture"]').click();
    await page.waitForFunction(()=>window.requests.length===2);
    await page.evaluate(()=>{const r=window.requests[1];window.postMessage({...r,type:'vjaDashboardApplyResult',status:'confirmed',message:'Отклик и письмо отправлены.'},location.origin);});
    await page.waitForFunction(()=>document.querySelector('[data-apply-id="fixture"]').textContent==='Отклик и письмо отправлены');
    assert.equal(page.url(),dashboardUrl);assert.equal(page.context().pages().length,1);
    automation.apiReady=true;vacancy.id='api-fixture';await page.evaluate(()=>refreshDashboard());
    await page.locator('[data-apply-id="api-fixture"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-apply-id="api-fixture"]').textContent==='Отклик и письмо отправлены');
    assert.deepEqual(directRequests,['/api/vacancies/api-fixture/apply-tailored']);
    assert.equal(page.url(),dashboardUrl);assert.equal(page.context().pages().length,1);
    await page.locator('[data-view="pipeline"]').click();
    fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/operator-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'dashboard must fit mobile width');
    await page.screenshot({path:'artifacts/operator-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
    console.log('Dashboard receipt dates, missing date, review notes, live refresh, edited settings and mobile layout passed');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
