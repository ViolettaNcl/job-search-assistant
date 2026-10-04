import json, subprocess, sys, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ML=ROOT/'tools'/'ml'
class MlOps(unittest.TestCase):
    def make(self,path,label,n=60):
        with open(path,'w',encoding='utf-8') as f:
            for i in range(n):
                y=1 if i%2==0 else 0
                row={'eventId':str(i),'timestamp':1_700_000_000_000+i*1000,'vacancyId':str(i),'title':'Junior C# remote' if y else 'Sales manager calls','company':'A' if y else 'B','role':'developer' if y else 'sales','remote':bool(y),'calls':'no-calls' if y else 'calls','sales':not bool(y),'senior':False,'junior':bool(y),'requiredYears':1 if y else 5,'technologies':['c#','sql'] if y else [],label:y}
                f.write(json.dumps(row,ensure_ascii=False)+'\n')
    def run_pipeline(self,target,label):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);ds=d/'data.jsonl';out=d/'out';self.make(ds,label)
            subprocess.check_call([sys.executable,str(ML/'train_pipeline.py'),str(ds),'--target',target,'--out-dir',str(out),'--min-labels','20','--test-only'],cwd=ML)
            model=json.loads((out/'model.json').read_text());metrics=json.loads((out/'test-metrics.json').read_text());reg=json.loads((out/'registry.json').read_text())
            self.assertFalse(model['trainedOnRealLabels']);self.assertIn('calibration',model);self.assertGreater(metrics['n'],0);self.assertEqual(reg['schemaVersion'],2);return model
    def test_preference_pipeline(self):
        m=self.run_pipeline('preference','labelUserApply');self.assertEqual(m['modelType'],'personal-vacancy-logreg')
    def test_engagement_pipeline_is_independent(self):
        m=self.run_pipeline('engagement','labelEmployerEngagement');self.assertEqual(m['modelType'],'employer-engagement-logreg')
    def test_dataset_validator_rejects_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as d:
            ds=Path(d)/'d.jsonl';self.make(ds,'labelUserApply',10);lines=ds.read_text().splitlines();ds.write_text('\n'.join(lines+[lines[0]])+'\n')
            p=subprocess.run([sys.executable,str(ML/'validate_dataset.py'),str(ds)],cwd=ML,capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0);self.assertIn('duplicate-example-identifiers',p.stdout)

    def test_real_pipeline_rejects_too_few_examples_in_one_class(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);ds=d/'imbalanced.jsonl';out=d/'out'
            with open(ds,'w',encoding='utf-8') as f:
                for i in range(100):
                    y=0 if i<95 else 1
                    row={'eventId':str(i),'timestamp':1_700_000_000_000+i*1000,'vacancyId':str(i),'title':'Role','company':'X','role':'support','remote':True,'calls':'no-calls','sales':False,'senior':False,'junior':False,'requiredYears':1,'technologies':['sql'],'labelUserApply':y}
                    f.write(json.dumps(row)+'\n')
            p=subprocess.run([sys.executable,str(ML/'train_pipeline.py'),str(ds),'--target','preference','--out-dir',str(out),'--min-labels','100'],cwd=ML,capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0)
            self.assertIn('at least 10 examples in each class',p.stdout+p.stderr)

if __name__=='__main__':unittest.main()
