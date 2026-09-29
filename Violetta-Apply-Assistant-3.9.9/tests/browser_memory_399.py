"""Focused 3.9.9 Chromium regression: persistent list memory + HH form continuation.
Uses actual extension JS/service-worker JS with mocked Chrome/HTTP boundaries; no live HH account.
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
        ctx=await browser.new_context(viewport={'width':1200,'height':900});pages={};nextid=400
        async def bridge(source,msg):
            return await call(op='message',message=msg,sender={'tab':{'id':pages[source['page']]},'frameId':0,'url':await source['frame'].evaluate('__vjaLocation.href')})
        await ctx.expose_binding('workerBridge399',bridge)
        chrome_mock="""(()=>{const listeners=[];window.chrome={runtime:{sendMessage:m=>window.workerBridge399(m),onMessage:{addListener:f=>listeners.push(f)},getURL:p=>'chrome-extension://fixture/'+p,id:'fixture'},storage:{local:{get:async()=>({}),set:async()=>{},remove:async()=>{}},sync:{get:async()=>({})}}};window.dispatchExtensionMessage=m=>new Promise(resolve=>{let handled=false;for(const f of listeners){let sent=false;const r=f(m,{},v=>{sent=true;handled=true;resolve(v)});if(r===true){handled=true;break;}if(sent)break;}if(!handled)resolve(null)});})();"""
        async def open_page(path,html,tab_id=None):
            nonlocal nextid
            pg=await ctx.new_page();nextid+=1;pages[pg]=tab_id if tab_id is not None else nextid
            await pg.set_content('<base href="https://hh.ru/">'+html);await pg.evaluate('(url)=>{window.__vjaLocation=new URL(url)}','https://hh.ru'+path)
            await pg.add_script_tag(content=chrome_mock)
            for script in scripts: await pg.add_script_tag(content=(EXT/script).read_text().replace('location.', '__vjaLocation.'))
            await pg.wait_for_timeout(250);return pg
        try:
            pdf=b'%PDF-1.4\n% fixture\n%%EOF';file={'name':'english-fixture.pdf','type':'application/pdf','size':len(pdf),'base64':base64.b64encode(pdf).decode(),'savedAt':'fixture'}
            await call(op='set',data={'cvVaultEn':file,'vjaCopilotSettings':{'aiConsent':False,'historyLimit':24,'quickListCoverLetter':True}})
            card='''<html><body><div data-qa="vacancy-serp__vacancy" id="c"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/780">Менеджер по работе с клиентами в чатах</a><div data-qa="vacancy-serp__vacancy-employer">Fixture</div><p>Общение в чате.</p><button>Откликнуться</button></div></body></html>'''
            pg=await open_page('/search/vacancy?text=chat',card);await pg.get_by_role('button',name='Analysis',exact=True).click();await pg.locator('#c .vja-card-call-analysis').filter(has_text='✓ Без звонков').wait_for(timeout=6000);check('Analysis reaches a confirmed no-calls state',await pg.locator('#c .vja-card-call-analysis').get_attribute('data-state')=='no-calls');await pg.close()
            pg2=await open_page('/search/vacancy?text=chat2',card);await pg2.locator('#c .vja-card-call-analysis').filter(has_text='✓ Без звонков').wait_for(timeout=4000);check('duplicate card restores Analysis from persistent vacancy memory without another click',await pg2.locator('#c .vja-card-call-analysis').get_attribute('data-state')=='no-calls');await pg2.close()
            tab_id=499;v={'provider':'hh','url':'https://hh.ru/vacancy/784','vacancyId':'784','title':'Junior .NET Backend Developer','company':'Fixture Forms','description':'C# ASP.NET Core SQL REST remote','descriptionCoverage':'snippet','selectedFromList':True}
            prep=await call(op='message',message={'type':'vjaCopilot','op':'quick-list-prepare','vacancy':v},sender={'tab':{'id':tab_id},'frameId':0,'url':'https://hh.ru/search/vacancy?text=forms'});check('quick-list context is saved before navigation',prep.get('ok') is True and prep.get('application',{}).get('vacancy',{}).get('vacancyId')=='784')
            form='''<html><body><h1>Junior .NET Backend Developer</h1><form id="application" data-step="1"><label>First name<input name="firstName"></label><label>Email<input type="email" name="email"></label><label>Cover letter<textarea name="coverLetter"></textarea></label><label>Expected salary<input name="salary"></label><label>I agree to terms<input type="checkbox" name="consent"></label><label>Resume<input type="file" name="resume" accept="application/pdf"></label><button type="submit">Submit application</button></form><script>window.submits=0;application.addEventListener('submit',e=>{e.preventDefault();window.submits++});</script></body></html>'''
            fp=await open_page('/applicant/vacancy_response?vacancyId=784',form,tab_id);await fp.wait_for_function("document.querySelector('[name=resume]').files.length===1",timeout=8000)
            check('HH questionnaire auto-fills confirmed profile/letter/CV',await fp.locator('[name=firstName]').input_value()=='Violetta' and await fp.locator('[name=email]').input_value()=='violettanicolaou@gmail.com' and len(await fp.locator('[name=coverLetter]').input_value())>20 and await fp.locator('[name=resume]').evaluate('(e)=>e.files[0]?.name')=='english-fixture.pdf')
            check('unknown salary and legal consent are left for review',await fp.locator('[name=salary]').input_value()=='' and not await fp.locator('[name=consent]').is_checked())
            check('form continuation never auto-clicks final Submit',await fp.evaluate('window.submits')==0)
            state=await call(op='get');job=next(v for k,v in state['data'].items() if k.startswith('vjaApplicationJob:') and v.get('plan',{}).get('vacancyId')=='784');check('form progress is stored in application memory',job.get('context',{}).get('formMemory',{}).get('reviewCount')==2 and job.get('context',{}).get('formMemory',{}).get('filled',0)>=4);await fp.close()
            back='''<html><body><div data-qa="vacancy-serp__vacancy" id="b"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/784">Junior .NET Backend Developer</a><div data-qa="vacancy-serp__vacancy-employer">Fixture Forms</div><p>C# ASP.NET Core SQL</p><button>Откликнуться</button></div></body></html>'''
            bp=await open_page('/search/vacancy?text=forms',back,tab_id);await bp.locator('#b .vja-card-fast-apply').filter(has_text='! Форма: 2 проверить').wait_for(timeout=5000);check('Back/list restores saved form-review state',await bp.locator('#b .vja-card-fast-apply').get_attribute('data-state')=='review');await bp.close()
        finally:
            await browser.close();proc.terminate();await proc.wait();reader_task.cancel()
    print(f'{len(passed)} focused 3.9.9 browser assertions passed.',flush=True)
if __name__=='__main__': asyncio.run(main())
