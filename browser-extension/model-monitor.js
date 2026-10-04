/* Offline-style monitoring of promoted model predictions captured in learning events. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaModelMonitor=api;})(globalThis,function(){
  'use strict';
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  function labelFor(e,kind='preference'){
    if(kind==='engagement'){
      if(e?.type!=='OUTCOME_CHANGED')return null;
      const status=String(e?.meta?.status||e?.userAction||'');
      if(['Recruiter Replied','HR Interview','Technical Interview','Test Assignment','Offer'].includes(status))return 1;
      if(['Rejected','Closed'].includes(status))return 0;
      return null;
    }
    if(['VACANCY_APPLIED','VACANCY_SAVED','FIT_ACCEPTED'].includes(e?.type))return 1;
    if(['VACANCY_SKIPPED','FIT_REJECTED'].includes(e?.type))return 0;
    return null;
  }
  function predictionFor(e,kind='preference'){
    return kind==='engagement'?(e?.modelDecision?.engagement||e?.meta?.engagement||null):(e?.modelDecision?.ml||e?.meta?.ml||null);
  }
  function rows(events=[],modelVersion='',kind='preference'){
    return (Array.isArray(events)?events:[]).map(e=>{const ml=predictionFor(e,kind),y=labelFor(e,kind);if(y===null||!ml||!Number.isFinite(Number(ml.probability)))return null;if(modelVersion&&String(ml.modelVersion||'')!==String(modelVersion))return null;return {at:Number(e.timestamp)||0,p:clamp(ml.probability),threshold:clamp(ml.threshold??.5,.05,.95),y,modelVersion:String(ml.modelVersion||''),role:String(e?.meta?.features?.role||e?.modelDecision?.features?.role||'other')};}).filter(Boolean);
  }
  function metrics(xs=[]){let tp=0,fp=0,tn=0,fn=0,brier=0;for(const r of xs){const pred=r.p>=Number(r.threshold??.5);brier+=(r.p-r.y)**2;tp+=+!!(pred&&r.y);fp+=+!!(pred&&!r.y);tn+=+!!(!pred&&!r.y);fn+=+!!(!pred&&r.y);}const precision=tp/Math.max(1,tp+fp),recall=tp/Math.max(1,tp+fn),f1=2*precision*recall/Math.max(1e-12,precision+recall);return {n:xs.length,precision,recall,f1,accuracy:(tp+tn)/Math.max(1,xs.length),brier:brier/Math.max(1,xs.length),positiveRate:xs.reduce((s,r)=>s+r.y,0)/Math.max(1,xs.length),meanPrediction:xs.reduce((s,r)=>s+r.p,0)/Math.max(1,xs.length)};}
  function expectedCalibrationError(xs=[],bins=5){if(!xs.length)return 0;let ece=0;for(let b=0;b<bins;b++){const lo=b/bins,hi=(b+1)/bins,bin=xs.filter(r=>r.p>=lo&&(b===bins-1?r.p<=hi:r.p<hi));if(!bin.length)continue;const conf=bin.reduce((s,r)=>s+r.p,0)/bin.length,acc=bin.reduce((s,r)=>s+r.y,0)/bin.length;ece+=bin.length/xs.length*Math.abs(conf-acc);}return ece;}
  function drift(xs=[]){if(xs.length<20)return {available:false,reason:'need-more-labelled-predictions'};const ordered=[...xs].sort((a,b)=>a.at-b.at),cut=Math.max(8,Math.floor(ordered.length*.5)),old=ordered.slice(0,cut),recent=ordered.slice(cut),a=metrics(old),b=metrics(recent);return {available:true,meanPredictionShift:b.meanPrediction-a.meanPrediction,positiveRateShift:b.positiveRate-a.positiveRate,brierShift:b.brier-a.brier,warning:Math.abs(b.meanPrediction-a.meanPrediction)>.18||Math.abs(b.positiveRate-a.positiveRate)>.22||b.brier-a.brier>.08};}
  function summarize(events=[],activeModel=null,kind='preference'){const version=activeModel?.modelVersion||activeModel||'',xs=rows(events,version,kind),m=metrics(xs),ece=expectedCalibrationError(xs),d=drift(xs),trainedAt=Number(activeModel?.trainedAt||0),sinceTrain=xs.filter(r=>r.at>trainedAt).length,retrain=Boolean(xs.length>=30&&(sinceTrain>=50||m.brier>.25||ece>.15||d.warning));return {kind,modelVersion:version,labelledPredictions:xs.length,metrics:{...m,ece},drift:d,retraining:{recommended:retrain,reasons:[sinceTrain>=50?'≥50 новых labels после обучения':'',m.brier>.25?'Brier score ухудшен':'',ece>.15?'Калибровка требует внимания':'',d.warning?'Обнаружен drift':''].filter(Boolean),labelsSinceTraining:sinceTrain}};}
  return {labelFor,predictionFor,rows,metrics,expectedCalibrationError,drift,summarize};
});
