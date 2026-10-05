#!/usr/bin/env python3
"""Train an explainable personal-vacancy logistic baseline from REAL user labels.
This tool refuses small datasets by default. Synthetic data may be used only by tests with --allow-small.
"""
from __future__ import annotations
import argparse, json, math, random, time
from pathlib import Path
from provenance import require_real_labels
from common import DIM, features, load_jsonl, predict

def validate(rows, min_labels=20):
    good=[]
    for r in rows:
        y=r.get('labelUserApply')
        if y in (0,1):good.append(r)
    if len(good)<min_labels:raise SystemExit(f'Need at least {min_labels} labelled rows; got {len(good)}')
    if len({r['labelUserApply'] for r in good})<2:raise SystemExit('Dataset needs both positive and negative labels')
    return good

def split(rows, seed=42):
    pos=[r for r in rows if r['labelUserApply']==1];neg=[r for r in rows if r['labelUserApply']==0]
    rnd=random.Random(seed);rnd.shuffle(pos);rnd.shuffle(neg)
    def cut(a):
        n=max(1,int(len(a)*.2));return a[n:],a[:n]
    ptrain,pval=cut(pos);ntrain,nval=cut(neg)
    train=ptrain+ntrain;val=pval+nval;rnd.shuffle(train);rnd.shuffle(val);return train,val

def train(rows, epochs=220, lr=.08, l2=.001):
    w=[0.0]*DIM
    for _ in range(epochs):
        grad=[0.0]*DIM
        for r in rows:
            x=features(r);err=predict(w,x)-r['labelUserApply']
            for i,v in enumerate(x):
                if v:grad[i]+=err*v
        n=max(1,len(rows))
        for i in range(DIM):w[i]-=lr*(grad[i]/n+l2*w[i])
    return w

def metrics(rows,w,threshold=.5):
    tp=fp=tn=fn=0;loss=0.0
    scored=[]
    for r in rows:
        p=max(1e-9,min(1-1e-9,predict(w,features(r))));y=r['labelUserApply'];loss+=-(y*math.log(p)+(1-y)*math.log(1-p));pred=p>=threshold
        tp+=int(pred and y==1);fp+=int(pred and y==0);tn+=int((not pred) and y==0);fn+=int((not pred) and y==1);scored.append((p,y))
    precision=tp/max(1,tp+fp);recall=tp/max(1,tp+fn);f1=2*precision*recall/max(1e-12,precision+recall)
    return {'n':len(rows),'precision':precision,'recall':recall,'f1':f1,'accuracy':(tp+tn)/max(1,len(rows)),'logLoss':loss/max(1,len(rows)),'tp':tp,'fp':fp,'tn':tn,'fn':fn}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('dataset');ap.add_argument('--out',required=True);ap.add_argument('--min-labels',type=int,default=100);ap.add_argument('--allow-small',action='store_true');ap.add_argument('--confirm-real-labels',action='store_true');args=ap.parse_args()
    rows=validate(load_jsonl(args.dataset),2 if args.allow_small else args.min_labels);real_labels=require_real_labels(rows,args.confirm_real_labels,args.allow_small);train_rows,val_rows=split(rows);w=train(train_rows);m=metrics(val_rows,w)
    model={'schemaVersion':1,'modelType':'personal-vacancy-logreg','modelVersion':f'preference-{int(time.time())}','featureEncoder':'hashed-v1','dimension':DIM,'weights':w,'threshold':.5,'trainedAt':int(time.time()*1000),'trainingLabels':len(rows),'trainedOnRealLabels':real_labels,'labelProvenance':'user-attested' if real_labels else 'test-only','validation':m,'status':'candidate'}
    Path(args.out).write_text(json.dumps(model,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'model':args.out,'validation':m,'labels':len(rows)},ensure_ascii=False))
if __name__=='__main__':main()
