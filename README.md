<p align="center"><img src="docs/assets/hero.svg" alt="Violetta Apply Assistant" width="100%"></p>

# Violetta Apply Assistant

**Current release: 5.0.0 Foundation**

Violetta Apply Assistant is a vacancy-first job-search copilot centered on HeadHunter. It combines exact-vacancy analysis, no-calls detection, explainable fit ranking, persistent application memory, questionnaire autofill, recruiter assistance, outcome analytics and a privacy-conscious personal learning layer.

5.0 is intentionally called **Foundation**: the product now contains the data/learning/model pipeline required for real ML, while production decisions still remain explainable and safe when no validated trained model exists. The extension never labels heuristics as machine learning.

## Main workflow

```text
HH search results
→ ⚡ Analyze page
→ exact vacancyId + full vacancy read
→ Calls status: ✓ no calls / ✕ calls / ? unknown
→ explainable Fit Score
→ personal learning adjustment from your real Apply / Save / Skip / ✓ / ✕ history
→ filters + Ready Queue
→ vacancy-specific ✦ Отклик + письмо
→ questionnaire autofill + review gate
→ recruiter / interview workflow
→ outcomes + timeline
→ Learning Center
→ export labelled dataset
→ offline model training + evaluation + promotion gate
```

## What 5.0 adds

### Personal Learning Engine

The extension records structured `LearningEvent` objects from real user actions. Examples:

- `VACANCY_APPLIED`
- `VACANCY_SAVED`
- `VACANCY_SKIPPED`
- `FIT_ACCEPTED`
- `FIT_REJECTED`
- `COVER_LETTER_EDITED`
- `OUTCOME_CHANGED`

These are stored locally and used to derive explainable personal signals. A positive history around a role or technology can adjust the deterministic Fit Score; repeated skips can reduce it. The adjustment is bounded, visible in the Fit tooltip and never overrides hard safety constraints such as required phone calls when calls are disabled.

### Clear Fit vs Calls UI

`Fit` and `Calls` are separate indicators.

```text
86% Match     ✓ Без звонков
70% Match     ✕ Есть звонки
```

Fit color means job-fit strength. Calls color means whether phone/voice duties were detected. They are not the same signal.

### Explicit and implicit feedback

The search page records:

- Apply → strong positive signal;
- Save → positive signal;
- Skip → negative signal;
- ✓ next to Fit → score was useful;
- ✕ next to Fit → score was wrong.

The system does not silently change confirmed candidate facts from these signals.

### Learning Center

Open **Learning Center** from the extension popup to see:

- number of learning events;
- number of labelled vacancy decisions;
- strongest role/technology preference signals;
- application outcome funnel;
- ML training readiness;
- current model-registry state;
- export/import/reset controls.

Exports are local JSON / JSONL files. Resetting learning data does not delete CVs or application history.

### Outcome learning foundation

Application outcomes remain separate from preference labels. `Would I apply?` and `Did the employer respond?` are different targets. Outcome analytics include sample-size warnings so a tiny sample is not presented as strong evidence.

### Recruiter and interview intelligence

5.0 adds deterministic recruiter-intent classification and an evidence-safe interview-preparation plan. It can recognize salary questions, interview invitations, test assignments, technical questions, rejection and follow-up messages. Interview preparation uses the exact vacancy and confirmed profile evidence; it does not manufacture experience.

### Multi-site adapter contract

`site-adapter-core.js` defines a formal `JobSiteAdapter` contract for future providers. HH remains the primary live-tested adapter. Other selectors already exist in the legacy adapter layer, but 5.0 does **not** claim full live support for every listed site.

### Repost / duplicate detection

A cross-ID detector compares company, normalized title and description similarity. It can flag a likely repost even when the source vacancy ID changes. This is advisory, not a destructive deduplication action.

## Real ML pipeline

The repository now contains a real offline baseline pipeline under `tools/ml/`:

```text
tools/ml/train_preference.py
tools/ml/evaluate_model.py
tools/ml/model_registry.py
tools/ml/promote_model.py
```

The first model is a logistic-regression preference baseline trained from exported real labels. It uses deterministic hashed features and produces a versioned model JSON.

Important safeguards:

1. production training requires a minimum labelled dataset;
2. both positive and negative labels are required;
3. training and evaluation are separate steps;
4. model promotion refuses synthetic/test-only models;
5. validation sample size and F1 thresholds are enforced;
6. a candidate cannot replace an active model if the configured promotion metric regresses;
7. no online retraining happens after every click.

Synthetic data is used only in automated tests to prove the pipeline works. It is never represented as a real personal model.

## Existing protected workflows

5.0 preserves the established 3.9/4.0 flows:

- full exact-vacancy reader with hidden-tab + `api.hh.ru` fallback;
- `Analysis` for calls/no-calls;
- `⚡ Analyze page` batch processing with bounded concurrency;
- user-controlled Ready Queue;
- persistent vacancy memory by exact ID;
- individual cover letters;
- employer-already-viewed auto-close;
- smart questionnaire autofill and human fallback drafts;
- final review gate;
- recruiter-chat copilot;
- application timeline and reminders.

## Installation

1. Extract the FULL or standalone extension ZIP.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. FULL build: select `extension/`.
6. Git source: select `browser-extension/`.
7. Grant HH access if Chrome asks.
8. Reload already-open HH tabs once after upgrading.

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Repository layout

The Git repository contains source, tests and docs only:

```text
.github/
browser-extension/
docs/
scripts/
src/
tests/
tools/
```

Do not commit FULL releases, runtime `backend/`, packaged `extension/`, ZIPs, test-results, databases, logs or build output. Run:

```powershell
python tools/check-repo-hygiene.py
```

before publishing.

## ML quick start

After enough real decisions have been collected:

```powershell
# Export dataset from Learning Center first.
python tools/ml/train_preference.py violetta-preference-dataset.jsonl --out candidate-model.json
python tools/ml/evaluate_model.py candidate-model.json violetta-preference-dataset.jsonl --out candidate-metrics.json
python tools/ml/model_registry.py model-registry.json candidate-model.json --metrics candidate-metrics.json
python tools/ml/promote_model.py model-registry.json <modelVersion>
```

Default production training expects at least 100 labelled decisions. For meaningful personalization, several hundred real labels are preferred.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- [docs/FEATURES.md](docs/FEATURES.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/LEARNING_SYSTEM.md](docs/LEARNING_SYSTEM.md)
- [docs/ML_ARCHITECTURE.md](docs/ML_ARCHITECTURE.md)
- [docs/MODEL_EVALUATION.md](docs/MODEL_EVALUATION.md)
- [docs/PRIVACY_AND_DATA.md](docs/PRIVACY_AND_DATA.md)
- [docs/REPOSITORY_LAYOUT.md](docs/REPOSITORY_LAYOUT.md)
- [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md)
- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [ROADMAP.md](ROADMAP.md)
- [WHAT_CHANGED.md](WHAT_CHANGED.md)

## Product principle

The assistant should become more personal as real evidence accumulates, but automation must remain reversible, explainable and grounded in verified candidate facts. Rules, LLM assistance, retrieval, embeddings and trained ML models are documented as separate mechanisms.
