# ML Architecture · 5.0 Foundation

## Separation of mechanisms

The project distinguishes:

1. deterministic rules;
2. user-derived personal signals;
3. LLM-assisted text generation;
4. retrieval/memory;
5. embeddings/similarity;
6. trained ML models.

Only item 6 is called machine learning.

## First real model

Target: `P(user_would_apply | vacancy)`.

Baseline: logistic regression over structured + hashed sparse features.

Features currently exported:

- role;
- remote;
- calls status;
- sales;
- senior/junior flags;
- required years;
- technologies;
- hashed title/company tokens.

The baseline is deliberately simple so it is debuggable and easy to compare with deterministic rules.

## Training lifecycle

```text
Learning Events
→ labelled JSONL export
→ dataset validation
→ stratified train/validation split
→ candidate model
→ offline evaluation
→ registry
→ promotion gate
→ active model
```

No model is promoted merely because training finished.

## Online behavior

5.0 does not retrain after every click. The extension continues to work with rules + personal signals when no validated model is active.

## Later models

Potential independent models:

- calls classifier;
- questionnaire category classifier;
- employer engagement model;
- duplicate/repost semantic model.

These targets must remain separate because the labels and risks differ.
