#!/usr/bin/env python3
"""End-to-end offline training pipeline with leakage-resistant calibration/test holdouts.
It does not auto-promote unless --promote is explicitly supplied.
"""
from __future__ import annotations
import argparse,json,subprocess,sys,tempfile,time
from pathlib import Path
from common import load_jsonl

def split_three(rows,label_field):
    groups={0:[],1:[]}
    for r in rows:
        if r.get(label_field) in (0,1):groups[int(r[label_field])].append(r)
    for g in groups.values():g.sort(key=lambda r:int(r.get('timestamp') or 0))
    train=[];cal=[];test=[]
    for g in groups.values():
        n=len(g);nt=max(1,int(n*.2));nc=max(1,int((n-nt)*.2));test+=g[-nt:];cal+=g[-(nt+nc):-nt] if nc else [];train+=g[:-(nt+nc)] if n>nt+nc else g[:max(1,n-2)]
    return train,cal,test
def write_jsonl(path,rows):Path(path).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows),encoding='utf-8')
def run(args,cwd):subprocess.check_call([sys.executable,*map(str,args)],cwd=cwd)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('dataset');ap.add_argument('--target',choices=['preference','engagement'],default='preference');ap.add_argument('--out-dir',required=True);ap.add_argument('--registry');ap.add_argument('--min-labels',type=int,default=100);ap.add_argument('--promote',action='store_true');ap.add_argument('--test-only',action='store_true');a=ap.parse_args();root=Path(__file__).resolve().parent;out=Path(a.out_dir);out.mkdir(parents=True,exist_ok=True);label='labelUserApply' if a.target=='preference' else 'labelEmployerEngagement';rows=load_jsonl(a.dataset)
    run([root/'validate_dataset.py',a.dataset,'--label-field',label,'--out',out/'dataset-validation.json'],root)
    labelled=[r for r in rows if r.get(label) in (0,1)]
    need=2 if a.test_only else a.min_labels
    if len(labelled)<need:raise SystemExit(f'Need at least {need} labelled rows; got {len(labelled)}')
    class_counts={y:sum(1 for r in labelled if r.get(label)==y) for y in (0,1)}
    if not a.test_only and min(class_counts.values())<10:raise SystemExit(f'Need at least 10 examples in each class for a leakage-resistant 3-way split; got {class_counts}')
    train,cal,test=split_three(labelled,label);
    if not all({r.get(label) for r in part}=={0,1} for part in (train,cal,test)):raise SystemExit('Train/calibration/test split must contain both classes')
    write_jsonl(out/'train.jsonl',train);write_jsonl(out/'calibration.jsonl',cal);write_jsonl(out/'test.jsonl',test)
    raw=out/'model.raw.json';calibrated=out/'model.json';metrics=out/'test-metrics.json'
    trainer='train_preference.py' if a.target=='preference' else 'train_engagement.py';train_args=[root/trainer,out/'train.jsonl','--out',raw,'--min-labels',max(2,min(a.min_labels,len(train)))];train_args+=['--allow-small'] if a.test_only else [];run(train_args,root)
    run([root/'tune_threshold.py',raw,out/'calibration.jsonl','--label-field',label,'--out',calibrated],root);run([root/'evaluate_model.py',calibrated,out/'test.jsonl','--label-field',label,'--out',metrics],root)
    model=json.loads(calibrated.read_text(encoding='utf-8'));model['trainedOnRealLabels']=not a.test_only;model['trainingLabels']=len(labelled);model['datasetSplit']={'train':len(train),'calibration':len(cal),'test':len(test),'strategy':'stratified-temporal-v1'};model['testMetrics']=json.loads(metrics.read_text(encoding='utf-8'));calibrated.write_text(json.dumps(model,ensure_ascii=False,indent=2),encoding='utf-8')
    registry=Path(a.registry) if a.registry else out/'registry.json';run([root/'model_registry.py',registry,calibrated,'--metrics',metrics],root)
    if a.promote and a.test_only:raise SystemExit('Refusing promotion in --test-only mode')
    if a.promote:run([root/'promote_model.py',registry,model['modelVersion']],root)
    print(json.dumps({'target':a.target,'model':str(calibrated),'registry':str(registry),'testMetrics':model['testMetrics'],'promoted':a.promote},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
