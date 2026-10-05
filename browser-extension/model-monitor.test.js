const test=require('node:test');const assert=require('node:assert/strict');const M=require('./model-monitor.js');
function e(i,y,p){return {type:y?'VACANCY_APPLIED':'VACANCY_SKIPPED',timestamp:1000+i,modelDecision:{ml:{modelVersion:'m1',probability:p}},meta:{features:{role:y?'developer':'sales'}}};}
test('monitor computes metrics from later user labels',()=>{const xs=[e(1,1,.9),e(2,0,.1),e(3,1,.8),e(4,0,.2)];const s=M.summarize(xs,{modelVersion:'m1',trainedAt:0});assert.equal(s.labelledPredictions,4);assert.equal(s.metrics.accuracy,1);assert.ok(s.metrics.brier<.1);});
test('monitor ignores predictions from another model version',()=>{const xs=[e(1,1,.9),{...e(2,0,.1),modelDecision:{ml:{modelVersion:'other',probability:.1}}}];assert.equal(M.rows(xs,'m1').length,1);});

test('monitor respects the prediction threshold captured with each label',()=>{
  const ev=[
    {type:'VACANCY_APPLIED',timestamp:1,modelDecision:{ml:{modelVersion:'m2',probability:.42,threshold:.4}}},
    {type:'VACANCY_SKIPPED',timestamp:2,modelDecision:{ml:{modelVersion:'m2',probability:.38,threshold:.4}}}
  ];
  const r=M.summarize(ev,{modelVersion:'m2',trainedAt:0});
  assert.equal(r.metrics.accuracy,1);
});

test('engagement monitor uses outcome labels and the separate engagement prediction',()=>{
  const ev=[
    {type:'OUTCOME_CHANGED',timestamp:1,userAction:'Recruiter Replied',modelDecision:{engagement:{modelVersion:'e1',probability:.8,threshold:.6}}},
    {type:'OUTCOME_CHANGED',timestamp:2,userAction:'Rejected',modelDecision:{engagement:{modelVersion:'e1',probability:.2,threshold:.6}}}
  ];
  const r=M.summarize(ev,{modelVersion:'e1',trainedAt:0},'engagement');
  assert.equal(r.kind,'engagement');assert.equal(r.labelledPredictions,2);assert.equal(r.metrics.accuracy,1);
});

test('closed vacancy is censored, not a negative engagement label',()=>{assert.equal(M.labelFor({type:'OUTCOME_CHANGED',userAction:'Closed'},'engagement'),null);});
