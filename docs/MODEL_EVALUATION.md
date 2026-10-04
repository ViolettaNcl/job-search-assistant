# Model Evaluation · 5.2

## Split discipline

Training, calibration and final test roles are separated. Threshold/temperature tuning uses the calibration subset; final reported test metrics come from held-out rows not used for fitting/tuning.

The pipeline prefers a stratified temporal split so later examples are not casually leaked into training.

## Metrics

Preference and engagement models track, when defined:

- sample size and class balance;
- accuracy;
- precision;
- recall;
- F1;
- Brier score;
- log loss;
- ROC-AUC when both classes exist.

Runtime monitoring additionally tracks expected calibration error (ECE) and recent-vs-early rate drift.

## Promotion gate

A candidate must:

- be marked trained on real labels;
- have sufficient held-out sample size;
- meet the configured F1 floor;
- not regress against the active same-target model under the configured metric gate.

Promotion is explicit.

## Interpretation

Metrics on tiny samples are unstable. The product should display sample size and avoid claiming model quality before enough real labels exist.
