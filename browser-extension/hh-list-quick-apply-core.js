(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.vjaHhListQuickApply=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  function isApplyLabel(value){return /^(?:откликнуться|быстрый отклик)$/i.test(clean(value));}
  function isLetterActionLabel(value){return /^(?:приложить|добавить)(?:\s+сопроводительное)?\s+письмо(?:\s|$)/i.test(clean(value));}
  function isAppliedText(value){return /(?:вы\s+откликнулись|ваш\s+отклик\s+отправлен|отклик\s+отправлен\s+работодателю)/i.test(clean(value));}
  function isSendLetterLabel(value){return /^(?:отправить|send)$/i.test(clean(value));}
  function vacancyIdFromUrl(value){try{return new URL(String(value||''),'https://hh.ru').pathname.match(/\/vacancy\/(\d+)/i)?.[1]||'';}catch{return '';}}
  function sameVacancyUrl(a,b){const x=vacancyIdFromUrl(a),y=vacancyIdFromUrl(b);return Boolean(x&&y&&x===y);}
  function chooseSendCandidate(items=[]){
    const matches=(Array.isArray(items)?items:[]).filter(x=>isSendLetterLabel(x?.label)&&x?.visible!==false&&!x?.disabled);
    return matches.length===1?{found:true,candidate:matches[0]}:{found:false,ambiguous:matches.length>1,count:matches.length};
  }
  return {clean,isApplyLabel,isLetterActionLabel,isAppliedText,isSendLetterLabel,vacancyIdFromUrl,sameVacancyUrl,chooseSendCandidate};
});
