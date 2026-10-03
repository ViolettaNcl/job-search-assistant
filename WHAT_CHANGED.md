# What changed · 3.9.13

3.9.13 is a **documentation and repository-hygiene release**. The core application workflow remains the 3.9.12 behavior.

## Documentation

- Rewrote `README.md` as a current product overview instead of a chronological development diary.
- Added a user guide, feature reference, repository layout, release process, troubleshooting and privacy/data documentation.
- Reworked architecture, implementation status, supported-sites, testing, security and roadmap documents around the current system.
- Moved concise 3.9 release history to `docs/history/CHANGELOG_3.9.md`.
- Kept exact test counts in `TEST_REPORT.md` so README does not become stale.

## Repository hygiene

- Added `tools/check-repo-hygiene.py`.
- Added dedicated hygiene regression tests.
- CI now checks that the Git source tree does not contain FULL bundle folders, runtime artifacts, local databases, logs or secret/local configuration files.
- Source publication still uses the SHA-256 manifest and whitelist mapping (`extension/` in bundle → `browser-extension/` in GitHub).

## Release metadata

- Extension release version: `3.9.13`.
- Source publisher: `Publish-Violetta-3.9.13.ps1`.
- Backend source release metadata is updated to `3.9.13` during publication; backend code/runtime is otherwise unchanged.

## No user-workflow regression intended

The release keeps:

- full-vacancy Analysis;
- HH API fallback;
- quick apply + vacancy-specific cover letter;
- persistent vacancy memory;
- Smart Questionnaire Autofill;
- Human Fallback Drafts;
- recruiter chat drafts;
- employer-already-viewed handling.

For historical changes see `docs/history/CHANGELOG_3.9.md`.
