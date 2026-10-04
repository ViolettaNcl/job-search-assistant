/* Questionnaire UI + dynamic-form watcher + user-correction capture (5.2.0). */
(function(root){
  'use strict';
  if(root.vjaQuestionnaireContent)return;
  const Q=root.vjaQuestionnaireCore,A=root.vjaSiteAdapters;
  const watchers=new WeakMap(),corrections=new WeakMap();
  const fieldValue=el=>String(el?.isContentEditable?el.textContent:el?.value??'').replace(/\s+/g,' ').trim();
  function statusHost(el){
    let host=el?.parentElement?.querySelector?.(':scope > [data-vja-root="questionnaire-status"]');
    if(host)return host;host=document.createElement('span');host.dataset.vjaRoot='questionnaire-status';host.style.cssText='display:inline-flex;margin:4px 0 2px 6px;font:600 11px/1.2 system-ui,sans-serif;border-radius:999px;padding:3px 7px;vertical-align:middle;max-width:230px;white-space:normal;';
    try{el.insertAdjacentElement('afterend',host);}catch{el.parentElement?.append(host);}return host;
  }
  function vacancyIdFromPage(){try{const u=new URL(location.href);return u.searchParams.get('vacancyId')||u.searchParams.get('vacancy_id')||u.searchParams.get('vacancy')||u.pathname.match(/\/vacancy\/(\d+)/)?.[1]||'';}catch{return '';}}
  function trackCorrection(el,meta={}){
    if(!el||corrections.has(el))return;const state={original:fieldValue(el),timer:null,meta:{category:meta.category||'UNKNOWN',semanticKey:meta.semanticKey||'',question:meta.question||'',vacancyId:meta.vacancyId||vacancyIdFromPage()}};corrections.set(el,state);
    const handler=e=>{if(e?.isTrusted!==true)return;clearTimeout(state.timer);state.timer=setTimeout(()=>{const corrected=fieldValue(el);if(!corrected||corrected===state.original)return;chrome.runtime?.sendMessage?.({type:'vjaCopilot',op:'questionnaire-correction',originalValue:state.original,correctedValue:corrected,category:state.meta.category,semanticKey:state.meta.semanticKey,question:state.meta.question,vacancyId:state.meta.vacancyId,url:location.href}).catch?.(()=>{});state.original=corrected;},420);};
    el.addEventListener('input',handler,true);el.addEventListener('change',handler,true);
  }
  function decorate(el,state,meta={}){
    if(!el?.isConnected)return;const host=statusHost(el),label=Q.stateLabel(state);host.textContent=label;host.dataset.state=state;host.title=meta.reason||'';
    if(state==='filled')host.style.cssText+='background:#e9f8ef;color:#17633a;border:1px solid #b8e4c8;';
    else if(state==='suggested')host.style.cssText+='background:#eef4ff;color:#35558a;border:1px solid #bfd0ee;';
    else if(state==='review')host.style.cssText+='background:#fff8e7;color:#7a5914;border:1px solid #ecd18d;';
    else host.style.cssText+='background:#f4f5f8;color:#626b7b;border:1px solid #d8dce5;';
    if(meta.semanticKey)el.dataset.vjaQuestionnaireSemantic=meta.semanticKey;if(meta.category)el.dataset.vjaQuestionnaireCategory=meta.category;if(state==='filled'){el.dataset.vjaQuestionnaireAutofilled='1';delete el.dataset.vjaQuestionnaireSuggested;}else if(state==='suggested'){el.dataset.vjaQuestionnaireSuggested='1';delete el.dataset.vjaQuestionnaireAutofilled;}
    if(['filled','suggested'].includes(state))trackCorrection(el,{...meta,question:meta.question||Q.questionText?.(el,A)||''});
  }
  function signature(scope){
    const fields=A.formFields(scope);return fields.map((el,i)=>{const f=A.descriptor(el,i),q=Q.questionText(el,A);return Q.hash([f.type,f.required,q].join('|'));}).join(':');
  }
  function observeForm(scope,onChange){
    if(!scope||watchers.has(scope))return watchers.get(scope)||null;let last=signature(scope),timer=null;
    const observer=new MutationObserver(records=>{
      if(records.every(r=>r.target instanceof Element&&r.target.closest?.('[data-vja-root]')))return;
      clearTimeout(timer);timer=setTimeout(()=>{if(!scope.isConnected)return;const next=signature(scope);if(next&&next!==last){last=next;onChange?.(next);}},260);
    });observer.observe(scope,{childList:true,subtree:true});watchers.set(scope,observer);return observer;
  }
  root.vjaQuestionnaireContent={decorate,observeForm,trackCorrection,questionText:(el)=>Q.questionText(el,A),signature};
})(globalThis);
