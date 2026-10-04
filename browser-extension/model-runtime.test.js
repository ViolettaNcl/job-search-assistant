const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('./model-runtime.js');

test('runtime feature hashing is deterministic and bounded',async()=>{const a=await R.bucket('role=developer',256),b=await R.bucket('role=developer',256);assert.equal(a,b);assert.ok(a>=0&&a<256);const v=await R.vector({role:'developer',remote:true,calls:'no-calls',technologies:['c#']});assert.equal(v.length,256);assert.ok(v.some(x=>x!==0));});

test('runtime rejects synthetic model activation but can score it offline',async()=>{const weights=Array(256).fill(0),bias=await R.bucket('bias',256);weights[bias]=2;const model={schemaVersion:1,modelType:'personal-vacancy-logreg',modelVersion:'t',dimension:256,weights,threshold:.5,trainedOnRealLabels:false,trainingLabels:20};assert.throws(()=>R.validate(model),/real labels/);const p=await R.predict(model,{role:'developer'});assert.ok(p.probability>.5);});

test('temperature calibration and fit blending stay bounded',()=>{const p=R.calibrate(.8,{calibration:{type:'temperature',temperature:2}});assert.ok(p>.5&&p<.8);const fit=R.blendFit({score:80,decision:'MATCH',features:{},preferences:{minimumFitScore:75},algorithm:'rules'},{modelType:'personal-vacancy-logreg',probability:.9,modelVersion:'m',trainingLabels:120},{weight:.25});assert.equal(fit.score,83);assert.match(fit.algorithm,/promoted-ml/);});
