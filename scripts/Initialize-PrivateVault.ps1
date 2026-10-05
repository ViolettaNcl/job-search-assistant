#requires -Version 5.1
<## Copy private import files to the current user's LocalAppData without deleting originals.
This is filesystem staging, not a native-messaging bridge or full runtime migration.
##>
[CmdletBinding(SupportsShouldProcess=$true)]
param(
  [string]$SourcePath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'private-data'),
  [string]$VaultPath = (Join-Path $env:LOCALAPPDATA 'ViolettaApplyAssistant')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
if (-not (Test-Path -LiteralPath $SourcePath -PathType Container)) { throw 'Private source folder not found. Use the FULL package.' }
$source = (Resolve-Path -LiteralPath $SourcePath).Path
if (-not $PSCmdlet.ShouldProcess($VaultPath,'Create private folders and hash-verified copies; retain originals')) { return }
foreach ($name in @('profile','cv','memory','applications','questionnaires','learning','datasets','models','backups','logs')) {
  [void](New-Item -ItemType Directory -Force -Path (Join-Path $VaultPath $name))
}
$items = @()
foreach ($file in Get-ChildItem -LiteralPath $source -File) {
  if ($file.Name -ne 'README_PRIVATE.md') { $items += [pscustomobject]@{Source=$file.FullName; Target=(Join-Path (Join-Path $VaultPath 'profile') $file.Name)} }
}
$cvSource = Join-Path $source 'cv'
if (Test-Path -LiteralPath $cvSource) {
  foreach ($file in Get-ChildItem -LiteralPath $cvSource -File) { $items += [pscustomobject]@{Source=$file.FullName; Target=(Join-Path (Join-Path $VaultPath 'cv') $file.Name)} }
}
$count=0
foreach ($item in $items) {
  $hash=(Get-FileHash -LiteralPath $item.Source -Algorithm SHA256).Hash
  if (Test-Path -LiteralPath $item.Target) {
    if ((Get-FileHash -LiteralPath $item.Target -Algorithm SHA256).Hash -eq $hash) { continue }
    # Preserve both versions instead of silently replacing an existing private profile.
    $target=$item.Target+'.import-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8)
  } else { $target=$item.Target }
  $temporary=$target+'.pending-'+[guid]::NewGuid().ToString('N')
  try {
    Copy-Item -LiteralPath $item.Source -Destination $temporary
    if ((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash -ne $hash) { throw 'Private copy verification failed.' }
    Move-Item -LiteralPath $temporary -Destination $target
    $count++
  } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
}
Write-Host "Verified private copies created: $count"
Write-Host "Vault: $VaultPath"
Write-Host 'Originals retained. Chrome working storage is unchanged. This folder is not encrypted.'
