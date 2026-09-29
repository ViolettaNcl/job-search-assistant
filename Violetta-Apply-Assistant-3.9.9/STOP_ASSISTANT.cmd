@echo off
setlocal EnableExtensions
set "VJA_PORT=8080"

echo Looking for Violetta Apply Assistant...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listeners=Get-NetTCPConnection -LocalPort %VJA_PORT% -State Listen -ErrorAction SilentlyContinue; if($listeners){$owners=$listeners | Select-Object -ExpandProperty OwningProcess -Unique; foreach($id in $owners){$p=Get-Process -Id $id -ErrorAction SilentlyContinue; if($p -and $p.ProcessName -eq 'JobSearchAssistant'){Stop-Process -Id $p.Id -Force;Write-Host ('Stopped JobSearchAssistant PID '+$p.Id+'.')} elseif($p){Write-Host ('Port %VJA_PORT% belongs to '+$p.ProcessName+' (PID '+$p.Id+'). It was NOT stopped.');exit 3}}};$remaining=Get-Process -Name JobSearchAssistant -ErrorAction SilentlyContinue; if($remaining){foreach($p in $remaining){Stop-Process -Id $p.Id -Force;Write-Host ('Stopped non-listening JobSearchAssistant PID '+$p.Id+'.')}} elseif(-not $listeners){Write-Host 'No JobSearchAssistant process is running.'}" 
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="3" echo Another application owns port %VJA_PORT%; close that application manually before starting the assistant.
pause
exit /b %RC%
