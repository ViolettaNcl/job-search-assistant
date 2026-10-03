"""Focused 3.9.12 Chromium regression for Smart Questionnaire Autofill.
Uses actual extension content/service-worker JS with mocked Chrome/HH boundaries; no live HH account.
"""
import asyncio, base64, json, shutil
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
        proc.stdin.write((json.dumps(data)+'\n').encode());await proc.stdin.drain();return await asyncio.wait_for(f,20)
    def check(name,cond):
        assert cond,name;passed.append(name);print('PASS',name,flush=True)
    scripts=json.loads((EXT/'manifest.json').read_text())['content_scripts'][1]['js']
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-gpu'])
        ctx=await browser.new_context(viewport={'width':1200,'height':900});pages={};nextid=700
        async def bridge(source,msg):
            return await call(op='message',message=msg,sender={'tab':{'id':pages[source['page']]},'frameId':0,'url':await source['frame'].evaluate('__vjaLocation.href')})
        await ctx.expose_binding('workerBridge3912',bridge)
        chrome_mock="""(()=>{const listeners=[];const local={};window.chrome={runtime:{sendMessage:m=>window.workerBridge3912(m),onMessage:{addListener:f=>listeners.push(f)},getURL:p=>'chrome-extension://fixture/'+p,id:'fixture'},storage:{local:{get:async keys=>{if(keys==null)return {...local};if(typeof keys==='string')keys=[keys];if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>k in local).map(k=>[k,local[k]]));return Object.fromEntries(Object.entries(keys||{}).map(([k,v])=>[k,local[k]??v]));},set:async o=>Object.assign(local,o),remove:async k=>[].concat(k).forEach(x=>delete local[x])},sync:{get:async()=>({})}}};window.dispatchExtensionMessage=m=>new Promise(resolve=>{let handled=false;for(const f of listeners){let sent=false;const r=f(m,{},v=>{sent=true;handled=true;resolve(v)});if(r===true){handled=true;break;}if(sent)break;}if(!handled)resolve(null)});})();"""
        async def open_page(path,html,tab_id=None):
            nonlocal nextid
            pg=await ctx.new_page();nextid+=1;pages[pg]=tab_id if tab_id is not None else nextid
            await pg.set_content('<base href="https://hh.ru/">'+html);await pg.evaluate('(url)=>{window.__vjaLocation=new URL(url)}','https://hh.ru'+path)
            await pg.add_script_tag(content=chrome_mock)
            for script in scripts: await pg.add_script_tag(content=(EXT/script).read_text().replace('location.', '__vjaLocation.'))
            await pg.wait_for_timeout(300);return pg
        try:
            pdf=b'%PDF-1.4\n% fixture\n%%EOF';file={'name':'english-fixture.pdf','type':'application/pdf','size':len(pdf),'base64':base64.b64encode(pdf).decode(),'savedAt':'fixture'}
            await call(op='set',data={'cvVaultEn':file,'vjaCopilotSettings':{'aiConsent':False,'historyLimit':24,'quickListCoverLetter':True}})
            tab_id=799;v={'provider':'hh','url':'https://hh.ru/vacancy/784','vacancyId':'784','title':'Специалист технической поддержки / Support L1','company':'Fixture Forms','description':'Техническая поддержка пользователей, тикеты, API, SQL, английский язык.','descriptionCoverage':'snippet','selectedFromList':True}
            prep=await call(op='message',message={'type':'vjaCopilot','op':'quick-list-prepare','vacancy':v},sender={'tab':{'id':tab_id},'frameId':0,'url':'https://hh.ru/search/vacancy?text=forms'});check('prepared application is pinned to exact vacancy',prep.get('ok') is True and prep.get('application',{}).get('vacancy',{}).get('vacancyId')=='784')
            form='''<html><body><h1>Отклик на вакансию</h1><div>Специалист технической поддержки / Support L1</div><form id="application" data-step="1">
            <div class="question"><p>Какие условия по зарплате для себя рассматриваете? Напишите вилку</p><textarea name="salary" placeholder="Писать тут"></textarea></div>
            <div class="question"><p>Есть ли у вас опыт работы с проектами? Если да, с какими проектами работали и для каких задач их использовали?</p><textarea name="projects" placeholder="Писать тут"></textarea></div>
            <div class="question"><p>Какой у вас уровень английского? Как часто применяли его в работе и для каких задач?</p><textarea name="english" placeholder="Писать тут"></textarea></div>
            <label>Сопроводительное письмо<textarea name="coverLetter"></textarea></label><label>Resume<input type="file" name="resume" accept="application/pdf"></label><button type="submit" id="submit">Откликнуться</button></form>
            <script>window.submits=0;application.addEventListener('submit',e=>{e.preventDefault();window.submits++});</script></body></html>'''
            fp=await open_page('/applicant/vacancy_response?vacancyId=784',form,tab_id)
            await fp.wait_for_function("document.querySelector('[name=projects]').value.length>40",timeout=8000)
            await fp.wait_for_function("document.querySelector('[name=english]').value.length>20",timeout=8000)
            check('projects question is answered from confirmed project evidence','DentalClinic' in await fp.locator('[name=projects]').input_value())
            check('English question is answered from confirmed language evidence','англий' in (await fp.locator('[name=english]').input_value()).lower())
            salary_value=await fp.locator('[name=salary]').input_value();check('salary receives neutral fallback draft when no amount is confirmed',len(salary_value)>20 and ('обсуд' in salary_value.lower() or 'discuss' in salary_value.lower()))
            await fp.wait_for_function("document.querySelectorAll('[data-vja-root=\"questionnaire-status\"]').length>=3",timeout=5000);check('questionnaire renders field-level states',await fp.locator('[data-vja-root="questionnaire-status"]').count()>=3);check('fallback draft remains visibly marked for review',await fp.locator('[data-vja-root="questionnaire-status"][data-state="suggested"]').count()>=1)
            check('final submit remains user-controlled',await fp.evaluate('window.submits')==0)
            # Dynamic question appears after initial fill; observer should rerun safe fill.
            await fp.evaluate("""()=>{const d=document.createElement('div');d.className='question';d.innerHTML='<p>Расскажите об опыте технической поддержки</p><textarea name="support"></textarea>';application.insertBefore(d,submit)}""")
            await fp.wait_for_function("document.querySelector('[name=support]') && document.querySelector('[name=support]').value.length>20",timeout=8000)
            check('late dynamic question is detected and filled safely',len(await fp.locator('[name=support]').input_value())>20)
            await fp.wait_for_timeout(700)
            state=await call(op='get');job=next(v for k,v in state['data'].items() if k.startswith('vjaApplicationJob:') and v.get('plan',{}).get('vacancyId')=='784');fm=job.get('context',{}).get('formMemory',{});cats={x.get('category') for x in fm.get('filledFields',[])};check('per-vacancy questionnaire memory stores semantic filled fields','PROJECTS' in cats and 'ENGLISH_LEVEL' in cats and fm.get('reviewCount',0)>=1)
            await fp.close()
        finally:
            await browser.close();proc.terminate();await proc.wait();reader_task.cancel()
    print(f'{len(passed)} focused 3.9.12 questionnaire assertions passed.',flush=True)
if __name__=='__main__': asyncio.run(main())
