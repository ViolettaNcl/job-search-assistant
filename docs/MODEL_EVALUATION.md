# Model Evaluation Requirements

These requirements apply once the project introduces trained models.

## Dataset split

Never evaluate a model on the same rows used for training. Use a time-aware or user-event-aware split when leakage from repeated/reposted vacancies is possible.

## Classification metrics

For preference/call/question classifiers report, as appropriate:

- precision;
- recall;
- F1;
- ROC-AUC;
- PR-AUC;
- confusion matrix.

Accuracy alone is insufficient for imbalanced labels.

## Ranking metrics

For ranked vacancy lists consider:

- Precision@K;
- NDCG@K;
- MRR.

## Product metrics

Offline model quality is separate from job-search outcomes. Track user acceptance/override rates and later application/reply/interview rates with sample sizes.

## Baseline comparison

Every trained model must be compared with:

1. a trivial baseline;
2. the current deterministic `rules-v1` ranking;
3. the previously promoted model, if one exists.

## No causal claims

Higher historical reply rate does not prove a feature caused employer engagement. Product analytics should report associations with sample size and uncertainty rather than causal claims.
