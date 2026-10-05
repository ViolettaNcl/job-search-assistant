"""Product Center DOM regression. Chrome storage/IDB/crypto boundary mocked.
Native crypto is independently tested in product-core.test.js under Node WebCrypto.
This sandbox blocks document navigation and extension loading by policy.
"""
import asyncio,json,shutil,re
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];EXT=ROOT/('browser-extension' if (ROOT/'browser-extension').exists() else 'extension')
async def main():
 passed=[];errors=[]
 def check(name,value):
  assert value,name
  passed.append(name);print('PASS',name,flush=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=await browser.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
  page.on('pageerror',lambda e:errors.append(str(e)))
  html=re.sub(r'<script[^>]*></script>','',(EXT/'product.html').read_text())
  await page.set_content(html);await page.add_style_tag(content=(EXT/'product.css').read_text())
  await page.evaluate("""()=>{window.__data={vjaCandidateTruthProfile:{fullName:'Test candidate',facts:[{status:'CONFIRMED'}]},vjaJobPreferencesV1:{minimumFitScore:80},'vjaVacancyIntel:1':{vacancy:{title:'Support fixture',vacancyId:'1',url:'https://hh.ru/vacancy/1',company:'Fixture'},analysis:{status:'no-calls'},fit:{score:91,ready:true},at:Date.now()},vjaLearningEventsV1:[],vjaWritingProvider:{apiKey:'PRIVATE-TEST-KEY'}};window.__ops=[];window.chrome={storage:{local:{get:async k=>k===null?structuredClone(window.__data):Object.fromEntries([].concat(k).filter(x=>x in window.__data).map(x=>[x,structuredClone(window.__data[x])])),set:async d=>Object.assign(window.__data,d)}},runtime:{getManifest:()=>({version:'6.0.0',version_name:'RC1',host_permissions:['https://api.hh.ru/*']}),sendMessage:async m=>{window.__ops.push(m.op);if(m.op==='applications')return {ok:true,applications:[{id:'1',vacancy:{title:'Support fixture',company:'Fixture',url:'https://hh.ru/vacancy/1'},status:'Applied',timeline:[{at:Date.now(),type:'status',title:'Applied'}]}]};if(m.op==='product-restore'){Object.assign(window.__data,vjaProductCore.restorePlan(m.data,window.__data).patch);return {ok:true,restored:3};}return {ok:true};}}};}""")
  for f in ['product-core.js','learning-core.js']:
   await page.add_script_tag(content=(EXT/f).read_text())
  await page.evaluate("""()=>{const vault=new Map();let id=0;window.vjaProductStore={save:async e=>{const key=String(++id);vault.set(key,{id:key,createdAt:Date.now(),envelope:e});return key;},list:async()=>[...vault.values()].map(x=>({id:x.id,createdAt:x.createdAt,bytes:1})),read:async k=>vault.get(k)?.envelope,remove:async k=>vault.delete(k)};window.vjaProductCrypto={seal:async(data,password)=>{if(password.length<12)throw Error('Пароль: минимум 12 символов.');return {format:'TEST-ONLY-CRYPTO-BOUNDARY',password,data};},open:async(x,password)=>{if(x.password!==password)throw Error('Неверный пароль или повреждённый файл.');return x.data;}};window.vjaProductModels={digest:async x=>JSON.stringify(x),shadowMetrics:()=>({n:0,modelAccuracy:null,rulesAccuracy:null})};}""")
  await page.add_script_tag(content=(EXT/'product.js').read_text());await page.wait_for_function("document.getElementById('stats').children.length===4")
  check('overview shows local counts',await page.locator('#stats .stat').first.inner_text()=='1\nПроанализировано')
  await page.locator('[data-page=queue]').click();check('queue has distinct Fit and calls text','Fit' in await page.locator('#queueList').inner_text() and 'Звонки' in await page.locator('#queueList').inner_text())
  await page.locator('[data-page=applications]').click();await page.locator('[data-timeline]').click();check('timeline opens for selected application','Applied' in await page.locator('#timeline').inner_text())
  await page.locator('#appSearch').fill('absent');check('application search works','нет' in await page.locator('#appList').inner_text());await page.locator('#appSearch').fill('')
  await page.locator('[data-page=learning]').click();check('insufficient data not labelled production-ready','Менее 100' in await page.locator('#quality').inner_text())
  await page.locator('[data-page=models]').click();check('no trained model fabricated','ещё не импортирована' in await page.locator('#modelList').inner_text())
  check('rollback unavailable without prior model',await page.locator('#rollbackPreference').is_disabled())
  await page.locator('[data-page=backups]').click();await page.locator('#backupPassword').fill('test-backup-password');await page.locator('#backupLocal').click();await page.wait_for_function("document.querySelector('[data-vault-download]')!==null")
  check('vault write invoked through storage boundary',len(await page.evaluate('vjaProductStore.list()'))==1)
  b=await page.evaluate('(async()=>{const [x]=await vjaProductStore.list();return vjaProductStore.read(x.id)})()');check('known API keys excluded before encryption boundary','PRIVATE-TEST-KEY' not in json.dumps(b))
  await page.locator('#backupFile').set_input_files({'name':'fixture.vja','mimeType':'application/json','buffer':json.dumps(b).encode()});await page.locator('#restorePassword').fill('wrong-password');await page.locator('#previewRestore').click();await page.wait_for_function("document.getElementById('status').dataset.error==='true'")
  check('failed decrypt does not enable restore',await page.locator('#confirmRestore').is_disabled())
  await page.locator('#restorePassword').fill('test-backup-password');await page.locator('#previewRestore').click();await page.wait_for_function("!document.getElementById('confirmRestore').disabled")
  check('restore preview does not mutate data','product-restore' not in await page.evaluate('window.__ops'))
  page.on('dialog',lambda d:asyncio.create_task(d.accept()))
  await page.locator('#confirmRestore').click();await page.wait_for_function("window.__ops.includes('product-restore')")
  check('confirmed restore pauses ML and external AI consent',await page.evaluate('window.__data.vjaFeatureFlagsV1.mlRanking===false && window.__data.vjaCopilotSettings.aiConsent===false'))
  await page.wait_for_timeout(200);await page.locator('[data-page=diagnostics]').click();check('diagnostics excludes private values','Test candidate' not in await page.locator('#diagnosticText').inner_text() and 'PRIVATE-TEST-KEY' not in await page.locator('#diagnosticText').inner_text())
  check('center never submits an employer application',all('apply' not in x for x in await page.evaluate('window.__ops')))
  await page.set_viewport_size({'width':390,'height':844});check('mobile portrait has no horizontal document overflow',await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  await page.set_viewport_size({'width':1280,'height':1000});await page.locator('[data-page=overview]').click();(ROOT/'test-results').mkdir(exist_ok=True);await page.screenshot(path=str(ROOT/'test-results/product-overview.png'),full_page=True)
  check('no uncaught JavaScript errors',not errors);await browser.close()
 print(json.dumps({'passed':len(passed),'errors':errors,'boundary':'Chromium DOM; mocked storage/crypto/Chrome APIs. No real HH login.'}),flush=True)
if __name__=='__main__':asyncio.run(main())
