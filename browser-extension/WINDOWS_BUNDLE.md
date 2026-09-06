# Windows bundle — v2.2

The `package-windows` GitHub Actions workflow creates a downloadable artifact named:

`violetta-apply-assistant-windows`

The artifact contains `Violetta-Apply-Assistant-Windows.zip` with:

- `backend/` — self-contained `win-x64` ASP.NET Core backend, including the SQLite native runtime;
- `extension/` — the complete unpacked Chrome extension;
- `start-assistant.cmd` — local launcher binding the backend to `127.0.0.1:8080`;
- `user-settings.example.cmd` — optional private environment-variable template;
- `START_HERE.txt` — first-run instructions.

## Security model

No HH, Telegram, encryption or database secrets are committed or packaged into the repository. Optional secrets belong in a local `user-settings.cmd` copied from the example after download. That local file must never be committed or shared.

The launcher reads `user-settings.cmd` only when the file exists beside it.

## Default local persistent mode

PostgreSQL is no longer required just to keep local history. When no PostgreSQL connection is configured, the backend uses SQLite and creates the database automatically at:

`%LOCALAPPDATA%\ViolettaApplyAssistant\jobassistant.db`

The database is outside the extracted application bundle, so replacing or re-extracting a newer bundle does not delete the local CRM/application database. Application records, queue state, follow-ups, settings and analytics survive backend and Windows restarts.

`ConnectionStrings__Sqlite` can optionally override the local SQLite connection string. `ConnectionStrings__Postgres` remains available for server/shared deployments and takes precedence when configured.

Without HH credentials, external ATS preparation remains available; only official HH direct submission is unavailable. The extension's Setup & Readiness page reports this distinction.

## Build trigger

The bundle is rebuilt on relevant pushes to `main` and can also be built through `workflow_dispatch`.

The package workflow verifies that both `backend/JobSearchAssistant.exe` and `extension/manifest.json` exist before creating the ZIP. v2.2 release verification also checks the produced Windows artifact for the SQLite runtime needed by the self-contained backend.
