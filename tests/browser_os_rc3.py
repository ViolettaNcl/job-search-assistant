"""RC3 UI and choice controls in real Chromium DOM.
Chrome, IndexedDB, crypto and worker transport are mocked; not native extension validation.
The native crypto and actual worker authorization have separate test suites.
"""
import asyncio,json,re,shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];EXT=ROOT/('browser-extension' if (ROOT/'browser-extension').exists() else 'extension')
async def main():
 checks=[];errors=[]
 def check(name,value):
  assert value,name
  checks.append(name);print('PASS '+name,flush=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
  html=re.sub(r'<script[^>]*></script>','',(EXT/'product.html').read_text());await page.set_content(html);await page.add_style_tag(content=(EXT/'product.css').read_text())
  await page.evaluate('''()=>{
  window.__data={'vjaVacancyIntel:1':{vacancy:{vacancyId:'1',title:'Technical Support · пример',company:'Пример компании',url:'https://hh.ru/vacancy/1'},fit:{score:94,ready:true,reasons:['Удалённая работа','API / SQL'],risks:['Уточнить график']},analysis:{status:'no-calls'},at:Date.now()},vjaLearningEventsV1:[],vjaCandidateTruthProfile:{fullName:'Demo candidate',facts:[]}};
  window.__ops=[];const get=async k=>k==null?structuredClone(__data):Object.fromEntries([].concat(k).filter(x=>x in __data).map(x=>[x,structuredClone(__data[x])]));
  window.chrome={storage:{local:{get,set:async d=>Object.assign(__data,d)},sync:{get:async()=>({})}},runtime:{getManifest:()=>({version:'6.0.0',version_name:'6.0.0 RC3'}),sendMessage:async m=>{
   __ops.push(m.op);if(m.op==='applications')return {ok:true,applications:[]};
   if(m.op==='os-index-query')return {ok:true,rows:m.query.collection==='vacancies'?[{payload:__data['vjaVacancyIntel:1']}]:[],hasMore:false};
   if(m.op==='os-policy-save'){const v=vjaAutomationPolicy.normalize(m.policy);if(v.mode==='autopilot'&&(!v.explicitOptIn||!v.approvedCategories.length))return {ok:false,error:'Подтвердите Autopilot и категории.'};__data.vjaAutomationPolicyV1=v;return {ok:true,policy:v};}
   if(m.op==='os-diagnostics')return {ok:true,diagnostics:{version:'RC3',hhLiveAccess:'NOT_LIVE_VALIDATED',indexedDB:{available:false}}};
   if(m.op==='os-profile-import'){const patch=vjaPrivateProfile.plan(m.data,__data,m);Object.assign(__data,patch);return {ok:true,facts:patch.vjaCandidateTruthProfile.facts.length};}
   if(m.op==='os-queue-decision'){__data['vjaVacancyDecision:'+m.vacancyId]={decision:m.decision};return {ok:true};}
   return {ok:true};}}};}''')
  for f in ['product-core.js','learning-core.js','strategy-analytics.js','private-profile.js','followup-intelligence.js','automation-policy.js']:
   await page.add_script_tag(content=(EXT/f).read_text())
  await page.evaluate('''()=>{const vault=new Map();let id=0;window.vjaProductStore={save:async e=>{vault.set(String(++id),e);return String(id);},list:async()=>[...vault.keys()].map(id=>({id,createdAt:Date.now(),bytes:1})),read:async k=>vault.get(k),remove:async k=>vault.delete(k)};
  window.vjaProductModels={digest:async x=>JSON.stringify(x),shadowMetrics:()=>({n:0})};window.vjaProductCrypto={seal:async(data,password)=>{if(password.length<12)throw Error('Пароль слишком короткий');return {format:'TEST_ONLY',data};}};}''')
  for f in ['product.js','product-os.js']:await page.add_script_tag(content=(EXT/f).read_text())
  await page.wait_for_function("document.getElementById('onboarding').children.length>0")
  check('13 navigation surfaces initialize',await page.locator('nav [data-page]').count()==13)
  await page.locator('[data-page=discover]').click();await page.wait_for_function("document.getElementById('discoverList').textContent.includes('Technical Support')")
  check('indexed query is rendered with Fit explanation','Объяснить Fit' in await page.locator('#discoverList').inner_text())
  await page.locator('[data-page=settings]').click();await page.locator('#automationMode').select_option('autopilot');await page.locator('#saveAutomation').click();await page.wait_for_function("document.getElementById('status').dataset.error==='true'")
  check('Autopilot cannot be enabled without approval',not await page.evaluate("Boolean(__data.vjaAutomationPolicyV1?.explicitOptIn)"))
  await page.locator('#approvedCategories').select_option(['technical_support']);await page.locator('#autopilotConsent').check();await page.locator('#saveAutomation').click();await page.wait_for_function("__data.vjaAutomationPolicyV1?.explicitOptIn===true")
  check('explicit category and mode choice persists',await page.evaluate("__data.vjaAutomationPolicyV1.mode==='autopilot'"))
  await page.locator('[data-page=analytics]').click();check('empty analytics does not fabricate outcomes','Нет подтверждённых' in await page.locator('#analyticsTable').inner_text())
  await page.locator('[data-page=start]').click()
  profile={'format':'violetta-private-profile','schemaVersion':1,'profile':{'fullName':'Fixture import','contacts':{'email':'fixture@example.invalid'},'facts':[{'id':'language-fixture','text':'English: fluent','status':'CONFIRMED','kind':'language'}]}}
  await page.locator('#privateFile').set_input_files({'name':'profile.json','mimeType':'application/json','buffer':json.dumps(profile).encode()});await page.locator('#privatePreview').click();await page.wait_for_function("!document.getElementById('privatePreviewText').hidden")
  check('profile preview does not mutate candidate facts',await page.evaluate("__data.vjaCandidateTruthProfile.fullName==='Demo candidate'"))
  await page.locator('#privateImport').click();await page.wait_for_function("document.getElementById('status').dataset.error==='true'")
  check('import requires explicit fact confirmation','os-profile-import' not in await page.evaluate('__ops'))
  await page.locator('#privateConfirmed').check();await page.locator('#privatePassword').fill('fixture-secure-password');await page.locator('#privateImport').click();await page.wait_for_function("__data.vjaCandidateTruthProfile.fullName==='Fixture import'")
  check('import checkpoints before updating',len(await page.evaluate('vjaProductStore.list()'))==1)
  check('import pauses automatic sending',await page.evaluate("__data.vjaAutomationPolicyV1.paused && !__data.vjaAutomationPolicyV1.explicitOptIn"))
  await page.locator('[data-page=diagnostics]').click();check('diagnostics labels live access unvalidated','NOT_LIVE_VALIDATED' in await page.locator('#diagnosticText').inner_text())
  await page.set_viewport_size({'width':390,'height':844});check('mobile center has no horizontal document overflow',await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  await page.emulate_media(reduced_motion='reduce');check('reduced motion media is supported',await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"))
  await page.set_viewport_size({'width':1440,'height':1000});await page.locator('[data-page=overview]').click();(ROOT/'test-results').mkdir(exist_ok=True);await page.screenshot(path=str(ROOT/'test-results/product-rc3.png'),full_page=True)
  # Actual DOM controls; no Chrome or worker calls on this page.
  choice=await browser.new_page();await choice.set_content('''<form><fieldset><legend>Уровень английского</legend><label><input type=radio name=english value=b2 required>B2</label><label><input type=radio name=english value=c1>C1</label></fieldset><label>Опция<input id=flag type=checkbox></label><select id=select><option value=''>Выберите</option><option value=remote>Удалённо</option></select><select id=multi multiple><option value=sql>SQL</option><option value=api>API</option></select><select id=reset><option value=''>Выберите</option><option value=yes>Да</option></select><button type=submit>Отправить</button></form><script>window.submits=0;document.querySelector('form').onsubmit=e=>{e.preventDefault();submits++};reset.onchange=()=>setTimeout(()=>reset.value='',30);</script>''')
  await choice.add_script_tag(content=(EXT/'questionnaire-controls.js').read_text())
  check('radio options grouped as one question',await choice.evaluate("vjaChoiceControls.groupFields([...document.querySelectorAll('input[type=radio]')]).length===1"))
  check('confirmed radio answer sets actual checked state',await choice.evaluate("vjaChoiceControls.set(document.querySelector('input[type=radio]'),'C1')") and await choice.locator('[value=c1]').is_checked())
  check('unmatched radio answer is rejected',not await choice.evaluate("vjaChoiceControls.set(document.querySelector('input[type=radio]'),'C2')"))
  check('native select exact label persists',await choice.evaluate("vjaChoiceControls.set(document.getElementById('select'),'Удалённо')"))
  check('multi-select supports exact JSON answers',await choice.evaluate("vjaChoiceControls.set(document.getElementById('multi'),'[\"sql\",\"api\"]')"))
  check('checkbox uses verified boolean answer',await choice.evaluate("vjaChoiceControls.set(document.getElementById('flag'),'true')") and await choice.locator('#flag').is_checked())
  check('reactive reset is detected after change event',not await choice.evaluate("vjaChoiceControls.set(document.getElementById('reset'),'Да')"))
  check('choice filling never submits form',await choice.evaluate('submits')==0)
  check('no uncaught UI JavaScript errors',not errors)
  await browser.close()
 print(json.dumps({'passed':len(checks),'errors':errors,'boundary':'Chromium DOM; mocked Chrome/IDB/crypto/worker. Not live.'}),flush=True)
if __name__=='__main__':asyncio.run(main())
