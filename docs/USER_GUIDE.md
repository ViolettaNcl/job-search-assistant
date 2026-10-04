# User Guide · 5.2

## Install

1. Extract the standalone extension or FULL bundle.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load `extension/` from FULL, or the standalone extension folder.
5. Reload existing HH tabs once after upgrade.

## Search-page workflow

### One vacancy

Use `Analysis` for a single exact vacancy.

Calls status is separate from Fit:

- `✓ Без звонков` — no required phone/voice duties detected in the full vacancy.
- `✕ Есть звонки` — phone/voice duties detected.
- `?` — full evidence unavailable/uncertain.

### Whole page

Use `⚡ Analyze page`. The extension processes unique rendered vacancy IDs with bounded concurrency, restores cached results and computes Fit.

Fit tooltip explains rules/personal/ML contributions. A promoted ML model never changes the Calls hard gate.

## Queue and feedback

- **Apply** — starts the exact existing vacancy-specific apply flow.
- **Save** — positive preference signal.
- **Skip** — negative preference signal.
- **✓ / ✕ next to Fit** — explicit feedback on ranking quality.

## Questionnaire workflow

Confirmed facts are used first. Safe subjective fields can receive reviewable drafts. High-risk factual/legal fields remain review-gated.

If you edit an autofilled/drafted answer, the extension records the correction as a learning example. Confirmed generic answers can later be retrieved for semantically similar questions; vacancy-specific motivation answers remain isolated.

## Pre-submit review

The final review can summarize proposed field changes, overwrite/review/blocked counts, CV and cover-letter state. Review unresolved fields before final submission.

## Learning & Model Center

Open **Learning** from the extension home page.

You can:

- inspect event / preference-label / engagement-label counts;
- export a full backup;
- export preference or engagement JSONL datasets;
- import a learning backup;
- reset learning data;
- import a candidate model JSON;
- explicitly promote a valid real-label model;
- disable active preference ML;
- inspect model monitoring/drift/retraining information.

Importing a model does not activate it. Promotion is a separate action.

## Training a model

Training happens offline, not inside Chrome. See [MODEL_OPERATIONS.md](MODEL_OPERATIONS.md).

Never treat synthetic test metrics as personal model quality.

## Interview practice

Interview Prep uses the exact vacancy plus confirmed profile evidence. Mock practice scores response structure/evidence grounding only. It does not invent experience or make claims about personal competence.
