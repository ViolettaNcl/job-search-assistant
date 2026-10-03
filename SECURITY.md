# Security and Privacy

## Scope

Violetta Apply Assistant is a browser automation tool that reads job pages and may store candidate context locally. Its security model is therefore based on least privilege, explicit site permissions and source/release separation.

## Chrome permissions

The extension uses permissions required for:

- storage;
- tab/background vacancy reading;
- script injection on supported hosts;
- HH navigation handling;
- optional access to additional employer forms.

Host access is explicitly declared for HH/HeadHunter and HH API. Optional broad host access should be granted only when needed for external forms.

## Candidate data

Candidate profile, CV assets and answer memory may contain personal information. Keep that in mind before making a repository public.

The current release package can contain candidate-specific assets. A future public-safe vault is listed in the roadmap.

See [docs/PRIVACY_AND_DATA.md](docs/PRIVACY_AND_DATA.md).

## Secrets and local files

The source publisher and hygiene checker reject or ignore common private/runtime files:

- `.env`;
- `candidate.private.json`;
- `appsettings.local.json`;
- `user-settings.cmd`;
- databases;
- logs;
- binaries/build outputs.

Never commit API keys or credentials directly into JavaScript, JSON, CMD or Markdown files.

## Submission safety

Questionnaire autofill distinguishes confirmed evidence from reviewable drafts. Unknown legal/work-authorization facts are intentionally not fabricated. Final submission remains blocked/user-controlled when review is required.

## Repository hygiene

Before push:

```powershell
python tools/check-repo-hygiene.py
```

CI repeats this check to prevent accidental commits of FULL/runtime folders.

## Reporting

If the project is shared with other users, security issues should be reported privately before publishing exploit details or personal data.
