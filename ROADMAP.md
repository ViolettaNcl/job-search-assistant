# Roadmap

The current priority is reliability before adding more automatic actions.

## Next candidates

### 1. Batch Analysis Queue

Analyze visible HH cards sequentially with bounded concurrency and cache results by vacancy ID. Goal: reduce repetitive clicks without opening many active tabs.

### 2. Questionnaire Review Center

One compact screen showing:

- confirmed answers;
- fallback drafts;
- unresolved required fields;
- reusable answers waiting for user confirmation.

This would make answer-memory approval explicit instead of implicit.

### 3. Duplicate / Repost Detection

Detect semantically identical vacancies that appear with a new vacancy ID or are reposted by the same employer. This should be advisory, not silently merge application history.

### 4. Application Timeline

Per-vacancy history:

```text
seen → analyzed → prepared → questionnaire → submitted → viewed → reply/rejection
```

Useful for analytics and follow-up without relying only on current HH card state.

### 5. Memory Export / Import

Encrypted or user-controlled backup of candidate profile, vacancy memory and questionnaire answer memory, separate from GitHub source code.

### 6. Public-safe Profile Vault

Move personal CV/candidate seed out of tracked source into a local importable vault. This would make the repository safer to keep public without exposing candidate data.

### 7. Additional ATS adapters

Add site-specific adapters only after the generic questionnaire engine is stable. Each adapter should have explicit permissions and dedicated fixtures.

### 8. Pre-submit Review Diff

Before final submission, show exactly what the assistant changed in the form and which fields were user-edited afterward.

## Not planned as blind automation

The project should not auto-invent legal/identity facts, bypass CAPTCHA/MFA or silently submit reviewable questionnaire drafts.
