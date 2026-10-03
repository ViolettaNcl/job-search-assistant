/* Pure 4.0 helpers for HH search-page batch analysis, filters and queue UI. */
(function(root,factory){const F=root.vjaVacancyFit||(typeof require==='function'?require('./vacancy-fit.js'):null);const api=factory(F);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaJobSearchPage=api;})(globalThis,function(F){
  'use strict';
  const list=v=>Array.isArray(v)?v:[];
  function uniqueVacancies(items=[],max=80){const seen=new Set(),out=[];for(const v of list(items)){const id=String(v?.vacancyId||'');if(!id||seen.has(id))continue;seen.add(id);out.push(v);if(out.length>=Math.max(1,Number(max)||80))break;}return out;}
  function filterMatches(record,filter='all',preferences={}){
    if(filter==='all')return true;if(!record)return false;
    const prefs=F?.normalizePreferences?.(preferences)||preferences||{};
    if(filter==='no-calls')return record.analysis?.status==='no-calls';
    if(filter==='fit')return Number(record.fit?.score||0)>=Number(prefs.minimumFitScore||80);
    if(filter==='ready')return Boolean(record.fit?.ready&&Number(record.fit?.score||0)>=Number(prefs.minimumFitScore||80)&&record.analysis?.status!=='calls'&&!F?.terminalApplication?.(record.application)&&record.decision!=='SKIPPED');
    if(filter==='saved')return record.decision==='SAVED';
    return true;
  }
  function progress(done,total,failed=0){const d=Math.max(0,Number(done)||0),t=Math.max(0,Number(total)||0),f=Math.max(0,Number(failed)||0);return t?`${Math.min(d,t)}/${t}${f?` · ошибок ${f}`:''}`:'0/0';}
  function badgeLabel(fit){const score=Number(fit?.score);if(!Number.isFinite(score))return '';return `${Math.round(score)}% Match`;}
  return {uniqueVacancies,filterMatches,progress,badgeLabel};
});
