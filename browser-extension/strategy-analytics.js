/* Descriptive application analytics; no causal claims and no automatic CV switching. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.vjaStrategyAnalytics=api;})(globalThis,function(){
  'use strict';const ENGAGED=new Set(['Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer']);
  function normalize(a={}){return a.context?{...a.context,id:a.plan?.id||a.id,plan:a.plan,completed:a.completed}:a;}
  function statuses(a){const s=new Set([a.status].filter(Boolean));for(const e of a.timeline||[]){if(e.meta?.status)s.add(e.meta.status);if(['submitted','submitted-native-list'].includes(e.type))s.add('Applied');}if(a.coverLetterMemory?.submittedAt)s.add('Applied');return s;}
  function metrics(a){const s=statuses(normalize(a));return {applied:s.has('Applied')||[...s].some(x=>ENGAGED.has(x)||x==='Viewed'||x==='Rejected'),viewed:s.has('Viewed'),engaged:[...s].some(x=>ENGAGED.has(x)),interviews:s.has('HR Interview')||s.has('Technical Interview'),tests:s.has('Test Assignment'),offers:s.has('Offer'),rejected:s.has('Rejected')};}
  function wilson(k,n){if(!n)return null;const z=1.95996398454,p=k/n,d=1+z*z/n,center=(p+z*z/(2*n))/d,spread=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,center-spread),Math.min(1,center+spread)];}
  function letterGroup(a){const m=a.coverLetterMemory||{},text=String(m.submittedText||m.lastEditedText||a.coverLetter||'');return m.style||(!text?'Не записано':text.length<=700?'Короткое':/SQL|API|\.NET|Python|REST|Linux/i.test(text)?'Техническое':/поддерж|support|клиент/i.test(text)?'Поддержка':'Общее');}
  function group(apps,dimension='role'){
    const groups=new Map(),seen=new Set();
    for(const raw of apps||[]){const a=normalize(raw),v=a.vacancy||{},identity=a.id||`${v.provider||v.source||'hh'}:${v.vacancyId||v.url||''}`;if(identity.endsWith(':')||seen.has(identity))continue;seen.add(identity);const m=metrics(a);if(!m.applied)continue;
      const key=String(dimension==='cv'?(a.cvName||a.cvKey||a.cvProfile||a.cvSelection?.name||'Не записано'):dimension==='letter'?letterGroup(a):(a.role||a.roleVariant||'Не записано'));
      const g=groups.get(key)||{key,applied:0,viewed:0,engaged:0,interviews:0,tests:0,offers:0,rejected:0,edited:0,totalLetterLength:0};for(const k of ['applied','viewed','engaged','interviews','tests','offers','rejected'])g[k]+=Number(m[k]);const mem=a.coverLetterMemory||{};g.edited+=Number(!!(mem.userEdited||mem.editedAt||mem.edited));g.totalLetterLength+=String(mem.submittedText||mem.lastEditedText||a.coverLetter||'').length;groups.set(key,g);
    }
    return [...groups.values()].map(g=>({...g,engagementRate:g.engaged/g.applied,interval95:wilson(g.engaged,g.applied),lowSample:g.applied<20,meanRecordedLength:g.totalLetterLength/g.applied,recommendation:g.applied<20?'Недостаточно наблюдений для рекомендации.':'Наблюдательное сравнение: учитывайте различия вакансий и дату отклика.'})).sort((a,b)=>b.applied-a.applied||a.key.localeCompare(b.key));
  }
  function summarize(apps=[]){const total={applied:0,viewed:0,engaged:0,interviews:0,tests:0,offers:0,rejected:0};for(const a of apps){const m=metrics(a);for(const k of Object.keys(total))total[k]+=Number(m[k]);}return total;}
  return {normalize,statuses,metrics,wilson,letterGroup,group,summarize};
});
