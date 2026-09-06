# Windows bundle — v2.1

The `package-windows` GitHub Actions workflow creates a downloadable artifact named:

`violetta-apply-assistant-windows`

The artifact contains `Violetta-Apply-Assistant-Windows.zip` with:

- `backend/` — self-contained `win-x64` ASP.NET Core backend;
- `extension/` — the complete unpacked Chrome extension;
- `start-assistant.cmd` — local launcher binding the backend to `127.0.0.1:8080`;
- `user-settings.example.cmd` — optional private environment-variable template;
- `START_HERE.txt` — first-run instructions.

## Security model

No HH, Telegram, encryption or database secrets are committed or packaged into the repository. Optional secrets belong in a local `user-settings.cmd` copied from the example after download. That local file must never be committed or shared.

The launcher reads `user-settings.cmd` only when the file exists beside it.

## Default local mode

Without PostgreSQL configuration, the backend uses its existing in-memory mode. This makes the bundle easy to run but means CRM/application history does not survive backend restarts. Persistent history still requires PostgreSQL.

Without HH credentials, external ATS preparation remains available; only official HH direct submission is unavailable. The extension's Setup & Readiness page reports this distinction.

## Build trigger

The bundle is rebuilt on relevant pushes to `main` and can also be built through `workflow_dispatch`.

The package workflow verifies that both `backend/JobSearchAssistant.exe` and `extension/manifest.json` exist before creating the ZIP.
