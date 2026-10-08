/* HH list surfaces: search AND homepage recommendation feeds.
 * DOM discovery only. No analysis requests, navigation, or application submission.
 * A page headline/tab label is never used as a vacancy identity.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.vjaHhListSurfaces=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CARD_SELECTOR='[data-qa="vacancy-serp__vacancy"],[data-qa="vacancy-card"],[data-qa="vacancy-recommendation"],[data-qa="recommended-vacancy"],[data-vacancy-id],[class*="vacancy-card"],[class*="vacancyCard"],[class*="serp-item"],article';
  const EXCLUDED='[data-vja-root],nav,footer,[role="navigation"],[role="dialog"],dialog';
  const OWN_UI='[data-vja-root],[id^="vja-"],.vja-card-fast-apply,.vja-card-call-analysis,.vja-card-fit-badge,.vja-card-calls-chip,.vja-intel-feedback-wrap,.vja-intel-feedback';
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  function vacancyId(url,base='https://hh.ru'){
    try { const u=new URL(String(url||''),base);return /^https?:$/.test(u.protocol)&&/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(u.hostname)?u.pathname.match(/^\/vacancy\/(\d+)(?:\/|$)/i)?.[1]||'':''; }catch{return '';}
  }
  function pageKind(url,hasCards=false){
    try {
      const u=new URL(String(url||''));
      if(!/^https?:$/.test(u.protocol)||!/(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(u.hostname)||u.hostname==='api.hh.ru')return '';
      const path=u.pathname;
      // A vacancy's related jobs and a recruiter's chat links must not start a list flow.
      if(/^\/vacancy\/\d+(?:\/|$)/i.test(path)||/(?:^|\/)(?:resume|resumes|negotiations?|chats?|messages|login|account|settings|vacancy_response|application|questionnaire|screening)(?:[/.]|$)/i.test(path))return '';
      // Inspect pathname, not marketing/search query strings that happen to contain 'jobs'.
      if(/(?:^|\/)(?:search\/vacancy|vacancy\/search|vacancies|jobs)(?:\/|$)/i.test(path))return 'search';
      // Includes /?utm_..., /applicant and feed/collection URLs. Real cards are required.
      return hasCards?'recommendations':'';
    }catch{return '';}
  }
  function onActiveSurface(element){
    if(!element?.isConnected)return false;
    const view=element.ownerDocument?.defaultView;
    for(let node=element;node?.nodeType===1;node=node.parentElement){
      if(node.hidden||node.getAttribute('aria-hidden')==='true')return false;
      const style=view?.getComputedStyle?.(node);
      // Extension Fit/Calls filtering must be reversible. Hidden native tab panels are not.
      if(style&&(style.display==='none'&&!node.classList.contains('vja-intel-hidden')||style.visibility==='hidden'||style.visibility==='collapse'))return false;
    }
    return true;
  }
  function vacancyLinks(element){
    if(!element?.querySelectorAll)return [];
    const links=[...(element.matches?.('a[href*="/vacancy/"]')?[element]:[]),...element.querySelectorAll('a[href*="/vacancy/"]')];
    return links.filter(link=>!link.closest(OWN_UI)&&vacancyId(link.href||link.getAttribute('href'),link.ownerDocument?.baseURI));
  }
  function cardId(element){
    const ids=new Set(vacancyLinks(element).map(a=>vacancyId(a.href||a.getAttribute('href'),a.ownerDocument?.baseURI)));
    return ids.size===1?[...ids][0]:'';
  }
  function nativeAction(element){
    return [...element.querySelectorAll('button,a,[role="button"]')].some(el=>!el.closest(OWN_UI)&&/^(?:откликнуться|быстрый отклик|приложить (?:сопроводительное )?письмо)$/i.test(clean(el.innerText||el.textContent||el.getAttribute('aria-label'))));
  }
  function cardFor(element){
    if(!element?.closest||element.closest(EXCLUDED)||element.closest(OWN_UI))return null;
    for(let node=element,depth=0;node&&depth<12;node=node.parentElement,depth++){
      if(node.matches('body,html,main,nav,footer,[role="main"],[role="dialog"]'))break;
      if(node.matches('a,button,input,h1,h2,h3,span'))continue;
      const id=cardId(node);
      if(!id)continue;
      const action=nativeAction(node)||/вы откликнулись|отклик отправлен/i.test(clean(node.innerText||node.textContent));
      // Do not mistake a title wrapper with 'vacancy-card' in its CSS name for the card.
      const stable=node.matches('article,[data-qa="vacancy-serp__vacancy"],[data-qa="vacancy-card"],[data-qa="vacancy-recommendation"],[data-qa="recommended-vacancy"]');
      if(action||stable&&node.matches(CARD_SELECTOR))return node;
    }
    return null;
  }
  function cards(doc){
    const found=new Set();
    for(const link of doc.querySelectorAll('a[href*="/vacancy/"]')){const card=cardFor(link);if(card&&onActiveSurface(card))found.add(card);}
    return [...found];
  }
  function isListPage(doc,url){
    if(pageKind(url,false)==='search')return true;
    if(!pageKind(url,true))return false;
    for(const link of doc.querySelectorAll('a[href*="/vacancy/"]')){const card=cardFor(link);if(card&&onActiveSurface(card))return true;}
    return false;
  }
  function meaningfulMutations(changes){
    const isOwn=node=>{const e=node?.nodeType===1?node:node?.parentElement;return Boolean(e?.closest?.(OWN_UI));};
    const nativeClasses=value=>String(value||'').split(/\s+/).filter(x=>x&&!x.startsWith('vja-')).sort().join(' ');
    return changes.some(change=>{
      if(isOwn(change.target))return false;
      if(change.type==='attributes'){
        if(change.attributeName==='class'&&nativeClasses(change.oldValue)===nativeClasses(change.target.className))return false;
        return true;
      }
      if(change.type==='childList'){
        // HH may remove just our controls while recycling a card. Restore them,
        // but ignore our own insertions/text changes to avoid an observer loop.
        if([...change.removedNodes].some(node=>isOwn(node)))return true;
        return [...change.addedNodes,...change.removedNodes].some(node=>!isOwn(node));
      }
      return false;
    });
  }
  return {pageKind,vacancyId,isListPage,cards,cardFor,cardId,onActiveSurface,meaningfulMutations};
});
