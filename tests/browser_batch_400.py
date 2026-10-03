"""Focused 4.0 Chromium regression for HH Batch Analysis + explainable Fit Score + Apply Queue.
Uses actual extension/service-worker JS with mocked Chrome/HH boundaries; no live HH account.
"""
import asyncio,json,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/('browser-extension' if (ROOT/'browser-extension').exists() else 'extension')

async def main():
    proc=await asyncio.create_subprocess_exec('node',str(ROOT/'tests/worker-bridge.cjs'),stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,limit=4*1024*1024)
    pending={};seq=0;passed=[]
    async def reader():
        while line:=await proc.stdout.readline():
            v=json.loads(line);f=pending.pop(v['id'],None)
            if f:
                if v.get('error'): f.set_exception(RuntimeError(v['error']))
                else: f.set_result(v.get('result'))
    reader_task=asyncio.create_task(reader())
    async def call(**data):
        nonlocal seq
        seq+=1;data['id']=seq;f=asyncio.get_running_loop().create_future();pending[seq]=f
        proc.stdin.write((json.dumps(data)+'\n').encode());await proc.stdin.drain();return await asyncio.wait_for(f,25)
    def check(name,cond):
        assert cond,name;passed.append(name);print('PASS',name,flush=True)
    scripts=json.loads((EXT/'manifest.json').read_text())['content_scripts'][1]['js']
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-gpu'])
        ctx=await browser.new_context(viewport={'width':1400,'height':1000});pages={};nextid=900
        async def bridge(source,msg):
            return await call(op='message',message=msg,sender={'tab':{'id':pages[source['page']]},'frameId':0,'url':await source['frame'].evaluate('__vjaLocation.href')})
        await ctx.expose_binding('workerBridge400',bridge)
        chrome_mock="""(()=>{const listeners=[];window.chrome={runtime:{sendMessage:m=>window.workerBridge400(m),onMessage:{addListener:f=>listeners.push(f)},getURL:p=>'chrome-extension://fixture/'+p,id:'fixture'},storage:{local:{get:async()=>({}),set:async()=>{},remove:async()=>{}},sync:{get:async()=>({})}}};window.dispatchExtensionMessage=m=>new Promise(resolve=>{let handled=false;for(const f of listeners){let sent=false;const r=f(m,{},v=>{sent=true;handled=true;resolve(v)});if(r===true){handled=true;break;}if(sent)break;}if(!handled)resolve(null)});})();"""
        async def open_page(query='batch'):
            nonlocal nextid
            html='''<html><body><main>
            <div data-qa="vacancy-serp__vacancy" id="c779"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/779">Специалист технической поддержки</a><div data-qa="vacancy-serp__vacancy-employer">SaaS One</div><p>Поддержка пользователей, API и SQL.</p><button>Откликнуться</button></div>
            <div data-qa="vacancy-serp__vacancy" id="c780"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/780">Менеджер по работе с клиентами в чатах</a><div data-qa="vacancy-serp__vacancy-employer">Chat Co</div><p>Письменная поддержка.</p><button>Откликнуться</button></div>
            <div data-qa="vacancy-serp__vacancy" id="c781"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/781">Консультант банка</a><div data-qa="vacancy-serp__vacancy-employer">Bank</div><p>Консультации клиентов.</p><button>Откликнуться</button></div>
            </main></body></html>'''
            pg=await ctx.new_page();nextid+=1;pages[pg]=nextid
            await pg.set_content('<base href="https://hh.ru/">'+html);await pg.evaluate('(url)=>{window.__vjaLocation=new URL(url)}','https://hh.ru/search/vacancy?text='+query)
            await pg.add_script_tag(content=chrome_mock)
            for script in scripts: await pg.add_script_tag(content=(EXT/script).read_text().replace('location.', '__vjaLocation.'))
            await pg.wait_for_timeout(500);return pg
        try:
            pg=await open_page();await pg.locator('#vja-job-intel-toolbar').wait_for(timeout=5000)
            check('4.0 installs one compact Batch Analysis toolbar',await pg.locator('#vja-job-intel-toolbar').count()==1)
            await pg.locator('[data-vja-action="batch"]').click()
            await pg.locator('#c779 .vja-card-fit-badge').filter(has_text='% Match').wait_for(timeout=12000)
            await pg.locator('#c780 .vja-card-fit-badge').filter(has_text='% Match').wait_for(timeout=12000)
            await pg.locator('#c781 .vja-card-fit-badge').filter(has_text='% Match').wait_for(timeout=12000)
            s779=await pg.locator('#c779 .vja-card-fit-badge').inner_text();s781=await pg.locator('#c781 .vja-card-fit-badge').inner_text()
            check('4.0 calculates explainable Fit badges after full vacancy analysis','% Match' in s779 and '% Match' in s781)
            check('4.0 phone-call vacancy is penalized below strong queue threshold',int(s781.split('%')[0])<=25)
            await pg.locator('[data-vja-action="queue"]').click();await pg.locator('#vja-job-intel-queue').wait_for(state='visible',timeout=4000)
            qcount=await pg.locator('#vja-job-intel-queue .vja-intel-item').count();check('4.0 Ready to Apply queue contains only suitable analyzed vacancies',qcount>=1 and qcount<3)
            await pg.locator('#vja-job-intel-toolbar select').select_option('no-calls');await pg.wait_for_timeout(200)
            check('4.0 no-calls filter hides the confirmed phone-call vacancy',await pg.locator('#c781').evaluate("e=>e.classList.contains('vja-intel-hidden')"))
            await pg.close()
            pg2=await open_page('batch-repeat')
            await pg2.locator('#c779 .vja-card-fit-badge').filter(has_text='% Match').wait_for(timeout=6000)
            check('4.0 repeated vacancy restores Fit Score from vacancy-ID memory without another batch click','% Match' in await pg2.locator('#c779 .vja-card-fit-badge').inner_text())
            await pg2.close()
        finally:
            await browser.close();proc.terminate();await proc.wait();reader_task.cancel()
    print(f'{len(passed)} focused 4.0 browser assertions passed.',flush=True)
if __name__=='__main__': asyncio.run(main())
