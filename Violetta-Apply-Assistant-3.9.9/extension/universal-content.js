/* Main JOB_DESCRIPTION path is direct auto-apply; APPLICATION_FORM keeps the existing review/fill path. */
(function(root){
  'use strict';
  if(root.vjaUniversal)return;
  const C=root.vjaCopilotCore,A=root.vjaSiteAdapters,U=root.vjaCopilotUI;
  const documentId=C.newId();let bar=null,panel=null,toast=null,working=false,prepared=null,scanTimer=null,lastPage='',generation=0,applyState='IDLE',applyMeta=null;
  const request=(op,args={})=>chrome.runtime.sendMessage({type:'vjaCopilot',op,...args});
  const current=()=>A.make(document,location.href);
  function effectivePageType(adapter=current()){
    const type=adapter.detectPageType();
    if(type!=='UNKNOWN')return type;
    try{
      const u=new URL(location.href);
      if(/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(u.hostname)&&/\/vacancy\/\d+/i.test(u.pathname))return 'JOB_DESCRIPTION';
    }catch{}
    return type;
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function context(){return location.href+'|'+C.vacancyKey(current().extractVacancy());}
  function alive(key,epoch){return epoch===generation&&key===context();}
  function close(){panel?.close();panel=null;}
  function closeToast(){toast?.close?.();toast=null;}
  function applyLabel(){return root.vjaApplicationState?.label?.(applyState)||({CONFIRMED:'✓ Отклик отправлен',DUPLICATE:'✓ Уже откликнулись',FAILED:'! Повторить',REVIEW_REQUIRED:'! Нужна проверка'}[applyState]||'✦ Apply');}
  function setApplyState(state,message='',kind='neutral'){applyState=state;renderBar();closeToast();if(message){toast=U.toast(message,bar?.box,kind,state==='CONFIRMED'||state==='DUPLICATE'?5500:0);}}
  function show(title='Подготовка отклика'){close();panel=U.panel(title);return panel;}
  function inputValue(el){return el.isContentEditable?el.textContent:el.value;}
  function pageContextText(){return C.clip([document.title,A.text(document.body,18000)].filter(Boolean).join('\n'),20000);}
  function mark(el,reason){el.setAttribute('data-vja-needs-review',reason);el.style.outline='2px solid #c29438';el.style.outlineOffset='2px';}
  function clearMark(el){if(el.hasAttribute('data-vja-needs-review')){el.removeAttribute('data-vja-needs-review');el.style.outline='';el.style.outlineOffset='';}}
  async function fill(data,p,status,key,epoch,{autoContinue=false,autoDepth=0}={}){
    const adapter=current(),scope=adapter.detectApplicationForm();
    if(!scope){status.textContent='Откройте форму отклика на сайте и нажмите ✦ Fill. Ничего не отправлено.';return {submitted:false,status:'needs-review',reason:'open-form-manually'};}
    const fields=A.formFields(scope);let filled=0,review=0,coverLetterFilled=false,cvUploaded=false;const unresolved=[];
    const addReview=(f,reason)=>{review++;unresolved.push({label:C.clip(f?.label||'',180),reason:C.clip(reason||'Нужна проверка',220)});};
    for(let i=0;i<fields.length;i++){
      if(!alive(key,epoch))throw new Error('Контекст изменился. Заполнение остановлено.');
      const el=fields[i],f=A.descriptor(el,i);clearMark(el);
      if(f.currentValue){continue;}
      try{
        if(f.type==='file'){
          if(!/(?:\bcv\b|\bresume\b|résumé|резюме|lebenslauf)/i.test(f.label)||C.highRisk(f.label)||!data.cvFile){addReview(f,'Проверьте файл резюме');mark(el,'Проверьте файл резюме');continue;}
          const result=typeof vjaUploadCv==='function'?vjaUploadCv(data.cvFile,el):{success:false};
          if(result.success){cvUploaded=true;filled++;}else{addReview(f,'Файл не прикреплён');mark(el,'Файл не прикреплён');}continue;
        }
        const d=C.fieldDecision(f,data.profile,{coverLetter:data.coverLetter,role:data.role});
        if(d.action!=='fill'){addReview(f,d.reason);mark(el,d.reason);continue;}
        let ok=false;
        if(f.type==='select'){
          const values=[...el.options].filter(o=>o.value&&[o.value,o.textContent].some(v=>C.clean(v).toLowerCase()===C.clean(d.value).toLowerCase()));
          if(values.length===1){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,values[0].value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));ok=true;}
        }else if(el.isContentEditable){el.textContent=d.value;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:d.value}));ok=true;}
        else if(typeof setFieldValue==='function')ok=setFieldValue(el,d.value);
        if(ok){
          await wait(75);
          const valid=el.isConnected&&(f.type==='select'?[el.value,el.selectedOptions?.[0]?.textContent].some(v=>C.clean(v).toLowerCase()===C.clean(d.value).toLowerCase()):C.clean(inputValue(el))===C.clean(d.value));
          if(valid){filled++;if(/cover.?letter|сопровод/i.test(f.label))coverLetterFilled=true;}
          else{addReview(f,'Значение не сохранилось');mark(el,'Значение не сохранилось');}
        }else{addReview(f,'Проверьте поле');mark(el,'Проверьте поле');}
      }catch{addReview(f,'Не удалось заполнить');if(el.isConnected)mark(el,'Не удалось заполнить');}
    }
    if(!alive(key,epoch))throw new Error('Страница изменилась.');
    const original=new Set(fields);
    for(const el of A.formFields(scope))if(!original.has(el)&&!A.descriptor(el).currentValue){const f=A.descriptor(el);addReview(f,'Новое поле — нужна проверка');mark(el,'Новое поле — нужна проверка');}
    status.textContent=review?`${filled} полей заполнено. ${review} полей требуют проверки.\nНеизвестные или важные ответы не придуманы — проверьте отмеченные поля.`:`✓ Ready — заполнено полей: ${filled}.\nФинальную отправку подтвердите на сайте самостоятельно.`;
    const result={submitted:false,status:'needs-review',ready:!review,reviewCount:review,filled,coverLetterFilled,cvUploaded,unresolved,reason:'user-submit-required'};
    await request('prepared',{id:data.application.id,url:location.href,pageText:pageContextText(),reviewCount:review,filled,unresolved,coverLetterFilled,cvUploaded,autoFilled:Boolean(autoContinue)});
    const actions=document.createElement('div');actions.className='actions';
    actions.append(U.button('Проверить поля',()=>{const el=A.all('[data-vja-needs-review]',scope)[0];el?.scrollIntoView({block:'center'});el?.focus?.();}));
    const navigationMeta=el=>({label:A.text(el,80),inForm:Boolean(el.closest('form')),submitType:el.tagName==='BUTTON'&&el.type!=='button',explicitStep:Boolean(document.querySelector('[aria-current="step"],[data-step],.stepper,.steps'))});
    const next=A.all('button,a,[role="button"]',scope).filter(A.visible).find(el=>C.safeNavigation(navigationMeta(el)));
    if(next&&!review)actions.append(U.button('Следующий шаг',async()=>{
      if(working||!next.isConnected)return;if(!C.safeNavigation(navigationMeta(next)))return;
      next.click();await wait(300);void prepare({open:false,autoContinue:false});
    }));
    p.body.append(actions);p.place();
    if(autoContinue&&!review&&next&&autoDepth<4&&next.isConnected&&C.safeNavigation(navigationMeta(next))){
      status.textContent=`✓ Заполнено полей: ${filled}. Перехожу к следующему безопасному шагу…`;
      next.click();setTimeout(()=>{if(current().detectApplicationForm())void prepare({open:false,autoContinue:true,autoDepth:autoDepth+1});},420);return {...result,advanced:true};
    }
    return result;
  }
  async function prepare({open=true,legacyPlan=null,autoContinue=false,autoDepth=0}={}){
    if(working)return {submitted:false,status:'needs-review',reason:'preparation-in-progress'};
    working=true;const key=context(),epoch=++generation;const p=show(),status=p.status('Читаю вакансию…');
    try{
      const adapter=current();if(adapter.detectPageType()==='RECRUITER_CHAT')throw new Error('Для переписки используйте ✎ AI.');
      const pinned=root.vjaHhListQuickApplyRuntime?.selectedVacancy?.()||null;
      const resumed=await request('pending',{url:location.href,pageText:pageContextText()});
      // If Fill is pressed inside an HH list/application modal, keep the exact
      // vacancy card selected by the user. Never derive a cover letter from the
      // search-results page heading/body.
      const data=resumed.pending||(pinned?await request('quick-list-prepare',{vacancy:pinned}):await request('prepare',{vacancy:adapter.extractVacancy(),legacyPlan}));
      if(!alive(key,epoch))return {submitted:false,status:'needs-review',reason:'stale-context'};
      if(data.ok===false)throw new Error(data.error);
      if(data.duplicate){status.textContent='На эту вакансию уже есть отклик. Повторная отправка не выполняется.';return {submitted:false,status:'needs-review',reason:'already-applied'};}
      prepared=data;
      const summary=document.createElement('p');summary.className='summary';summary.textContent=`${data.application.vacancy.title}\n${C.labels[data.role]||data.role||''}${data.context?.cvName?' · '+data.context.cvName:''}`;p.body.prepend(summary);
      const letter=document.createElement('textarea');letter.className='draft';letter.value=data.coverLetter;letter.setAttribute('aria-label','Сопроводительное письмо');
      // Edited letter remains local to this form until explicit confirmation below.
      p.body.append(letter);
      const actions=document.createElement('div');actions.className='actions';actions.append(U.button('Использовать этот текст',async()=>{data.coverLetter=letter.value;const result=await request('update-letter',{id:data.application.id,text:letter.value,url:location.href});status.textContent=result.ok?'Текст сохранён для этого отклика. Нажмите ✦ Fill, чтобы заполнить пустое поле.':result.error;}));p.body.append(actions);
      const form=adapter.detectApplicationForm();
      if(form){status.textContent='Заполняю безопасные поля…';return await fill(data,p,status,key,epoch,{autoContinue:Boolean(autoContinue||resumed.pending?.autoContinuation),autoDepth});}
      const link=open?adapter.detectApplyButton():null;
      if(link){
        await request('pending',{url:location.href,value:{id:data.application.id,target:link.href}});
        const dest=new URL(link.href);if(dest.origin!==location.origin){status.textContent='Форма находится на другом сайте. Откройте её, затем включите помощника через значок расширения.';const a=U.button('Открыть форму',()=>{location.assign(link.href);});p.body.append(a);return {submitted:false,status:'needs-review',reason:'cross-origin-permission'};}
        status.textContent='Открываю форму. Финальная отправка останется за вами.';
        location.assign(link.href);return {submitted:false,status:'needs-review',reason:'opening-form'};
      }
      status.textContent='Письмо подготовлено. Откройте Apply / «Откликнуться» на сайте самостоятельно. Некоторые такие кнопки сразу отправляют резюме — помощник их не нажимает.';
      p.place();return {submitted:false,status:'needs-review',reason:'open-form-manually'};
    }catch(e){if(alive(key,epoch))status.textContent=e.message||'Не удалось подготовить отклик.';return {submitted:false,status:'needs-review',reason:e.message||'prepare-error'};}
    finally{working=false;p.place();}
  }
  async function autoApply(){
    if(working)return {submitted:false,status:'busy',reason:'application-in-progress'};
    const a=current();if(effectivePageType(a)==='RECRUITER_CHAT')return {submitted:false,status:'wrong-page'};
    const vacancy=a.extractVacancy();if(!vacancy?.title){setApplyState('FAILED','Не удалось прочитать текущую вакансию.','bad');return {submitted:false,status:'failed'};}
    working=true;setApplyState('ANALYZING','Анализирую вакансию…');
    try{
      setTimeout(()=>{if(working&&applyState==='ANALYZING')setApplyState('CV_SELECTED','Выбираю подходящее CV и готовлю сопроводительное письмо…');},180);
      setTimeout(()=>{if(working&&['ANALYZING','CV_SELECTED'].includes(applyState))setApplyState('LETTER_READY','Сопроводительное письмо готовится под эту вакансию…');},520);
      setTimeout(()=>{if(working&&!['CONFIRMED','DUPLICATE','REVIEW_REQUIRED','FAILED'].includes(applyState))setApplyState('SUBMITTING','Заполняю форму и отправляю отклик в этой же вкладке…');},900);
      const result=await request('auto-apply',{vacancy});
      if(result?.ok===false)throw new Error(result.error||'Не удалось запустить отклик.');
      applyMeta=result?.application||null;
      if(result?.duplicate){setApplyState('DUPLICATE',result.message||'На эту вакансию уже был отправлен отклик.','ok');return {submitted:false,status:'duplicate'};}
      const site=result?.result||{};
      if(site.submitted&&site.status==='confirmed'){
        setApplyState('CONFIRMED','✓ Отклик отправлен. CV и точный текст сопроводительного письма сохранены в памяти этой вакансии.','ok');
        return site;
      }
      const reason=result?.message||site.reason||'Форма требует проверки.';
      setApplyState('REVIEW_REQUIRED',`Нужна проверка на текущей странице: ${reason}`,'warn');return site;
    }catch(e){
      const message=e?.message||'Не удалось запустить автоотклик.';
      if(/message port closed|receiving end does not exist|context invalidated/i.test(message))setApplyState('SUBMITTING','Автоотклик продолжает работу на странице работодателя. Отдельное окно не открывается.');
      else setApplyState('FAILED',message,'bad');
      return {submitted:false,status:'needs-review',reason:message};
    }finally{working=false;renderBar();}
  }
  async function refreshVacancyStatus(){
    const a=current();if(effectivePageType(a)!=='JOB_DESCRIPTION')return;
    try{const vacancy=a.extractVacancy();if(!vacancy?.title)return;const r=await request('vacancy-status',{vacancy});if(!r?.ok)return;if(r.applied){applyMeta=r.application;applyState='DUPLICATE';}else if(!working&&['DUPLICATE','CONFIRMED'].includes(applyState)){applyState='IDLE';}renderBar();}catch{}
  }
  function renderBar(){
    const adapter=current(),type=effectivePageType(adapter);bar?.remove();bar=null;
    if(type==='RECRUITER_CHAT'||!['JOB_DESCRIPTION','APPLICATION_FORM'].includes(type))return;
    if(type==='APPLICATION_FORM')bar=U.bar([{label:'✦ Fill',primary:true,onClick:()=>void prepare({open:true})},{label:'⋯',onClick:()=>void request('open-options')}]);
    else bar=U.bar([{label:applyLabel(),primary:true,onClick:()=>void autoApply()},{label:'⋯',onClick:()=>void request('open-options')}]);
    toast?.place?.();
  }
  function scan(){
    const adapter=current(),type=effectivePageType(adapter),signature=type+'|'+location.href;
    if(signature===lastPage&&bar?.host?.isConnected){bar.place();toast?.place?.();return;}
    lastPage=signature;
    if(type!=='JOB_DESCRIPTION'&&!working){applyState='IDLE';applyMeta=null;}
    renderBar();
    if(type==='JOB_DESCRIPTION')void refreshVacancyStatus();
  }
  const observer=new MutationObserver(mutations=>{
    if(mutations.every(m=>m.target instanceof Element&&m.target.closest('[data-vja-root]')))return;
    clearTimeout(scanTimer);scanTimer=setTimeout(scan,300);
  });observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('popstate',()=>{generation++;lastPage='';scan();});
  window.addEventListener('hashchange',()=>{generation++;lastPage='';scan();});
  document.addEventListener('focusin',e=>{if(e.target?.matches?.('input,textarea,[contenteditable="true"]')&&!e.target.closest('[data-vja-root]'))void request('focus').catch(()=>{});});
  chrome.runtime.onMessage.addListener((m,_s,respond)=>{
    if(m?.type!=='vjaCopilotPage')return false;
    if(m.action==='ping'){respond({ok:true});return false;}
    if(m.action==='vacancy'){const v=current().extractVacancy();if(m.expectedVacancyId&&String(v?.vacancyId||'')!==String(m.expectedVacancyId)){respond({ok:false,error:'wrong-vacancy',vacancy:null});return false;}respond({ok:true,vacancy:v});return false;}
    if(m.action==='inspect'){respond({ok:true,pageType:current().detectPageType(),provider:current().provider});return false;}
    if(m.action==='prepare'){prepare().then(respond);return true;}
    if(m.action==='auto-apply'){void autoApply();respond({ok:true,started:true});return false;}
    return false;
  });
  // HH and other SPA pages can change route/content without popstate. This small
  // watchdog only re-runs cheap detection and keeps ✦ Apply visible after navigation.
  const visibilityWatch=setInterval(()=>{if(document.visibilityState!=='hidden')scan();},1200);
  addEventListener('pagehide',()=>clearInterval(visibilityWatch),{once:true});
  root.vjaUniversal={prepare,autoApply,scan,refreshVacancyStatus,documentId,get prepared(){return prepared;},get applyState(){return applyState;}};
  scan();
  // Continue only a explicitly persisted application/form URL in this tab.
  if(current().detectApplicationForm())request('pending',{url:location.href,pageText:pageContextText()}).then(r=>{if(r.pending&&current().detectApplicationForm())void prepare({open:false,autoContinue:Boolean(r.pending.autoContinuation),autoDepth:0});}).catch(()=>{});
})(globalThis);
