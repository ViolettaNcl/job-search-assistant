(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.vjaApplicationAnalytics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RESPONSE=new Set(['Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer']);
  const INTERVIEW=new Set(['HR Interview','Technical Interview','Offer']);
  function clean(v,max=180){return String(v||'').replace(/\s+/g,' ').trim().slice(0,max);}
  function statuses(app={}){
    const out=new Set();if(app.status)out.add(app.status);
    for(const e of Array.isArray(app.timeline)?app.timeline:[]){if(e?.meta?.status)out.add(e.meta.status);if(e?.type==='submitted')out.add('Applied');}
    return out;
  }
  function metrics(app={}){
    const seen=statuses(app);return {
      applied:seen.has('Applied')||[...seen].some(s=>RESPONSE.has(s)||s==='Rejected'),
      response:[...seen].some(s=>RESPONSE.has(s)),
      interview:[...seen].some(s=>INTERVIEW.has(s)),
      test:seen.has('Test Assignment'),
      offer:seen.has('Offer'),
      rejected:seen.has('Rejected')
    };
  }
  function add(bucket,m){bucket.applications++;for(const k of ['applied','response','interview','test','offer','rejected'])if(m[k])bucket[k]++;}
  function makeBucket(key,label){return {key,label,applications:0,applied:0,response:0,interview:0,test:0,offer:0,rejected:0};}
  function summarize(applications=[]){
    const total=makeBucket('all','Все отклики'),roles=new Map(),cvs=new Map();
    for(const app of Array.isArray(applications)?applications:[]){
      const m=metrics(app);add(total,m);
      const role=clean(app.role||app.cvProfileId||'other')||'other';if(!roles.has(role))roles.set(role,makeBucket(role,role));add(roles.get(role),m);
      const cvKey=clean(app.cvName||app.cvProfileId||'CV не указан')||'CV не указан';if(!cvs.has(cvKey))cvs.set(cvKey,makeBucket(cvKey,cvKey));add(cvs.get(cvKey),m);
    }
    const enrich=b=>({...b,responseRate:b.applied?Math.round(b.response/b.applied*100):0,interviewRate:b.applied?Math.round(b.interview/b.applied*100):0});
    return {total:enrich(total),roles:[...roles.values()].map(enrich).sort((a,b)=>b.applications-a.applications||a.label.localeCompare(b.label)),cvs:[...cvs.values()].map(enrich).sort((a,b)=>b.applications-a.applications||a.label.localeCompare(b.label))};
  }
  return {RESPONSE,INTERVIEW,clean,statuses,metrics,summarize};
});
