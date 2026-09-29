(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaApplicationState=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const states={IDLE:'IDLE',ANALYZING:'ANALYZING',CV_SELECTED:'CV_SELECTED',LETTER_READY:'LETTER_READY',OPENING_APPLICATION:'OPENING_APPLICATION',FILLING:'FILLING',SUBMITTING:'SUBMITTING',REVIEW_REQUIRED:'REVIEW_REQUIRED',CONFIRMED:'CONFIRMED',FAILED:'FAILED',DUPLICATE:'DUPLICATE'};
  const terminal=new Set([states.CONFIRMED,states.DUPLICATE]);
  const allowed={
    IDLE:['ANALYZING','DUPLICATE'],ANALYZING:['CV_SELECTED','REVIEW_REQUIRED','FAILED','DUPLICATE'],CV_SELECTED:['LETTER_READY','REVIEW_REQUIRED','FAILED'],LETTER_READY:['OPENING_APPLICATION','FILLING','SUBMITTING','REVIEW_REQUIRED','FAILED'],OPENING_APPLICATION:['FILLING','SUBMITTING','REVIEW_REQUIRED','FAILED'],FILLING:['SUBMITTING','REVIEW_REQUIRED','FAILED'],SUBMITTING:['CONFIRMED','REVIEW_REQUIRED','FAILED'],REVIEW_REQUIRED:['ANALYZING','FILLING','SUBMITTING','FAILED'],FAILED:['ANALYZING'],CONFIRMED:[],DUPLICATE:[]
  };
  function normalize(value){const v=String(value||'').toUpperCase();return Object.values(states).includes(v)?v:states.IDLE;}
  function can(from,to){from=normalize(from);to=normalize(to);return from===to||(allowed[from]||[]).includes(to);}
  function transition(current,to,meta={},now=Date.now()){
    const from=normalize(current?.state||current);to=normalize(to);if(!can(from,to))return {...(typeof current==='object'?current:{}),state:from,invalidTransition:{from,to,at:now}};
    const history=[...((typeof current==='object'&&current?.history)||[]),{from,to,at:now,meta}].slice(-30);
    return {state:to,updatedAt:now,history,lastMeta:meta};
  }
  function label(state){return ({IDLE:'✦ Apply',ANALYZING:'◌ Анализирую…',CV_SELECTED:'◌ Выбираю CV…',LETTER_READY:'◌ Готовлю письмо…',OPENING_APPLICATION:'◌ Открываю отклик…',FILLING:'◌ Заполняю…',SUBMITTING:'◌ Отправляю…',REVIEW_REQUIRED:'! Нужна проверка',CONFIRMED:'✓ Отклик отправлен',FAILED:'! Повторить',DUPLICATE:'✓ Уже откликнулись'})[normalize(state)]||'✦ Apply';}
  return {states,normalize,can,transition,label,isTerminal:state=>terminal.has(normalize(state))};
});
