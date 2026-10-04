# 5.2 Release Notes

## 5.2.0 — Production Learning Loop

- Added compatible browser runtime inference for imported preference and employer-engagement logistic baselines.
- Added Model Registry v2 with independent active preference/engagement slots.
- Added explicit import, promotion and disable controls; synthetic/test-only promotion remains blocked.
- Added dataset validation, three-way train/calibration/test pipeline, temperature calibration and threshold tuning.
- Added independent engagement dataset/training target.
- Added runtime model monitoring, calibration/drift summary and retraining proposals for both targets.
- Added semantic questionnaire-memory retrieval with deterministic local hash vectors.
- Added trusted questionnaire correction capture.
- Added pre-submit change review.
- Added mock interview answer-structure feedback.
- Completed formal JobSiteAdapter methods on DOM adapters while keeping HH as the primary validated provider.
- Preserved all established HH Analysis, Batch Analysis, Apply, questionnaire and memory flows.
