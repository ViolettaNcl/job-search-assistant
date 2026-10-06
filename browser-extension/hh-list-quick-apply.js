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
  const analysisActive=new Set();
  const statePromises=new Map();
  const pinnedByCard=new WeakMap();
  let selected=null;
  const BUTTON_CLASS='vja-card-fast-apply';
  const ANALYSIS_CLASS='vja-card-call-analysis';
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
      .${BUTTON_CLASS}[data-state="review"]{background:#fff8e7!important;color:#7a5914!important;border-color:#ecd18d!important}
      .${ANALYSIS_CLASS}{margin-inline-start:8px!important;border:1px solid #d7dbe6!important;border-radius:11px!important;background:#fff!important;color:#30394d!important;padding:8px 11px!important;font:600 12px/1.15 system-ui,sans-serif!important;cursor:pointer!important;white-space:nowrap!important;box-shadow:none!important}
      .${ANALYSIS_CLASS}:hover{background:#f6f8fc!important;border-color:#b9c0cf!important}
      .${ANALYSIS_CLASS}[data-state="working"]{background:#eef2f8!important;color:#44506a!important;border-color:#c4ccd9!important}
      .${ANALYSIS_CLASS}[data-state="no-calls"]{background:#e9f8ef!important;color:#17633a!important;border-color:#9ed8b4!important}
      .${ANALYSIS_CLASS}[data-state="calls"]{background:#fff0ef!important;color:#a22822!important;border-color:#eba8a2!important}
      .${ANALYSIS_CLASS}[data-state="unknown"]{background:#fff8e7!important;color:#7a5914!important;border-color:#ecd18d!important}
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
    if(exact){const ids=new Set(vacancyLinks(exact).map(x=>x.id));if(ids.size===1)return exact;}
    let node=el;
    for(let depth=0;node&&depth<10;depth++,node=node.parentElement){
      const ids=new Set(vacancyLinks(node).map(x=>x.id));
      if(ids.size===1&&(nativeApplyIn(node)||H.isAppliedText(text(node))))return node;
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
    const clone=card.cloneNode(true);clone.querySelectorAll?.('.'+BUTTON_CLASS+',.'+ANALYSIS_CLASS+',script,style').forEach?.(x=>x.remove());
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
    if(typeof root.vjaSiteSetTextVerified==='function'){const ok=await root.vjaSiteSetTextVerified(field,letter);if(ok){field.dispatchEvent(new Event('blur',{bubbles:true}));await wait(80);return true;}}
    field.focus();
    if(field instanceof HTMLTextAreaElement||field instanceof HTMLInputElement){
      const proto=field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(field,letter);else field.value=letter;
    }else field.textContent=letter;
    try{field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:letter}));}catch{field.dispatchEvent(new Event('input',{bubbles:true}));}
    field.dispatchEvent(new Event('change',{bubbles:true}));
    field.dispatchEvent(new Event('blur',{bubbles:true}));
    await wait(90);
    const current=String(field.isContentEditable?field.innerText:field.value||'').trim();
    return current===String(letter||'').trim();
  }
  function actionScopes(container){
    const scopes=[];let node=container;
    for(let depth=0;node&&depth<6;depth++,node=node.parentElement){if(!scopes.includes(node))scopes.push(node);if(node.matches?.('[role="dialog"],dialog,[class*="overlay" i],[data-qa*="modal" i]'))break;}
    return scopes;
  }
  function chooseAction(container,chooser){
    for(const scope of actionScopes(container)){
      const items=[...scope.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible).map(el=>({el,label:text(el),visible:true,disabled:Boolean(el.disabled)||el.getAttribute?.('aria-disabled')==='true'}));
      const candidate=chooser(items).candidate?.el;if(candidate)return candidate;
    }
    const global=[...document.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible).map(el=>({el,label:text(el),visible:true,disabled:Boolean(el.disabled)||el.getAttribute?.('aria-disabled')==='true'}));
    return chooser(global).candidate?.el||null;
  }
  function sendButton(container){return chooseAction(container,H.chooseSendCandidate);}
  function initialSubmitButton(container){return chooseAction(container,H.chooseInitialSubmitCandidate);}
  async function waitForActionButton(container,kind='send',timeout=5000){
    const started=Date.now(),getter=kind==='initial'?initialSubmitButton:sendButton;
    while(Date.now()-started<timeout){const button=getter(container);if(button)return button;await wait(100);}return null;
  }
  function closeButton(container){
    if(!container)return null;
    const items=[...container.querySelectorAll('button,input[type="button"],[role="button"]')].filter(visible).map(el=>({el,label:text(el),visible:true,disabled:Boolean(el.disabled)}));
    return H.chooseCloseCandidate(items).candidate?.el||null;
  }
  function employerAlreadyViewedUi(preferredContainer=null){
    const containers=[];if(preferredContainer?.isConnected&&visible(preferredContainer))containers.push(preferredContainer);
    for(const container of coverLetterContainers())if(!containers.includes(container))containers.push(container);
    for(const container of containers){if(!H.isEmployerAlreadyViewedText(text(container)))continue;const close=closeButton(container);if(close)return {container,close};}
    return null;
  }
  async function closeEmployerAlreadyViewed(preferredContainer=null,timeout=5500){
    const started=Date.now();
    while(Date.now()-started<timeout){
      const found=employerAlreadyViewedUi(preferredContainer);
      if(found){found.close.scrollIntoView?.({block:'center'});found.close.click();for(let i=0;i<15;i++){await wait(100);if(!found.container.isConnected||!visible(found.container))break;}return true;}
      await wait(120);
    }
    return false;
  }
  function currentLetterValue(field){return String(field?.isContentEditable?field.innerText:field?.value||'').trim();}
  function coverLetterSubmitState(ui,vacancyId,appliedCard){
    const refreshed=findLetterUi();
    const activeUi=refreshed||ui||null;
    const container=activeUi?.container||ui?.container||null;
    const field=activeUi?.field||ui?.field||null;
    const card=findCard(vacancyId,appliedCard)||appliedCard||null;
    const containerOpen=Boolean(container&&container.isConnected&&visible(container));
    const fieldOpen=Boolean(field&&field.isConnected&&visible(field));
    const successPattern=/письм[оа].{0,36}(?:отправлен|добавлен|приложен)|сопроводительное.{0,36}(?:отправлен|добавлен|приложен)|cover\s+letter.{0,36}(?:sent|submitted|attached)/i;
    // Never trust a page-wide success label: a search page can contain the same
    // text for another vacancy. Confirmation must belong to the active modal or
    // to the exact vacancy card after the modal has closed.
    const modalSuccess=Boolean(containerOpen&&!fieldOpen&&successPattern.test(text(container)));
    const cardSuccess=Boolean(!containerOpen&&!fieldOpen&&card&&successPattern.test(text(card)));
    const originalContainer=ui?.container||container;
    const containerClosed=Boolean(originalContainer&&(!originalContainer.isConnected||!visible(originalContainer))&&!refreshed);
    const noUi=Boolean(!refreshed&&!containerOpen&&!fieldOpen);
    const success=modalSuccess||cardSuccess;
    return {confirmed:Boolean(success||containerClosed||noUi),success,modalSuccess,cardSuccess,containerClosed,containerOpen,fieldOpen,ui:activeUi,field,card};
  }
  async function waitForCoverLetterSubmitState(ui,vacancyId,appliedCard,timeout=2800){
    const started=Date.now();let state=coverLetterSubmitState(ui,vacancyId,appliedCard);
    while(Date.now()-started<timeout){
      const viewed=employerAlreadyViewedUi(state.ui?.container||ui?.container||null);
      if(viewed)return {...state,alreadyViewed:true};
      state=coverLetterSubmitState(state.ui||ui,vacancyId,state.card||appliedCard);
      if(state.confirmed)return state;
      await wait(180);
    }
    return coverLetterSubmitState(state.ui||ui,vacancyId,state.card||appliedCard);
  }
  async function clickCoverLetterSendUntilClosed(ui,vacancy,appliedCard,letter,{maxAttempts=6}={}){
    let currentUi=ui,lastReason='cover-letter-modal-still-open',attempts=0;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      attempts=attempt;
      const before=coverLetterSubmitState(currentUi,vacancy.vacancyId,appliedCard);
      currentUi=before.ui||currentUi;
      if(before.confirmed)return {...before,attempts};
      if(before.field&&visible(before.field)&&currentLetterValue(before.field)!==String(letter||'').trim()){
        if(!await setLetter(before.field,letter))return {...before,confirmed:false,attempts,reason:'cover-letter-not-persisted-before-retry'};
      }
      const send=await waitForActionButton(currentUi?.container||ui.container,'send',attempt===1?5000:3500);
      if(!send){
        const settled=await waitForCoverLetterSubmitState(currentUi,vacancy.vacancyId,appliedCard,900);
        currentUi=settled.ui||currentUi;
        if(settled.confirmed||settled.alreadyViewed)return {...settled,attempts};
        lastReason='cover-letter-send-not-found';
        if(attempt<maxAttempts)await wait(350+attempt*180);
        continue;
      }
      send.scrollIntoView?.({block:'center'});send.focus?.();send.click();
      const settled=await waitForCoverLetterSubmitState(currentUi,vacancy.vacancyId,appliedCard,attempt===1?2800:3600);
      currentUi=settled.ui||currentUi;
      if(settled.confirmed||settled.alreadyViewed)return {...settled,attempts};
      lastReason='cover-letter-modal-still-open';
      if(attempt<maxAttempts)await wait(420+attempt*220);
    }
    const finalState=await waitForCoverLetterSubmitState(currentUi,vacancy.vacancyId,appliedCard,1800);
    return {...finalState,attempts,reason:finalState.confirmed?'':lastReason};
  }
  function toast(message,anchor,kind='neutral',ms=3800){try{return U?.toast?.(message,anchor,kind,ms);}catch{return null;}}
  async function preparedLetter(preparedPromise){
    const prepared=await preparedPromise;if(!prepared||prepared?.ok===false)throw new Error(prepared?.error||'Не удалось подготовить письмо.');
    const letter=String(prepared.coverLetter||prepared.application?.coverLetter||'').trim();if(!letter)throw new Error('Сопроводительное письмо не создано.');
    return {prepared,letter};
  }
  async function completePrepared(prepared,{coverLetterSubmitted=true,employerAlreadyViewed=false}={}){if(prepared?.application?.id)await request('quick-list-complete',{id:prepared.application.id,appliedConfirmed:true,coverLetterSubmitted,employerAlreadyViewed}).catch(()=>{});}
  async function submitInitialLetter(stage,vacancy,preparedPromise,anchor,options={}){
    const {prepared,letter}=await preparedLetter(preparedPromise);
    if(!await setLetter(stage.ui.field,letter))throw new Error('Не удалось надёжно заполнить обязательное сопроводительное письмо.');
    await (root.vjaSubmissionGuard||{requirePermission:async()=>{throw new Error('Final submission requires review.');}}).requirePermission({id:prepared.application?.id,vacancyId:vacancy.vacancyId,userInitiated:options.userInitiatedSubmit===true,intent:'quick-list-apply-letter'});
    let appliedCard=null,currentUi=stage.ui;
    for(let attempt=1;attempt<=4&&!appliedCard;attempt++){
      const activeUi=findLetterUi()||currentUi;currentUi=activeUi||currentUi;
      if(currentUi?.field&&visible(currentUi.field)&&currentLetterValue(currentUi.field)!==letter){
        if(!await setLetter(currentUi.field,letter))throw new Error('Не удалось восстановить текст письма перед повторной отправкой.');
      }
      const submit=await waitForActionButton(currentUi?.container||stage.ui.container,'initial',attempt===1?5000:3500);
      if(!submit){if(attempt<4){await wait(450+attempt*180);continue;}throw new Error('Письмо заполнено, но активная кнопка отправки отклика не определена однозначно.');}
      submit.scrollIntoView?.({block:'center'});submit.focus?.();submit.click();
      appliedCard=await waitForApplied(vacancy.vacancyId,stage.card,attempt===1?5200:6200);
      if(!appliedCard&&attempt<4)await wait(420+attempt*220);
    }
    if(!appliedCard)appliedCard=await waitForApplied(vacancy.vacancyId,stage.card,2600);
    if(!appliedCard)throw new Error('Письмо заполнено, но HH не подтвердил отправку после повторных попыток.');
    if(stage.ui.container?.isConnected&&visible(stage.ui.container)){const close=closeButton(stage.ui.container);if(close){close.click();await wait(120);}}
    await completePrepared(prepared);toast('✓ Отклик + сопроводительное письмо отправлены',anchor,'ok',4500);return appliedCard;
  }
  async function appendLetterAfterApplied(appliedCard,vacancy,preparedPromise,anchor,options={}){
    const {prepared,letter}=await preparedLetter(preparedPromise);
    const found=await waitForLetterAction(vacancy.vacancyId,appliedCard,12000);
    if(!found)throw new Error('Отклик отправлен, но HH не показал действие «Приложить письмо».');
    found.action.scrollIntoView?.({block:'center'});found.action.click();
    const ui=await waitForLetterUi(10000);if(!ui)throw new Error('Отклик отправлен, но редактор сопроводительного письма не найден.');
    if(!await setLetter(ui.field,letter))throw new Error('Не удалось надёжно вставить сопроводительное письмо.');
    await (root.vjaSubmissionGuard||{requirePermission:async()=>{throw new Error('Final submission requires review.');}}).requirePermission({id:prepared.application?.id,vacancyId:vacancy.vacancyId,userInitiated:options.userInitiatedSubmit===true,intent:'quick-list-apply-letter'});
    const submission=await clickCoverLetterSendUntilClosed(ui,vacancy,appliedCard,letter,{maxAttempts:6});
    if(submission.alreadyViewed){
      await closeEmployerAlreadyViewed(submission.ui?.container||ui.container,1800);
      await completePrepared(prepared,{coverLetterSubmitted:false,employerAlreadyViewed:true});
      toast('↷ Отклик уже просмотрен работодателем — окно закрыто, идём дальше.',anchor,'neutral',4800);
      return {card:found.card,outcome:'already-viewed'};
    }
    if(!submission.confirmed)throw new Error(`Письмо не подтвердилось после ${submission.attempts||6} попыток отправки. Окно оставлено открытым для проверки.`);
    const activeContainer=submission.ui?.container||ui.container;
    if(activeContainer?.isConnected&&visible(activeContainer)){const close=closeButton(activeContainer);if(close){close.click();await wait(120);}}
    await completePrepared(prepared);toast('✓ Отклик + сопроводительное письмо отправлены',anchor,'ok',4500);return {card:found.card,outcome:'sent'};
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
      let outcome='sent';
      if(stage.kind==='initial-letter'){
        note=toast('Заполняю обязательное сопроводительное письмо…',nativeButton||options.control);
        await submitInitialLetter(stage,vacancy,preparedPromise,nativeButton||options.control,options);
      }else if(stage.kind==='applied'){
        note=toast('Отклик отправлен. Добавляю сопроводительное письмо…',nativeButton||options.control);
        const appendResult=await appendLetterAfterApplied(stage.card,vacancy,preparedPromise,nativeButton||options.control,options);outcome=appendResult?.outcome||'sent';
      }else{
        throw new Error('HH открыл другой сценарий отклика. Нужна проверка текущей формы.');
      }
      note?.remove?.();markCard(findCard(vacancy.vacancyId,card)||card,'done');
      const memoryState=outcome==='already-viewed'?{status:'Viewed',completed:true,employerAlreadyViewed:true,coverLetterSubmitted:false}:{status:'Applied',completed:true,coverLetterSubmitted:true};
      if(options.control)renderApplicationControl(options.control,memoryState);broadcastApplication(vacancy.vacancyId,memoryState);
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
    control.dataset.state='working';control.textContent='✦ Анализирую…';control.disabled=true;
    let prepared;try{prepared=await request('quick-list-prepare',{vacancy});if(!prepared||prepared.ok===false)throw new Error(prepared?.error||'Не удалось подготовить отклик.');}
    catch(e){markCard(card,'error');control.dataset.state='error';control.textContent='! Повторить';control.disabled=false;toast(e?.message||'Не удалось подготовить отклик.',control,'bad',6200);return;}
    if(prepared.duplicate){markCard(card,'done');renderApplicationControl(control,{status:prepared.application?.status||'Applied',completed:true,coverLetterSubmitted:Boolean(prepared.application?.coverLetterMemory?.submittedAt)});toast('✓ Эта вакансия уже есть в памяти откликов.',control,'neutral',3600);return;}
    // The dedicated button is an explicit user confirmation for this one vacancy.
    // Do not stop on the list with a “letter saved” message: open the native HH flow,
    // then authorize the actual final button only after the real form/modal is visible.
    const preparePromise=Promise.resolve(prepared);
    native.scrollIntoView?.({block:'center'});native.click();
    await run(native,card,vacancy,preparePromise,{control,userInitiatedSubmit:true});
  }
  function analysisTitle(result){const source=result?.source==='hh-live-dom'?'Источник: полная страница вакансии, прочитанная в фоновой вкладке':result?.source==='hh-api'?'Источник: полное описание HH API':result?.source==='card-snippet'?'Источник: карточка вакансии (полную страницу прочитать не удалось)':'Источник: описание вакансии';return [result?.reason,result?.evidence&&`Фрагмент: ${result.evidence}`,source].filter(Boolean).join('\n');}
  function renderAnalysisControl(control,result){
    if(!control||!result)return;control.disabled=false;
    if(result.status==='calls'){control.dataset.state='calls';control.textContent='✕ Есть звонки';}
    else if(result.status==='no-calls'){control.dataset.state='no-calls';control.textContent='✓ Без звонков';}
    else{control.dataset.state='unknown';control.textContent='↻ Повторить';}
    control.title=analysisTitle(result);
  }
  function renderApplicationControl(control,state){
    if(!control||!state)return;const status=String(state.status||''),form=state.formMemory||null;control.style.display='';
    if(state.employerAlreadyViewed||status==='Viewed'){control.dataset.state='done';control.textContent='✓ Уже просмотрен';control.disabled=true;control.title='HH уже сообщил, что работодатель просмотрел этот отклик.';return;}
    if(['Applied','Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer','Rejected','Closed'].includes(status)||state.completed){control.dataset.state='done';control.textContent=state.coverLetterSubmitted?'✓ Отклик + письмо':'✓ Отклик отправлен';control.disabled=true;control.title='Статус восстановлен из памяти по точному vacancy ID.';return;}
    if(form&&Number(form.reviewCount||0)>0){control.dataset.state='review';control.textContent=`! Форма: ${Number(form.reviewCount)} проверить`;control.disabled=false;control.title='Форма уже была автоматически заполнена. Вернитесь к форме и проверьте отмеченные поля.';return;}
    if(form&&status==='Ready'){control.dataset.state='review';control.textContent='✓ Форма заполнена';control.disabled=false;control.title='Известные поля формы заполнены и сохранены в памяти. Финальную отправку подтвердите на сайте.';return;}
    if(status==='Preparing'){control.dataset.state='review';control.textContent='↷ Продолжить отклик';control.disabled=false;control.title='Подготовленный отклик сохранён в памяти этой вакансии.';}
  }
  function vacancyCards(vacancyId){return [...document.querySelectorAll(`[data-vja-vacancy-id="${CSS.escape(String(vacancyId))}"]`)];}
  function broadcastAnalysis(vacancyId,result){for(const c of vacancyCards(vacancyId)){const control=c.querySelector('.'+ANALYSIS_CLASS);if(control)renderAnalysisControl(control,result);c.dataset.vjaCallStatus=result?.status||'unknown';c.dataset.vjaMemoryRestored='1';}statePromises.delete(String(vacancyId));}
  function broadcastApplication(vacancyId,state){for(const c of vacancyCards(vacancyId)){const control=c.querySelector('.'+BUTTON_CLASS);if(control)renderApplicationControl(control,state);c.dataset.vjaMemoryRestored='1';}statePromises.delete(String(vacancyId));}
  async function restoreCardState(card,vacancy,apply,analysis){
    if(!card?.isConnected||!vacancy?.vacancyId||card.dataset.vjaMemoryRestored==='pending'||card.dataset.vjaMemoryRestored==='1')return;
    card.dataset.vjaMemoryRestored='pending';const id=String(vacancy.vacancyId);let promise=statePromises.get(id);
    if(!promise){promise=request('quick-list-state',{vacancy}).catch(()=>null);statePromises.set(id,promise);}
    const state=await promise;if(!card.isConnected)return;
    if(!state||state.ok===false){delete card.dataset.vjaMemoryRestored;return;}
    if(state.analysis&&analysis)renderAnalysisControl(analysis,state.analysis);
    if(state.application&&apply)renderApplicationControl(apply,state.application);
    else if(apply&&!nativeApplyButton(card)){if(applied(card)){apply.style.display='';apply.dataset.state='done';apply.textContent='✓ Уже откликнулись';apply.disabled=true;}else apply.style.display='none';}
    card.dataset.vjaMemoryRestored='1';
  }
  async function analyzeCardCalls(card,control){
    if(!card||!control)return;
    const vacancy=pinnedByCard.get(card)||extractVacancy(card);if(!vacancy){control.dataset.state='unknown';control.textContent='? Неясно';control.title='Не удалось однозначно определить эту карточку вакансии.';return;}
    if(analysisActive.has(vacancy.vacancyId))return;
    selected={vacancy,card,at:Date.now()};pinnedByCard.set(card,vacancy);card.dataset.vjaVacancyId=vacancy.vacancyId;analysisActive.add(vacancy.vacancyId);
    control.disabled=true;control.dataset.state='working';control.textContent='… Analysis';control.title='Проверяю полное описание вакансии на входящие/исходящие звонки.';
    try{
      const result=await request('quick-list-call-analysis',{vacancy});if(!result||result.ok===false)throw new Error(result?.error||'Не удалось проанализировать вакансию.');
      card.dataset.vjaCallStatus=result.status||'unknown';renderAnalysisControl(control,result);broadcastAnalysis(vacancy.vacancyId,result);
      if(result.status==='calls')toast('✕ В вакансии найдены звонки — пропускаем.',control,'bad',3600);
      else if(result.status==='no-calls')toast('✓ Звонки не требуются или не указаны в полном описании.',control,'ok',3000);
      else toast(result.reason||'Не удалось прочитать полную вакансию. Повторите Analysis.',control,'neutral',5200);
    }catch(e){control.dataset.state='unknown';control.textContent='? Повторить';control.title=e?.message||'Ошибка анализа';control.disabled=false;toast(e?.message||'Не удалось выполнить Analysis.',control,'bad',5200);}
    finally{analysisActive.delete(vacancy.vacancyId);}
  }
  function ensureCardButton(card){
    if(!card)return;const vacancy=extractVacancy(card);if(!vacancy)return;const native=nativeApplyButton(card);
    pinnedByCard.set(card,vacancy);card.dataset.vjaVacancyId=vacancy.vacancyId;
    let apply=card.querySelector('.'+BUTTON_CLASS);
    if(!apply){
      apply=document.createElement('button');apply.type='button';apply.className=BUTTON_CLASS;apply.textContent='✦ Отклик + письмо';apply.title='Выбрать эту вакансию и отправить отклик с индивидуальным сопроводительным письмом';
      apply.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(nativeApplyButton(card))void quickApplyCard(card,apply);});
      const holder=native?.parentElement||card;try{if(native)native.insertAdjacentElement('afterend',apply);else holder.append(apply);}catch{holder.append(apply);}
      if(!native)apply.style.display='none';
    }
    let analysis=card.querySelector('.'+ANALYSIS_CLASS);
    if(!analysis){
      analysis=document.createElement('button');analysis.type='button';analysis.className=ANALYSIS_CLASS;analysis.textContent='Analysis';analysis.title='Открыть эту вакансию в фоне, прочитать полное описание и проверить, есть ли звонки';
      analysis.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void analyzeCardCalls(card,analysis);});
      try{apply.insertAdjacentElement('afterend',analysis);}catch{(native?.parentElement||card).append(analysis);}
    }
    if(card.dataset.vjaMemoryRestored!=='1')void restoreCardState(card,vacancy,apply,analysis);
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
    if(!target||target.classList.contains(BUTTON_CLASS)||target.classList.contains(ANALYSIS_CLASS)||!visible(target)||!H.isApplyLabel(text(target)))return;
    const card=cardFor(target),vacancy=card?(pinnedByCard.get(card)||extractVacancy(card)):null;if(!card||!vacancy)return;
    selected={vacancy,card,at:Date.now()};pinnedByCard.set(card,vacancy);card.dataset.vjaVacancyId=vacancy.vacancyId;
    if(settingsCache.quickListCoverLetter===false)return;
    clearOtherCards(card);markCard(card,'working');
    const preparePromise=request('quick-list-prepare',{vacancy});
    setTimeout(()=>void run(target,card,vacancy,preparePromise,{userInitiatedSubmit:true}),0);
  },true);
  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(scanCards,90);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('popstate',()=>setTimeout(scanCards,80));
  addEventListener('pageshow',()=>setTimeout(scanCards,80));
  scanCards();setTimeout(scanCards,600);setTimeout(scanCards,1800);
  root.vjaHhListQuickApplyRuntime={extractVacancy,run,findCard,scanCards,quickApplyCard,analyzeCardCalls,selectedVacancy:()=>selected?.vacancy||null,selectedCard:()=>selected?.card?.isConnected?selected.card:null};
})(globalThis);
