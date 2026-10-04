import json, math, subprocess, unittest
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'/'ml'))
from common import features, sigmoid

class RuntimeCompatibility(unittest.TestCase):
    def test_browser_and_python_feature_hashing_match(self):
        row={'title':'Junior C# Developer','company':'Example Tech','role':'developer','remote':True,'calls':'no-calls','sales':False,'senior':False,'junior':True,'requiredYears':2,'technologies':['c#','sql','docker']}
        py=features(row)
        script=f"""
const R=require({json.dumps(str(ROOT/'extension'/'model-runtime.js'))});
(async()=>{{const x=await R.vector({json.dumps(row,ensure_ascii=False)},256);process.stdout.write(JSON.stringify(x));}})().catch(e=>{{console.error(e);process.exit(1)}});
"""
        out=subprocess.check_output(['node','-e',script],text=True)
        js=json.loads(out)
        self.assertEqual(len(py),len(js))
        for a,b in zip(py,js): self.assertAlmostEqual(a,b,places=12)

    def test_browser_probability_matches_python_before_calibration(self):
        row={'title':'Support API SQL','company':'Acme','role':'support','remote':True,'calls':'no-calls','sales':False,'senior':False,'junior':False,'requiredYears':1,'technologies':['sql','rest']}
        w=[((i%11)-5)/100 for i in range(256)]
        py=sigmoid(sum(a*b for a,b in zip(w,features(row))))
        model={'schemaVersion':1,'modelType':'personal-vacancy-logreg','modelVersion':'compat','dimension':256,'weights':w,'threshold':.5,'trainedOnRealLabels':False}
        script=f"""
const R=require({json.dumps(str(ROOT/'extension'/'model-runtime.js'))});
(async()=>{{const r=await R.predict({json.dumps(model)},{json.dumps(row)});process.stdout.write(String(r.rawProbability));}})().catch(e=>{{console.error(e);process.exit(1)}});
"""
        js=float(subprocess.check_output(['node','-e',script],text=True))
        self.assertAlmostEqual(py,js,places=12)

if __name__=='__main__': unittest.main()
