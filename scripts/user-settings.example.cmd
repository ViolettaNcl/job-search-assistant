@echo off
rem Copy this file to user-settings.cmd inside the extracted bundle.
rem Keep user-settings.cmd private and never commit/share it.

rem Optional HH.ru applicant API credentials for direct HH submission:
set "HH__ClientId="
set "HH__ClientSecret="

rem Required only if the backend needs to encrypt stored OAuth tokens/secrets.
rem Use a private 32-byte key encoded as Base64.
set "Security__EncryptionKeyBase64="

rem Optional Telegram integration:
set "Telegram__BotToken="
set "Telegram__AllowedChatId="

rem Optional persistent PostgreSQL database. Leave empty for local in-memory mode.
set "ConnectionStrings__Postgres="
