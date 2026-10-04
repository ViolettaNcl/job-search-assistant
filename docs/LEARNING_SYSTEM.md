# Personal Learning System · 5.2

## Purpose

Learn from real user behavior while keeping factual candidate data immutable unless explicitly confirmed.

## LearningEvent store

Local events may include:

- vacancy identity and structured features;
- rule/ML decision at the time;
- Apply / Save / Skip / Fit feedback;
- questionnaire original + corrected text;
- application outcome changes;
- interview-prep usage;
- confidence/source metadata.

## Preference labels

Positive signals include Apply, Save and Fit accepted. Negative signals include Skip and Fit rejected.

Dataset generation keeps the **latest preference decision per vacancy** so repeated UI interactions do not create artificial duplicated labels.

## Engagement labels

Employer engagement is an independent target. Outcome events can create engagement labels from recruiter reply/interview/test/offer versus terminal rejection/closure. They are never mixed with user-preference labels.

## Questionnaire correction learning

When an autofilled or drafted field is later changed by trusted user input, the extension records a `QUESTIONNAIRE_EDITED` event with original/corrected text, category and question context. Programmatic synthetic DOM events are not treated as user corrections.

## Semantic answer memory

Exact semantic keys remain the first lookup. For generic confirmed answers, a deterministic local hash-vector index can retrieve a similar prior question within the same category. Vacancy-specific answers are excluded from generic reuse.

This is local retrieval, not a trained embedding model.

## Active learning policy

- high confidence: eligible safe automation;
- medium confidence: suggestion/review;
- low confidence: leave for user input.

Legal, work-authorization, unconfirmed salary and other high-risk categories remain review-gated regardless of confidence.

## Monitoring

When an active preference model has enough later labels, the system can calculate prediction quality/calibration and compare early vs recent windows. It can recommend retraining, but it does not train/promote silently.
