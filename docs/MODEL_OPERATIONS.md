# Model Operations · 5.2

This guide describes the safe operational loop for real personal models.

## 1. Collect real labels

Use the extension normally. Preference labels come from Apply/Save/Skip/Fit feedback. Engagement labels come later from real outcome changes.

Do not manufacture labels simply to reach a sample count.

## 2. Export dataset

Learning & Model Center can export:

- preference JSONL;
- engagement JSONL;
- full learning backup JSON.

Keep exports local if they contain personal context.

## 3. Train the preference baseline

Example:

```powershell
powershell -ExecutionPolicy Bypass -File tools/ml/train-model.ps1 `
  -Dataset .\violetta-preference-dataset.jsonl `
  -Target preference `
  -OutputDir .\artifacts\preference-v1
```

For engagement use `-Target engagement` with the engagement dataset.

## 4. Pipeline stages

`train_pipeline.py` validates the dataset, creates train/calibration/test subsets, trains, tunes temperature/threshold, evaluates on held-out data and registers a candidate artifact.

## 5. Test-only mode

Use Python `--test-only` only to verify mechanics. Such artifacts are marked non-real and cannot pass promotion.

## 6. Import candidate into extension

Open Learning & Model Center → Model Registry → import the candidate model JSON. Import does not activate it.

## 7. Promote explicitly

Select a candidate and press Promote. The local gate verifies real-label metadata and minimum quality evidence. Preference and engagement models are promoted independently.

## 8. Monitor

After promotion and later real decisions, inspect monitoring metrics and drift. A retraining proposal means “consider training a new candidate,” not “replace the model automatically.”

## 9. Disable / rollback

Disable preference ML from the Learning Center at any time. Rules + personal signals remain available. Keeping model activation optional makes the system usable even when a model degrades or insufficient labels exist.
