# Security & privacy

Violetta Apply Assistant works with personal job-search data, so the default design should minimize unnecessary exposure.

## Principles

- Keep the local backend bound to loopback (`127.0.0.1`) unless there is a deliberate deployment reason.
- Keep secrets and private local settings out of Git.
- Do not send unrelated browser history to the backend.
- Do not fabricate candidate facts.
- Treat salary, visa/work authorization, legal/privacy declarations and contractual terms as high-risk decisions.
- Do not bypass CAPTCHA, MFA or browser security boundaries.

## Repository hygiene

Do not commit:

- local databases;
- tokens/secrets;
- `.env`;
- `candidate.private.json`;
- generated self-contained backend binaries;
- release ZIPs;
- test-output screenshots/logs;
- personal diagnostic dumps.

## CV privacy

The extension currently contains bundled RU/EN CV assets. If the repository is public, those PDFs are public as well.

If the CVs should remain private, keep the repository private or move the CV distribution mechanism out of the public source tree before publishing.

## Reporting

For a private personal project, report security issues directly to the repository owner rather than posting sensitive data in a public issue.
