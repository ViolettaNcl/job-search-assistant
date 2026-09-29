(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.vjaHhListQuickApply=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  function isSupportedHost(value){
    try{return /(^|\.)(?:hh\.ru|headhunter\.kg)$/i.test(new URL(String(value||''),'https://hh.ru').hostname);}catch{return false;}
  }
  function isSuspiciousVacancyTitle(value){const t=clean(value);return !t||/^(?:найдено\s+[\d\s.,]+\s+ваканс(?:ий|ии|ия)|вакансии|поиск\s+вакансий|результаты\s+поиска|jobs?|job\s+search|search\s+jobs?)(?:\s|$)/i.test(t);}
  function isApplyLabel(value){return /^(?:откликнуться|быстрый отклик)$/i.test(clean(value));}
  function isLetterActionLabel(value){return /^(?:приложить|добавить)(?:\s+сопроводительное)?\s+письмо(?:\s|$)/i.test(clean(value));}
  function isAppliedText(value){return /(?:вы\s+откликнулись|ваш\s+отклик\s+отправлен|отклик\s+отправлен\s+работодателю)/i.test(clean(value));}
  function isSendLetterLabel(value){return /^(?:отправить|send)$/i.test(clean(value));}
  function isInitialSubmitLabel(value){return /^(?:откликнуться|отправить\s+отклик|подать\s+заявку|apply|submit\s+application)$/i.test(clean(value));}
  function isEmployerAlreadyViewedText(value){const t=clean(value);return /(?:отклик\s+(?:уже\s+)?(?:был\s+)?просмотрен\s+работодател[а-я]*|работодател[а-я]*\s+(?:уже\s+)?просмотрел[а-я]*\s+(?:ваш\s+)?отклик)/i.test(t);}
  function isCloseLabel(value){return /^(?:закрыть|close)$/i.test(clean(value));}
  function vacancyIdFromUrl(value){try{return new URL(String(value||''),'https://hh.ru').pathname.match(/\/vacancy\/(\d+)/i)?.[1]||'';}catch{return '';}}
  function sameVacancyUrl(a,b){const x=vacancyIdFromUrl(a),y=vacancyIdFromUrl(b);return Boolean(x&&y&&x===y);}
  function htmlToText(value){
    return String(value||'')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
      .replace(/<br\s*\/?\s*>/gi,'\n')
      .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|section|article)>/gi,'\n')
      .replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;|&#160;/gi,' ')
      .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
      .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
      .replace(/\r/g,'').replace(/[\t ]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
  }
  function hhApiVacancyUrl(vacancyUrl,vacancyId){
    const id=clean(vacancyId||vacancyIdFromUrl(vacancyUrl));if(!/^\d+$/.test(id)||!isSupportedHost(vacancyUrl))return '';
    let host='hh.ru';try{if(/(^|\.)headhunter\.kg$/i.test(new URL(String(vacancyUrl)).hostname))host='headhunter.kg';}catch{}
    return `https://api.hh.ru/vacancies/${encodeURIComponent(id)}?host=${encodeURIComponent(host)}`;
  }
  function evidence(text,index,length=42){const start=Math.max(0,index-70),end=Math.min(text.length,index+length+110);return clean((start?'…':'')+text.slice(start,end)+(end<text.length?'…':''));}
  function analyzeCallRequirement(value,coverage='full-dom'){
    const original=clean(htmlToText(value));if(!original)return {status:'unknown',hasCalls:null,canApply:false,confidence:0,reason:'Описание вакансии пустое.',evidence:''};
    const lower=original.toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
    const noAll=[
      /без\s+(?:телефонн[а-я]*\s+)?звонк[а-я]*/i,/никак[а-я]*\s+звонк[а-я]*/i,/звонк[а-я]*\s+(?:не\s+)?(?:нужн[а-я]*|требу[а-я]*|отсутств[а-я]*)/i,
      /не\s+(?:нужно|надо|придется|требуется)\s+звонить/i,/\bno\s+(?:phone\s+)?calls?\b/i,/\bwithout\s+(?:phone\s+)?calls?\b/i,/\bno\s+calling\b/i
    ];
    const chatOnly=[/только\s+(?:в\s+)?чат[а-я]*/i,/только\s+переписк[а-я]*/i,/исключительно\s+(?:в\s+)?чат[а-я]*/i,/общени[а-я]*\s+только\s+(?:в\s+)?чат[а-я]*/i,/\bchat[ -]?only\b/i,/\bonly\s+(?:via\s+)?chat\b/i,/\btext[ -]?only\s+support\b/i];
    const partialNo=[/без\s+холодн[а-я]*\s+звонк[а-я]*/gi,/нет\s+холодн[а-я]*\s+звонк[а-я]*/gi,/\bno\s+cold\s+calls?\b/gi];
    const explicitNo=[...noAll,...chatOnly].map(re=>{const m=lower.match(re);return m?{match:m[0],index:m.index||0}:null;}).filter(Boolean)[0]||null;
    let scan=lower;for(const re of [...noAll,...chatOnly,...partialNo])scan=scan.replace(re,m=>' '.repeat(m.length));
    const callPatterns=[
      /входящ[а-я]*\s+(?:телефонн[а-я]*\s+)?звонк[а-я]*/i,/исходящ[а-я]*\s+(?:телефонн[а-я]*\s+)?звонк[а-я]*/i,
      /(?:принимать|прием|обрабатывать|обработка|совершать|совершение|делать)[а-я]*\s+(?:входящ[а-я]*\s+|исходящ[а-я]*\s+)?звонк[а-я]*/i,
      /обзвон[а-я]*/i,/холодн[а-я]*\s+звонк[а-я]*/i,/тепл[а-я]*\s+звонк[а-я]*/i,/звонить\s+(?:клиент|пользовател|заказчик|сотрудник)[а-я]*/i,
      /(?:общени[а-я]*|общаться|консультир[а-я]*|консультац[а-я]*)[^.!?\n]{0,45}по\s+телефону/i,
      /(?:работ[а-я]*|поддержк[а-я]*|прием[а-я]*\s+обращен[а-я]*)[^.!?\n]{0,35}по\s+телефону/i,/телефонн[а-я]*\s+переговор[а-я]*/i,
      /телефонн[а-я]*\s+(?:поддержк[а-я]*|консультац[а-я]*|коммуникац[а-я]*|общени[а-я]*|линия[а-я]*)/i,/голосов[а-я]*\s+(?:поддержк[а-я]*|коммуникац[а-я]*|канал[а-я]*)/i,
      /(?:колл|call)[ -]?центр[а-я]*/i,/(?:^|[^а-яa-z])звонк[а-я]*(?=$|[^а-яa-z])/i,/\binbound\s+(?:phone\s+)?calls?\b/i,/\boutbound\s+(?:phone\s+)?calls?\b/i,/\bphone\s+calls?\b/i,
      /\bvoice\s+support\b/i,/\btelephone\s+support\b/i,/\bcalling\s+(?:customers|clients|users|employees)\b/i,/\b(?:cold|warm)\s+calls?\b/i
    ];
    let found=null;for(const re of callPatterns){const m=scan.match(re);if(m){found={match:m[0],index:m.index||0};break;}}
    if(found)return {status:'calls',hasCalls:true,canApply:false,confidence:.98,reason:'В обязанностях найдены телефонные/голосовые звонки.',evidence:evidence(original,found.index,found.match.length)};
    if(explicitNo)return {status:'no-calls',hasCalls:false,canApply:true,confidence:.98,reason:/chat|чат|переписк|text/i.test(explicitNo.match)?'Работа явно описана как чат/переписка без телефонного канала.':'В описании прямо указано, что звонки не требуются.',evidence:evidence(original,explicitNo.index,explicitNo.match.length)};
    if(!/^full-(?:dom|structured|fetch)$/i.test(String(coverage||'')))return {status:'unknown',hasCalls:null,canApply:false,confidence:.35,reason:'На карточке нет явного упоминания звонков; нужно полное описание.',evidence:''};
    return {status:'no-calls',hasCalls:false,canApply:true,confidence:.78,reason:'В полном описании обязанности по звонкам или телефону не указаны.',evidence:''};
  }
  function chooseSendCandidate(items=[]){
    const matches=(Array.isArray(items)?items:[]).filter(x=>isSendLetterLabel(x?.label)&&x?.visible!==false&&!x?.disabled);
    return matches.length===1?{found:true,candidate:matches[0]}:{found:false,ambiguous:matches.length>1,count:matches.length};
  }
  function chooseInitialSubmitCandidate(items=[]){
    const matches=(Array.isArray(items)?items:[]).filter(x=>isInitialSubmitLabel(x?.label)&&x?.visible!==false&&!x?.disabled);
    return matches.length===1?{found:true,candidate:matches[0]}:{found:false,ambiguous:matches.length>1,count:matches.length};
  }
  function chooseCloseCandidate(items=[]){
    const matches=(Array.isArray(items)?items:[]).filter(x=>isCloseLabel(x?.label)&&x?.visible!==false&&!x?.disabled);
    return matches.length===1?{found:true,candidate:matches[0]}:{found:false,ambiguous:matches.length>1,count:matches.length};
  }
  return {clean,isSupportedHost,isSuspiciousVacancyTitle,isApplyLabel,isLetterActionLabel,isAppliedText,isSendLetterLabel,isInitialSubmitLabel,isEmployerAlreadyViewedText,isCloseLabel,vacancyIdFromUrl,sameVacancyUrl,htmlToText,hhApiVacancyUrl,analyzeCallRequirement,chooseSendCandidate,chooseInitialSubmitCandidate,chooseCloseCandidate};
});
