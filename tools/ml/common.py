"""Shared deterministic feature encoding for Violetta 5.2 preference/engagement baselines."""
from __future__ import annotations
import hashlib, json, math
DIM=256

def _bucket(text:str, dim:int=DIM)->int:
    h=hashlib.sha256(text.encode('utf-8')).digest()
    return int.from_bytes(h[:4],'big')%dim

def features(row:dict, dim:int=DIM):
    x=[0.0]*dim
    def add(name,val=1.0): x[_bucket(name,dim)]+=float(val)
    add('bias',1)
    for k in ('remote','sales','senior','junior'): add(k,1 if row.get(k) else 0)
    add('requiredYears',min(10,float(row.get('requiredYears') or 0))/10)
    calls=str(row.get('calls') or 'unknown');add('calls='+calls)
    role=str(row.get('role') or 'other').lower();add('role='+role)
    for t in row.get('technologies') or []: add('tech='+str(t).lower())
    for token in (str(row.get('title') or '')+' '+str(row.get('company') or '')).lower().split():
        if len(token)>=3:add('text='+token,.25)
    return x

def sigmoid(z):
    if z>=0:
        e=math.exp(-z);return 1/(1+e)
    e=math.exp(z);return e/(1+e)

def predict(weights,x): return sigmoid(sum(a*b for a,b in zip(weights,x)))

def load_jsonl(path):
    rows=[]
    with open(path,encoding='utf-8') as f:
        for n,line in enumerate(f,1):
            if not line.strip():continue
            obj=json.loads(line);obj['_line']=n;rows.append(obj)
    return rows
