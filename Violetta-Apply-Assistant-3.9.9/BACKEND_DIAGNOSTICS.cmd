@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "VJA_API=http://127.0.0.1:8080"
if defined LOCALAPPDATA (
  set "VJA_DATA_DIR=%LOCALAPPDATA%\ViolettaApplyAssistant"
) else (
  set "VJA_DATA_DIR=%~dp0data"
)
set "VJA_LOG_DIR=%VJA_DATA_DIR%\logs"
set "VJA_STDOUT_LOG=%VJA_LOG_DIR%\backend.stdout.log"
set "VJA_STDERR_LOG=%VJA_LOG_DIR%\backend.stderr.log"
set "VJA_DIAG=%VJA_DATA_DIR%\backend-diagnostic.txt"
if not exist "%VJA_DATA_DIR%" mkdir "%VJA_DATA_DIR%" >nul 2>nul

>"%VJA_DIAG%" echo Violetta Apply Assistant 3.8.0 backend diagnostics
>>"%VJA_DIAG%" echo Generated: %DATE% %TIME%
>>"%VJA_DIAG%" echo Project: %~dp0
>>"%VJA_DIAG%" echo API: %VJA_API%
>>"%VJA_DIAG%" echo.

>>"%VJA_DIAG%" echo === EXECUTABLE ===
if exist "%~dp0backend\JobSearchAssistant.exe" (
  >>"%VJA_DIAG%" echo JobSearchAssistant.exe: present
) else (
  >>"%VJA_DIAG%" echo JobSearchAssistant.exe: MISSING
)

>>"%VJA_DIAG%" echo.
>>"%VJA_DIAG%" echo === PROCESS / PORT 8080 ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){$p=Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; 'Listening=True'; 'PID='+$c.OwningProcess; if($p){'Process='+$p.ProcessName}}else{'Listening=False'}" >>"%VJA_DIAG%" 2>&1

>>"%VJA_DIAG%" echo.
>>"%VJA_DIAG%" echo === HEALTH LIVE ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%VJA_API%/health/live';'HTTP '+[int]$r.StatusCode;$r.Content}catch{'ERROR '+$_.Exception.Message;if($_.Exception.Response){try{$s=$_.Exception.Response.GetResponseStream();$rd=New-Object IO.StreamReader($s);$rd.ReadToEnd()}catch{}}}" >>"%VJA_DIAG%" 2>&1

>>"%VJA_DIAG%" echo.
>>"%VJA_DIAG%" echo === HEALTH READY ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%VJA_API%/health/ready';'HTTP '+[int]$r.StatusCode;$r.Content}catch{'ERROR '+$_.Exception.Message;if($_.Exception.Response){try{$s=$_.Exception.Response.GetResponseStream();$rd=New-Object IO.StreamReader($s);$rd.ReadToEnd()}catch{}}}" >>"%VJA_DIAG%" 2>&1

>>"%VJA_DIAG%" echo.
>>"%VJA_DIAG%" echo === LOCAL DATA ===
if exist "%VJA_DATA_DIR%\jobassistant.db" (
  for %%F in ("%VJA_DATA_DIR%\jobassistant.db") do >>"%VJA_DIAG%" echo Database=present Size=%%~zF bytes Path=%%~fF
) else (
  >>"%VJA_DIAG%" echo Database=not-created Path=%VJA_DATA_DIR%\jobassistant.db
)

>>"%VJA_DIAG%" echo.
>>"%VJA_DIAG%" echo === BACKEND STDERR TAIL ===
if exist "%VJA_STDERR_LOG%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath $env:VJA_STDERR_LOG -Tail 60" >>"%VJA_DIAG%" 2>&1
) else (
  >>"%VJA_DIAG%" echo No stderr log yet.
)

>>"%VJA_DIAG%" echo.
>>"%VJA_DIAG%" echo === BACKEND STDOUT TAIL ===
if exist "%VJA_STDOUT_LOG%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath $env:VJA_STDOUT_LOG -Tail 60" >>"%VJA_DIAG%" 2>&1
) else (
  >>"%VJA_DIAG%" echo No stdout log yet.
)

echo.
echo === Violetta Apply Assistant backend diagnostics ===
type "%VJA_DIAG%"
echo.
echo Saved to: %VJA_DIAG%
if /I not "%~1"=="nopause" pause
