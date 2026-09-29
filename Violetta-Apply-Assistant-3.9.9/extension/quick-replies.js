(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaQuickReplies=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Keep the visible library deliberately small. AI handles everything outside
  // these five common one-click situations.
  const templates=[
    {id:'feedback_default',label:'Спасибо, буду ждать',text:'Здравствуйте! Спасибо за ответ. Буду ждать обратной связи.\n\nЕсли будет возможность, пожалуйста, напишите мне здесь в чате, в Telegram {{telegram}} или на почту {{email}}. По обычному телефонному звонку могу не успеть ответить.'},
    {id:'contacts',label:'Контакты',text:'Если будет возможность, пожалуйста, напишите мне здесь в чате, в Telegram {{telegram}} или на почту {{email}}. По обычному телефонному звонку могу не успеть ответить.'},
    {id:'telegram',label:'Telegram',text:'Конечно: {{telegram}}'},
    {id:'email',label:'Email',text:'Конечно: {{email}}'},
    {id:'interview_time',label:'Интервью / время',text:'Спасибо за приглашение! Мне интересно продолжить. Подскажите, пожалуйста, доступные дату, время, часовой пояс и формат собеседования — я сверю и подтвержу.'}
  ];
  const defaultPersonalReply={id:'default-feedback-ru',label:'Спасибо, буду ждать',language:'ru',text:'Здравствуйте! Спасибо за ответ. Буду ждать обратной связи.\n\nЕсли будет возможность, пожалуйста, напишите мне здесь в чате, в Telegram @Violet111 или на почту violettanicolaou@gmail.com. По обычному телефонному звонку могу не успеть ответить.'};
  function intent(s=''){
    if(/telegram|телеграм/i.test(s)&&/пришл|отправ|укаж|какой|send|share|what/i.test(s))return 'REQUEST_TELEGRAM';
    if(/email|e-mail|почт/i.test(s)&&/пришл|отправ|укаж|какой|send|share|what/i.test(s))return 'REQUEST_EMAIL';
    if(/когда.*удоб|созвон|available|availability|call|интервью|собеседован|interview/i.test(s))return 'INTERVIEW';
    if(/контакт|связаться|contact|reach you/i.test(s))return 'REQUEST_CONTACT';
    if(/рассмотрим|верн[её]мся|обратн.*связ|review.*(?:resume|application)|get back|reviewing|спасибо|thank/i.test(s))return 'WAIT_FOR_FEEDBACK';
    return 'CUSTOM';
  }
  function render(text,vars={}){
    let missing=false;
    const result=String(text||'').replace(/\{\{\s*(firstName|email|telegram|jobTitle|company|recruiterName)\s*\}\}/g,(_,key)=>{const v=String(vars[key]||'').trim();if(!v)missing=true;return v;});
    return missing||/\{\{/.test(result)?'':result.slice(0,4000);
  }
  function library(_lang='ru',vars={},personal=[]){
    const custom=personal.find(t=>(!t.language||t.language==='ru')&&t.id==='default-feedback-ru');
    const primary=custom?{id:'feedback_default',label:String(custom.label||'Спасибо, буду ждать').slice(0,50),text:render(custom.text,vars)}:{id:'feedback_default',label:templates[0].label,text:render(templates[0].text,vars)};
    const fixed=templates.slice(1).map(t=>({id:t.id,label:t.label,text:render(t.text,vars)}));
    return [primary,...fixed].filter(t=>t.text).slice(0,5);
  }
  function suggest(latest,_lang,vars,recent=[],personal=[],candidateMessages=[]){
    const map={REQUEST_TELEGRAM:['telegram'],REQUEST_EMAIL:['email'],INTERVIEW:['interview_time'],REQUEST_CONTACT:['contacts'],WAIT_FOR_FEEDBACK:['feedback_default']};
    const ids=map[intent(latest)]||[];const used=new Set(recent.filter(x=>Date.now()-x.at<10*60*1000).map(x=>x.id));const sent=new Set(candidateMessages.slice(-4).map(x=>String(x.text||x).trim()));
    return library('ru',vars,personal).filter(t=>ids.includes(t.id)&&!used.has(t.id)&&!sent.has(t.text)).slice(0,2);
  }
  return {templates,defaultPersonalReply,intent,render,library,suggest};
});
