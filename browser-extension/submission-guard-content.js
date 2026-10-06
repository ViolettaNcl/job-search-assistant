/* Every extension-triggered final action asks the worker for a fresh authorization.
   Risk inspection is scoped to the active application UI, not unrelated search filters. */
(function(root){
  'use strict';if(root.vjaSubmissionGuard)return;
  const A=root.vjaSiteAdapters;
  const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  function visible(el){
    if(!el||!el.isConnected||el.disabled||el.getAttribute?.('aria-disabled')==='true')return false;
    const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&el.getClientRects().length>0;
  }
  function fieldValue(el){
    if(!el)return '';
    if(el.type==='file')return el.files?.length?'attached':'';
    if(['checkbox','radio'].includes(el.type))return el.checked?'checked':'';
    if(el.isContentEditable)return clean(el.innerText||el.textContent||'');
    return clean(el.value||el.getAttribute?.('value')||'');
  }
  function coverField(){
    const preferred=typeof root.vjaSiteCoverLetterField==='function'?root.vjaSiteCoverLetterField(document):null;
    if(preferred&&visible(preferred))return preferred;
    const fields=[...document.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"]')].filter(visible);
    return fields.find(el=>/сопровод|почему|кандидатур|работодател|cover.?letter/i.test([
      el.getAttribute?.('placeholder'),el.getAttribute?.('aria-label'),el.getAttribute?.('name'),el.id,
      el.closest?.('label,[role="dialog"],form')?.innerText
    ].filter(Boolean).join(' ')))||null;
  }
  function closestApplicationScope(field){
    if(!field)return null;
    const selectors='[role="dialog"],dialog,form,[data-qa*="modal" i],[data-qa*="popup" i],[data-application-form],[class*="bloko-modal" i],[class*="modal" i],[class*="popup" i]';
    let node=field;
    for(let depth=0;node&&depth<10;depth++,node=node.parentElement){
      if(node.matches?.(selectors)&&visible(node))return node;
    }
    return field.parentElement||null;
  }
  function activeApplicationScope(plan={}){
    const field=coverField(),fieldScope=closestApplicationScope(field);
    if(fieldScope)return {scope:fieldScope,coverField:field,kind:'cover-letter'};
    try{
      const form=A?.make?.(document,location.href)?.detectApplicationForm?.();
      if(form&&visible(form))return {scope:form,coverField:null,kind:'application-form'};
    }catch{}
    const dialogs=[...document.querySelectorAll('[role="dialog"],dialog,[data-qa*="modal" i],[class*="modal" i],[class*="popup" i]')]
      .filter(visible).filter(el=>/отклик|резюме|сопровод|apply|application|cover.?letter/i.test(clean(el.innerText)));
    if(dialogs.length===1)return {scope:dialogs[0],coverField:null,kind:'application-dialog'};
    return {scope:document,coverField:null,kind:'page-fallback'};
  }
  function visibleCaptcha(){
    return [...document.querySelectorAll('iframe[src*="captcha" i],.g-recaptcha,[data-sitekey],[class*="captcha" i]')].some(visible);
  }
  function collectRisks(plan={}){
    const active=activeApplicationScope(plan),scope=active.scope||document;
    const scopeText=clean(scope===document?document.body?.innerText:scope.innerText);
    const risks={captcha:visibleCaptcha(),unknownRequiredFact:false,unresolvedReview:false,legal:false,unexpectedUpload:false,payment:false,identityVerification:false};
    risks.unresolvedReview=Boolean(scope.querySelector?.('[data-vja-needs-review]'));
    risks.payment=/внесите оплату|оплатите|переведите деньги|pay (?:a |the )?fee|payment required/i.test(scopeText);
    risks.identityVerification=/загрузите паспорт|скан паспорта|identity verification|upload.*passport/i.test(scopeText);
    const fields=A?.formFields?.(scope)||[];
    for(const f of fields){
      if(!visible(f)&&!(f.type==='file'&&visible(f.parentElement)))continue;
      const d=A.descriptor(f),category=root.vjaQuestionnaireCore?.classify?.(d.label,d);
      if(['LEGAL','CONSENT','WORK_AUTHORIZATION'].includes(category))risks.legal=true;
      const current=fieldValue(f)||clean(d.currentValue);
      if(d.required&&!current)risks.unknownRequiredFact=true;
      if(d.type==='file'&&!/cv|resume|резюме/i.test(d.label))risks.unexpectedUpload=true;
    }
    // The letter itself is not an "unknown fact" after the extension has inserted a verified draft.
    if(active.coverField&&fieldValue(active.coverField)){
      const onlyMissing=fields.filter(f=>{const d=A.descriptor(f);return d.required&&!fieldValue(f)&&!clean(d.currentValue);});
      if(onlyMissing.length===0)risks.unknownRequiredFact=false;
    }
    return {risks,scopeKind:active.kind};
  }
  async function authorize(plan={}){
    const {risks,scopeKind}=collectRisks(plan);
    const response=await chrome.runtime.sendMessage({
      type:'vjaSubmitAuthorization',vacancyId:plan.vacancyId||plan.trackedId||'',planId:plan.id||'',
      userInitiated:plan.userInitiated===true,intent:String(plan.intent||''),submitIntentToken:String(plan.submitIntentToken||''),
      scopeKind,risks
    }).catch(()=>null);
    return response&&typeof response==='object'?response:{allowed:false,reason:'authorization-unavailable'};
  }
  async function allow(plan={}){return (await authorize(plan)).allowed===true;}
  function denialMessage(decision={}){
    const stop=Array.isArray(decision.stop)?decision.stop:[];
    if(stop.includes('captcha'))return 'HH запросил CAPTCHA. Завершите проверку и повторите отклик.';
    if(stop.includes('legal'))return 'В форме есть юридическое согласие или вопрос о праве на работу. Его нужно проверить вручную.';
    if(stop.includes('unknownRequiredFact'))return 'В активной форме осталось обязательное поле без подтверждённых данных.';
    if(stop.includes('payment'))return 'Форма запрашивает оплату. Автоматическая отправка остановлена.';
    if(stop.includes('identityVerification'))return 'Форма запрашивает подтверждение личности. Автоматическая отправка остановлена.';
    if(stop.includes('unexpectedUpload'))return 'Форма запрашивает неожиданный файл. Проверьте её вручную.';
    if(stop.includes('unresolvedReview'))return 'В активной форме осталось поле, отмеченное для проверки.';
    if(decision.reason==='automation-paused')return 'Автоматические действия приостановлены в настройках.';
    if(decision.reason==='application-context-missing')return 'Контекст выбранной вакансии потерян. Нажмите «Отклик + письмо» ещё раз.';
    return 'Не удалось подтвердить автоматическую отправку именно для этой вакансии. Нажмите «Отклик + письмо» ещё раз.';
  }
  async function requirePermission(plan={}){const decision=await authorize(plan);if(!decision.allowed)throw new Error(denialMessage(decision));return decision;}
  root.vjaSubmissionGuard={allow,authorize,requirePermission,collectRisks,activeApplicationScope};
})(globalThis);
