@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0user-settings.cmd" (
  call "%~dp0user-settings.cmd"
)

set "ASPNETCORE_URLS=http://127.0.0.1:8080"
set "DOTNET_ENVIRONMENT=Production"

if not exist "%~dp0backend\JobSearchAssistant.exe" (
  echo [Violetta Apply Assistant] Backend executable was not found.
  echo Expected: %~dp0backend\JobSearchAssistant.exe
  echo Re-download or re-extract the Windows bundle and try again.
  pause
  exit /b 1
)

echo Starting Violetta Apply Assistant backend on http://127.0.0.1:8080 ...
start "Violetta Apply Assistant" /D "%~dp0backend" "%~dp0backend\JobSearchAssistant.exe"

for /L %%i in (1,1,15) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8080/health/ready; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)

echo.
echo Backend started but readiness did not become green within 15 seconds.
echo Open http://127.0.0.1:8080/health/ready to inspect the status.
goto end

:ready
echo Backend is ready.
start "" "http://127.0.0.1:8080/"
echo.
echo Next: open Chrome, pin Violetta Apply Assistant, then open Setup ^& Readiness.
echo If this is the first install, load the included "extension" folder from chrome://extensions using Developer mode.

:end
echo.
echo Keep this backend running while you apply. Closing this window does not stop the backend process.
pause
