/* HH search-list quick apply: native Apply or the inline Violetta button sends the exact card with a tailored cover letter. */
(function(root){
  'use strict';
  let __vjaHost='';try{__vjaHost=new URL(location.href).hostname}catch{}
  const H=root.vjaHhListQuickApply,U=root.vjaCopilotUI,A=root.vjaSiteAdapters;
  if(root.vjaHhListQuickApplyRuntime||window.top!==window||!H?.isSupportedHost?.(location.href))return;
  if(!H)return;
  const request=(op,args={})=>chrome.runtime.sendMessage({type:'vjaCopilot',op,...args});
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const active=new Set();
  const pinnedByCard=new WeakMap();
  let selected=null;
  const BUTTON_CLASS='vja-card-fast-apply';
  const CARD_CLASS='vja-card-selected';
  let settingsCache={quickListCoverLetter:true};
  let settingsPromise=request('bootstrap').then(x=>{settingsCache=x?.settings||{};return settingsCache;}).catch(()=>settingsCache);
  const visible=el=>{if(!el||!el.isConnected||el.disabled||el.getAttribute?.('aria-disabled')==='true')return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const text=el=>String(el?.innerText||el?.textContent||el?.value||el?.getAttribute?.('aria-label')||'').replace(/\s+/g,' ').trim();
  function isListPage(){try{return A?.make(document,location.href).detectPageType()==='JOB_LIST'||/(?:search\/vacancy|vacancies|jobs|vacancy\/search)/i.test(location.pathname+location.search);}catch{return /vacanc/i.test(location.pathname);}}
  async function enabled(){const settings=await settingsPromise;return settings.quickListCoverLetter!==false;}
  function installStyle(){
    if(document.getElementById('vja-card-fast-style'))return;
    const style=document.createElement('style');style.id='vja-card-fast-style';style.textContent=`
      .${BUTTON_CLASS}{margin-inline-start:8px!important;border:1px solid #d9d0fb!important;border-radius:11px!important;background:#f5f2ff!important;color:#5b47b7!important;padding:8px 11px!important;font:600 12px/1.15 system-ui,sans-serif!important;cursor:pointer!important;white-space:nowrap!important;box-shadow:none!important}
      .${BUTTON_CLASS}:hover{background:#ece6ff!important;border-color:#b9aaf6!important}
      .${BUTTON_CLASS}[data-state="working"]{background:#6554bd!important;color:white!important;border-color:#6554bd!important}
      .${BUTTON_CLASS}[data-state="done"]{background:#e9f8ef!important;color:#17633a!important;border-color:#b8e4c8!important}
      .${BUTTON_CLASS}[data-state="error"]{background:#fff2f1!important;color:#9f2e28!important;border-color:#efc9c5!important}
      .${CARD_CLASS}{outline:3px solid #9b87f5!important;outline-offset:2px!important;box-shadow:0 0 0 5px rgba(155,135,245,.10)!important}
      .${CARD_CLASS}[data-vja-state="done"]{outline-color:#72c58f!important;box-shadow:0 0 0 5px rgba(114,197,143,.10)!important}
      .${CARD_CLASS}[data-vja-state="error"]{outline-color:#e59a91!important;box-shadow:0 0 0 5px rgba(229,154,145,.10)!important}
    `;document.documentElement.append(style);
  }
  function vacancyLinks(card){
    if(!card)return [];
    const links=[...card.querySelectorAll('a[href*="/vacancy/"]')].map(a=>({a,id:H.vacancyIdFromUrl(a.href),meta:String(a.getAttribute('data-qa')||'')+' '+String(a.className||''),label:text(a)})).filter(x=>x.id);
    const seen=new Set();return links.filter(x=>{const key=x.id+'|'+x.a.href;if(seen.has(key))return false;seen.add(key);return true;});
  }
  function nativeApplyIn(node){return [...node.querySelectorAll?.('button,a,[role="button"]')||[]].filter(visible).some(x=>!x.classList.contains(BUTTON_CLASS)&&H.isApplyLabel(text(x)));}
  function cardFor(el){
    const exact=el?.closest?.('[data-qa="vacancy-serp__vacancy"],[data-vacancy-id],[class*="vacancy-card"],[class*="serp-item"]');
    if(exact){const ids=new Set(vacancyLinks(exact).map(x=>x.id));if(ids.size===1&&nativeApplyIn(exact))return exact;}
    let node=el;
    for(let depth=0;node&&depth<10;depth++,node=node.parentElement){
      const ids=new Set(vacancyLinks(node).map(x=>x.id));
      if(ids.size===1&&nativeApplyIn(node))return node;
    }
    return null;
  }
  function vacancyLink(card){
    const links=vacancyLinks(card);if(!links.length)return null;
    const strong=links.filter(x=>/serp-item__title|vacancy.*title/i.test(x.meta));
    if(strong.length===1)return strong[0].a;
    const nonEmpty=links.filter(x=>x.label&&!H.isSuspiciousVacancyTitle(x.label));
    const ids=[...new Set(links.map(x=>x.id))];
    if(ids.length!==1)return null;
    return (nonEmpty[0]||links[0]).a;
  }
  function extractVacancy(card){
    const link=vacancyLink(card);if(!link)return null;
    const url=new URL(link.href,location.href).href,vacancyId=H.vacancyIdFromUrl(url);if(!vacancyId)return null;
    const titleCandidates=[
      text(card.querySelector('[data-qa="serp-item__title"]')),
      text(card.querySelector('[data-qa*="vacancy-title"]')),
      text(card.querySelector('h2 a[href*="/vacancy/"],h3 a[href*="/vacancy/"]')),
      text(link)
    ].filter(Boolean);
    const title=titleCandidates.find(x=>!H.isSuspiciousVacancyTitle(x))||'';
    if(!title)return null;
    const ids=[...new Set(vacancyLinks(card).map(x=>x.id))];if(ids.length!==1||ids[0]!==vacancyId)return null;
    const company=text(card.querySelector('[data-qa="vacancy-serp__vacancy-employer"],[data-qa*="vacancy-employer"],[class*="company"]'));
    const locationText=text(card.querySelector('[data-qa="vacancy-serp__vacancy-address"],[data-qa*="vacancy-address"],[class*="location"]'));
    const clone=card.cloneNode(true);clone.querySelectorAll?.('.'+BUTTON_CLASS+',script,style').forEach?.(x=>x.remove());
    const cardText=text(clone).slice(0,7000);
    return {provider:'hh',url,vacancyId,title,company,location:locationText,description:cardText,descriptionCoverage:'snippet',requirements:'',remote:/удал[её]н|remote/i.test(cardText),selectedFromList:true};
  }
  function findCard(vacancyId,fallback){
    if(fallback?.isConnected&&H.vacancyIdFromUrl(vacancyLink(fallback)?.href)===vacancyId)return fallback;
    for(const a of document.querySelectorAll('a[href*="/vacancy/"]'))if(H.vacancyIdFromUrl(a.href)===vacancyId){const c=cardFor(a);if(c)return c;}
    return null;
  }
  function nativeApplyButton(card){
    if(!card)return null;
    const items=[...card.querySelectorAll('button,a,[role="button"]')].filter(visible).filter(el=>!el.classList.contains(BUTTON_CLASS)&&H.isApplyLabel(text(el)));
    return items.length===1?items[0]:items.find(el=>/vacancy-response|respond/i.test(String(el.getAttribute('data-qa')||'')+' '+String(el.getAttribute('href')||'')))||items[0]||null;
  }
  function markCard(card,state='working'){
    if(!card)return;card.classList.add(CARD_CLASS);card.dataset.vjaState=state;
  }
  function clearOtherCards(current){
    for(const card of document.querySelectorAll('.'+CARD_CLASS))if(card!==current&&card.dataset.vjaState!=='done'){card.classList.remove(CARD_CLASS);delete card.dataset.vjaState;}
  }
  function letterAction(card){
    const local=card?[...card.querySelectorAll('button,a,[role="button"]')].filter(visible).filter(el=>H.isLetterActionLabel(text(el))):[];
    if(local.length===1)return local[0];
    const global=[...document.querySelectorAll('button,a,[role="button"]')].filter(visible).filter(el=>H.isLetterActionLabel(text(el)));
    return global.length===1?global[0]:null;
  }
  function applied(card){return Boolean(card&&(H.isAppliedText(text(card))||letterAction(card)));}
  async function waitForApplied(vacancyId,card,timeout=14000){
    const started=Date.now();let current=card;
    while(Date.now()-started<timeout){current=findCard(vacancyId,current);if(applied(current))return current;await wait(250);}return null;
  }
  async function waitForLetterAction(vacancyId,card,timeout=9000){
    const started=Date.now();let current=card;
    while(Date.now()-started<timeout){current=findCard(vacancyId,current);const action=letterAction(current);if(action)return {action,card:current};await wait(220);}return null;
  }
  function coverLetterContainers(){
    const selector='[role="dialog"],dialog,[data-qa*="modal" i],[data-qa*="popup" i],[class*="bloko-modal"],[class*="modal" i],[class*="popup" i],[class*="overlay" i]';
    return [...new Set([...document.querySelectorAll(selector)].filter(visible))];
  }
  function visibleCoverLetterField(scope=document){
    const preferred=typeof root.vjaSiteCoverLetterField==='function'?root.vjaSiteCoverLetterField(scope):null;
    if(preferred&&visible(preferred))return preferred;
    const fields=[...scope.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"]')].filter(visible);
    return fields.find(f=>/сопровод|почему|кандидатур|работодател|cover.?letter/i.test(text(f)+' '+String(f.getAttribute('placeholder')||'')+' '+String(f.getAttribute('aria-label')||'')))||(fields.length===1?fields[0]:null);
  }
  function findLetterUi(){
    const containers=coverLetterContainers();
    for(const container of containers){
      const field=visibleCoverLetterField(container);
      if(field&&(/сопроводительное письмо/i.test(text(container))||/сопровод|почему|кандидатур|работодател|cover.?letter/i.test(String(field.getAttribute('placeholder')||'')+' '+String(field.getAttribute('aria-label')||''))))return {container,field};
    }
    const fields=[...document.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"]')].filter(visible).filter(f=>/сопровод|почему|кандидатур|работодател|cover.?letter/i.test(String(f.getAttribute('placeholder')||'')+' '+String(f.getAttribute('aria-label')||'')));
    if(fields.length===1){
      let container=fields[0].parentElement;
      for(let i=0;container&&i<7;i++,container=container.parentElement){
        if(/сопроводительное письмо/i.test(text(container))||[...container.querySelectorAll('button,[role="button"],input[type="submit"]')].some(b=>H.isSendLetterLabel(text(b))||H.isInitialSubmitLabel(text(b))))return {container,field:fields[0]};
      }
    }
    return null;
  }
  async function waitForLetterUi(timeout=9000){const started=Date.now();while(Date.now()-started<timeout){const ui=findLetterUi();if(ui)return ui;await wait(160);}return null;}
  async function waitForFirstStage(vacancyId,card,timeout=14000){
    const started=Date.now();let current=card;
    while(Date.now()-started<timeout){
      const ui=findLetterUi();if(ui)return {kind:'initial-letter',ui,card:current};
      current=findCard(vacancyId,current);if(applied(current))return {kind:'applied',card:current};
      await wait(160);
    }
    return {kind:'unknown',card:current};
  }
  async function setLetter(field,letter){
    if(typeof root.vjaSiteSetTextVerified==='function'){const ok=await root.vjaSiteSetTextVerified(field,letter);if(ok)return true;}
    field.focus();
    if(field instanceof HTMLTextAreaElement||field instanceof HTMLInputElement){
      const proto=field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(field,letter);else field.value=letter;
    }else field.textContent=letter;
    try{field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:letter}));}catch{field.dispatchEvent(new Event('input',{bubbles:true}));}
    field.dispatchEvent(new Event('change',{bubbles:true}));
    const current=String(field.isContentEditable?field.innerText:field.value||'').trim();
    return current===String(letter||'').trim();
  }
  function sendButton(container){
    const items=[...container.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible).map(el=>({el,label:text(el),visible:true,disabled:Boolean(el.disabled)}));
    return H.chooseSendCandidate(items).candidate?.el||null;
  }
  function initialSubmitButton(container){
    const items=[...container.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible).map(el=>({el,label:text(el),visible:true,disabled:Boolean(el.disabled)}));
    return H.chooseInitialSubmitCandidate(items).candidate?.el||null;
  }
  function toast(message,anchor,kind='neutral',ms=3800){try{return U?.toast?.(message,anchor,kind,ms);}catch{return null;}}
  async function preparedLetter(preparedPromise){
    const prepared=await preparedPromise;if(!prepared||prepared?.ok===false)throw new Error(prepared?.error||'Не удалось подготовить письмо.');
    const letter=String(prepared.coverLetter||prepared.application?.coverLetter||'').trim();if(!letter)throw new Error('Сопроводительное письмо не создано.');
    return {prepared,letter};
  }
  async function completePrepared(prepared){if(prepared?.application?.id)await request('quick-list-complete',{id:prepared.application.id,appliedConfirmed:true,coverLetterSubmitted:true}).catch(()=>{});}
  async function submitInitialLetter(stage,vacancy,preparedPromise,anchor){
    const {prepared,letter}=await preparedLetter(preparedPromise);
    if(!await setLetter(stage.ui.field,letter))throw new Error('Не удалось надёжно заполнить обязательное сопроводительное письмо.');
    const submit=initialSubmitButton(stage.ui.container);if(!submit)throw new Error('Письмо заполнено, но кнопка «Откликнуться» в форме не определена однозначно.');
    submit.scrollIntoView?.({block:'center'});submit.click();
    const appliedCard=await waitForApplied(vacancy.vacancyId,stage.card,16000);
    if(!appliedCard)throw new Error('Письмо заполнено и отклик отправлялся, но HH не подтвердил результат.');
    await completePrepared(prepared);toast('✓ Отклик + сопроводительное письмо отправлены',anchor,'ok',4500);return appliedCard;
  }
  async function appendLetterAfterApplied(appliedCard,vacancy,preparedPromise,anchor){
    const {prepared,letter}=await preparedLetter(preparedPromise);
    const found=await waitForLetterAction(vacancy.vacancyId,appliedCard,12000);
    if(!found)throw new Error('Отклик отправлен, но HH не показал действие «Приложить письмо».');
    found.action.scrollIntoView?.({block:'center'});found.action.click();
    const ui=await waitForLetterUi(10000);if(!ui)throw new Error('Отклик отправлен, но редактор сопроводительного письма не найден.');
    if(!await setLetter(ui.field,letter))throw new Error('Не удалось надёжно вставить сопроводительное письмо.');
    const send=sendButton(ui.container);if(!send)throw new Error('Письмо заполнено, но кнопка «Отправить» не определена однозначно.');
    send.scrollIntoView?.({block:'center'});send.click();
    let confirmed=false;
    for(let i=0;i<50;i++){
      await wait(160);
      const success=/письм[оа].{0,30}(?:отправлен|добавлен|приложен)|сопроводительное.{0,30}(?:отправлен|добавлен|приложен)/i.test(text(document.body));
      const actionGone=!letterAction(findCard(vacancy.vacancyId,appliedCard));
      if(!ui.field.isConnected||!visible(ui.field)||success||actionGone){confirmed=true;break;}
    }
    if(!confirmed)throw new Error('Письмо отправлялось, но HH не подтвердил результат. Проверьте окно письма вручную.');
    await completePrepared(prepared);toast('✓ Отклик + сопроводительное письмо отправлены',anchor,'ok',4500);return found.card;
  }
  async function run(nativeButton,initialCard,vacancy,preparePromise,options={}){
    if(!vacancy?.title||!vacancy.vacancyId)return false;
    if(active.has(vacancy.vacancyId)||!await enabled())return false;
    active.add(vacancy.vacancyId);let note=null;
    const card=findCard(vacancy.vacancyId,initialCard)||initialCard;
    markCard(card,'working');clearOtherCards(card);
    if(options.control){options.control.dataset.state='working';options.control.textContent='✦ Отправляю…';options.control.disabled=true;}
    try{
      note=toast('Анализирую выбранную вакансию и готовлю письмо…',nativeButton||options.control);
      const preparedPromise=preparePromise||request('quick-list-prepare',{vacancy});
      const stage=await waitForFirstStage(vacancy.vacancyId,card,16000);
      note?.remove?.();
      if(stage.kind==='initial-letter'){
        note=toast('Заполняю обязательное сопроводительное письмо…',nativeButton||options.control);
        await submitInitialLetter(stage,vacancy,preparedPromise,nativeButton||options.control);
      }else if(stage.kind==='applied'){
        note=toast('Отклик отправлен. Добавляю сопроводительное письмо…',nativeButton||options.control);
        await appendLetterAfterApplied(stage.card,vacancy,preparedPromise,nativeButton||options.control);
      }else{
        throw new Error('HH открыл другой сценарий отклика. Нужна проверка текущей формы.');
      }
      note?.remove?.();markCard(findCard(vacancy.vacancyId,card)||card,'done');
      if(options.control){options.control.dataset.state='done';options.control.textContent='✓ Отклик + письмо';options.control.disabled=true;}
      return true;
    }catch(e){
      note?.remove?.();markCard(findCard(vacancy.vacancyId,card)||card,'error');
      if(options.control){options.control.dataset.state='error';options.control.textContent='! Повторить';options.control.disabled=false;}
      toast(e?.message||'Не удалось автоматически отправить отклик с письмом.',nativeButton||options.control,'bad',7000);return false;
    }finally{active.delete(vacancy.vacancyId);}
  }
  async function quickApplyCard(card,control){
    if(!card||!await enabled())return;
    const vacancy=pinnedByCard.get(card)||extractVacancy(card),native=nativeApplyButton(card);if(!vacancy||!native){toast('Не удалось однозначно определить именно эту карточку вакансии.',control,'bad',5200);return;}
    selected={vacancy,card,at:Date.now()};pinnedByCard.set(card,vacancy);card.dataset.vjaVacancyId=vacancy.vacancyId;
    clearOtherCards(card);markCard(card,'working');
    const preparePromise=request('quick-list-prepare',{vacancy});
    native.scrollIntoView?.({block:'center'});
    native.click();
    await run(native,card,vacancy,preparePromise,{control});
  }
  function ensureCardButton(card){
    if(!card||card.querySelector('.'+BUTTON_CLASS)||applied(card))return;
    const native=nativeApplyButton(card),vacancy=extractVacancy(card);if(!native||!vacancy)return;
    pinnedByCard.set(card,vacancy);card.dataset.vjaVacancyId=vacancy.vacancyId;
    const btn=document.createElement('button');btn.type='button';btn.className=BUTTON_CLASS;btn.textContent='✦ Отклик + письмо';btn.title='Выбрать эту вакансию и отправить отклик с индивидуальным сопроводительным письмом';
    btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void quickApplyCard(card,btn);});
    const holder=native.parentElement||card;try{native.insertAdjacentElement('afterend',btn);}catch{holder.append(btn);}
  }
  function scanCards(){
    if(!isListPage())return;
    installStyle();
    const candidates=new Set();
    for(const link of document.querySelectorAll('a[href*="/vacancy/"]')){const card=cardFor(link);if(card)candidates.add(card);}
    for(const native of document.querySelectorAll('button,a,[role="button"]'))if(visible(native)&&H.isApplyLabel(text(native))){const card=cardFor(native);if(card)candidates.add(card);}
    for(const card of candidates)ensureCardButton(card);
  }
  document.addEventListener('click',event=>{
    if(!event.isTrusted||!isListPage())return;
    const target=event.target instanceof Element?event.target.closest('button,a,[role="button"]'):null;
    if(!target||target.classList.contains(BUTTON_CLASS)||!visible(target)||!H.isApplyLabel(text(target)))return;
    const card=cardFor(target),vacancy=card?(pinnedByCard.get(card)||extractVacancy(card)):null;if(!card||!vacancy)return;
    selected={vacancy,card,at:Date.now()};pinnedByCard.set(card,vacancy);card.dataset.vjaVacancyId=vacancy.vacancyId;
    if(settingsCache.quickListCoverLetter===false)return;
    clearOtherCards(card);markCard(card,'working');
    const preparePromise=request('quick-list-prepare',{vacancy});
    setTimeout(()=>void run(target,card,vacancy,preparePromise),0);
  },true);
  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(scanCards,90);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('popstate',()=>setTimeout(scanCards,80));
  addEventListener('pageshow',()=>setTimeout(scanCards,80));
  scanCards();setTimeout(scanCards,600);setTimeout(scanCards,1800);
  root.vjaHhListQuickApplyRuntime={extractVacancy,run,findCard,scanCards,quickApplyCard,selectedVacancy:()=>selected?.vacancy||null,selectedCard:()=>selected?.card?.isConnected?selected.card:null};
})(globalThis);
