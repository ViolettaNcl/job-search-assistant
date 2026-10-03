<p align="center"><img src="docs/assets/hero.svg" alt="Violetta Apply Assistant" width="100%"></p>

# Violetta Apply Assistant

**Current release: 4.0.0**

Violetta Apply Assistant is a vacancy-first job-search copilot for HeadHunter. It runs primarily as a Chrome extension and keeps each decision bound to the exact `vacancyId`: full-vacancy analysis, phone-duty detection, explainable fit ranking, application preparation, questionnaire assistance and recruiter-chat drafts.

Version 4.0 moves the project from one-card-at-a-time assistance toward a structured job-search workflow: **Batch Analysis → Explainable Fit Score → filters → user-controlled Apply Queue**. It deliberately does **not** claim machine learning yet. The 4.0 scoring model is deterministic and explainable so that 4.1 can later collect reliable feedback/training signals.

## Core workflow

```text
HH search results
→ ⚡ Analyze page
→ full vacancy read for each exact vacancyId
→ Analysis: calls / no calls
→ Fit Score with reasons + risks
→ filter the page
→ Ready to Apply queue
→ user chooses Apply / Review / Save / Skip
→ ✦ Отклик + письмо
→ questionnaire autofill if required
→ final review
→ persistent vacancy/application memory
```

## 4.0 search-page intelligence

### Batch Analysis

`⚡ Analyze page` collects the unique vacancies currently rendered on the HH search page and analyzes them with bounded concurrency. It does not open dozens of visible tabs and does not mass-submit applications.

For every vacancy it:

1. fixes the exact `vacancyId`;
2. obtains the full description through the reliable HH reader / API fallback;
3. runs phone-duty Analysis;
4. extracts structured vacancy features;
5. calculates an explainable Fit Score;
6. stores the result by vacancy ID;
7. updates all repeated cards for that vacancy.

Default batch concurrency is 3 and is configurable from the compact search-page toolbar.

### Explainable Fit Score

Fit Score is currently **rules-v1**, not an ML model. The score uses structured evidence such as:

- role family;
- confirmed candidate skills vs vacancy technologies;
- remote/office format;
- phone-call duties;
- sales focus;
- seniority and explicit years-of-experience requirements;
- English requirement when detectable;
- user search preferences.

A score is always accompanied by reasons and risks. Examples:

```text
91% Match
✓ Remote
✓ No required calls
✓ C#, SQL Server and REST API match
! Linux is requested but not confirmed
```

Phone-call vacancies are strongly penalized when `avoidCalls` is enabled. Sales-focused roles are similarly penalized when `avoidSales` is enabled.

### Search filters

The 4.0 toolbar can filter the current HH result page by:

- all vacancies;
- confirmed no-calls vacancies;
- Fit Score above the selected threshold;
- vacancies ready for the queue;
- saved-for-later vacancies.

Filters affect only the local page presentation; they do not modify HH search settings or submit anything.

### Ready to Apply queue

The queue is derived from analyzed vacancies and remains user-controlled. A queue item can be:

- **Apply** — invokes the existing exact-card `✦ Отклик + письмо` flow;
- **Show** — scrolls back to the card for manual review;
- **Save** — persists a saved-for-later decision;
- **Skip** — persists a skip decision.

These decisions are stored as structured data so the later 4.1 Learning Engine can use explicit feedback. In 4.0 they are **not yet used to train or adapt a model**.

## Existing protected workflows

### Vacancy Analysis

The single-card `Analysis` button remains available. It reads the exact full vacancy through a hidden/background HH page and `api.hh.ru` fallback, checks that the returned vacancy ID matches the selected card, and returns:

- `✓ Без звонков`;
- `✕ Есть звонки`;
- `↻ Повторить` only when the full vacancy cannot be verified.

Telephony configuration, SIP/VoIP setup, generic incoming requests, tickets and chats are not treated as phone-call duties by themselves.

### Vacancy-specific application

`✦ Отклик + письмо` keeps the application pinned to the selected card. It rejects search-page headings as vacancy titles, does not borrow another card's description, and prepares the letter only from verified candidate evidence.

If HH reports `Отклик уже просмотрен работодателем`, only that known terminal modal is closed automatically and the vacancy is marked as already viewed.

### Persistent vacancy memory

