import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ML=ROOT/'tools'/'ml'
class MlFoundation(unittest.TestCase):
    def make_dataset(self,p,n=30):
        with open(p,'w',encoding='utf-8') as f:
            for i in range(n):
                y=1 if i%2==0 else 0
                row={'eventId':str(i),'title':'Junior C# remote' if y else 'Sales manager calls','company':'A' if y else 'B','role':'developer' if y else 'sales','remote':bool(y),'calls':'no-calls' if y else 'calls','sales':not bool(y),'senior':False,'junior':bool(y),'requiredYears':1 if y else 5,'technologies':['c#','sql'] if y else [],'labelUserApply':y}
                f.write(json.dumps(row,ensure_ascii=False)+'\n')
    def test_training_and_evaluation_pipeline(self):
        with tempfile.TemporaryDirectory() as d:
            ds=Path(d)/'data.jsonl';model=Path(d)/'model.json';metrics=Path(d)/'metrics.json';self.make_dataset(ds)
            subprocess.check_call([sys.executable,str(ML/'train_preference.py'),str(ds),'--out',str(model),'--allow-small'],cwd=ML)
            subprocess.check_call([sys.executable,str(ML/'evaluate_model.py'),str(model),str(ds),'--out',str(metrics)],cwd=ML)
            m=json.loads(model.read_text());r=json.loads(metrics.read_text());self.assertEqual(m['modelType'],'personal-vacancy-logreg');self.assertFalse(m['trainedOnRealLabels']);self.assertGreaterEqual(r['f1'],0.5)
    def test_promotion_rejects_synthetic_model(self):
        with tempfile.TemporaryDirectory() as d:
            ds=Path(d)/'data.jsonl';model=Path(d)/'model.json';reg=Path(d)/'registry.json';self.make_dataset(ds)
            subprocess.check_call([sys.executable,str(ML/'train_preference.py'),str(ds),'--out',str(model),'--allow-small'],cwd=ML)
            subprocess.check_call([sys.executable,str(ML/'model_registry.py'),str(reg),str(model)],cwd=ML)
            version=json.loads(model.read_text())['modelVersion'];p=subprocess.run([sys.executable,str(ML/'promote_model.py'),str(reg),version,'--min-validation','1'],cwd=ML,capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0);self.assertIn('real labels',p.stderr+p.stdout)
if __name__=='__main__':unittest.main()
