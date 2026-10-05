#!/usr/bin/env python3
"""Validate exported Violetta learning datasets before training.
Reports label balance, duplicate IDs, temporal span and obvious leakage risks.
"""
from __future__ import annotations
import argparse, json
from collections import Counter
from pathlib import Path
from common import load_jsonl

def validate(rows, label_field):
    labelled=[r for r in rows if r.get(label_field) in (0,1)]
    ids=[str(r.get('provider') or 'hh')+':'+str(r.get('vacancyId') or r.get('eventId') or '') for r in labelled]
    dup=len(ids)-len(set(ids))
    labels=Counter(int(r[label_field]) for r in labelled)
    times=[int(r.get('timestamp') or 0) for r in labelled if int(r.get('timestamp') or 0)>0]
    warnings=[]
    if len(labelled)<20:warnings.append('very-small-dataset')
    if min(labels.get(0,0),labels.get(1,0))<5:warnings.append('class-has-fewer-than-5-examples')
    if dup:warnings.append('duplicate-example-identifiers')
    if times and max(times)-min(times)<24*60*60*1000:warnings.append('labels-cover-less-than-24-hours')
    missing_features=sum(1 for r in labelled if not r.get('role') and not r.get('technologies'))
    if labelled and missing_features/len(labelled)>.25:warnings.append('many-rows-missing-role-and-technologies')
    return {'rows':len(rows),'labelled':len(labelled),'labels':dict(labels),'duplicateIds':dup,'missingFeatureRows':missing_features,'timeMin':min(times) if times else None,'timeMax':max(times) if times else None,'warnings':warnings,'ok':len(labelled)>=2 and len(labels)==2 and not dup}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('dataset');ap.add_argument('--label-field',default='labelUserApply');ap.add_argument('--out');a=ap.parse_args();result=validate(load_jsonl(a.dataset),a.label_field);text=json.dumps(result,ensure_ascii=False,indent=2);print(text)
    if a.out:Path(a.out).write_text(text,encoding='utf-8')
    if not result['ok']:raise SystemExit(2)
if __name__=='__main__':main()
