/* Model identity and shadow comparison; no automatic training or promotion. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaProductModels=api;})(globalThis,function(root){
 'use strict';
 function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
 async function digest(model){const c=root.crypto||(typeof require==='function'?require('node:crypto').webcrypto:null);return [...new Uint8Array(await c.subtle.digest('SHA-256',new TextEncoder().encode(canonical(model))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
 async function verify(entry){if(!entry?.model)throw new Error('Model artifact missing');if(entry.sha256&&await digest(entry.model)!==entry.sha256)throw new Error('Model hash mismatch. Re-import with a new version.');return true;}
 function shadowMetrics(predictions=[],events=[],version=''){
   const labels=new Map();for(const e of events){const y=['VACANCY_APPLIED','VACANCY_SAVED','FIT_ACCEPTED'].includes(e.type)?1:['VACANCY_SKIPPED','FIT_REJECTED'].includes(e.type)?0:null;if(y===null)continue;const k=(e.provider||'hh')+':'+e.vacancyId,old=labels.get(k);if(!old||e.timestamp>=old.timestamp)labels.set(k,{y,timestamp:e.timestamp});}
   const rows=new Map();for(const p of predictions){if(version&&p.modelVersion!==version)continue;const k=(p.provider||'hh')+':'+p.vacancyId,l=labels.get(k);if(!l||!(l.timestamp>p.at)||!Number.isFinite(p.probability))continue;const old=rows.get(k);if(!old||p.at>old.at)rows.set(k,{...p,y:l.y});}
   let modelCorrect=0,rulesCorrect=0,brier=0;for(const p of rows.values()){modelCorrect+=Number((p.probability>=p.threshold)===Boolean(p.y));rulesCorrect+=Number(Boolean(p.basePositive)===Boolean(p.y));brier+=(p.probability-p.y)**2;}const n=rows.size;return {n,modelAccuracy:n?modelCorrect/n:null,rulesAccuracy:n?rulesCorrect/n:null,brier:n?brier/n:null};
 }
 return {canonical,digest,verify,shadowMetrics};
});
