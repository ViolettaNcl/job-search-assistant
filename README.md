<p align="center"><img src="docs/assets/hero.svg" alt="Violetta Apply Assistant" width="100%"></p>

# Violetta Apply Assistant

**Current release: 5.2.0 — Production Learning Loop**

Violetta Apply Assistant is a vacancy-first job-search copilot built around HeadHunter. It combines exact-vacancy reading, explicit calls/no-calls detection, explainable ranking, batch analysis, persistent application memory, questionnaire autofill, recruiter/interview assistance, outcome tracking and a local personal-learning system.

5.2 closes the main gap left by the 5.0 Foundation: a validated model can now move through a complete **offline train → calibrate → evaluate → register → explicitly promote → run → monitor → retrain-proposal** lifecycle. The extension still works without any trained model, and safety decisions such as calls/sales exclusions remain deterministic.

## Main workflow

```text
HH search results
→ ⚡ Analyze page
→ exact vacancyId + full vacancy reader
→ Calls: ✓ no calls / ✕ calls / ? unknown
→ explainable rules Fit Score
→ bounded personal signals from real feedback
→ optional promoted preference model contribution
→ filters + Ready Queue
→ vacancy-specific ✦ Отклик + письмо
→ questionnaire autofill + correction capture
→ pre-submit change review
→ recruiter / interview workflow
→ application outcomes + timeline
→ Learning & Model Center
→ export real labelled datasets
→ offline training / calibration / evaluation
→ explicit model promotion
→ prediction monitoring / drift / retraining proposal
```

## What 5.2 adds

### Promoted-model runtime

A preference model is no longer only an offline artifact. A model JSON can be imported into the local Model Registry and, after an explicit promotion gate, used as a **bounded ranking contribution**. It does not replace the deterministic Fit Score and cannot override hard Calls/Sales safety filters.

The same runtime also supports a separate **Employer Engagement** model. Its prediction is displayed as a separate signal and is never mixed into the user's personal Fit preference target.

### Calibration and threshold tuning

`tools/ml/train_pipeline.py` implements a real offline workflow:

```text
validate dataset
→ stratified temporal train / calibration / test split
→ train logistic baseline
→ tune temperature + decision threshold on calibration split
→ evaluate once on held-out test split
→ register candidate model
→ optionally promote only through explicit gate
```

Synthetic fixtures can exercise the pipeline with `--test-only`, but those artifacts remain `trainedOnRealLabels=false` and cannot be promoted.

### Monitoring and drift

The Learning Center now reports, when enough post-prediction labels exist:

- labelled prediction count;
- accuracy / precision / recall / F1;
- Brier score;
- expected calibration error (ECE);
- recent vs early prediction-rate / label-rate drift;
- a retraining proposal when enough new evidence or degradation accumulates.

A retraining proposal is advisory. The extension does not silently train or promote a new model after every click.

### Independent preference vs engagement datasets

The project keeps two different targets:

1. **Preference:** `Would I apply to this vacancy?`
2. **Engagement:** `Did this application produce meaningful employer engagement?`

The engagement dataset is derived from outcome events such as recruiter reply/interview/test/offer and is not treated as a substitute for user preference labels.

### Semantic questionnaire retrieval

Confirmed reusable questionnaire answers can now be retrieved through a local deterministic semantic hash-vector index when exact semantic keys differ. Vacancy-specific answers remain isolated by vacancy/company context.

This mechanism is **not described as a trained embedding model**. It is a lightweight local retrieval index used until enough data exists to justify a learned semantic model.

### Richer correction learning

If the extension autofills or drafts a questionnaire answer and the user edits it, trusted user input is captured as a structured `QUESTIONNAIRE_EDITED` learning event containing the original answer, corrected answer, category and question context.

### Pre-submit diff

The final-review surface can show what the agent intends to submit: field, previous value, proposed value/action, review/blocked state, selected CV and cover-letter presence. The user retains control of complex final submission.

### Stronger interview practice

Interview Prep remains vacancy-grounded. 5.2 adds a local mock-answer review surface that evaluates response structure (clarity, relevance, specificity and evidence grounding) without claiming to assess a person's competence or invent missing experience.

## Existing protected workflows

5.2 keeps the established 3.9–5.0 behavior:

- exact HH vacancy identity and full-vacancy reading;
- hidden-tab reader + `api.hh.ru` fallback;
- single-card and batch Analysis;
- separate Fit and Calls indicators;
- Ready Queue, Save, Skip and Apply;
- persistent vacancy/application/questionnaire memory;
- vacancy-specific cover letters;
- employer-already-viewed auto-close;
- questionnaire autofill with review-safe human drafts;
- recruiter chat copilot and outcome timeline;
- duplicate/repost advisory;
- repository-hygiene guard.

## AI / ML terminology

The project deliberately separates:

- **Rules:** deterministic calls detection, hard gates and base Fit features.
- **Personal signals:** bounded weights derived from real user actions.
- **LLM assistance:** writing/semantic generation when configured.
- **Retrieval:** exact and semantic local memory lookup.
- **ML:** trained model artifacts evaluated on held-out data and explicitly promoted.

The repository does not claim that heuristics are machine learning.

## Installation

1. Extract the FULL or standalone extension archive.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. FULL build: select `extension/`.
6. Git source: select `browser-extension/`.
7. Grant HH permissions if Chrome asks.
8. Reload already-open HH pages once after upgrading.

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Repository layout

Git tracks source, tests and documentation only:

```text
.github/
browser-extension/
docs/
scripts/
src/
tests/
tools/
```

Do not commit FULL bundles, runtime `backend/`, packaged `extension/`, ZIPs, test output, local databases or build artifacts. Run:

```powershell
python tools/check-repo-hygiene.py
```

before publication.

## Model operations quick start

After exporting real preference labels from Learning Center:

```powershell
powershell -ExecutionPolicy Bypass -File tools/ml/train-model.ps1 `
  -Dataset .\violetta-preference-dataset.jsonl `
  -Target preference `
  -OutputDir .\artifacts\preference-v1
```

The pipeline creates a candidate model, calibrated metrics and registry entry. Promotion remains explicit. Import the candidate model JSON in **Learning & Model Center**, inspect its metadata/metrics, then promote it only if the gate accepts it.

For test-only pipeline validation, use the Python `--test-only` option. Test-only artifacts cannot be promoted.

See [docs/MODEL_OPERATIONS.md](docs/MODEL_OPERATIONS.md).

## Privacy

Learning data, imported model artifacts and user state remain local by default. GitHub should contain code/schemas, not runtime learning databases. The Learning Center supports local export/import/reset controls; reset learning does not delete CVs or application history.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/FEATURES.md](docs/FEATURES.md)
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- [docs/LEARNING_SYSTEM.md](docs/LEARNING_SYSTEM.md)
- [docs/ML_ARCHITECTURE.md](docs/ML_ARCHITECTURE.md)
- [docs/MODEL_EVALUATION.md](docs/MODEL_EVALUATION.md)
- [docs/MODEL_OPERATIONS.md](docs/MODEL_OPERATIONS.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/PRIVACY_AND_DATA.md](docs/PRIVACY_AND_DATA.md)
- [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md)
- [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md)
- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [ROADMAP.md](ROADMAP.md)

## Product principle

Automation should reduce repetitive work while remaining reversible, explainable and grounded in verified candidate facts. Model quality is earned from real labelled usage; it is not assumed from version numbers.
