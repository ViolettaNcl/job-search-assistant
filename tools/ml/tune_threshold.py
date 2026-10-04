#!/usr/bin/env python3
"""Tune decision threshold and simple temperature calibration on a validation dataset."""
from __future__ import annotations
import argparse,json,math
from pathlib import Path
from common import features,load_jsonl,predict,sigmoid

def logit(p):
    p=max(1e-7,min(1-1e-7,p));return math.log(p/(1-p))
def calibrated(p,t):return sigmoid(logit(p)/t)
def score(rows,weights,label_field,threshold,t):
    tp=fp=tn=fn=0;loss=0.0
    for r in rows:
        if r.get(label_field) not in (0,1):continue
        y=int(r[label_field]);p=max(1e-9,min(1-1e-9,calibrated(predict(weights,features(r)),t)));loss+=-(y*math.log(p)+(1-y)*math.log(1-p));pred=p>=threshold
        tp+=int(pred and y);fp+=int(pred and not y);tn+=int((not pred) and not y);fn+=int((not pred) and y)
    precision=tp/max(1,tp+fp);recall=tp/max(1,tp+fn);f1=2*precision*recall/max(1e-12,precision+recall);n=tp+fp+tn+fn
    return {'n':n,'precision':precision,'recall':recall,'f1':f1,'accuracy':(tp+tn)/max(1,n),'logLoss':loss/max(1,n)}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('model');ap.add_argument('dataset');ap.add_argument('--label-field',default='labelUserApply');ap.add_argument('--out',required=True);a=ap.parse_args();m=json.load(open(a.model,encoding='utf-8'));rows=load_jsonl(a.dataset);best=None
    for t in [0.6,0.75,0.9,1.0,1.15,1.35,1.6,2.0]:
      for threshold in [x/100 for x in range(30,71,2)]:
        r=score(rows,m['weights'],a.label_field,threshold,t);key=(r['f1'],-r['logLoss'],r['accuracy'])
        if best is None or key>best[0]:best=(key,threshold,t,r)
    _,threshold,t,r=best;m['threshold']=threshold;m['calibration']={'type':'temperature','temperature':t,'tunedOn':r['n'],'labelField':a.label_field};m['validation']={**m.get('validation',{}),'tunedThreshold':threshold,'temperature':t,'tunedF1':r['f1'],'tunedLogLoss':r['logLoss']};Path(a.out).write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'threshold':threshold,'temperature':t,'metrics':r},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
