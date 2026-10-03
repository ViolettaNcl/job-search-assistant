# ML Architecture · planned 5.0

4.0 does not contain a trained ML ranking model. It creates structured vacancy/decision data so a future model can be trained honestly.

## Prerequisites

Before training a personal preference model, collect a meaningful set of real labelled decisions. A few dozen examples are not sufficient for a reliable personalized ranking claim. Target at least several hundred labelled vacancies before evaluating a first baseline.

## First model

**Personal Vacancy Preference Classifier**

Target:

`P(user_would_apply | vacancy)`

Start with an interpretable baseline such as Logistic Regression over structured features. Compare against `rules-v1` before considering Random Forest / Gradient Boosting. More complex models are justified only by measured improvement.

## Separate engagement model

A later Employer Engagement model may rank applications by observed reply/interview outcomes. This target must stay separate from user preference; "I like this vacancy" and "this employer will reply" are different labels.

## Text representation

Embeddings can later support:

- duplicate/repost vacancies;
- similar questionnaire questions;
- retrieval of previous corrections;
- text features for preference ranking.

Embedding similarity is not itself a supervised ML outcome model.

## Model registry

Every promoted model should record:

- `modelVersion`;
- `trainingDatasetVersion`;
- training timestamp;
- feature schema version;
- train/test split strategy;
- metrics;
- decision thresholds;
- artifact SHA-256.

## Promotion rule

Train candidate model → evaluate offline → compare with current baseline/model → promote only if metrics and product safety checks improve. Do not update the production model after every click.
