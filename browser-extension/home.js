'use strict';
const homeNode=id=>document.getElementById(id);
const homeRequest=(op,args={})=>chrome.runtime.sendMessage({type:'vjaCopilot',op,...args});
let homeTab=null,homePage='UNKNOWN';
let homeAutopilotStatus=null,homeAutopilotBusy=false;
const homeAutopilotDefaults={programmingOnly:true,remoteOnly:true,sessionLimit:5,searchQueries:['Junior C# .NET','Junior ASP.NET Core','Junior Backend C#','Junior Full-Stack .NET','Junior QA Automation C#','Junior Manual QA','Technical Support remote']};
async function homeApiBase(){const x=await chrome.storage.sync.get({apiBase:'http://127.0.0.1:8080'});return String(x.apiBase||'http://127.0.0.1:8080').replace(/\/$/,'');}
async function homeJson(url,options={}){const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);try{const r=await fetch(url,{...options,signal:c.signal});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`HTTP ${r.status}`));return data;}catch(e){if(c.signal.aborted)throw new Error('Локальная программа не ответила. Запустите start-assistant.cmd.');throw e;}finally{clearTimeout(timer);}}
async function homeAutopilotPrefs(){const s=await chrome.storage.sync.get(['vjaAutopilotPreferences','vjaHhBrowserSearch']);return {...homeAutopilotDefaults,...(s.vjaAutopilotPreferences||{}),browserSearch:s.vjaHhBrowserSearch!==false};}
async function homeAutopilotSession(){try{if(chrome.storage.session?.get){const x=await chrome.storage.session.get('vjaAutopilotSession');return x.vjaAutopilotSession||{count:0};}}catch{}return {count:0};}
function renderHomeAutopilot(status,prefs,session){
 const button=homeNode('rocketAutopilotHome'),state=homeNode('autopilotState'),line=homeNode('autopilotHomeStatus'),stats=homeNode('autopilotHomeStats');
 const active=Boolean(status?.autoApplyEnabled);button.textContent=active?'⏹ Остановить автопилот':'🚀 Запустить автопилот';button.classList.toggle('running',active);button.setAttribute('aria-pressed',String(active));
 state.textContent=active?'работает':'выключен';state.className=`autopilotState ${active?'on':'off'}`;
 const score=Number(status?.autoApplyMinimumScore??80),daily=Number(status?.dailyAutoApplyLimit??15),today=Number(status?.appliedToday??0),sessionCount=Number(session?.count||0),sessionLimit=Number(prefs?.sessionLimit||5);
 const message=String(status?.lastMessage||status?.browserAutopilot?.message||'').trim();
 line.textContent=active?(message||'Ищу и проверяю подходящие вакансии…'):'Запускается только после вашего нажатия. По умолчанию: удалённые IT-вакансии подходящего уровня.';
 stats.hidden=false;stats.textContent=`Порог ${score}/100 · сессия ${sessionCount}/${sessionLimit} · сегодня ${today}/${daily}`;
 button.disabled=homeAutopilotBusy||(!active&&status?.allowed===false);
}
async function refreshHomeAutopilot(){if(homeAutopilotBusy)return;try{const [prefs,session,api]=await Promise.all([homeAutopilotPrefs(),homeAutopilotSession(),homeApiBase()]);const status=await homeJson(`${api}/api/automation/status`);homeAutopilotStatus=status;renderHomeAutopilot(status,prefs,session);}catch(e){homeAutopilotStatus=null;const b=homeNode('rocketAutopilotHome'),state=homeNode('autopilotState');b.disabled=false;b.textContent='🚀 Запустить автопилот';b.classList.remove('running');state.textContent='нет связи';state.className='autopilotState error';homeNode('autopilotHomeStatus').textContent=e.message;homeNode('autopilotHomeStats').hidden=true;}}
async function toggleHomeAutopilot(){if(homeAutopilotBusy)return;homeAutopilotBusy=true;homeNode('rocketAutopilotHome').disabled=true;try{
 const api=await homeApiBase(),prefs=await homeAutopilotPrefs();let current=homeAutopilotStatus; if(!current)current=await homeJson(`${api}/api/automation/status`);const enabling=!current.autoApplyEnabled;
 if(enabling){const score=Number(current.autoApplyMinimumScore??80),daily=Number(current.dailyAutoApplyLimit??15);if(!confirm(`Запустить AI-автопилот?\n\nОн сам найдёт подходящие удалённые IT-вакансии, проверит соответствие вашему уровню/CV и будет отправлять отклики с коротким сопроводительным письмом.\n\nПорог: ${score}/100\nЛимит: ${daily} в день · ${prefs.sessionLimit} за эту сессию\n\nНепонятные обязательные поля будут оставлены на проверку.`))return;
   if(chrome.storage.session?.remove)await chrome.storage.session.remove('vjaAutopilotSession').catch(()=>{});const searchPref=await chrome.storage.sync.get('vjaHhBrowserSearch');if(searchPref.vjaHhBrowserSearch===undefined)await chrome.storage.sync.set({vjaHhBrowserSearch:true});await chrome.storage.local.remove(['vjaHhDiscoveryAt','vjaHhDiscoveryBlocked']);
 }
 await homeJson(`${api}/api/settings/autoapply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:enabling,minimumScore:Number(current.autoApplyMinimumScore??80),dailyLimit:Number(current.dailyAutoApplyLimit??15)})});
 await chrome.runtime.sendMessage({type:'vjaAutopilotControlWake'}).catch(()=>{});
 homeNode('autopilotHomeStatus').textContent=enabling?'Автопилот запущен. Начинаю поиск и проверку вакансий…':'Автопилот остановлен.';
 }catch(e){homeNode('autopilotHomeStatus').textContent=e.message;}finally{homeAutopilotBusy=false;await refreshHomeAutopilot();}}
async function inspectHome(){
 try{
  [homeTab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!homeTab?.id||!/^https?:\/\//.test(homeTab.url||''))throw new Error('Откройте вакансию, форму или переписку с работодателем.');
  homeNode('page').textContent=new URL(homeTab.url).hostname;
  const granted=await chrome.permissions.contains({origins:[new URL(homeTab.url).origin+'/*']});
  if(!granted){homeNode('enable').hidden=false;homeNode('status').textContent='Разрешите доступ только к этому сайту. Другие вкладки не читаются.';return;}
  const injected=await homeRequest('inject',{tabId:homeTab.id});if(!injected?.ok)throw new Error(injected?.error||'Обновите вкладку и повторите.');
  const r=await chrome.tabs.sendMessage(homeTab.id,{type:'vjaCopilotPage',action:'inspect'},{frameId:0});homePage=r?.pageType||'UNKNOWN';
  const names={RECRUITER_CHAT:'Переписка с работодателем',JOB_DESCRIPTION:'Вакансия',APPLICATION_FORM:'Форма отклика',JOB_LIST:'Список вакансий',UNKNOWN:'Вакансия или форма пока не найдена',COMPANY_PAGE:'Страница компании',INTERVIEW_PAGE:'Страница собеседования'};
  homeNode('status').textContent=names[homePage]||names.UNKNOWN;
  homeNode('primary').textContent=homePage==='RECRUITER_CHAT'?'✎ AI':homePage==='APPLICATION_FORM'?'✦ Fill':'✦ Apply';
  homeNode('primary').disabled=!['RECRUITER_CHAT','JOB_DESCRIPTION','APPLICATION_FORM'].includes(homePage);
  homeNode('enable').hidden=true;
 }catch(e){homeNode('status').textContent=e.message;}
}
homeNode('enable').addEventListener('click',async()=>{
 try{
  // Must happen directly within this explicit click to retain browser user activation.
  const origin=new URL(homeTab.url).origin;
  if(!await chrome.permissions.request({origins:[origin+'/*']})){homeNode('status').textContent='Доступ не выдан. На сайте ничего не изменено.';return;}
  const r=await homeRequest('register-origin',{origin});if(!r.ok)throw new Error(r.error);await inspectHome();
 }catch(e){homeNode('status').textContent=e.message;}
});
homeNode('primary').addEventListener('click',async()=>{
 homeNode('primary').disabled=true;
 try{
  const action=homePage==='RECRUITER_CHAT'?'ai':homePage==='JOB_DESCRIPTION'?'auto-apply':'prepare';
  await chrome.tabs.sendMessage(homeTab.id,{type:'vjaCopilotPage',action},{frameId:0});
  window.close();
 }catch{homeNode('status').textContent='Обновите страницу и повторите.';homeNode('primary').disabled=false;}
});
for(const id of ['settings','privacy'])homeNode(id).addEventListener('click',()=>chrome.runtime.openOptionsPage());
homeNode('rocketAutopilotHome').addEventListener('click',()=>void toggleHomeAutopilot());
homeNode('autopilotSettings').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('popup.html')+(homeTab?.id?'?tab='+homeTab.id:'')}));
homeNode('advanced').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('popup.html')+(homeTab?.id?'?tab='+homeTab.id:'')}));
homeNode('shortcuts').addEventListener('click',()=>chrome.tabs.create({url:'chrome://extensions/shortcuts'}));
function actionDate(ms){const d=new Date(Number(ms)||0);return Number.isNaN(d.getTime())?'':d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function renderAnalytics(summary){
 const box=homeNode('cvAnalytics');box.replaceChildren();if(!summary){box.textContent='Статистика пока недоступна.';return;}
 const section=(title,items)=>{const h=document.createElement('div');h.className='metricSection';h.textContent=title;box.append(h);for(const item of (items||[]).slice(0,4)){const card=document.createElement('div');card.className='metricCard';const strong=document.createElement('strong');strong.textContent=item.label;const span=document.createElement('span');span.textContent=`Отклики: ${item.applications} · ответы: ${item.response} · интервью: ${item.interview} · офферы: ${item.offer}${item.applied>=3?` · ответ ${item.responseRate}%`:''}`;card.append(strong,span);box.append(card);}};
 section('По CV',summary.cvs);section('По направлениям',summary.roles);
}
async function loadApplications(){
 const r=await homeRequest('applications');if(!r?.ok)return;
 const container=homeNode('applications');container.replaceChildren();const apps=r.applications||[];
 const titles={'Preparing':'Подготовка','Ready':'Готово к проверке','Needs review':'Нужна проверка','Applied':'Отправлено','Viewed':'Просмотрено','Recruiter Replied':'Есть ответ','HR Interview':'HR-интервью','Technical Interview':'Техническое интервью','Test Assignment':'Тестовое задание','Offer':'Оффер','Rejected':'Отказ','Closed':'Закрыто'};
 const stageLabels={application_review:'Рассмотрение отклика',experience_question:'Вопрос об опыте',technical_question:'Технический вопрос',availability:'Дата выхода / доступность',salary:'Условия',interview_scheduling:'Назначение интервью',test_assignment:'Тестовое задание',offer:'Предложение',rejection:'Отказ'};
 const due=apps.filter(a=>a.nextAction&&!a.nextAction.doneAt&&!a.nextAction.dismissedAt&&Number(a.nextAction.dueAt)<=Date.now()&&!['Offer','Rejected','Closed'].includes(a.status));
 const dueSummary=homeNode('dueSummary');dueSummary.hidden=!due.length;dueSummary.textContent=due.length?`⏰ Требуют внимания: ${due.length}. Откройте «Мои отклики», чтобы отметить действие или отложить напоминание.`:'';
 for(const a of apps.slice().reverse().slice(0,80)){
  const row=document.createElement('div');row.className='application';const link=document.createElement('a');link.textContent=a.title;link.href=/^https?:\/\//.test(a.url)?a.url:'#';link.target='_blank';link.rel='noopener noreferrer';const company=document.createElement('small');company.textContent=a.company;
  const select=document.createElement('select');select.setAttribute('aria-label','Статус отклика: '+a.title);
  for(const [value,label] of Object.entries(titles)){const o=document.createElement('option');o.value=value;o.textContent=label;o.selected=value===a.status;o.disabled=['Preparing','Ready','Needs review'].includes(value);select.append(o);}
  select.addEventListener('change',async()=>{const rr=await homeRequest('mark-status',{id:a.id,status:select.value});if(!rr.ok){homeNode('status').textContent=rr.error;select.value=a.status;}else{a.status=select.value;void loadApplications();}});row.append(link,company,select);
  if(a.detectedStage&&stageLabels[a.detectedStage]){const stage=document.createElement('span');stage.className='stageHint';stage.textContent='В чате: '+stageLabels[a.detectedStage];row.append(stage);}
  const next=a.nextAction&&!a.nextAction.doneAt&&!a.nextAction.dismissedAt?a.nextAction:null;
  if(next){
   const card=document.createElement('div');card.className='nextAction';const strong=document.createElement('strong');const isDue=Number(next.dueAt)<=Date.now();strong.textContent=`${isDue?'⏰ ':''}${next.label||'Следующее действие'}`;const when=document.createElement('small');when.textContent=`${isDue?'Срок прошёл':'До'}: ${actionDate(next.dueAt)}`;const acts=document.createElement('div');acts.className='miniActions';const done=document.createElement('button');done.textContent='Готово';done.addEventListener('click',async()=>{await homeRequest('next-action',{id:a.id,mode:'done'});void loadApplications();});const later=document.createElement('button');later.textContent='+1 день';later.addEventListener('click',async()=>{await homeRequest('next-action',{id:a.id,mode:'snooze',days:1});void loadApplications();});acts.append(done,later);card.append(strong,when,acts);row.append(card);
  }else if(['Applied','Viewed','Recruiter Replied'].includes(a.status)){
   const acts=document.createElement('div');acts.className='miniActions';const remind=document.createElement('button');remind.textContent='Напомнить через 3 раб. дня';remind.addEventListener('click',async()=>{await homeRequest('set-followup',{id:a.id,days:3});void loadApplications();});acts.append(remind);row.append(acts);
  }
  if(a.coverLetterMemory?.text||a.coverLetter){const memory=document.createElement('details');memory.className='timeline coverMemory';const summary=document.createElement('summary');summary.textContent=`Письмо · ${a.cvName||a.coverLetterMemory?.cvName||'CV сохранено'}`;const body=document.createElement('div');body.className='timelineItem coverText';body.textContent=a.coverLetterMemory?.submittedText||a.coverLetterMemory?.text||a.coverLetter||'';memory.append(summary,body);row.append(memory);}
  const timeline=Array.isArray(a.timeline)?a.timeline:[];if(timeline.length){const details=document.createElement('details');details.className='timeline';const summary=document.createElement('summary');summary.textContent=`История · ${timeline.length}`;details.append(summary);for(const event of timeline.slice().reverse().slice(0,8)){const item=document.createElement('div');item.className='timelineItem';const when=new Date(Number(event.at)||0);item.textContent=`${Number.isNaN(when.getTime())?'':when.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' · '}${event.label||event.type||'Событие'}`;details.append(item);}row.append(details);}
  container.append(row);
 }
 if(!apps.length)container.textContent='Пока нет подготовленных откликов.';
 const t=r.analytics?.total;homeNode('analytics').textContent=t?`Воронка: отправлено ${t.applied} · ответы ${t.response} · интервью ${t.interview} · тестовые ${t.test} · офферы ${t.offer}. Данные основаны на сохранённых статусах и истории.`:`Всего в реестре: ${apps.length}.`;
 renderAnalytics(r.analytics);
}
void inspectHome();void loadApplications().catch(()=>{});void refreshHomeAutopilot();setInterval(()=>void refreshHomeAutopilot(),4000);
