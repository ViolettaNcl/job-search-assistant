#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,time,hashlib
from pathlib import Path

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def kind(model_type):
    if model_type=='employer-engagement-logreg':return 'engagement'
    if model_type=='personal-vacancy-logreg':return 'preference'
    raise SystemExit(f'Unsupported model type: {model_type}')
def main():
    ap=argparse.ArgumentParser();ap.add_argument('registry');ap.add_argument('model');ap.add_argument('--metrics');a=ap.parse_args();p=Path(a.registry);reg=json.loads(p.read_text(encoding='utf-8')) if p.exists() else {'schemaVersion':2,'activeModel':None,'activeModels':{'preference':None,'engagement':None},'models':[]};reg.setdefault('activeModels',{'preference':reg.get('activeModel'),'engagement':None});reg['schemaVersion']=2;m=json.load(open(a.model,encoding='utf-8'));entry={'modelVersion':m['modelVersion'],'modelType':m['modelType'],'kind':kind(m['modelType']),'sha256':sha(a.model),'path':str(Path(a.model)),'trainingLabels':m.get('trainingLabels',0),'trainedOnRealLabels':bool(m.get('trainedOnRealLabels')),'validation':json.load(open(a.metrics,encoding='utf-8')) if a.metrics else m.get('validation',{}),'threshold':m.get('threshold',.5),'calibration':m.get('calibration'),'status':'candidate','registeredAt':int(time.time()*1000)};reg['models']=[x for x in reg.get('models',[]) if x.get('modelVersion')!=entry['modelVersion']]+[entry];reg['updatedAt']=int(time.time()*1000);p.write_text(json.dumps(reg,ensure_ascii=False,indent=2),encoding='utf-8');print(entry['modelVersion'])
if __name__=='__main__':main()
