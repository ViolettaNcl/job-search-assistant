@echo off
rem Copy this file to user-settings.cmd inside the extracted bundle.
rem Keep user-settings.cmd private and never commit/share it.
rem Private contact override. Existing extension contact memory is also retained.
rem set "Candidate__Phone=your verified number"

rem Legacy optional HH API credentials (retained for existing integrations).
rem 3.8.0 enables user-started Apply / Autopilot by default. Set false here only if you want to disable backend automatic submission.
set "HH__ClientId="
set "HH__ClientSecret="

rem Optional safety override. Default is true for the user-started Auto Apply / Autopilot mode.
rem set "Security__EnableAutomaticSubmission=false"

rem Required only if the backend needs to encrypt stored OAuth tokens/secrets.
rem Use a private 32-byte key encoded as Base64.
set "Security__EncryptionKeyBase64="

rem Optional Telegram integration:
set "Telegram__BotToken="
set "Telegram__AllowedChatId="

rem Database settings are optional.
rem Leave both values empty for the default persistent local SQLite database at:
rem %LOCALAPPDATA%\ViolettaApplyAssistant\jobassistant.db
rem
rem Advanced: override the SQLite connection string if you want another local path.
rem set "ConnectionStrings__Sqlite=Data Source=C:\path\to\jobassistant.db"

rem Advanced/server mode: configure PostgreSQL here. PostgreSQL takes precedence
rem over local SQLite when this value is non-empty.
rem set "ConnectionStrings__Postgres=Host=...;Database=...;Username=...;Password=..."
