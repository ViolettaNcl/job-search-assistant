(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.vjaFollowUpIntelligence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DAY=24*60*60*1000;
  const WEEKDAYS={
    ru:{'воскресенье':0,'воскресенья':0,'понедельник':1,'понедельника':1,'вторник':2,'вторника':2,'среда':3,'среды':3,'четверг':4,'четверга':4,'пятница':5,'пятницы':5,'суббота':6,'субботы':6},
    en:{sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6}
  };
  const MONTHS_RU={января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};

  function clean(value,max=1200){return String(value||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
  function atHour(date,hour=18){const d=new Date(date);d.setHours(hour,0,0,0);return d;}
  function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+Number(n||0));return d;}
  function addBusinessDays(date,n){
    const d=new Date(date);let left=Math.max(0,Math.floor(Number(n)||0));
    while(left>0){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)left--;}
    return d;
  }
  function nextWeekday(base,target){
    const d=new Date(base);let delta=(target-d.getDay()+7)%7;if(delta===0)delta=7;d.setDate(d.getDate()+delta);return d;
  }
  function classify(text=''){
    const s=clean(text).toLowerCase();
    if(/тестов\S*\s+(?:задан|работ)|дедлайн\S*\s+тест|test\s+(?:assignment|task)|coding\s+challenge|take[- ]?home/.test(s))return 'test-deadline';
    if(/интервью|собеседован|созвон|встреч|interview|screening\s+call|meeting|video\s+call/.test(s))return 'interview';
    if(/обратн\S*\s+связ|верн\S*\s+(?:с|к\s+вам)|ответим|сообщим|рассмотрим|feedback|get\s+back|hear\s+back|review\S*\s+(?:resume|application)|let\s+you\s+know/.test(s))return 'feedback';
    return '';
  }
  function parseExplicitDate(text,base=new Date()){
    const s=clean(text).toLowerCase();
    const b=new Date(base);
    let m;
    if(/послезавтра/.test(s))return {date:atHour(addDays(b,2)),phrase:'послезавтра',precision:'day'};
    if(/завтра|\btomorrow\b/.test(s))return {date:atHour(addDays(b,1)),phrase:/tomorrow/.test(s)?'tomorrow':'завтра',precision:'day'};

    m=s.match(/(?:через|в\s+течение)\s+(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?\s*(?:рабоч(?:их|его|ие)?\s*)?(?:дн(?:я|ей|и)|day(?:s)?)/i);
    if(m){const n=Number(m[2]||m[1]);const business=/рабоч/i.test(m[0]);const d=business?addBusinessDays(b,n):addDays(b,n);return {date:atHour(d),phrase:m[0],precision:'relative'};}
    m=s.match(/(?:within|in)\s+(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?\s*(business\s+)?days?/i);
    if(m){const n=Number(m[2]||m[1]);const d=m[3]?addBusinessDays(b,n):addDays(b,n);return {date:atHour(d),phrase:m[0],precision:'relative'};}

    m=s.match(/(?:до|к|не\s+позднее)\s+(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/i);
    if(m){let y=m[3]?Number(m[3]):b.getFullYear();if(y<100)y+=2000;let d=new Date(y,Number(m[2])-1,Number(m[1]),18,0,0,0);if(!m[3]&&d.getTime()<b.getTime()-DAY)d.setFullYear(d.getFullYear()+1);return {date:d,phrase:m[0],precision:'date'};}
    m=s.match(/(?:by|before)\s+(\d{4})-(\d{1,2})-(\d{1,2})/i);
    if(m){return {date:new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),18,0,0,0),phrase:m[0],precision:'date'};}
    m=s.match(/(?:до|к|не\s+позднее)\s+(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?/i);
    if(m){let y=m[3]?Number(m[3]):b.getFullYear();let d=new Date(y,MONTHS_RU[m[2]],Number(m[1]),18,0,0,0);if(!m[3]&&d.getTime()<b.getTime()-DAY)d.setFullYear(d.getFullYear()+1);return {date:d,phrase:m[0],precision:'date'};}

    for(const [lang,map] of Object.entries(WEEKDAYS)){
      for(const [word,day] of Object.entries(map)){
        const re=lang==='ru'?new RegExp(`(?:до|к|в|на)\\s+${word}(?=$|\\s|[,.!?])`,'i'):new RegExp(`(?:by|on)\\s+${word}\\b`,'i');
        const hit=s.match(re);if(hit)return {date:atHour(nextWeekday(b,day)),phrase:hit[0],precision:'weekday'};
      }
    }
    if(/на\s+следующ(?:ей|ую)\s+недел|next\s+week/.test(s))return {date:atHour(addDays(b,7)),phrase:/next\s+week/.test(s)?'next week':'на следующей неделе',precision:'week'};
    return null;
  }
  function extract(text,base=Date.now()){
    const sourceText=clean(text,2000);if(!sourceText)return null;
    const type=classify(sourceText);if(!type)return null;
    const parsed=parseExplicitDate(sourceText,new Date(base));if(!parsed)return null;
    const dueAt=parsed.date.getTime();if(!Number.isFinite(dueAt))return null;
    const labels={feedback:'Уточнить обратную связь',interview:'Собеседование / созвон','test-deadline':'Срок тестового задания'};
    return {type,dueAt,label:labels[type],sourceText,sourcePhrase:parsed.phrase,precision:parsed.precision,confidence:(parsed.precision==='relative'||parsed.precision==='date')?0.96:0.90,source:'chat-explicit'};
  }
  function normalizeAction(value){
    if(!value||!Number.isFinite(Number(value.dueAt)))return null;
    return {type:clean(value.type,60),dueAt:Number(value.dueAt),label:clean(value.label,160),sourceText:clean(value.sourceText,2000),sourcePhrase:clean(value.sourcePhrase,160),precision:clean(value.precision,40),confidence:Math.max(0,Math.min(1,Number(value.confidence)||0)),source:clean(value.source,80),createdAt:Number(value.createdAt)||Date.now(),doneAt:Number(value.doneAt)||0,dismissedAt:Number(value.dismissedAt)||0,snoozedFrom:Number(value.snoozedFrom)||0};
  }
  function isOpen(action){const a=normalizeAction(action);return Boolean(a&&!a.doneAt&&!a.dismissedAt);}
  function isDue(action,now=Date.now()){const a=normalizeAction(action);return Boolean(a&&!a.doneAt&&!a.dismissedAt&&a.dueAt<=now);}
  function dueItems(applications,now=Date.now()){
    return (Array.isArray(applications)?applications:[]).filter(a=>isDue(a?.nextAction,now)&&!['Offer','Rejected','Closed'].includes(a?.status)).sort((a,b)=>Number(a.nextAction.dueAt)-Number(b.nextAction.dueAt));
  }
  function sameAction(a,b){const x=normalizeAction(a),y=normalizeAction(b);if(!x||!y)return false;return x.type===y.type&&Math.abs(x.dueAt-y.dueAt)<60*1000&&clean(x.sourceText)===clean(y.sourceText);}
  function snooze(action,days=1,now=Date.now()){
    const a=normalizeAction(action);if(!a)return null;const n=Math.max(1,Math.min(30,Math.floor(Number(days)||1)));const base=Math.max(Number(a.dueAt)||0,Number(now)||Date.now());return {...a,dueAt:addDays(new Date(base),n).getTime(),snoozedFrom:a.dueAt,doneAt:0,dismissedAt:0};
  }
  return {DAY,clean,addDays,addBusinessDays,nextWeekday,classify,parseExplicitDate,extract,normalizeAction,isOpen,isDue,dueItems,sameAction,snooze};
});
