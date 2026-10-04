#!/usr/bin/env python3
"""Promotion gate: real labels only, adequate validation sample, and no regression vs active model of the same target."""
from __future__ import annotations
import argparse,json,time
from pathlib import Path

def kind(model_type):
    if model_type=='employer-engagement-logreg':return 'engagement'
    if model_type=='personal-vacancy-logreg':return 'preference'
    raise SystemExit(f'Unsupported model type: {model_type}')
def main():
    ap=argparse.ArgumentParser();ap.add_argument('registry');ap.add_argument('candidate');ap.add_argument('--min-validation',type=int,default=20);ap.add_argument('--min-f1',type=float,default=.55);a=ap.parse_args();p=Path(a.registry);reg=json.loads(p.read_text(encoding='utf-8'));reg.setdefault('activeModels',{'preference':reg.get('activeModel'),'engagement':None});cand=next((x for x in reg.get('models',[]) if x.get('modelVersion')==a.candidate),None)
    if not cand:raise SystemExit('Candidate not found')
    if not cand.get('trainedOnRealLabels'):raise SystemExit('Refusing promotion: model is not marked as trained on real labels')
    m=cand.get('validation') or {};n=int(m.get('n') or 0);f1=float(m.get('f1') or 0)
    if n<a.min_validation or f1<a.min_f1:raise SystemExit(f'Refusing promotion: validation n={n}, f1={f1:.3f}')
    k=cand.get('kind') or kind(cand.get('modelType'));active_version=reg.get('activeModels',{}).get(k);active=next((x for x in reg.get('models',[]) if x.get('modelVersion')==active_version),None)
    if active and f1+1e-9<float((active.get('validation') or {}).get('f1') or 0):raise SystemExit('Refusing promotion: F1 regressed vs active model')
    for x in reg.get('models',[]):
        if (x.get('kind') or kind(x.get('modelType')))==k and x.get('status')=='active':x['status']='superseded'
    cand['status']='active';reg['activeModels'][k]=cand['modelVersion'];
    if k=='preference':reg['activeModel']=cand['modelVersion']
    reg['schemaVersion']=2;reg['updatedAt']=int(time.time()*1000);p.write_text(json.dumps(reg,ensure_ascii=False,indent=2),encoding='utf-8');print('PROMOTED',cand['modelVersion'])
if __name__=='__main__':main()
