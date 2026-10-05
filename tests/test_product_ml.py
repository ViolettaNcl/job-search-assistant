import importlib.util,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools/ml'))
import train_pipeline, evaluate_model, validate_dataset
class ProductML(unittest.TestCase):
 def test_constant_predictions_have_auc_half(self):
  m={'weights':[0]*256,'threshold':.5}
  rows=[{'labelUserApply':i%2,'vacancyId':str(i)} for i in range(20)]
  self.assertEqual(evaluate_model.auc(rows,m,'labelUserApply'),.5)
 def test_global_time_boundaries(self):
  rows=[{'timestamp':i+1,'labelUserApply':0 if i<65 else i%2,'vacancyId':str(i)} for i in range(100)]
  a,b,c=train_pipeline.split_three(rows,'labelUserApply')
  self.assertLess(max(x['timestamp'] for x in a),min(x['timestamp'] for x in b));self.assertLess(max(x['timestamp'] for x in b),min(x['timestamp'] for x in c));self.assertEqual(len(a)+len(b)+len(c),100)
 def test_equal_timestamp_group_not_split(self):
  rows=[{'timestamp':i//5+1,'labelUserApply':i%2} for i in range(100)]
  a,b,c=train_pipeline.split_three(rows,'labelUserApply')
  self.assertFalse(set(x['timestamp'] for x in a)&set(x['timestamp'] for x in b));self.assertFalse(set(x['timestamp'] for x in b)&set(x['timestamp'] for x in c))
 def test_missing_time_rejected(self):
  with self.assertRaises(ValueError):train_pipeline.split_three([{'labelUserApply':i%2} for i in range(20)],'labelUserApply')
 def test_duplicate_vacancy_with_changed_event_id(self):
  rows=[{'vacancyId':'a','eventId':'1','labelUserApply':1},{'vacancyId':'a','eventId':'2','labelUserApply':0}]
  r=validate_dataset.validate(rows,'labelUserApply');self.assertFalse(r['ok']);self.assertEqual(r['duplicateIds'],1)
if __name__=='__main__':unittest.main()
