"""Real Chromium DOM + actual worker JS through worker-bridge.cjs, mocked Chrome/HTTP.
No login, real employer traffic, real PDF, or AI credits. Not live site certification.
"""
import asyncio, base64, json, tempfile, threading, http.server, shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results';RESULTS.mkdir(exist_ok=True)
async def main():
 proc=await asyncio.create_subprocess_exec('node',str(ROOT/'tests/worker-bridge.cjs'),stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,limit=4*1024*1024)
 pending={};seq=0;passed=[];page_errors=[]
 async def reader():
  while line:=await proc.stdout.readline():
   v=json.loads(line);future=pending.pop(v['id'],None)
   if future:
    if v.get('error'):future.set_exception(RuntimeError(v['error']))
    else:future.set_result(v.get('result'))
 reader_task=asyncio.create_task(reader())
 async def call(**data):
  nonlocal seq
  seq+=1;data['id']=seq;f=asyncio.get_running_loop().create_future();pending[seq]=f
  proc.stdin.write((json.dumps(data)+'\n').encode());await proc.stdin.drain();return await asyncio.wait_for(f,15)
 def check(name,cond):
  assert cond,name;passed.append(name);print('PASS',name,flush=True)
 base='https://fixture.invalid'
 scripts=json.loads((ROOT/'extension/manifest.json').read_text())['content_scripts'][1]['js']
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-gpu']);ctx=await browser.new_context(viewport={'width':1280,'height':1000});ctx.set_default_timeout(5000)
  pages={};nextid=7
  async def bridge(source,msg):return await call(op='message',message=msg,sender={'tab':{'id':pages[source['page']]},'frameId':0,'url':await source['frame'].evaluate('__vjaLocation.href')})
  await ctx.expose_binding('workerBridge',bridge)
  chrome_mock="""(()=>{const listeners=[];window.chrome={runtime:{sendMessage:m=>window.workerBridge(m),onMessage:{addListener:f=>listeners.push(f)},getURL:p=>'chrome-extension://fixture/'+p,id:'fixture'},storage:{local:{get:async()=>({}),set:async()=>{},remove:async()=>{}},sync:{get:async()=>({})}}};window.dispatchExtensionMessage=m=>new Promise(resolve=>{let handled=false;for(const f of listeners){let sent=false;const r=f(m,{},v=>{sent=true;handled=true;resolve(v)});if(r===true){handled=true;break;}if(sent)break;}if(!handled)resolve(null)});})();"""
  async def open_page(path,inject=True,html=None,virtual_base=None):
   nonlocal nextid
   pg=await ctx.new_page();nextid+=1;pages[pg]=nextid;pg.on('pageerror',lambda e:page_errors.append(str(e)));
   virtual_base=virtual_base or base
   await pg.set_content('<base href="'+virtual_base+'/">'+(html if html else (ROOT/'tests/fixtures'/path.lstrip('/')).read_text()))
   await pg.evaluate('(url)=>{window.__vjaLocation=new URL(url)}',virtual_base+path)
   if inject:
    await pg.add_script_tag(content=chrome_mock)
    for script in scripts:await pg.add_script_tag(content=(ROOT/'extension'/script).read_text().replace('location.', '__vjaLocation.'))
    await pg.wait_for_timeout(250)
   return pg
  try:
   pdf=b'%PDF-1.4\n% fixture only; never use as a real CV\n%%EOF';file={'name':'english-fixture.pdf','type':'application/pdf','size':len(pdf),'base64':base64.b64encode(pdf).decode(),'savedAt':'fixture'}
   await call(op='set',data={'cvVaultEn':file,'vjaCopilotSettings':{'aiConsent':False,'historyLimit':2}})
   pg=await open_page('/application.html');check('generic application detected',await pg.evaluate("vjaSiteAdapters.make().detectPageType()")=='APPLICATION_FORM')
   result=await pg.evaluate('vjaUniversal.prepare({open:false})');check('form prepared without submission',result.get('submitted') is False and await pg.evaluate('submits')==0)
   check('confirmed contact filled',await pg.locator('[name=email]').input_value()=='violettanicolaou@gmail.com')
   check('unknown salary and experience stay empty',await pg.locator('[name=salary]').input_value()=='' and await pg.locator('[name=years]').input_value()=='')
   check('legal consent stays unchecked',not await pg.locator('[name=consent]').is_checked())
   check('vacancy language selects the English CV without role-specific configuration',await pg.locator('[name=resume]').evaluate('(el)=>el.files[0]?.name')=='english-fixture.pdf')
   check('portfolio not overwritten with CV',await pg.locator('[name=portfolio]').evaluate('(el)=>el.files.length')==0)
   dev=await open_page('/dev-letter',html='<html><body><h1>Junior .NET Backend Developer</h1><div class=company-name>Fixture Tech</div><div class=job-description>C# ASP.NET Core REST API SQL Server Docker backend</div><form id=application><label>Email<input type=email name=email></label><label>Cover letter<textarea name=coverLetter></textarea></label><label>Resume<input type=file name=resume accept="application/pdf"></label><button type=submit>Submit application</button></form><script>window.submits=0;document.querySelector("form").addEventListener("submit",e=>{e.preventDefault();submits++});</script></body></html>');await dev.evaluate('vjaUniversal.prepare({open:false})');dev_letter=await dev.locator('[name=coverLetter]').input_value();check('developer cover letter is short project-focused, includes GitHub and excludes hospitality history','DentalClinic' in dev_letter and ('C#' in dev_letter or 'ASP.NET Core' in dev_letter) and 'github.com/ViolettaNcl' in dev_letter and 'Crowne' not in dev_letter and 'Front Desk' not in dev_letter and len(dev_letter)<900)
   await pg.locator('[name=email]').fill('existing@example.test');await pg.evaluate('vjaUniversal.prepare({open:false})');check('existing text preserved',await pg.locator('[name=email]').input_value()=='existing@example.test')
   records=await call(op='get');job=next(v for k,v in records['data'].items() if k.startswith('vjaApplicationJob:'));check('application in original storage with profile snapshot',bool(job['context']['profileSnapshot']['fullName']) and job['context']['status']=='Needs review')
   check('application timeline records preparation and review without claiming send',any(e.get('type')=='prepared' for e in job['context'].get('timeline',[])) and any(e.get('type')=='needs-review' for e in job['context'].get('timeline',[])))
   await pg.screenshot(path=str(RESULTS/'form-review.png'),full_page=True)
   # AI has no paid/external calls; the real worker receives mock HTTP results.
   chat=await open_page('/chat.html');check('chat identity and author detected',await chat.evaluate('vjaLiveChat.snapshot().conversationId')=='chat-A' and await chat.evaluate('vjaLiveChat.snapshot().latestInbound.includes("рассмотрим")'))
   await chat.evaluate('vjaLiveChat.openAiMenu()');check('AI menu exposes explicit full-dialog analysis action',await chat.get_by_role('button',name='🧠 Проанализировать весь диалог и ответить',exact=True).count()==1)
   await chat.get_by_role('button',name='Закрыть',exact=True).click()
   await chat.get_by_role('button',name='Спасибо, буду ждать',exact=True).click();default_reply=await chat.locator('textarea[name=message]').input_value();check('default feedback quick reply inserted with Telegram email and phone note',default_reply.startswith('Здравствуйте! Спасибо за ответ. Буду ждать обратной связи.') and '@Violet111' in default_reply and 'violettanicolaou@gmail.com' in default_reply and 'телефонному звонку могу не успеть ответить' in default_reply and await chat.evaluate('sends')==0)
   await chat.locator('textarea[name=message]').fill('My own draft');r=await chat.evaluate('vjaLiveChat.insertText("replacement",vjaLiveChat.snapshot())');check('chat draft overwrite requires explicit confirmation',r['code']=='existing' and await chat.locator('textarea[name=message]').input_value()=='My own draft')
   await chat.locator('textarea[name=message]').fill('');r=await chat.evaluate('vjaLiveChat.analyze()');check('background AI still requires consent unless user explicitly invokes current-chat analysis',r.get('code')=='consent-required')
   r=await chat.evaluate('vjaLiveChat.analyze("dialog","",true)');check('explicit current-chat AI works without forcing a settings detour',r.get('ok') is True)
   check('AI panel exposes full-answer vacancy-question and draft-polish tools',await chat.get_by_role('button',name='Ответить на все вопросы',exact=True).count()==1 and await chat.get_by_role('button',name='Вопрос работодателю',exact=True).count()==1 and await chat.get_by_role('button',name='Улучшить этот черновик',exact=True).count()==1)
   await chat.get_by_role('button',name='Вставить',exact=True).click();check('AI inserts never sends',(await chat.locator('textarea[name=message]').input_value()).startswith('Спасибо') and await chat.evaluate('sends')==0)
   await chat.screenshot(path=str(RESULTS/'chat-copilot.png'),full_page=True)
   # Real HH chat markup may not expose stable message data-qa attributes. The
   # DOM fallback must still read the active right-side dialogue instead of the chat list.
   hh_chat_html='''<html><body><div style="display:flex;height:850px"><aside style="width:330px"><h2>Чаты</h2><div>Разработчик C#</div><div>Менеджер</div></aside><main style="width:640px;padding:20px"><header><div>Adviya</div><div>Сейчас онлайн</div><div>Вакансия</div><h2>Специалист чат-поддержки</h2><a href="https://hh.ru/vacancy/999">Перейти</a></header><div class="plain-chat-area"><div class="plain-bubble" style="margin:40px 25px 20px 20px;padding:18px;background:#f3f4f8;border-radius:14px"><p>Здравствуйте! Это команда подбора Adviya. Коротко об условиях вакансии.</p><p>Задачи: консультация клиентов в чате и ведение истории общения в CRM.</p><p>Требование: знание азербайджанского языка.</p><p>Если условия подходят, напишите здесь несколько слов о себе.</p></div></div><form><textarea aria-label="Сообщение" placeholder="Сообщение" style="width:100%;height:70px"></textarea><button type="submit">Отправить</button></form></main></div></body></html>'''
   hh_chat=await open_page('/chat',html=hh_chat_html,virtual_base='https://hh.ru');hh_snap=await hh_chat.evaluate('vjaLiveChat.snapshot()');check('HH chat fallback reads dialogue even without stable message selectors',len(hh_snap.get('messages',[]))>0 and 'Если условия подходят' in hh_snap.get('latestInbound',''))
   context_before=await chat.evaluate('vjaLiveChat.snapshot()');await chat.evaluate('switchThread()');r=await chat.evaluate('(s)=>vjaLiveChat.insertText("Wrong A reply",s)',context_before);check('old thread insertion rejected immediately',r.get('code')=='stale' and await chat.locator('textarea[name=message]').input_value()=='')
   await chat.wait_for_timeout(300);await chat.evaluate('dispatchExtensionMessage({type:"vjaCopilotPage",action:"command",command:"contacts-reply"})');check('hotkey command only inserts contacts', '@Violet111' in await chat.locator('textarea[name=message]').input_value() and await chat.evaluate('sends')==0)
   await chat.locator('textarea[name=message]').fill('');await chat.evaluate('dispatchExtensionMessage({type:"vjaCopilotPage",action:"command",command:"thank-you-reply"})');hot=await chat.locator('textarea[name=message]').input_value();check('thank-you hotkey inserts full default feedback reply without Send',hot.startswith('Здравствуйте! Спасибо за ответ.') and '@Violet111' in hot and 'violettanicolaou@gmail.com' in hot and await chat.evaluate('sends')==0)
   await chat.evaluate("switchThread('chat-A','support-1');document.querySelector('.incoming').textContent='Спасибо! Мы дадим обратную связь до пятницы.'");await chat.wait_for_timeout(300);await chat.evaluate("chrome.runtime.sendMessage({type:'vjaCopilot',op:'observe-chat',snapshot:vjaLiveChat.snapshot()})");state=await call(op='get');support_job=next(v for k,v in state['data'].items() if k.startswith('vjaApplicationJob:') and v.get('plan',{}).get('vacancyId')=='support-1');next_action=support_job.get('context',{}).get('nextAction');check('explicit recruiter deadline becomes a local next-action reminder',support_job.get('context',{}).get('status')=='Recruiter Replied' and next_action and next_action.get('type')=='feedback' and next_action.get('dueAt',0)>0)
   ext_sender={'url':'chrome-extension://fixture/home.html'};apps_payload=await call(op='message',message={'type':'vjaCopilot','op':'applications'},sender=ext_sender);check('popup analytics are derived from stored application history',apps_payload.get('ok') is True and apps_payload.get('analytics',{}).get('total',{}).get('applications',0)>=1 and apps_payload.get('analytics',{}).get('total',{}).get('response',0)>=1)
   app_id=support_job['plan']['id'];old_due=next_action['dueAt'];snoozed=await call(op='message',message={'type':'vjaCopilot','op':'next-action','id':app_id,'mode':'snooze','days':1},sender=ext_sender);check('next-action reminder can be snoozed without sending anything',snoozed.get('ok') is True and snoozed.get('application',{}).get('nextAction',{}).get('dueAt',0)>old_due and await chat.evaluate('sends')==0);done=await call(op='message',message={'type':'vjaCopilot','op':'next-action','id':app_id,'mode':'done'},sender=ext_sender);check('next-action can be marked done locally',done.get('ok') is True and done.get('application',{}).get('nextAction',{}).get('doneAt',0)>0)
   # Thread A request remains in flight while navigating to B.
   await chat.evaluate("switchThread('chat-A','support-1');document.querySelector('.incoming').textContent='SLOW_TEST расскажите о задачах';");await chat.wait_for_timeout(250)
   await chat.evaluate('()=>{window.slowResult=vjaLiveChat.analyze("neutral","",true);}');await chat.wait_for_timeout(150);await chat.evaluate('switchThread()');r=await chat.evaluate('window.slowResult');check('late Chat A response discarded in Chat B',r.get('code')=='stale' and await chat.get_by_label('Черновик ответа',exact=True).count()==0)
   # Strong IDs for multiple jobs; no title-only matching.
   await chat.evaluate("document.querySelector('main').removeAttribute('data-conversation-id');document.querySelector('main').removeAttribute('data-vacancy-id');document.querySelector('main a')?.remove();");await chat.evaluate('vjaLiveChat.scan()');check('AI pencil remains visible in old/unlinked active chat',await chat.get_by_role('button',name='✎ AI',exact=True).count()==1);r=await chat.evaluate('vjaLiveChat.analyze("dialog","",true)');check('old/unlinked active chat gets an AI draft without vacancy selection',r.get('ok') is True and r.get('code')!='needs-selection')
   # Floating Apply on a job-description page stays in-place and only shows compact status.
   ui=await open_page('/vacancy/auto-ui',html='<html><body><main data-job-id="auto-ui"><h1>Technical Support Specialist</h1><div class="company-name">Fixture Company</div><div class="job-description">Support customers and explain solutions clearly.</div></main></body></html>')
   await ui.evaluate("()=>{const real=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async m=>m?.type==='vjaCopilot'&&m?.op==='auto-apply'?{ok:true,result:{submitted:true,status:'confirmed'},application:{id:'auto-ui'}}:m?.type==='vjaCopilot'&&m?.op==='vacancy-status'?{ok:true,applied:false}:real(m);}")
   ui_result=await ui.evaluate('vjaUniversal.autoApply()');check('floating Apply stays on current page and ends in confirmed compact state',ui_result.get('submitted') is True and await ui.evaluate('vjaUniversal.applyState')=='CONFIRMED' and await ui.get_by_role('button',name='✓ Отклик отправлен',exact=True).count()==1 and len(ctx.pages)>=1)
   # Explicit auto-apply is separate from safe preparation: only this direct user-selected mode may click final submit.
   auto=await open_page('/auto-application',html='<html><body><h1>Technical Support Specialist</h1><main data-job-id="auto-1"><div class="company-name">Fixture Company</div><div class="job-description">Support customers.</div><form id="application"><label>Email<input type=email name=email required></label><label>Cover letter<textarea name=coverLetter></textarea></label><button type=submit>Submit application</button></form></main><script>window.submits=0;document.querySelector("form").addEventListener("submit",e=>{e.preventDefault();window.submits++});</script></body></html>')
   prep=await auto.evaluate('vjaUniversal.prepare({open:false})');check('safe preparation path still does not submit before explicit auto action',prep.get('submitted') is False and await auto.evaluate('submits')==0)
   state=await call(op='get');auto_job=next(v for k,v in state['data'].items() if k.startswith('vjaApplicationJob:') and v.get('plan',{}).get('sourceUrl','').endswith('/auto-application'));auto_result=await auto.evaluate('(plan)=>vjaRunSiteApply(plan)',auto_job['plan']);check('explicit auto-apply path clicks final application control',await auto.evaluate('submits')==1 and auto_result.get('status') in ['clicked-unverified','confirmed'])
   legal=await open_page('/auto-legal',html='<html><body><h1>Technical Support Specialist</h1><main data-job-id="auto-legal-1"><div class="company-name">Fixture Company</div><div class="job-description">Support customers.</div><form id="application"><label>Email<input type=email name=email required></label><label>Cover letter<textarea name=coverLetter></textarea></label><label><input type=checkbox name=consent checked required> I agree to privacy terms</label><button type=submit>Submit application</button></form></main><script>window.submits=0;document.querySelector("form").addEventListener("submit",e=>{e.preventDefault();window.submits++});</script></body></html>')
   await legal.evaluate('vjaUniversal.prepare({open:false})');state=await call(op='get');legal_job=next(v for k,v in state['data'].items() if k.startswith('vjaApplicationJob:') and v.get('plan',{}).get('sourceUrl','').endswith('/auto-legal'));legal_result=await legal.evaluate('(plan)=>vjaRunSiteApply(plan)',legal_job['plan']);check('explicit auto-apply pauses on prechecked unreviewed legal consent',await legal.evaluate('submits')==0 and legal_result.get('reason')=='manual-risk-fields')
   # A trusted native HH list-card click is allowed to complete the same card's cover letter inline.
   hh_html='''<html><body><div data-qa="vacancy-serp__vacancy" id="card"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/777">Junior .NET Backend Developer</a><div data-qa="vacancy-serp__vacancy-employer">Fixture Tech</div><div data-qa="vacancy-serp__vacancy-address">Можно удалённо</div><p>C# ASP.NET Core REST API SQL Server Docker backend developer</p><button id="nativeApply">Откликнуться</button><div id="receipt" hidden>Вы откликнулись <button id="attach">Приложить письмо</button></div></div><script>window.sentLetter='';nativeApply.addEventListener('click',()=>{receipt.hidden=false});attach.addEventListener('click',()=>{const d=document.createElement('div');d.className='bloko-modal';d.innerHTML='<h2>Сопроводительное письмо</h2><textarea name="coverLetter" placeholder="Почему именно ваша кандидатура должна заинтересовать работодателя"></textarea><footer><button id="closeLetter">Закрыть</button><button id="sendLetter">Отправить</button></footer>';document.body.append(d);d.querySelector('#sendLetter').addEventListener('click',()=>{window.sentLetter=d.querySelector('textarea').value;d.remove()})});</script></body></html>'''
   hh=await open_page('/search/vacancy?text=.net',html=hh_html,virtual_base='https://hh.ru');await hh.get_by_role('button',name='Откликнуться',exact=True).click();
   await hh.wait_for_function("window.sentLetter && window.sentLetter.length>20",timeout=12000);sent_letter=await hh.evaluate('window.sentLetter');check('native HH list click attaches and sends a vacancy-specific cover letter without opening vacancy detail','Junior .NET Backend Developer' in sent_letter and 'github.com/ViolettaNcl' in sent_letter and len(ctx.pages)>=1)
   list_job=None
   for _ in range(30):
    state=await call(op='get');list_job=next((v for k,v in state['data'].items() if k.startswith('vjaApplicationJob:') and v.get('plan',{}).get('vacancyId')=='777'),None)
    if list_job and list_job.get('context',{}).get('status')=='Applied':break
    await asyncio.sleep(.1)
   check('native HH list quick apply stores submitted cover-letter memory',bool(list_job) and list_job.get('context',{}).get('status')=='Applied' and list_job.get('context',{}).get('coverLetterMemory',{}).get('submittedText')==sent_letter)
   # Minimal UI stays absent on unrelated pages; JSON-LD-only jobs use existing parser.
   unrelated=await open_page('/blank.html',html='<html><body><h1>Cooking notes</h1><p>Unrelated personal page.</p></body></html>');check('no UI on unrelated pages',await unrelated.locator('[data-vja-root]').count()==0)
   ld=await open_page('/jobs/structured',html='<html><body><h1>Structured role</h1><script type="application/ld+json">{"@type":"JobPosting","title":"QA Engineer","description":"<p>Test interfaces carefully.</p>","identifier":{"value":"qa-12"},"hiringOrganization":{"name":"Fixture Co"}}</script></body></html>');check('JSON-LD vacancy parsing',await ld.evaluate('vjaSiteAdapters.make().extractVacancy().description')=='Test interfaces carefully.')
   # Open shadow DOM fields and explicit steps are browser DOM operations.
   shadow=await open_page('/application-shadow',inject=False,html='<html><body><h1>QA Engineer</h1><div id="host"></div></body></html>');await shadow.evaluate("document.querySelector('#host').attachShadow({mode:'open'}).innerHTML='<form id=application><label>Email<input name=email type=email></label><button type=submit>Submit application</button></form>'")
   await shadow.add_script_tag(content=chrome_mock)
   for script in scripts:await shadow.add_script_tag(content=(ROOT/'extension'/script).read_text().replace('location.', '__vjaLocation.'))
   await shadow.evaluate('vjaUniversal.prepare({open:false})');check('open shadow DOM form fills',await shadow.locator('#host input').input_value()=='violettanicolaou@gmail.com')
   r=await call(op='get');ai_requests=[h for h in r['http'] if h['url'].endswith('/api/operator/recruiter/triage')];check('AI payload includes vacancy snapshot CV version and latest message',any('cvVersion' in h['body'] and 'support-1' in h['body'] and 'CONFIRMED' in h['body'] for h in ai_requests));check('no final submission HTTP endpoint called',not any('apply-tailored' in h['url'] or 'browser-applied' in h['url'] or 'browser-auto-applied' in h['url'] for h in r['http']))
   # A safe multi-step button never becomes a final submit command.
   step=await open_page('/application-step',html='<html><body><h1>Junior Developer</h1><main data-job-id="step-1"><form id="application" data-step="1"><label>First name<input name="firstName"></label><button type="button" id="next">Next</button></form></main><script>window.submits=0;document.querySelector("form").addEventListener("submit",e=>{e.preventDefault();submits++});document.querySelector("#next").onclick=()=>{document.querySelector("form").innerHTML="<label>Email<input type=email name=email></label><button type=submit>Submit application</button>"};</script></body></html>')
   await step.evaluate('vjaUniversal.prepare({open:false})');await step.get_by_role('button',name='Следующий шаг',exact=True).click();await step.wait_for_timeout(700);check('explicit intermediate step fills next form without submit',await step.locator('[name=email]').input_value()=='violettanicolaou@gmail.com' and await step.evaluate('submits')==0)
   # Bound lazy-history loading merges older messages and restores scroll position.
   history=await open_page('/chat.html');await history.evaluate("()=>{const e=document.querySelector('.history');e.style.height='50px';e.scrollTop=e.scrollHeight;let loaded=false;e.addEventListener('scroll',()=>{if(e.scrollTop===0&&!loaded){loaded=true;const m=document.createElement('div');m.className='message';m.dataset.messageId='old-0';m.dataset.sender='employer';m.textContent='Интервью в 14:00, подтвердите время';e.prepend(m);}})}")
   hist=await history.evaluate('vjaLiveChat.loadHistory(vjaLiveChat.snapshot())');check('lazy history collects older messages without duplicates',len([m for m in hist['messages'] if m['id']=='old-0'])==1 and len(hist['messages'])==3)
   check('chat scroll restored after history read',await history.locator('.history').evaluate('(el)=>Math.abs(el.scrollHeight-el.scrollTop-el.clientHeight)<4'))
   # Render the real compact action popup and verify the new rocket agent is the primary autonomous control.
   import re
   home=await ctx.new_page();nextid+=1;pages[home]=nextid;home.on('pageerror',lambda e:page_errors.append('home: '+str(e)))
   home_markup=(ROOT/'extension/home.html').read_text();await home.set_content(re.sub(r'<script src="[^"]+"></script>','',home_markup));await home.add_script_tag(content=chrome_mock)
   await home.evaluate("""()=>{chrome.tabs={query:async()=>[{id:91,url:'https://hh.ru/search/vacancy?text=.net'}],sendMessage:async()=>({pageType:'JOB_LIST'}),create:async()=>{}};chrome.permissions={contains:async()=>true,request:async()=>true};chrome.storage.session={get:async()=>({vjaAutopilotSession:{count:0}}),remove:async()=>{}};chrome.storage.sync={get:async(arg)=>{if(Array.isArray(arg))return {vjaHhBrowserSearch:true};return {apiBase:'http://127.0.0.1:8080'};},set:async()=>{}};chrome.storage.local={get:async()=>({}),set:async()=>{},remove:async()=>{}};chrome.runtime.sendMessage=async m=>m?.type==='vjaCopilot'?(m.op==='applications'?{ok:true,applications:[],analytics:null}:{ok:true}):{ok:true};window.fetch=async()=>({ok:true,text:async()=>JSON.stringify({allowed:true,autoApplyEnabled:false,remainingToday:15,autoApplyMinimumScore:80,dailyAutoApplyLimit:15,appliedToday:0,lastMessage:''})});}""")
   await home.add_script_tag(content=(ROOT/'extension/home.js').read_text());await home.wait_for_timeout(200);check('compact home popup exposes the rocket autopilot with threshold/session/day status',await home.get_by_role('button',name='🚀 Запустить автопилот',exact=True).count()==1 and 'Порог 80/100' in await home.locator('#autopilotHomeStats').inner_text() and await home.locator('#primary').is_disabled())
   # Render the actual settings with storage/Chrome APIs mocked at the boundary.
   import re
   opt=await ctx.new_page();nextid+=1;pages[opt]=nextid;opt.on('pageerror',lambda e:page_errors.append('options: '+str(e)))
   markup=(ROOT/'extension/options.html').read_text();option_scripts=re.findall(r'<script src="([^"]+)"></script>',markup)
   await opt.set_content(re.sub(r'<script src="[^"]+"></script>','',markup));await opt.evaluate("()=>window.__vjaLocation=new URL('chrome-extension://fixture/options.html')")
   await ctx.expose_binding('readFixtureStorage',lambda source:call(op='get'))
   async def write_storage(source,data):return await call(op='set',data=data)
   await ctx.expose_binding('writeFixtureStorage',write_storage)
   await opt.add_script_tag(content=chrome_mock)
   await opt.evaluate("""()=>{chrome.storage.local.get=async()=> (await readFixtureStorage()).data;chrome.storage.local.set=writeFixtureStorage;chrome.storage.sync={get:async()=>({apiBase:'http://localhost:8080'}),set:async()=>{}};chrome.runtime.openOptionsPage=async()=>{};chrome.commands={getAll:async()=>[]};chrome.tabs={create:async()=>{},query:async()=>[]};chrome.scripting={getRegisteredContentScripts:async()=>[]};window.fetch=async()=>({ok:false,status:503,json:async()=>({}),text:async()=>''});}""")
   for script in option_scripts:await opt.add_script_tag(content=(ROOT/'extension'/script).read_text())
   await opt.wait_for_timeout(250);check('actual settings loads migrated contacts',await opt.locator('#cpTelegram').input_value()=='@Violet111')
   await opt.locator('#cpPhone').fill('+70000000000');await opt.locator('#cpSave').click();await opt.get_by_text('Сохранено. Открытые чаты обновятся автоматически или после обновления страницы.', exact=True).wait_for(timeout=3000);stored=await call(op='get');check('settings saves profile and shared legacy phone memory',stored['data']['vjaCandidateTruthProfile']['contacts']['phone']=='+70000000000' and stored['data']['applicationMemory']['phone']=='+70000000000')
   check('settings removed role-specific CV section',await opt.get_by_text('CV для конкретных ролей',exact=False).count()==0)
   check('settings exposes one configurable primary quick reply',await opt.locator('#cpReplies .cpReply').count()==1)
   check('settings exposes native HH list cover-letter toggle',await opt.locator('#cpQuickListCoverLetter').count()==1 and await opt.locator('#cpQuickListCoverLetter').is_checked())
   await opt.screenshot(path=str(RESULTS/'settings.png'))
   check('no uncaught DOM JavaScript errors',not page_errors)
  finally:
   (RESULTS/'browser-e2e.json').write_text(json.dumps({'passed':passed,'count':len(passed),'pageErrors':page_errors,'boundary':'Offline Chromium DOM + actual worker JS; mocked Chrome APIs, HTTP and page URLs. MV3 load blocked by test-environment administrator policy; not certified live sites.'},ensure_ascii=False,indent=2));await browser.close();proc.terminate();await proc.wait();reader_task.cancel()
 print(f'{len(passed)} browser integration assertions passed.',flush=True)
if __name__=='__main__':asyncio.run(main())
