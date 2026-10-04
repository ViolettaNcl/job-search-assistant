# Roadmap

## 5.2 Production Learning Loop — current

5.2 completes the main engineering loop planned after the 5.0 Foundation:

- runtime inference for explicitly promoted preference models;
- independent employer-engagement model target;
- train/calibration/test pipeline;
- threshold + temperature calibration;
- model registry v2 and explicit promotion/disable controls;
- runtime prediction monitoring, calibration/drift and retraining proposals;
- semantic questionnaire-memory retrieval;
- richer questionnaire correction capture;
- pre-submit change review;
- stronger interview-practice UI.

## What comes next is mostly evidence, not architecture

### Real-data maturation

1. Collect real Apply / Save / Skip / correction labels.
2. Collect real employer outcomes independently.
3. Train candidate models after minimum sample requirements are met.
4. Validate on held-out chronological data.
5. Promote only if the candidate clears the gate and does not regress.
6. Monitor post-promotion calibration/drift.
7. Retrain when enough new evidence or degradation exists.

### 6.0 only when justified by usage

Potential 6.0 work:

- live-validated adapters for additional job sites;
- richer semantic embeddings only after privacy/performance evaluation;
- scheduled retraining **proposals** (not silent model replacement);
- longer-horizon model-performance dashboards using real labels;
- optional encrypted local vault / desktop service for portable private data.

The project should not increase major versions merely to add cosmetic features. The next meaningful milestone should be driven by real-world evidence and validated provider support.
