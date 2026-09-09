// Browser integration fixture: no job-board traffic, real accounts or submissions.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
(async () => {
  const server = http.createServer((req,res) => {res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1>Junior C# Developer — synthetic fixture</h1><p>C# SQL remote</p>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const extension=path.resolve('browser-extension');
  const context=await chromium.launchPersistentContext('', {channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try {
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    // Stop background polling and direct backend reads to the local fixture only.
    await worker.evaluate(async base=>{await chrome.alarms.clearAll();await chrome.storage.sync.set({apiBase:base});},base);
    const page=await context.newPage();await page.goto(base+'/vacancy/1');
    await worker.evaluate(async () => {const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.includes('/vacancy/1'));await chrome.tabs.sendMessage(tab.id,{type:'vjaToggleFloatingPanel'},{frameId:0});});
    // The actual extension iframe (inside a closed shadow root) is discoverable as a frame.
    let popup=page.frames().find(f=>f.url().includes('/popup.html'));
    if(!popup){await page.waitForTimeout(500);popup=page.frames().find(f=>f.url().includes('/popup.html'));}
    assert(popup,'floating extension iframe must load');
    await popup.locator('#oneClickApply').waitFor();
    assert.equal(await popup.locator('#pinPanel').isVisible(),false);
    await popup.evaluate(() => {
      window.vjaRenderScreening({notice:'Причина отказа неизвестна', suggestedResumeExcerpt:'Projects: C# SQL', requirements:[{skill:'<img src=x onerror=alert(1)>', importance:'Required', projectIds:['dental'], resumeState:'Not mentioned'}], unsupportedRequirements:['Azure'], reviewReasons:[], resumeTextChecked:true, verifiedTermsToAdd:['SQL']});
    });
    assert.equal(await popup.locator('#screeningTerms img').count(),0,'vacancy content must render as text');
    assert((await popup.locator('#screeningTerms').textContent()).includes('<img'));
    assert((await popup.locator('#screeningResult').textContent()).includes('SQL'));
    assert.equal(await popup.locator('#screeningExcerpt').inputValue(),'Projects: C# SQL');
    await popup.evaluate(() => window.vjaRenderScreening(null));
    assert.equal(await popup.locator('#screeningResult').textContent(),'','clear stale resume result for another vacancy');
    const tabId=await popup.evaluate(async()=> (await activeTab()).id);
    const another=await context.newPage();await another.goto(base+'/other');await another.bringToFront();
    assert.equal(await popup.evaluate(async()=> (await activeTab()).id),tabId,'panel must stay bound to original tab');
    await page.bringToFront();
    // Header starts at (viewportWidth-440, 70); drag it without entering the iframe.
    const width=page.viewportSize().width;
    await page.mouse.move(width-400,85);await page.mouse.down();await page.mouse.move(100,130,{steps:5});await page.mouse.up();
    const pos=await worker.evaluate(async()=> (await chrome.storage.sync.get('vjaFloatingPosition')).vjaFloatingPosition);
    assert(pos && pos.x>=0 && pos.x<200,'drag must update saved layout');
    const toggle = async () => worker.evaluate(async () => {const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.includes('/vacancy/1'));await chrome.tabs.sendMessage(tab.id,{type:'vjaToggleFloatingPanel'},{frameId:0});});
    await toggle();assert.equal(await (await popup.frameElement()).boundingBox(),null,'panel can be hidden');
    await toggle();assert(await (await popup.frameElement()).boundingBox(),'panel can be reopened without reinstall');
    await context.close();console.log('Real Chromium extension iframe, popup load, tab binding and drag passed');
  } finally {await context.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
