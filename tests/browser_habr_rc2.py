"""Habr Career beta DOM fixture: public vacancy read + on-page assistant presence.
No logged-in application submission is exercised.
"""
import asyncio,json,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];EXT=ROOT/('browser-extension' if (ROOT/'browser-extension').exists() else 'extension')
async def main():
 passed=[]
 def check(name,v): assert v,name;passed.append(name);print('PASS',name,flush=True)
 scripts=json.loads((EXT/'manifest.json').read_text())['content_scripts'][1]['js']
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);pg=await browser.new_page(viewport={'width':1200,'height':900})
  await pg.set_content('''<html><body><main><h1>Специалист технической поддержки (чат)</h1><div class="company_name">WebSoft</div><section class="vacancy-description">Удаленная работа. Поддержка пользователей в чатах, работа с тикетами, SQL и API. Без телефонных звонков.</section><a href="#apply" id="native">Откликнуться</a></main></body></html>''')
  await pg.evaluate("window.__vjaLocation=new URL('https://career.habr.com/vacancies/1000168050')")
  await pg.evaluate("""window.chrome={runtime:{sendMessage:async m=>m?.op==='vacancy-status'?{ok:true,applied:false}:{ok:true},onMessage:{addListener:()=>{}},getURL:p=>'chrome-extension://fixture/'+p,id:'fixture'},storage:{local:{get:async()=>({}),set:async()=>{}},sync:{get:async()=>({})}}};""")
  for script in scripts: await pg.add_script_tag(content=(EXT/script).read_text().replace('location.', '__vjaLocation.'))
  r=await pg.evaluate("""()=>{const a=vjaSiteAdapters.make(document,__vjaLocation.href),v=a.extractVacancy();return {provider:a.provider,type:a.detectPageType(),id:v.vacancyId,title:v.title,description:v.description};}""")
  check('career.habr.com is recognized as second provider',r['provider']=='habr')
  check('Habr vacancy page is recognized',r['type']=='JOB_DESCRIPTION')
  check('Habr vacancy id is extracted',r['id']=='1000168050')
  check('Habr title and description are read','технической поддержки' in r['title'].lower() and 'SQL' in r['description'])
  await pg.wait_for_timeout(500)
  check('assistant bar is rendered on Habr vacancy page',await pg.locator('[data-vja-root]').count()>0)
  await browser.close()
 print(f'{len(passed)} Habr Career beta assertions passed.',flush=True)
if __name__=='__main__':asyncio.run(main())
