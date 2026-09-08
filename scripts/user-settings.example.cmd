@echo off
rem Copy this file to user-settings.cmd inside the extracted bundle.
rem Keep user-settings.cmd private and never commit/share it.
rem Private contact override. Existing extension contact memory is also retained.
rem set "Candidate__Phone=your verified number"

rem Optional HH.ru applicant API credentials for direct HH submission:
set "HH__ClientId="
set "HH__ClientSecret="

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
set "ConnectionStrings__Sqlite="

rem Advanced/server mode: configure PostgreSQL here. PostgreSQL takes precedence
rem over local SQLite when this value is non-empty.
set "ConnectionStrings__Postgres="
