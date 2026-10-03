# Personal Learning System · 5.0

## Goal

Learn from the user's real decisions without silently rewriting factual candidate data.

## Event store

The extension stores bounded `LearningEvent` records in `chrome.storage.local` under `vjaLearningEventsV1`.

Each event may contain:

- event ID and timestamp;
- vacancy identity;
- structured vacancy features;
- model/rule decision at the time;
- user action;
- original/corrected text when relevant;
- confidence/source metadata.

## Signals

Current production personalization is **not an ML model**. It derives bounded weights from real events:

- role weights;
- technology weights;
- remote preference signal;
- calls/sales history;
- weak company-specific signal.

The adjustment is capped so learning cannot turn a hard mismatch into an extreme score simply because of a few clicks.

## Labels

Positive preference labels:

- Apply
- Save
- Fit accepted

Negative preference labels:

- Skip
- Fit rejected

Outcome events are stored separately and must not be mixed with preference labels.

## Active learning

Confidence policy:

- >= 0.90: safe auto-classification when the feature itself is allowed to be automatic;
- 0.65–0.90: suggestion / review;
- < 0.65: ask or leave for user review.

This policy does not override legal, salary, work-authorization or other high-risk review gates.

## Learning Center

The local Learning Center can export:

- a full learning backup (`.json`);
- preference training rows (`.jsonl`).

Import deduplicates by `eventId`. Reset deletes learning events and local model registry only; applications and CVs are not deleted.

## Future

When enough real labels exist, the exported dataset can train the 5.0 logistic baseline. Promotion remains an explicit offline step.
