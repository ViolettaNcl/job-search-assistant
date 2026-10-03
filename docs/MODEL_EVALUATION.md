# Model Evaluation

A trained model must be evaluated on data not used for fitting.

## Preference baseline

Minimum tracked metrics:

- validation sample size;
- precision;
- recall;
- F1;
- accuracy;
- log loss;
- ROC-AUC when both classes exist.

## Promotion

`tools/ml/promote_model.py` rejects candidates when:

- the model is not marked as trained on real labels;
- validation sample size is below the required gate;
- F1 is below the configured floor;
- F1 regresses against the active model.

The default production training command expects at least 100 labels. A larger dataset is preferred.

## Test data

Synthetic fixtures may test code paths only. Their metrics are never reported as personal model quality and such models are marked `trainedOnRealLabels=false`, which prevents promotion.