Memory is keyed by exact vacancy ID and survives HH SPA rerenders, reloads, Back/Forward, repeated search results and questionnaire navigation.

4.0 additionally persists:

- structured vacancy features;
- Fit Score and explanations;
- batch-analysis timestamp/source;
- Save / Skip / Reviewed decisions;
- job-search preference profile.

### Smart Questionnaire Autofill

Questionnaire support from 3.9.x remains intact. Confirmed facts are preferred. Reviewable neutral drafts can be generated for subjective free-text questions, but the assistant does not fabricate verifiable candidate facts such as citizenship, work authorization, certificates, exact years of experience or a numeric salary value.

Final submission of complex forms remains under user control when review fields are present.

## Architecture

The product is extension-first:

```text
browser-extension/
  HH page integration
  Batch Analysis UI
  rules-v1 Fit Score
  vacancy/application memory
  questionnaire copilot
  recruiter chat copilot

src/
  optional .NET backend source
  dashboard / advanced automation / analytics
```

The local backend remains optional for core search-page intelligence. Batch Analysis, Fit Score, queue, quick apply, questionnaire memory and recruiter-chat drafts are extension features.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the detailed flow and storage model.

## Installation

1. Extract the FULL ZIP or standalone extension ZIP.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. For the FULL bundle select `extension/`.
6. For source/development installation select `browser-extension/` in the Git repository.
7. Grant HH/HeadHunter access when Chrome requests it.
8. Reload already-open HH pages once after an extension upgrade.

Detailed instructions: [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Documentation

| Document | Purpose |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Installation and daily use |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature reference |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime/storage architecture |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Structured vacancy/application/learning data |
| [docs/LEARNING_SYSTEM.md](docs/LEARNING_SYSTEM.md) | 4.1 learning design and feedback signals |
| [docs/ML_ARCHITECTURE.md](docs/ML_ARCHITECTURE.md) | Planned 5.0 ML architecture |
| [docs/MODEL_EVALUATION.md](docs/MODEL_EVALUATION.md) | Model evaluation requirements |
| [docs/REPOSITORY_LAYOUT.md](docs/REPOSITORY_LAYOUT.md) | Clean source repository layout |
| [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md) | Safe publishing without FULL/runtime duplication |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | HH/Chrome troubleshooting |
| [docs/PRIVACY_AND_DATA.md](docs/PRIVACY_AND_DATA.md) | Candidate data and future local vault |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Test suites and commands |
| [ROADMAP.md](ROADMAP.md) | 4.1 → 5.0 development sequence |
| [WHAT_CHANGED.md](WHAT_CHANGED.md) | Current release changes |

## Repository hygiene

The Git repository is a source repository. Do not copy a FULL bundle into it.

Tracked source is expected under:

```text
.github/
browser-extension/
docs/
scripts/
src/
tests/
tools/
```

Runtime/release folders such as `backend/`, packaged `extension/`, `test-results/`, `dist/`, `artifacts/` and `Violetta-Apply-Assistant-*` must not be tracked in Git.

Before publishing:

```powershell
python tools/check-repo-hygiene.py
```

## Development

Core checks:

```powershell
node --test browser-extension/*.test.js
python tests/browser_batch_400.py
python tests/browser_memory_399.py
python tests/browser_questionnaire_3912.py
python tests/hh_read_fallback_3910.py
python tests/test_source_publication.py
python tests/test_repository_hygiene.py
```

Synthetic fixtures verify extension logic and DOM flows; they are not a permanent guarantee against future HH production changes.

## Publishing

Use `Publish-Violetta-4.0.0.ps1`. It verifies the source manifest and copies only whitelisted source/documentation files into the existing Git repository. It never performs force-push, reset, clean or stash.

## Roadmap principle

- **4.0** creates structured vacancy data and user decisions.
- **4.1** introduces the Personal Learning Engine and feedback event store.
- **4.2** learns from application outcomes and adds stronger analytics.
- **4.3** expands recruiter and interview intelligence.
- **4.4** introduces multi-site adapters.
- **5.0** may train real ranking/classification models only after enough labelled real-user data exists.

The project intentionally distinguishes deterministic rules, LLM-assisted writing, retrieval, embeddings and actual trained ML models. No component should be labelled "machine learning" until a model is genuinely trained and evaluated.
