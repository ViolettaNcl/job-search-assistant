@echo off
setlocal
cd /d "%~dp0"

where dotnet >nul 2>nul
if errorlevel 1 (
  echo [.NET 10 SDK required]
  echo Install the .NET 10 SDK, then run this file again.
  echo https://dotnet.microsoft.com/download/dotnet/10.0
  pause
  exit /b 1
)

set "ASPNETCORE_URLS=http://127.0.0.1:8080"
set "DOTNET_ENVIRONMENT=Production"

if exist "%~dp0scripts\user-settings.cmd" call "%~dp0scripts\user-settings.cmd"

echo Starting Violetta Apply Assistant from source...
start "Violetta Apply Assistant" /D "%~dp0" dotnet run --project "%~dp0src\JobSearchAssistant\JobSearchAssistant.csproj" --configuration Release

for /L %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8080/health/ready; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)

echo The server did not become ready within 30 seconds.
echo Check the "Violetta Apply Assistant" terminal window for the exact error.
pause
exit /b 1

:ready
start "" "http://127.0.0.1:8080/"
echo Dashboard opened. Keep the backend terminal window open all day.
echo Use the dashboard button to start or pause autonomous HH applications.
pause
