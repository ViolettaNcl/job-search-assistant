@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-Violetta-3.9.7.ps1" -Push
echo.
pause
