"""RC2 live-shape regression: HH standalone questionnaire without a semantic form.
The fixture mirrors the user-provided application page shape; Chrome/HH boundaries are mocked.
"""
import asyncio,base64,json,shutil
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
 task=asyncio.create_task(reader())
 async def call(**data):
  nonlocal seq
  seq+=1;data['id']=seq;f=asyncio.get_running_loop().create_future();pending[seq]=f;proc.stdin.write((json.dumps(data)+'\n').encode());await proc.stdin.drain();return await asyncio.wait_for(f,20)
 def check(name,cond): assert cond,name;passed.append(name);print('PASS',name,flush=True)
 scripts=json.loads((EXT/'manifest.json').read_text())['content_scripts'][1]['js']
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-gpu']);ctx=await browser.new_context(viewport={'width':1200,'height':900});pages={};nextid=900
  async def bridge(source,msg): return await call(op='message',message=msg,sender={'tab':{'id':pages[source['page']]},'frameId':0,'url':await source['frame'].evaluate('__vjaLocation.href')})
  await ctx.expose_binding('workerBridgeRc2',bridge)
  chrome_mock="""(()=>{const listeners=[];const local={};window.chrome={runtime:{sendMessage:m=>window.workerBridgeRc2(m),onMessage:{addListener:f=>listeners.push(f)},getURL:p=>'chrome-extension://fixture/'+p,id:'fixture'},storage:{local:{get:async keys=>{if(keys==null)return {...local};if(typeof keys==='string')keys=[keys];if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>k in local).map(k=>[k,local[k]]));return Object.fromEntries(Object.entries(keys||{}).map(([k,v])=>[k,local[k]??v]));},set:async o=>Object.assign(local,o),remove:async k=>[].concat(k).forEach(x=>delete local[x])},sync:{get:async()=>({})}}};})();"""
  pg=await ctx.new_page();nextid+=1;pages[pg]=nextid;tab_id=nextid
  v={'provider':'hh','url':'https://hh.ru/vacancy/909','vacancyId':'909','title':'Специалист поддержки Gaming','company':'Fixture Gaming','description':'Чаты, тикеты, ночные смены, поддержка пользователей.','descriptionCoverage':'full-dom'}
  prep=await call(op='message',message={'type':'vjaCopilot','op':'quick-list-prepare','vacancy':v},sender={'tab':{'id':tab_id},'frameId':0,'url':'https://hh.ru/search/vacancy?text=gaming'});check('application context prepared',prep.get('ok') is True)
  html='''<html><body><main id="questionnaire"><h1>Отклик на вакансию</h1><p>Для отклика необходимо ответить на несколько вопросов работодателя.</p>
  <div class="question"><p>Есть ли у вас опыт в сфере Gambling / Betting?</p><textarea name="domain" placeholder="Писать тут"></textarea></div>
  <div class="question"><p>Есть ли опыт продаж в чатах?</p><textarea name="sales" placeholder="Писать тут"></textarea></div>
  <div class="question"><p>Сколько удавалось за смену обработать тикетов/чатов?</p><textarea name="volume" placeholder="Писать тут"></textarea></div>
  <div class="question"><p>Работали ранее в ночных сменах? Готовы ли работать в ночные смены? смены по 12 часов 2/2 день, ночь 21:00 по мск.</p><textarea name="schedule" placeholder="Писать тут"></textarea></div>
  <div class="question"><p>Какой уровень зарплаты рассматриваете?</p><textarea name="salary" placeholder="Писать тут"></textarea></div>
  <div class="question"><p>Напишите, пожалуйста, ваш Telegram для связи</p><textarea name="telegram" placeholder="Писать тут"></textarea></div>
  <div id="actions"><button type="button" id="nativeApply">Откликнуться</button><button type="button">Откликнуться без теста</button></div></main></body></html>'''
  await pg.set_content('<base href="https://hh.ru/">'+html);await pg.evaluate('(url)=>{window.__vjaLocation=new URL(url)}','https://hh.ru/applicant/vacancy_response?vacancyId=909');await pg.add_script_tag(content=chrome_mock)
  for script in scripts: await pg.add_script_tag(content=(EXT/script).read_text().replace('location.', '__vjaLocation.'))
  await pg.wait_for_function("document.querySelector('[data-vja-root=\"inline-questionnaire-fill\"]')",timeout=7000)
  check('standalone questionnaire is detected without form tag',await pg.locator('[data-vja-root="inline-questionnaire-fill"]').count()==1)
  check('Fill is inserted next to native response action',await pg.locator('#actions [data-vja-root="inline-questionnaire-fill"]').count()==1)
  await pg.locator('[data-vja-root="inline-questionnaire-fill"]').click()
  await pg.wait_for_function("document.querySelector('[name=telegram]').value.includes('@ExampleCandidate')",timeout=8000)
  vals={n:await pg.locator(f'[name={n}]').input_value() for n in ['domain','sales','volume','schedule','salary','telegram']}
  check('unknown employment facts remain empty for review',all(not vals[n].strip() for n in ['domain','sales','volume','schedule']))
  check('required review markers are visible',await pg.locator('[data-vja-root=questionnaire-status]').count()>=4)
  check('salary uses neutral discussion fallback','обсуд' in vals['salary'].lower())
  check('Telegram comes from candidate profile',vals['telegram'].strip()=='@ExampleCandidate')
  check('native submit is not clicked by Fill',await pg.evaluate("document.activeElement?.id!=='nativeApply'"))
  await browser.close();proc.terminate();await proc.wait();task.cancel()
 print(f'{len(passed)} RC2 questionnaire assertions passed.',flush=True)
if __name__=='__main__': asyncio.run(main())
