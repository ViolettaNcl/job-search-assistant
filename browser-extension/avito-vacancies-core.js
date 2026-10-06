/* Avito vacancies BETA: pure URL/state helpers shared by the content script and tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaAvitoVacanciesCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  function isSupportedHost(value){try{const h=new URL(String(value||''),'https://www.avito.ru').hostname.toLowerCase();return h==='avito.ru'||h.endsWith('.avito.ru');}catch{return false;}}
  function vacancyIdFromUrl(value){
    try{
      const u=new URL(String(value||''),'https://www.avito.ru');
      for(const key of ['itemId','item_id','adId','ad_id'])if(u.searchParams.get(key))return clean(u.searchParams.get(key));
      const last=decodeURIComponent(u.pathname.split('/').filter(Boolean).at(-1)||'');
      return last.match(/_(\d{6,})(?:$|[/?#])/)?.[1]||'';
    }catch{return '';}
  }
  function isVacancyUrl(value){try{const u=new URL(String(value||''),'https://www.avito.ru');return isSupportedHost(u.href)&&/\/vakansii\//i.test(u.pathname)&&Boolean(vacancyIdFromUrl(u.href));}catch{return false;}}
  function isListUrl(value){try{const u=new URL(String(value||''),'https://www.avito.ru');return isSupportedHost(u.href)&&/\/vakansii(?:\/|$)/i.test(u.pathname)&&!vacancyIdFromUrl(u.href);}catch{return false;}}
  function fitState(fit={}){const score=Number(fit?.score);if(!Number.isFinite(score))return 'unknown';return score>=88?'strong':score>=80?'match':score>=60?'review':'skip';}
  function callsState(analysis={}){return ['calls','no-calls'].includes(analysis?.status)?analysis.status:'unknown';}
  function analysisTitle(result={}){
    const fit=result.fit||{},analysis=result.analysis||{};
    return [
      Number.isFinite(Number(fit.score))?`Fit: ${Math.round(Number(fit.score))}%`:'',
      ...(Array.isArray(fit.reasons)?fit.reasons.slice(0,4):[]),
      ...(Array.isArray(fit.risks)?fit.risks.slice(0,4).map(x=>`Риск: ${x}`):[]),
      analysis.reason||'',
      analysis.evidence?`Фрагмент: ${analysis.evidence}`:'',
      result.source?`Источник: ${result.source}`:''
    ].filter(Boolean).join('\n');
  }
  function filterMatches(result,filter='all'){
    if(filter==='all')return true;
    if(!result)return false;
    if(filter==='no-calls')return callsState(result.analysis)==='no-calls';
    if(filter==='match')return Number(result.fit?.score||0)>=80;
    if(filter==='strong')return Number(result.fit?.score||0)>=88;
    return true;
  }
  function uniqueVacancies(items=[],limit=50){const out=[],seen=new Set();for(const item of Array.isArray(items)?items:[]){const id=String(item?.vacancyId||'');if(!id||seen.has(id))continue;seen.add(id);out.push(item);if(out.length>=Math.max(1,Number(limit)||50))break;}return out;}
  return {clean,isSupportedHost,vacancyIdFromUrl,isVacancyUrl,isListUrl,fitState,callsState,analysisTitle,filterMatches,uniqueVacancies};
});
