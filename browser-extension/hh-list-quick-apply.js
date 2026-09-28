/* HH search-list quick apply: a trusted native "Откликнуться" click may be followed by a tailored cover letter in-place. */
(function(root){
  'use strict';
  let __vjaHost='';try{__vjaHost=new URL(location.href).hostname}catch{}
  if(root.vjaHhListQuickApplyRuntime||window.top!==window||!/(^|\.)hh\.ru$/i.test(__vjaHost))return;
  const H=root.vjaHhListQuickApply,U=root.vjaCopilotUI,A=root.vjaSiteAdapters;
  if(!H)return;
  const request=(op,args={})=>chrome.runtime.sendMessage({type:'vjaCopilot',op,...args});
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const active=new Set();
  // Prime settings at document_idle so a user's native Apply click can start
  // preparing the letter immediately, before HH re-renders the card.
  let settingsCache={quickListCoverLetter:true};
  let settingsPromise=request('bootstrap').then(x=>{settingsCache=x?.settings||{};return settingsCache;}).catch(()=>settingsCache);
  const visible=el=>{if(!el||!el.isConnected||el.disabled||el.getAttribute?.('aria-disabled')==='true')return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;};
  const text=el=>String(el?.innerText||el?.textContent||el?.value||el?.getAttribute?.('aria-label')||'').replace(/\s+/g,' ').trim();
  function isListPage(){try{return A?.make(document,location.href).detectPageType()==='JOB_LIST'||/\/(?:search\/vacancy|vacancies|jobs)/i.test(location.pathname);}catch{return /vacanc/i.test(location.pathname);}}
  async function enabled(){const settings=await settingsPromise;return settings.quickListCoverLetter!==false;}
  function cardFor(el){
    const direct=el?.closest?.('[data-qa="vacancy-serp__vacancy"],[data-qa*="vacancy-serp"],article,li,[data-vacancy-id],[class*="vacancy-card"],[class*="vacancy-serp"],[class*="serp-item"]');
    if(direct)return direct;
    let node=el;
    for(let depth=0;node&&depth<9;depth++,node=node.parentElement){
      if(node.querySelector?.('a[href*="/vacancy/"]')&&[...node.querySelectorAll?.('button,a,[role="button"]')||[]].some(x=>H.isApplyLabel(text(x))))return node;
    }
    return null;
  }
  function vacancyLink(card){
    const links=[...card.querySelectorAll('a[href*="/vacancy/"]')].filter(visible);
    return links.find(a=>/serp-item__title|vacancy.*title/i.test(String(a.getAttribute('data-qa')||'')+' '+String(a.className||'')))||links[0]||null;
  }
  function extractVacancy(card){
    const link=vacancyLink(card);if(!link)return null;
    const url=new URL(link.href,location.href).href,vacancyId=H.vacancyIdFromUrl(url);if(!vacancyId)return null;
    const title=text(card.querySelector('[data-qa="serp-item__title"],[data-qa*="vacancy-title"],h2 a[href*="/vacancy/"],h3 a[href*="/vacancy/"]'))||text(link);
    const company=text(card.querySelector('[data-qa="vacancy-serp__vacancy-employer"],[data-qa*="vacancy-employer"],[class*="company"]'));
    const locationText=text(card.querySelector('[data-qa="vacancy-serp__vacancy-address"],[data-qa*="vacancy-address"],[class*="location"]'));
    const cardText=text(card).slice(0,7000);
    return {provider:'hh',url,vacancyId,title,company,location:locationText,description:cardText,descriptionCoverage:'snippet',requirements:'',remote:/удал[её]н|remote/i.test(cardText)};
  }
  function findCard(vacancyId,fallback){
    if(fallback?.isConnected&&H.vacancyIdFromUrl(vacancyLink(fallback)?.href)===vacancyId)return fallback;
    for(const a of document.querySelectorAll('a[href*="/vacancy/"]'))if(H.vacancyIdFromUrl(a.href)===vacancyId){const c=cardFor(a);if(c)return c;}
    return null;
  }
  function letterAction(card){
    const local=card?[...card.querySelectorAll('button,a,[role="button"]')].filter(visible).filter(el=>H.isLetterActionLabel(text(el))):[];
    if(local.length===1)return local[0];
    // HH sometimes renders the post-apply action in a sibling/expanded area
    // outside the original card. Only use a global fallback when it is unique.
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
  async function waitForLetterUi(timeout=9000){
    const started=Date.now();
    while(Date.now()-started<timeout){
      const containers=coverLetterContainers();
      for(const container of containers){
        const field=visibleCoverLetterField(container);
        if(field&&(/сопроводительное письмо/i.test(text(container))||/сопровод|почему|кандидатур|работодател|cover.?letter/i.test(String(field.getAttribute('placeholder')||'')+' '+String(field.getAttribute('aria-label')||''))))return {container,field};
      }
      // Current HH may mount the letter editor in a generic portal without a
      // dialog role. If there is exactly one visible letter-like field, ascend
      // to a bounded container and use it.
      const fields=[...document.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"]')].filter(visible).filter(f=>/сопровод|почему|кандидатур|работодател|cover.?letter/i.test(String(f.getAttribute('placeholder')||'')+' '+String(f.getAttribute('aria-label')||'')));
      if(fields.length===1){
        let container=fields[0].parentElement;
        for(let i=0;container&&i<6;i++,container=container.parentElement){
          if(/сопроводительное письмо/i.test(text(container))||[...container.querySelectorAll('button,[role="button"],input[type="submit"]')].some(b=>H.isSendLetterLabel(text(b))))return {container,field:fields[0]};
        }
      }
      await wait(160);
    }
    return null;
  }
  async function setLetter(field,letter){
    if(typeof root.vjaSiteSetTextVerified==='function'){
      const ok=await root.vjaSiteSetTextVerified(field,letter);
      if(ok)return true;
    }
    field.focus();
    if(field instanceof HTMLTextAreaElement||field instanceof HTMLInputElement){
      const proto=field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(field,letter);else field.value=letter;
    }else field.textContent=letter;
    field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:letter}));
    field.dispatchEvent(new Event('change',{bubbles:true}));
    const current=String(field.isContentEditable?field.innerText:field.value||'').trim();
    return current===String(letter||'').trim();
  }
  function sendButton(container){
    const items=[...container.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible).map(el=>({el,label:text(el),visible:true,disabled:Boolean(el.disabled)}));
    return H.chooseSendCandidate(items).candidate?.el||null;
  }
  function toast(message,anchor,kind='neutral',ms=3800){try{return U?.toast?.(message,anchor,kind,ms);}catch{return null;}}
  async function run(nativeButton,initialCard,vacancy,preparePromise){
    if(!vacancy?.title||!vacancy.vacancyId)return;
    if(active.has(vacancy.vacancyId)||!await enabled())return;
    active.add(vacancy.vacancyId);let note=null;
    try{
      note=toast('Отклик принят. Готовлю письмо…',nativeButton);
      // Preparation is started from the capture-phase click handler before HH
      // has time to mark the same vacancy Applied. This avoids the duplicate
      // receipt race that previously produced an empty/no-op letter.
      const preparedPromise=preparePromise||request('quick-list-prepare',{vacancy});
      const [appliedCard,prepared]=await Promise.all([waitForApplied(vacancy.vacancyId,initialCard,18000),preparedPromise]);
      if(!appliedCard)return; // HH opened a multi-step/questionnaire flow.
      if(!prepared||prepared?.ok===false)throw new Error(prepared?.error||'Не удалось подготовить письмо.');
      const letter=String(prepared.coverLetter||prepared.application?.coverLetter||'').trim();
      if(!letter)throw new Error('Сопроводительное письмо не создано.');
      note?.remove?.();note=toast('Добавляю сопроводительное письмо…',nativeButton);
      const found=await waitForLetterAction(vacancy.vacancyId,appliedCard,12000);
      if(!found)throw new Error('Отклик отправлен, но HH не показал действие «Приложить письмо».');
      found.action.scrollIntoView?.({block:'center'});found.action.click();
      const ui=await waitForLetterUi(10000);if(!ui)throw new Error('Отклик отправлен, но редактор сопроводительного письма не найден.');
      if(!await setLetter(ui.field,letter))throw new Error('Не удалось надёжно вставить сопроводительное письмо.');
      const send=sendButton(ui.container);if(!send)throw new Error('Письмо заполнено, но кнопка «Отправить» не определена однозначно.');
      send.scrollIntoView?.({block:'center'});send.click();
      let confirmed=false;
      for(let i=0;i<45;i++){
        await wait(160);
        const success=/письм[оа].{0,30}(?:отправлен|добавлен|приложен)|сопроводительное.{0,30}(?:отправлен|добавлен|приложен)/i.test(text(document.body));
        const actionGone=!letterAction(findCard(vacancy.vacancyId,appliedCard));
        if(!ui.field.isConnected||!visible(ui.field)||success||actionGone){confirmed=true;break;}
      }
      if(!confirmed)throw new Error('Письмо отправлялось, но HH не подтвердил результат. Проверьте окно письма вручную.');
      if(prepared.application?.id)await request('quick-list-complete',{id:prepared.application.id,appliedConfirmed:true,coverLetterSubmitted:true}).catch(()=>{});
      note?.remove?.();toast('✓ Отклик + сопроводительное письмо отправлены',nativeButton,'ok',4500);
    }catch(e){note?.remove?.();toast(e?.message||'Не удалось автоматически приложить письмо.',nativeButton,'bad',6500);}
    finally{active.delete(vacancy.vacancyId);}
  }
  document.addEventListener('click',event=>{
    if(!event.isTrusted||!isListPage())return;
    const target=event.target instanceof Element?event.target.closest('button,a,[role="button"]'):null;
    if(!target||!visible(target)||!H.isApplyLabel(text(target)))return;
    const card=cardFor(target),vacancy=card?extractVacancy(card):null;if(!card||!vacancy)return;
    // Start preparing while this trusted click is still in the capture phase,
    // then let HH process its own click normally.
    if(settingsCache.quickListCoverLetter===false)return;
    const preparePromise=request('quick-list-prepare',{vacancy});
    setTimeout(()=>void run(target,card,vacancy,preparePromise),0);
  },true);
  root.vjaHhListQuickApplyRuntime={extractVacancy,run,findCard};
})(globalThis);
