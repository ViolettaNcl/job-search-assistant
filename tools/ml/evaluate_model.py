#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,math
from common import features,load_jsonl,predict,sigmoid

def calibrated(m,p):
    c=m.get('calibration') or {}
    if c.get('type')!='temperature':return p
    t=max(.2,min(5,float(c.get('temperature') or 1)));p=max(1e-7,min(1-1e-7,p));z=math.log(p/(1-p));return sigmoid(z/t)
def probability(m,row):return calibrated(m,predict(m['weights'],features(row)))
def auc(rows,m,label_field):
    pairs=sorted((probability(m,r),r[label_field]) for r in rows if r.get(label_field) in (0,1));pos=sum(y for _,y in pairs);neg=len(pairs)-pos
    if not pos or not neg:return None
    rank_sum=sum(i+1 for i,(_,y) in enumerate(pairs) if y==1);return (rank_sum-pos*(pos+1)/2)/(pos*neg)
def metrics(rows,m,label_field):
    t=float(m.get('threshold',.5));tp=fp=tn=fn=0;brier=loss=0.0
    for r in rows:
        if r.get(label_field) not in (0,1):continue
        y=r[label_field];p=max(1e-9,min(1-1e-9,probability(m,r)));pred=p>=t;tp+=int(pred and y);fp+=int(pred and not y);tn+=int((not pred) and not y);fn+=int((not pred) and y);brier+=(p-y)**2;loss+=-(y*math.log(p)+(1-y)*math.log(1-p))
    precision=tp/max(1,tp+fp);recall=tp/max(1,tp+fn);f1=2*precision*recall/max(1e-12,precision+recall);n=tp+fp+tn+fn
    return {'n':n,'precision':precision,'recall':recall,'f1':f1,'accuracy':(tp+tn)/max(1,n),'rocAuc':auc(rows,m,label_field),'brier':brier/max(1,n),'logLoss':loss/max(1,n),'threshold':t,'labelField':label_field}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('model');ap.add_argument('dataset');ap.add_argument('--label-field',default='labelUserApply');ap.add_argument('--out');a=ap.parse_args();m=json.load(open(a.model,encoding='utf-8'));r=metrics(load_jsonl(a.dataset),m,a.label_field);print(json.dumps(r,indent=2));
    if a.out:open(a.out,'w',encoding='utf-8').write(json.dumps(r,indent=2))
if __name__=='__main__':main()
