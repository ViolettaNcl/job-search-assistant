/* 5.0 application outcome analytics with sample-size guards. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaOutcomeAnalyticsV2=api;})(globalThis,function(){
  'use strict';const TERMINAL=new Set(['Offer','Rejected','Closed']);const ENGAGED=new Set(['Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer']);
  function statuses(app={}){const s=new Set();if(app.status)s.add(app.status);for(const e of app.timeline||[]){if(e?.meta?.status)s.add(e.meta.status);if(e?.type==='submitted'||e?.type==='submitted-native-list')s.add('Applied');}return s;}
  function metrics(app={}){const s=statuses(app);const applied=s.has('Applied')||[...s].some(x=>ENGAGED.has(x)||x==='Rejected');return {applied,viewed:s.has('Viewed'),reply:[...s].some(x=>ENGAGED.has(x)),interview:s.has('HR Interview')||s.has('Technical Interview')||s.has('Offer'),test:s.has('Test Assignment'),offer:s.has('Offer'),rejected:s.has('Rejected'),terminal:[...s].some(x=>TERMINAL.has(x))};}
  function rate(num,den){return den?Math.round(num/den*1000)/10:0;}
  function summarize(apps=[]){const total={applications:0,applied:0,viewed:0,reply:0,interview:0,test:0,offer:0,rejected:0};for(const a of apps||[]){total.applications++;const m=metrics(a);for(const k of Object.keys(m))if(k!=='terminal'&&m[k])total[k]++;}return {...total,replyRate:rate(total.reply,total.applied),interviewRate:rate(total.interview,total.applied),offerRate:rate(total.offer,total.applied),sampleSize:total.applied,lowSample:total.applied<20};}
  return {statuses,metrics,summarize};
});
