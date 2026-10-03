#!/usr/bin/env python3
from __future__ import annotations
import argparse,json
from common import features,load_jsonl,predict

def auc(rows,weights):
    pairs=sorted((predict(weights,features(r)),r['labelUserApply']) for r in rows if r.get('labelUserApply') in (0,1));pos=sum(y for _,y in pairs);neg=len(pairs)-pos
    if not pos or not neg:return None
    rank_sum=sum(i+1 for i,(_,y) in enumerate(pairs) if y==1);return (rank_sum-pos*(pos+1)/2)/(pos*neg)

def metrics(rows,m):
    t=float(m.get('threshold',.5));tp=fp=tn=fn=0
    for r in rows:
        if r.get('labelUserApply') not in (0,1):continue
        y=r['labelUserApply'];p=predict(m['weights'],features(r));pred=p>=t;tp+=int(pred and y);fp+=int(pred and not y);tn+=int((not pred) and not y);fn+=int((not pred) and y)
    precision=tp/max(1,tp+fp);recall=tp/max(1,tp+fn);f1=2*precision*recall/max(1e-12,precision+recall)
    return {'n':tp+fp+tn+fn,'precision':precision,'recall':recall,'f1':f1,'accuracy':(tp+tn)/max(1,tp+fp+tn+fn),'rocAuc':auc(rows,m['weights']),'threshold':t}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('model');ap.add_argument('dataset');ap.add_argument('--out');a=ap.parse_args();m=json.load(open(a.model,encoding='utf-8'));r=metrics(load_jsonl(a.dataset),m);print(json.dumps(r,indent=2));
    if a.out:open(a.out,'w',encoding='utf-8').write(json.dumps(r,indent=2))
if __name__=='__main__':main()
