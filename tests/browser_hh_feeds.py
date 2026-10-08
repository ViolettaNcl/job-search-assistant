"""HH home/feed regression: real Chromium DOM + actual extension AND worker code.
Page URLs and HTTP/Chrome boundaries are controlled fixtures.
The installed test-browser policy blocks HH navigation, so URLs are injected into
script-local location references just like the existing browser_batch_400 suite. No live accounts,
no external network requests, no real applications, no production private profile.
"""
import asyncio
import json
import os
import shutil
from contextlib import suppress
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/('browser-extension' if (ROOT/'browser-extension').exists() else 'extension')
MANIFEST=json.loads((EXT/'manifest.json').read_text())
HTML=(ROOT/'tests/fixtures/hh_home_feed.html').read_text()

async def main():
    proc=await asyncio.create_subprocess_exec('node',str(ROOT/'tests/worker-bridge.cjs'),stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,limit=4*1024*1024)
    pending={};seq=0;passed=[];requests=[];errors=[]
    async def reader():
        while line:=await proc.stdout.readline():
            value=json.loads(line);f=pending.pop(value['id'],None)
            if f and not f.done():
                if value.get('error'):f.set_exception(RuntimeError(value['error']))
                else:f.set_result(value.get('result'))
    task=asyncio.create_task(reader())
    async def call(**data):
        nonlocal seq
        seq+=1;data['id']=seq;f=asyncio.get_running_loop().create_future();pending[seq]=f
        proc.stdin.write((json.dumps(data)+'\n').encode());await proc.stdin.drain()
        return await asyncio.wait_for(f,35)
    def check(name,condition):
        assert condition,name
        passed.append(name);print('PASS',name,flush=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-gpu'])
        ctx=await browser.new_context(viewport={'width':1380,'height':1050})
        await ctx.route('**/*',lambda r:r.fulfill(status=200,body=HTML,content_type='text/html') if r.request.resource_type=='document' else r.abort())
        pages={};nextid=5000
        async def bridge(source,message):
            requests.append(message)
            # Deterministically delayed stale response to exercise DOM node recycling.
            if message.get('op')=='quick-list-state' and message.get('vacancy',{}).get('vacancyId')=='811':
                await asyncio.sleep(.7)
                return {'ok':True,'analysis':{'status':'no-calls'},'fit':{'score':99,'decision':'STRONG_MATCH'}}
            return await call(op='message',message=message,sender={'tab':{'id':pages[source['page']]},'frameId':0,'url':await source['frame'].evaluate('__vjaLocation.href')})
        await ctx.expose_binding('feedWorkerBridge',bridge)
        async def open_page(url):
            nonlocal nextid
            page=await ctx.new_page();nextid+=1;pages[page]=nextid
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.set_content('<base href="'+url+'">'+HTML)
            await page.evaluate('(u)=>window.__vjaLocation=new URL(u)',url)
            await page.evaluate('(m)=>window.fixtureManifest=m',MANIFEST)
            await page.add_script_tag(content='''(()=>{const listeners=[];window.chrome={runtime:{id:'fixture',getManifest:()=>fixtureManifest,getURL:p=>'chrome-extension://fixture/'+p,sendMessage:m=>feedWorkerBridge(m),onMessage:{addListener:f=>listeners.push(f)}},storage:{local:{get:async()=>({}),set:async()=>{},remove:async()=>{}},sync:{get:async()=>({})}}};})();''')
            for script in MANIFEST['content_scripts'][1]['js']:
                await page.add_script_tag(content=(EXT/script).read_text().replace('location.','__vjaLocation.'))
            return page
        try:
            page=await open_page('https://headhunter.kg/?utm_source=google&utm_term=headhunter')
            await page.wait_for_timeout(300)
            check('home without any rendered job cards does not install an unrelated batch toolbar',await page.locator('#vja-job-intel-toolbar').count()==0)
            await page.evaluate("showFeed('Для вас')")
            await page.locator('#vja-job-intel-toolbar').wait_for(timeout=5000)
            await page.locator('[data-card-fixture="779"] .vja-card-fit-badge').wait_for()
            check('late-rendered homepage recommendations get the same list adapter',await page.evaluate("vjaSiteAdapters.make(document,__vjaLocation.href).detectPageType()")=='JOB_LIST')
            for id in ['779','780','781']:
                card=page.locator(f'[data-card-fixture="{id}"]')
                check(f'recommendation {id}: exact card owns Apply + Analysis + Fit + Calls',await card.locator('.vja-card-fast-apply').count()==1 and await card.locator('.vja-card-call-analysis').count()==1 and await card.locator('.vja-card-fit-badge').count()==1 and await card.locator('.vja-card-calls-chip').count()==1)
            await page.locator('[data-card-fixture="779"] .vja-card-call-analysis').click()
            await page.locator('[data-card-fixture="779"] .vja-card-fit-badge').filter(has_text='% Match').wait_for(timeout=20000)
            check('single Analysis updates Fit as well as Calls using full vacancy data', 'Без звонков' in await page.locator('[data-card-fixture="779"] .vja-card-calls-chip').inner_text())
            await page.locator('[data-vja-action="batch"]').click()
            await page.locator('[data-card-fixture="781"] .vja-card-fit-badge').filter(has_text='% Match').wait_for(timeout=20000)
            await page.wait_for_function("!document.querySelector('[data-vja-action=batch]').textContent.includes('Остановить')")
            check('homepage batch identifies calls separately from Match', 'Есть звонки' in await page.locator('[data-card-fixture="781"] .vja-card-calls-chip').inner_text())
            check('batch analysis does not click native Apply or send any letter',await page.evaluate('nativeClicks.length===0&&fixtureSent.length===0'))
            if os.environ.get('VJA_HH_FEEDS_SCREENSHOT'):
                await page.screenshot(path=os.environ['VJA_HH_FEEDS_SCREENSHOT'],full_page=True)
            # Hover is deliberately tested before navigation: native styling must not remove controls.
            await page.locator('[data-card-fixture="779"]').hover()
            check('recommendation card controls remain visible on hover',await page.locator('[data-card-fixture="779"] .vja-card-fast-apply').is_visible())
            # User initiated single application: exact vacancy, real worker-prepared letter, native Send.
            await page.locator('[data-card-fixture="779"] .vja-card-fast-apply').click()
            await page.wait_for_function('fixtureSent.length===1',timeout=25000)
            sent=await page.evaluate('fixtureSent[0]')
            check('For you: one click follows native Apply -> tailored letter -> native Send',sent['id']=='779' and 'поддерж' in sent['text'].lower() and len(sent['text'])>80)
            check('letter modal closes after the fixture confirms send',await page.locator('.fixture-overlay').count()==0)
            auth=[r for r in requests if r.get('type')=='vjaSubmitAuthorization']
            check('feed application preserves per-vacancy user-initiated authorization',bool(auth) and auth[-1].get('userInitiated') is True and auth[-1].get('vacancyId')=='779')
            # Each homepage pill switches content without a document reload.
            for label,id in [('У дома','779'),('Подработка','780'),('Вахта','781'),('от 16 лет','786'),('Удаленная работа','785')]:
                await page.get_by_role('tab',name=label,exact=True).click()
                await page.locator(f'[data-card-fixture="{id}"] .vja-card-fit-badge').wait_for(timeout=5000)
                check(f'feed "{label}" attaches exactly one toolbar and card controls without reload',await page.locator('#vja-job-intel-toolbar').count()==1 and await page.locator(f'[data-card-fixture="{id}"] .vja-card-fast-apply').count()==1)
                if id=='779':
                    await page.locator('[data-card-fixture="779"] .vja-card-fast-apply').filter(has_text='Отклик + письмо').wait_for()
                    check('the same vacancy in another feed restores the applied status',await page.locator('[data-card-fixture="779"] .vja-card-fast-apply').is_disabled())
            # Lazy appended DOM cards must get controls automatically.
            await page.evaluate("feed.insertAdjacentHTML('beforeend',cardHtml('782',1))")
            await page.locator('[data-card-fixture="782"] .vja-card-fit-badge').wait_for(timeout=5000)
            check('newly appended cards are recognized without rescanning the whole page manually',await page.locator('[data-card-fixture="782"] .vja-card-call-analysis').count()==1)
            # Native hidden tab panels are excluded, but extension filtering is reversible.
            await page.evaluate("feed.innerHTML='<section hidden id=inactive>'+cardHtml('781')+'</section><section id=active>'+cardHtml('780')+'</section>'")
            await page.locator('#active .vja-card-fit-badge').wait_for()
            start=len(requests)
            await page.locator('[data-vja-action=batch]').click()
            await page.wait_for_function("!document.querySelector('[data-vja-action=batch]').textContent.includes('Остановить')")
            batch=[m.get('vacancy',{}).get('vacancyId') for m in requests[start:] if m.get('op')=='quick-list-full-analysis']
            check('Analyze page includes only the active native tab panel',batch==['780'])
            await page.locator('#vja-job-intel-toolbar select').select_option('saved')
            await page.locator('#vja-job-intel-toolbar select').select_option('all')
            check('switching Fit filters back to All restores cards',await page.locator('#active [data-card-fixture="780"]').is_visible())
            await page.evaluate("inactive.hidden=false;active.hidden=true")
            await page.locator('#inactive .vja-card-fit-badge').wait_for(timeout=5000)
            check('hidden/visible attribute-only tab switches are handled',await page.locator('#inactive .vja-card-call-analysis').count()==1)
            # Reuse the same card element while an old async memory result is pending.
            await page.evaluate("feed.innerHTML=cardHtml('811')")
            await page.locator('[data-card-fixture="811"] .vja-card-call-analysis').wait_for()
            await page.evaluate("(()=>{const c=feed.firstElementChild;c.dataset.cardFixture='781';c.querySelector('a').href='/vacancy/781';c.querySelector('a').textContent='Консультант банка'})()")
            await page.wait_for_timeout(1100)
            card=page.locator('[data-card-fixture="781"]')
            check('recycled card binds to new vacancy ID and discards delayed old memory',await card.get_attribute('data-vja-vacancy-id')=='781' and '99%' not in await card.locator('.vja-card-fit-badge').inner_text())
            await card.locator('.vja-card-call-analysis').click()
            await card.locator('.vja-card-calls-chip').filter(has_text='Есть звонки').wait_for(timeout=10000)
            check('recycled card does not keep the previous vacancy analysis', 'Есть звонки' in await card.locator('.vja-card-calls-chip').inner_text())
            # Site removes extension controls while re-rendering a recommendation.
            await page.evaluate("feed.querySelectorAll('.vja-card-fast-apply,.vja-card-call-analysis,.vja-card-fit-badge,.vja-card-calls-chip').forEach(e=>e.remove())")
            await card.locator('.vja-card-fit-badge').wait_for(timeout=5000)
            check('HH DOM re-render restores missing controls without duplicates',await card.locator('.vja-card-fast-apply').count()==1 and await card.locator('.vja-card-call-analysis').count()==1)
            await page.evaluate("window.__vjaLocation=new URL('https://headhunter.kg/vacancy/779')")
            await page.wait_for_timeout(1100)
            check('URL-only simulated SPA navigation to a direct vacancy does not keep the list toolbar',await page.locator('#vja-job-intel-toolbar').count()==0)
            check('direct vacancy retains the original JOB_DESCRIPTION adapter',await page.evaluate("vjaSiteAdapters.make(document,__vjaLocation.href).detectPageType()")=='JOB_DESCRIPTION')
            await page.evaluate("window.__vjaLocation=new URL('https://headhunter.kg/?utm_source=google');dispatchEvent(new PopStateEvent('popstate'))")
            await page.locator('#vja-job-intel-toolbar').wait_for(timeout=5000)
            check('simulated Back to the homepage restores its list toolbar',await page.locator('#vja-job-intel-toolbar').count()==1)
            # Actual HH main host, not only the Kyrgyzstan alias in the screenshot.
            hh=await open_page('https://hh.ru/?utm_source=fixture')
            await hh.evaluate("showFeed('Для вас')")
            await hh.locator('#vja-job-intel-toolbar').wait_for(timeout=5000)
            check('hh.ru homepage is supported alongside headhunter.kg',await hh.locator('.vja-card-call-analysis').count()==3)
            await hh.close()
            check('no uncaught JavaScript errors in the real content-script bundle',not errors)
        finally:
            await browser.close()
            if proc.returncode is None:
                proc.terminate()
                await proc.wait()
            task.cancel()
            with suppress(asyncio.CancelledError):await task
    print(f'{len(passed)} HH feed browser assertions passed. Offline fixtures, not live HH.',flush=True)

if __name__=='__main__':asyncio.run(main())
