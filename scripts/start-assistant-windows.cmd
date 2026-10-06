@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Violetta Apply Assistant 3.8.0

set "VJA_API=http://127.0.0.1:8080"
set "VJA_BACKEND=%~dp0backend"
set "VJA_EXE=%VJA_BACKEND%\JobSearchAssistant.exe"
if defined LOCALAPPDATA (
  set "VJA_DATA_DIR=%LOCALAPPDATA%\ViolettaApplyAssistant"
) else (
  set "VJA_DATA_DIR=%~dp0data"
)
set "VJA_LOG_DIR=%VJA_DATA_DIR%\logs"
set "VJA_STDOUT_LOG=%VJA_LOG_DIR%\backend.stdout.log"
set "VJA_STDERR_LOG=%VJA_LOG_DIR%\backend.stderr.log"
set "VJA_PID_FILE=%VJA_DATA_DIR%\backend.pid"

if not exist "%VJA_DATA_DIR%" mkdir "%VJA_DATA_DIR%" >nul 2>nul
if not exist "%VJA_LOG_DIR%" mkdir "%VJA_LOG_DIR%" >nul 2>nul

rem Stable desktop defaults. user-settings.cmd is loaded AFTER these so the user can override them.
set "ASPNETCORE_URLS=%VJA_API%"
set "DOTNET_ENVIRONMENT=Production"
set "ConnectionStrings__Postgres="
set "ConnectionStrings__Sqlite=Data Source=%VJA_DATA_DIR%\jobassistant.db"
set "Security__EnableAutomaticSubmission=true"

if exist "%~dp0user-settings.cmd" (
  call "%~dp0user-settings.cmd"
)
rem An empty legacy user-settings value must not accidentally disable the desktop SQLite database.
if not defined ConnectionStrings__Sqlite if not defined ConnectionStrings__Postgres set "ConnectionStrings__Sqlite=Data Source=%VJA_DATA_DIR%\jobassistant.db"

if not exist "%VJA_EXE%" (
  echo [ERROR] Backend executable was not found.
  echo Expected: %VJA_EXE%
  echo.
  echo Extract the complete ZIP first. Do not run start-assistant.cmd from inside the ZIP preview.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Violetta Apply Assistant 3.8.0
echo ============================================================
echo API:  %VJA_API%
echo Data: %VJA_DATA_DIR%
echo Logs: %VJA_LOG_DIR%
echo.

rem Port check: reuse a healthy assistant, but never reuse an unknown process.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(-not $c){exit 1}; try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%VJA_API%/health/live'; if($r.StatusCode -eq 200){exit 0}}catch{}; exit 2" >nul 2>nul
set "VJA_PORT_STATUS=%ERRORLEVEL%"
if "%VJA_PORT_STATUS%"=="0" (
  echo Existing Violetta backend detected on port 8080. Reusing it.
  goto wait_ready
)
if "%VJA_PORT_STATUS%"=="2" (
  echo [ERROR] Port 8080 is already used by another process.
  echo Run STOP_ASSISTANT.cmd. If it says the process is not Violetta Apply Assistant, close the other program using port 8080.
  echo.
  call "%~dp0BACKEND_DIAGNOSTICS.cmd" nopause
  pause
  exit /b 1
)

echo Starting backend...
>"%VJA_STDOUT_LOG%" echo ===== Violetta Apply Assistant backend start %DATE% %TIME% =====
>"%VJA_STDERR_LOG%" echo ===== Violetta Apply Assistant backend errors %DATE% %TIME% =====

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath $env:VJA_EXE -WorkingDirectory $env:VJA_BACKEND -PassThru -WindowStyle Hidden -RedirectStandardOutput $env:VJA_STDOUT_LOG -RedirectStandardError $env:VJA_STDERR_LOG; Set-Content -LiteralPath $env:VJA_PID_FILE -Value $p.Id -Encoding ascii" >>"%VJA_STDERR_LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] Windows could not start JobSearchAssistant.exe.
  goto startup_failed
)

echo Waiting for backend process to answer...
for /L %%i in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 '%VJA_API%/health/live';if($r.StatusCode -eq 200){exit 0}}catch{};exit 1" >nul 2>nul
  if not errorlevel 1 goto live
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Content -LiteralPath $env:VJA_PID_FILE -ErrorAction SilentlyContinue; if($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)){exit 0}else{exit 1}" >nul 2>nul
  if errorlevel 1 goto startup_failed
  timeout /t 1 /nobreak >nul
)
goto startup_failed

:live
echo Backend process is alive. Checking database/app readiness...

:wait_ready
for /L %%i in (1,1,45) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 '%VJA_API%/health/ready';if($r.StatusCode -eq 200){exit 0}}catch{};exit 1" >nul 2>nul
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)

echo.
echo [ATTENTION] Backend is reachable, but readiness is not green.
echo This is usually a local database/bootstrap problem, not a Chrome-extension problem.
echo.
call "%~dp0BACKEND_DIAGNOSTICS.cmd" nopause

echo.
echo Do NOT delete the project or reinstall Chrome.
echo If diagnostics show databaseReachable=false or appStateReady=false, send the generated diagnostic file to ChatGPT.
echo Diagnostic file: %VJA_DATA_DIR%\backend-diagnostic.txt
pause
exit /b 2

:ready
echo.
echo [OK] Backend is ready.
echo Chrome extension API: %VJA_API%
echo.
echo The launcher no longer opens an internal dashboard automatically.
echo Open the vacancy or recruiter chat in Chrome and use ^"Apply^", ^"AI^" or Autopilot there.
echo You may close THIS launcher window; the backend process keeps running.
echo To stop it later, run STOP_ASSISTANT.cmd.
echo.
pause
exit /b 0

:startup_failed
echo.
echo [ERROR] Backend process did not start correctly or exited before /health/live became available.
echo The old launcher hid this information; 3.8.0 keeps diagnostic logs instead.
echo.
call "%~dp0BACKEND_DIAGNOSTICS.cmd" nopause

echo.
echo Diagnostic file: %VJA_DATA_DIR%\backend-diagnostic.txt
pause
exit /b 1
