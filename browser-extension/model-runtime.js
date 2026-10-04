/* Runtime inference for promoted personal models. Uses the same SHA-256 feature hashing as tools/ml/common.py. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaModelRuntime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const DEFAULT_DIM=256;
  const enc=typeof TextEncoder!=='undefined'?new TextEncoder():null;
  const hashCache=new Map();
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  async function sha256Bytes(text){
    const key=String(text);if(hashCache.has(key))return hashCache.get(key);
    let bytes;
    if(root?.crypto?.subtle&&enc){bytes=new Uint8Array(await root.crypto.subtle.digest('SHA-256',enc.encode(key)));}
    else if(typeof require==='function'){const c=require('node:crypto');bytes=new Uint8Array(c.createHash('sha256').update(key).digest());}
    else throw new Error('SHA-256 is unavailable in this runtime.');
    hashCache.set(key,bytes);if(hashCache.size>3000)hashCache.delete(hashCache.keys().next().value);return bytes;
  }
  async function bucket(text,dim=DEFAULT_DIM){const b=await sha256Bytes(String(text));const n=((b[0]<<24)>>>0)+(b[1]<<16)+(b[2]<<8)+b[3];return n%Math.max(8,Number(dim)||DEFAULT_DIM);}
  function featurePairs(row={}){
    const out=[['bias',1]];for(const k of ['remote','sales','senior','junior'])out.push([k,row[k]?1:0]);
    out.push(['requiredYears',Math.min(10,Number(row.requiredYears)||0)/10]);out.push(['calls='+String(row.calls||'unknown'),1]);out.push(['role='+String(row.role||'other').toLowerCase(),1]);
    for(const t of Array.isArray(row.technologies)?row.technologies:[])out.push(['tech='+String(t).toLowerCase(),1]);
    for(const token of (String(row.title||'')+' '+String(row.company||'')).toLowerCase().split(/\s+/).filter(x=>x.length>=3))out.push(['text='+token,.25]);
    return out;
  }
  async function vector(row={},dim=DEFAULT_DIM){const x=Array(Math.max(8,Number(dim)||DEFAULT_DIM)).fill(0);for(const [name,val] of featurePairs(row)){x[await bucket(name,x.length)]+=Number(val)||0;}return x;}
  function sigmoid(z){if(z>=0){const e=Math.exp(-z);return 1/(1+e);}const e=Math.exp(z);return e/(1+e);}
  function logit(p){p=clamp(p,1e-7,1-1e-7);return Math.log(p/(1-p));}
  function calibrate(probability,model={}){const c=model.calibration||{};if(c.type==='temperature'){const t=Math.max(.2,Math.min(5,Number(c.temperature)||1));return sigmoid(logit(probability)/t);}return probability;}
  function validate(model,{requireReal=true}={}){
    if(!model||model.schemaVersion!==1)throw new Error('Unsupported model schema.');
    if(!['personal-vacancy-logreg','employer-engagement-logreg'].includes(model.modelType))throw new Error('Unsupported model type.');
    const dim=Math.max(8,Number(model.dimension)||DEFAULT_DIM);if(!Array.isArray(model.weights)||model.weights.length!==dim)throw new Error('Model weights do not match dimension.');
    if(!model.weights.every(Number.isFinite))throw new Error('Model contains invalid weights.');
    if(requireReal&&model.trainedOnRealLabels!==true)throw new Error('Only models trained on real labels may be activated.');
    return {...model,dimension:dim,threshold:clamp(model.threshold??.5,.05,.95)};
  }
  function rowFromFit(vacancy={},fit={}){const f=fit.features||{};return {title:vacancy.title||'',company:vacancy.company||'',role:f.role||'other',remote:Boolean(f.remote),calls:f.calls||'unknown',sales:Boolean(f.sales),senior:Boolean(f.senior),junior:Boolean(f.junior),requiredYears:Number(f.requiredYears||0),technologies:Array.isArray(f.technologies)?f.technologies:[]};}
  async function predict(model,row){model=validate(model,{requireReal:false});const x=await vector(row,model.dimension),raw=sigmoid(model.weights.reduce((s,w,i)=>s+w*x[i],0)),probability=calibrate(raw,model),threshold=Number(model.threshold??.5);return {modelVersion:String(model.modelVersion||''),modelType:model.modelType,rawProbability:raw,probability,threshold,positive:probability>=threshold,confidence:Math.abs(probability-threshold)/Math.max(threshold,1-threshold),trainingLabels:Number(model.trainingLabels||0),validation:model.validation||{},calibration:model.calibration||null};}
  function blendFit(baseFit={},prediction,{weight=.25}={}){if(!prediction||prediction.modelType!=='personal-vacancy-logreg')return baseFit;const w=Math.max(.05,Math.min(.35,Number(weight)||.25)),mlScore=Math.round(prediction.probability*100),score=Math.round(Math.max(0,Math.min(100,Number(baseFit.score||0)*(1-w)+mlScore*w)));const min=Number(baseFit.preferences?.minimumFitScore||baseFit.minimumFitScore||80);const decision=score>=88?'STRONG_MATCH':score>=min?'MATCH':score>=60?'REVIEW':'SKIP';return {...baseFit,score,decision,ml:{...prediction,score:mlScore,blendWeight:w,explanation:`ML signal ${mlScore}% · ${prediction.modelVersion||'model'} · n=${prediction.trainingLabels||0}`},algorithm:String(baseFit.algorithm||'rules')+'+promoted-ml'};}
  return {DEFAULT_DIM,bucket,featurePairs,vector,sigmoid,calibrate,validate,rowFromFit,predict,blendFit};
});
