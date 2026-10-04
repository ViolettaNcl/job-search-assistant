#!/usr/bin/env python3
"""Evaluate captured model predictions against later labels and propose retraining when drift appears."""
from __future__ import annotations
import argparse,json,math
from pathlib import Path

def main():
    ap=argparse.ArgumentParser();ap.add_argument('predictions');ap.add_argument('--out');a=ap.parse_args();rows=[]
    with open(a.predictions,encoding='utf-8') as f:
      for line in f:
        if line.strip():rows.append(json.loads(line))
    rows=[r for r in rows if r.get('label') in (0,1) and isinstance(r.get('probability'),(int,float))];n=len(rows);brier=sum((r['probability']-r['label'])**2 for r in rows)/max(1,n);recent=rows[-max(10,n//2):];old=rows[:-len(recent)] if n>len(recent) else []
    def mean(xs,k):return sum(float(x[k]) for x in xs)/max(1,len(xs))
    shift=mean(recent,'probability')-mean(old,'probability') if old else 0;label_shift=mean(recent,'label')-mean(old,'label') if old else 0;retrain=n>=30 and (brier>.25 or abs(shift)>.18 or abs(label_shift)>.22);result={'n':n,'brier':brier,'meanPredictionShift':shift,'labelRateShift':label_shift,'retrainingRecommended':retrain};text=json.dumps(result,indent=2);print(text)
    if a.out:Path(a.out).write_text(text,encoding='utf-8')
if __name__=='__main__':main()
