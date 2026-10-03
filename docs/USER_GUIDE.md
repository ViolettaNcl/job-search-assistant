# User Guide · 4.0

## Installation

### Standalone extension

1. Extract the standalone ZIP.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted extension folder.

### FULL bundle

Load `extension/` in Chrome. Run `start-assistant.cmd` only when you need the optional local dashboard/backend workflows.

After an upgrade reload already-open HH tabs once.

## Search-page workflow

### Analyze one vacancy

Use `Analysis` on a card when you want an immediate phone-duty check for that vacancy only.

### Analyze the page

Use the compact toolbar:

`⚡ Analyze page`

The assistant analyzes unique rendered vacancy IDs with limited parallelism. You can press the same button while it is running to stop scheduling additional vacancies.

Each completed vacancy gets a badge such as:

`91% Match`

Hover the badge to see the main positive reasons, risks and the algorithm ID.

## Fit Score settings

Open `⚙` in the search toolbar.

You can change:

- minimum Fit Score;
- avoid calls;
- remote preference;
- whether office vacancies are allowed;
- avoid sales;
- Batch Analysis concurrency (1–4).

Changing settings causes vacancies to be re-evaluated under the new preference profile when analyzed/restored.

Fit Score 4.0 is an explainable rules baseline, not a trained model.

## Filters

The toolbar can show:

- **All**;
- **✓ Без звонков**;
- **Fit ≥ threshold**;
- **Готовы к отклику**;
- **Сохранённые**.

This only changes the visible cards on the current page.

## Ready to Apply

Open `Очередь N`.

Available actions:

- **Отклик** — locate the exact card and start the existing `✦ Отклик + письмо` flow;
- **Показать** — scroll to the card for manual review;
- **Сохранить** — keep it in Saved;
- **Пропустить** — persist a skip decision.

The queue never mass-submits applications by itself.

## Application and questionnaire

The existing 3.9.x behaviour remains:

- exact vacancy-specific cover letter;
- application state persisted across navigation;
- Smart Questionnaire Autofill;
- confirmed evidence first;
- reviewable human fallback drafts for subjective free text;
- legal/factual unknowns remain for review;
- complex final submission remains user-controlled when unresolved fields exist.

## Memory

Per-vacancy memory now includes Analysis, Fit Score/features, queue decision, application state and questionnaire state. Repeated cards should restore this data automatically.

## Optional backend

Core 4.0 Batch Analysis and queue do not need the backend. The backend is still used by the advanced dashboard/server Autopilot/analytics mode.
