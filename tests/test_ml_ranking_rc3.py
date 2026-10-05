"""Deterministic held-out ranking metric definitions, not a trained personal model."""
import math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools/ml'))
from evaluate_model import ranking_metrics
from provenance import require_real_labels
class RankingMetricsTests(unittest.TestCase):
 def test_perfect_ranking(self):
  r=ranking_metrics([(1,1),(.9,1),(.2,0)])
  self.assertEqual(r['ndcg'],1);self.assertEqual(r['prAuc'],1);self.assertEqual(r['mrr'],1);self.assertEqual(r['effectiveK5'],3)
 def test_tied_ap(self):self.assertEqual(ranking_metrics([(.5,1),(.5,0)])['prAuc'],.5)
 def test_no_positives(self):
  r=ranking_metrics([(.1,0),(.5,0)]);self.assertIsNone(r['ndcg']);self.assertIsNone(r['prAuc']);self.assertIsNone(r['mrr'])
 def test_empty(self):self.assertEqual(ranking_metrics([])['rankingSamples'],0)
 def test_nonperfect(self):
  r=ranking_metrics([(1,0),(.9,1),(.8,1)],ks=(1,2));self.assertAlmostEqual(r['prAuc'],(.5+2/3)/2);self.assertEqual(r['mrr'],.5);self.assertEqual(r['precisionAt1'],0);self.assertEqual(r['recallAt2'],.5)
class ProvenanceTests(unittest.TestCase):
 def test_missing_attestation_is_not_real_training(self):
  with self.assertRaises(SystemExit):require_real_labels([{'labelUserApply':1}])
 def test_synthetic_rejected_even_when_confirmed(self):
  with self.assertRaises(SystemExit):require_real_labels([{'source':'synthetic-fixture'}],True)
 def test_test_mode_never_marks_real(self):self.assertFalse(require_real_labels([{'labelUserApply':1}],True,True))
 def test_user_attestation_is_required(self):self.assertTrue(require_real_labels([{'source':'user-feedback'}],True))
if __name__=='__main__':unittest.main()
