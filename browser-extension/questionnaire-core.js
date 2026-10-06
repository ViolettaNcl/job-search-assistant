/* Smart questionnaire understanding helpers (5.2.0). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.vjaQuestionnaireCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const categories=[
    'TIMEZONE','RUSSIAN_LEVEL','GREEK_LEVEL','FRENCH_LEVEL','SLA','TICKET_SYSTEMS','FINTECH','ECOMMERCE','CONFLICT_RESOLUTION','TROUBLESHOOTING','GITHUB','SALARY','DOMAIN_EXPERIENCE','CHAT_SALES','CHAT_VOLUME','EXPERIENCE','PROJECTS','TECH_STACK','PROGRAMMING_LANGUAGE','ENGLISH_LEVEL','OTHER_LANGUAGE','EDUCATION','LOCATION','REMOTE_WORK','RELOCATION','SCHEDULE','AVAILABILITY','START_DATE','CONTACT','TELEGRAM','EMAIL','PHONE','COVER_LETTER','WHY_COMPANY','WHY_ROLE','MOTIVATION','ACHIEVEMENTS','SUPPORT_EXPERIENCE','CUSTOMER_SERVICE','DATABASES','API','CRM','LINUX','WINDOWS','NETWORKING','AI','OTHER_TECHNICAL','LEGAL','WORK_AUTHORIZATION','CONSENT','UNKNOWN'
  ];
  function clean(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function normalize(value){return clean(value).toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[«»“”"'`]/g,'').replace(/[^a-zа-я0-9#+.\-/ ]+/gi,' ').replace(/\s+/g,' ').trim();}
  function language(value){const s=String(value||'');const ru=(s.match(/[а-яё]/gi)||[]).length,en=(s.match(/[a-z]/gi)||[]).length;if(ru>=4&&ru>=Math.ceil(en*0.35))return 'ru';return ru>=en?'ru':'en';}
  function classify(question,field={}){
    const s=normalize([question,field.label,field.name,field.placeholder].filter(Boolean).join(' '));
    const type=String(field.type||'').toLowerCase();
    if(/паспорт|инн\b|снилс|судимост|passport|social security|criminal record|citizenship|дата рождения|date of birth/i.test(s))return 'LEGAL';
    if(/часов.*пояс|timezone|time zone|utc|gmt/i.test(s)&&!/смен|schedule/i.test(s))return 'TIMEZONE';
    if(/github|гитхаб/i.test(s))return 'GITHUB';
    if(/греческ|greek/i.test(s))return 'GREEK_LEVEL';
    if(/француз|french/i.test(s))return 'FRENCH_LEVEL';
    if(/русск.*язык|уровень.*русск|russian/i.test(s))return 'RUSSIAN_LEVEL';
    if(/\bsla\b|соглашен.*уровн.*сервис/i.test(s))return 'SLA';
    if(/тикет.*систем|ticket.*system|zendesk|jira service|freshdesk/i.test(s))return 'TICKET_SYSTEMS';
    if(/fintech|финтех/i.test(s))return 'FINTECH';
    if(/e.?commerce|электронн.*коммерц/i.test(s))return 'ECOMMERCE';
    if(/(?:как|how).*(?:конфликт|недовольн|сложн.*клиент|angry|difficult customer|conflict)/i.test(s))return 'CONFLICT_RESOLUTION';
    if(/(?:как|how).*(?:диагност|устран.*ошиб|troubleshoot|debug)/i.test(s))return 'TROUBLESHOOTING';
    if(/зарплат|оклад|доход|вилк|salary|compensation|expected pay|rate\b|оплат/i.test(s))return 'SALARY';
    if(/gambling|betting|гембл|беттинг|букмек|казино|ставк.*спорт/i.test(s))return 'DOMAIN_EXPERIENCE';
    if(/(?:продаж|sales).{0,35}(?:чат|переписк)|(?:чат|переписк).{0,35}(?:продаж|sales)/i.test(s))return 'CHAT_SALES';
    if(/сколько.{0,45}(?:чат|тикет|обращен)|(?:чат|тикет|обращен).{0,45}(?:смен|день|обработ)/i.test(s))return 'CHAT_VOLUME';
    if(/соглас|privacy|персональн.*данн|terms|услови.*политик|legal|подтверждаю|agree|accept.*terms|обработк.*данн/i.test(s))return 'CONSENT';
    if(/гражданств|разрешен.*работ|разрешён.*работ|work authori[sz]|work permit|visa|sponsor/i.test(s))return 'WORK_AUTHORIZATION';
    if(/дата.*выход|когда.*(?:приступ|начать)|start date|notice period|available.*start/i.test(s))return 'START_DATE';
    if(/релокац|переезд|relocat/i.test(s))return 'RELOCATION';
    if(/график|смен|schedule|2\/2|5\/2|night shift|ночн.*смен/i.test(s))return 'SCHEDULE';
    if(/доступн|готов.*начать|availability|сколько.*час|hours per week/i.test(s))return 'AVAILABILITY';
    if(/удален|удалён|remote|hybrid|гибрид/i.test(s))return 'REMOTE_WORK';
    if(/английск|english|уровень.*англ|english level/i.test(s))return 'ENGLISH_LEVEL';
    if(/друг.*язык|язык.{0,30}(?:владе|знаете)|languages?|greek|греческ|french|француз/i.test(s))return 'OTHER_LANGUAGE';
    if(/проект|projects?|portfolio|портфолио/i.test(s))return 'PROJECTS';
    if(/стек|tech stack|technolog|технолог|инструмент|tools?\b/i.test(s))return 'TECH_STACK';
    if(/язык.*программ|programming language|какие.*язык.*(?:код|программ)/i.test(s))return 'PROGRAMMING_LANGUAGE';
    if(/технич.*поддерж|technical support|help.?desk|troubleshoot|support experience|опыт.*поддерж/i.test(s))return 'SUPPORT_EXPERIENCE';
    if(/клиент.*сервис|customer service|работ.*клиент|общен.*клиент|общён.*клиент/i.test(s))return 'CUSTOMER_SERVICE';
    if(/баз.*данн|database|sql\b|postgres|mysql|sqlite/i.test(s))return 'DATABASES';
    if(/\bapi\b|rest|интеграц/i.test(s))return 'API';
    if(/\bcrm\b/i.test(s))return 'CRM';
    if(/\blinux\b|ubuntu/i.test(s))return 'LINUX';
    if(/\bwindows\b/i.test(s))return 'WINDOWS';
    if(/сет|network|tcp|dns|vpn|routing/i.test(s))return 'NETWORKING';
    if(/\bai\b|искусствен.*интеллект|нейросет|llm|gemini|openai/i.test(s))return 'AI';
    if(/образован|education|диплом|учил|универс|college|academy/i.test(s))return 'EDUCATION';
    if(/город|место.*житель|место.*прожив|location|where.*located/i.test(s))return 'LOCATION';
    if(/telegram|телеграм/i.test(s))return 'TELEGRAM';
    if(/e.?mail|электронн.*почт/i.test(s)||type==='email')return 'EMAIL';
    if(/телефон|phone|mobile/i.test(s)||type==='tel')return 'PHONE';
    if(/контакт|contact/i.test(s))return 'CONTACT';
    if(/сопровод|cover letter/i.test(s))return 'COVER_LETTER';
    if(/почему.*(?:наш|компан)|why.*company|why.*us|почему.*именно.*компан/i.test(s))return 'WHY_COMPANY';
    if(/почему.*(?:ваканс|позици|роль)|why.*role|why.*position|интерес.*ваканс/i.test(s))return 'WHY_ROLE';
    if(/мотивац|motivat|что.*интерес|почему.*хот/i.test(s))return 'MOTIVATION';
    if(/достижен|achievement|результат.*работ|успех/i.test(s))return 'ACHIEVEMENTS';
    if(/опыт|experience|стаж|commercial/i.test(s))return 'EXPERIENCE';
    if(/техническ|technical|debug|ошиб|bug|разработ|developer|программ/i.test(s))return 'OTHER_TECHNICAL';
    if(type==='checkbox'||type==='radio'||type==='radiogroup')return 'LEGAL';
    return 'UNKNOWN';
  }
  const vacancySpecific=new Set(['WHY_COMPANY','WHY_ROLE','MOTIVATION','COVER_LETTER']);
  const legalOrDecision=new Set(['SALARY','LEGAL','WORK_AUTHORIZATION','CONSENT','START_DATE','RELOCATION','AVAILABILITY','SCHEDULE']);
  function isVacancySpecific(category){return vacancySpecific.has(category);}
  function isDecisionCategory(category){return legalOrDecision.has(category);}
  function semanticKey(category,question,vacancyKey=''){
    const c=categories.includes(category)?category:'UNKNOWN';
    if(isVacancySpecific(c))return `${c}:${String(vacancyKey||'vacancy')}:${hash(normalize(question)).slice(0,12)}`;
    // A shared category is not evidence that two factual questions ask the same thing.
    const exact = new Set(['UNKNOWN','OTHER_LANGUAGE','TECH_STACK','PROGRAMMING_LANGUAGE','EXPERIENCE','SUPPORT_EXPERIENCE','CUSTOMER_SERVICE','PROJECTS','DOMAIN_EXPERIENCE','DATABASES','API','CRM','SLA','TICKET_SYSTEMS','FINTECH','ECOMMERCE','ACHIEVEMENTS','OTHER_TECHNICAL','AVAILABILITY','SCHEDULE','REMOTE_WORK']);
    return exact.has(c) ? `${c}:${hash(normalize(question))}` : c;
  }
  function hash(value){let h=2166136261;for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  function questionText(el,adapter){
    if(!el)return '';
    const parts=[];
    const push=v=>{v=clean(v);if(v&&!parts.includes(v))parts.push(v);};
    try{push(adapter?.label?.(el));}catch{}
    try{push(el.getAttribute?.('aria-label'));push(el.getAttribute?.('placeholder'));}catch{}
    let node=el.parentElement;
    for(let depth=0;node&&depth<5;depth++,node=node.parentElement){
      if(node.matches?.('form,body,main'))break;
      const controls=node.querySelectorAll?.('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="radiogroup"]')?.length||0;
      if(controls>2)break;
      const clone=node.cloneNode(true);
      clone.querySelectorAll?.('input,textarea,select,button,script,style,[data-vja-root]').forEach(x=>x.remove());
      const t=clean(clone.innerText||clone.textContent||'');
      if(t&&t.length<=1400)push(t);
    }
    try{
      let prev=el.previousElementSibling,count=0;
      while(prev&&count<3){const t=clean(prev.innerText||prev.textContent||'');if(t&&t.length<900)push(t);prev=prev.previousElementSibling;count++;}
    }catch{}
    return clean(parts.join(' · ').replace(/(?:писать|напишите|write)\s+(?:тут|here)/ig,''));
  }
  function stateLabel(state){return state==='filled'?'✓ Заполнено автоматически':state==='suggested'?'✎ Черновик — проверьте':state==='review'?'! Проверьте ответ':state==='unknown'?'? Нет данных':'';}
  return {categories,clean,normalize,language,classify,isVacancySpecific,isDecisionCategory,semanticKey,hash,questionText,stateLabel};
});
