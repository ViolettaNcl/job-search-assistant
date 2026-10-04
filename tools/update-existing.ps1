#requires -Version 5.1
# Update in the SAME directory so an unpacked extension retains its path identity.
[CmdletBinding()]
param([string]$Destination)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
try {
    Write-Host 'Violetta Apply Assistant 5.2.0 - in-place update' -ForegroundColor Cyan
    Write-Host 'Close the previous assistant backend window before continuing.'
    Write-Host 'Do NOT remove the existing extension from Chrome.'
    if ([string]::IsNullOrWhiteSpace($Destination)) {
        $Destination = Read-Host 'Full path of your OLD assistant folder (the one containing extension and backend)'
    }
    $Destination = $Destination.Trim().Trim('"')
    if (-not (Test-Path -LiteralPath $Destination -PathType Container)) { throw 'The old folder does not exist.' }
    $target = (Resolve-Path -LiteralPath $Destination).Path
    if ($source.TrimEnd('\') -eq $target.TrimEnd('\')) { throw 'Select the OLD installation folder, not this newly extracted archive.' }
    if ($source.StartsWith($target.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($source.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Extract the new archive beside the old installation, not inside it.'
    }
    $manifestPath = Join-Path $target 'extension\manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'The chosen folder does not contain extension\manifest.json.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -ne 'Violetta Apply Assistant') { throw 'This is not a Violetta Apply Assistant installation.' }
    $running = Get-Process -Name JobSearchAssistant -ErrorAction SilentlyContinue
    if ($running) { throw 'The assistant server is still running. Run STOP_ASSISTANT.cmd first, then run this updater again. No processes were stopped.' }
    $busy = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    if ($busy) { throw 'Port 8080 is in use. Close the previous server first. No process was stopped.' }
    $configPath = Join-Path $target 'backend\appsettings.json'
    $config = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { Get-Content -LiteralPath (Join-Path $source 'backend\appsettings.json') -Raw -Encoding UTF8 | ConvertFrom-Json }
    if ($null -eq $config.Security) { $config | Add-Member -NotePropertyName Security -NotePropertyValue ([pscustomobject]@{}) }
    $config.Security | Add-Member -NotePropertyName EnableAutomaticSubmission -NotePropertyValue $true -Force
    $backup = $target + '.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    if (Test-Path -LiteralPath $backup) { throw 'Backup folder already exists; wait one second and retry.' }
    Write-Host "Creating backup: $backup"
    Copy-Item -LiteralPath $target -Destination $backup -Recurse
    # The backup contains private local settings. It stays on this computer.
    $files = Get-ChildItem -LiteralPath $source -File -Recurse
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($source.Length).TrimStart('\','/')
        if ($relative -in @('user-settings.cmd','backend\appsettings.json')) { continue }
        if ($file.Extension -in @('.db','.sqlite','.sqlite3') -or $file.Name -like '*.db-*' -or $file.Name -eq '.env') { continue }
        $dest = Join-Path $target $relative
        $parent = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
    }
    # Preserve prior provider credentials, candidate settings and DB paths.
    # The user explicitly requested user-started Auto Apply / Autopilot. Runtime safety gates still stop ambiguous legal, salary, visa and other unknown required fields.
    $json = $config | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host 'Update complete.' -ForegroundColor Green
    Write-Host '1. Open chrome://extensions and click Reload on the EXISTING extension.'
    Write-Host '2. Refresh open vacancy/chat pages.'
    Write-Host "3. Run start-assistant.cmd from: $target"
    Write-Host '4. Check Profile, CV and AI consent in extension settings.'
    Write-Host "Backup retained at: $backup"
    Write-Host 'Do not share that backup: it can contain your private settings.'
} catch {
    Write-Host ('UPDATE STOPPED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No database was deleted. Keep the existing folder and any backup.'
    exit 1
}
