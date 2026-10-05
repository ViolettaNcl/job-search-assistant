#!/usr/bin/env python3
"""Train the independent employer-engagement baseline from outcome-labelled applications."""
from __future__ import annotations
import argparse,json,math,random,time
from pathlib import Path
from provenance import require_real_labels
from common import DIM,features,load_jsonl,predict
LABEL='labelEmployerEngagement'
def validate(rows,min_labels=40):
    good=[r for r in rows if r.get(LABEL) in (0,1)]
    if len(good)<min_labels:raise SystemExit(f'Need at least {min_labels} engagement-labelled rows; got {len(good)}')
    if len({r[LABEL] for r in good})<2:raise SystemExit('Dataset needs both positive and negative engagement labels')
    return good
def split(rows,seed=43):
    rnd=random.Random(seed);pos=[r for r in rows if r[LABEL]==1];neg=[r for r in rows if r[LABEL]==0];rnd.shuffle(pos);rnd.shuffle(neg)
    def cut(a):n=max(1,int(len(a)*.2));return a[n:],a[:n]
    ptrain,pval=cut(pos);ntrain,nval=cut(neg);train=ptrain+ntrain;val=pval+nval;rnd.shuffle(train);rnd.shuffle(val);return train,val
def train(rows,epochs=220,lr=.08,l2=.001):
    w=[0.0]*DIM
    for _ in range(epochs):
      grad=[0.0]*DIM
      for r in rows:
        x=features(r);err=predict(w,x)-r[LABEL]
        for i,v in enumerate(x):
          if v:grad[i]+=err*v
      n=max(1,len(rows))
      for i in range(DIM):w[i]-=lr*(grad[i]/n+l2*w[i])
    return w
def metrics(rows,w,t=.5):
    tp=fp=tn=fn=0
    for r in rows:
      y=r[LABEL];pred=predict(w,features(r))>=t;tp+=int(pred and y);fp+=int(pred and not y);tn+=int((not pred) and not y);fn+=int((not pred) and y)
    precision=tp/max(1,tp+fp);recall=tp/max(1,tp+fn);f1=2*precision*recall/max(1e-12,precision+recall);return {'n':len(rows),'precision':precision,'recall':recall,'f1':f1,'accuracy':(tp+tn)/max(1,len(rows))}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('dataset');ap.add_argument('--out',required=True);ap.add_argument('--min-labels',type=int,default=100);ap.add_argument('--allow-small',action='store_true');ap.add_argument('--confirm-real-labels',action='store_true');a=ap.parse_args();rows=validate(load_jsonl(a.dataset),2 if a.allow_small else a.min_labels);real_labels=require_real_labels(rows,a.confirm_real_labels,a.allow_small);tr,val=split(rows);w=train(tr);m=metrics(val,w);model={'schemaVersion':1,'modelType':'employer-engagement-logreg','modelVersion':f'engagement-{int(time.time())}','featureEncoder':'hashed-v1','dimension':DIM,'weights':w,'threshold':.5,'trainedAt':int(time.time()*1000),'trainingLabels':len(rows),'trainedOnRealLabels':real_labels,'labelProvenance':'user-attested' if real_labels else 'test-only','validation':m,'status':'candidate'};Path(a.out).write_text(json.dumps(model,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'model':a.out,'validation':m,'labels':len(rows)},ensure_ascii=False))
if __name__=='__main__':main()
