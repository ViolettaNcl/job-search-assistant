#requires -Version 5.1
[CmdletBinding()]
param([string]$PackagePath = $PSScriptRoot)
$ErrorActionPreference='Stop'
function Resolve-Package([string]$Path){
  if(Test-Path -LiteralPath $Path -PathType Container){return (Resolve-Path -LiteralPath $Path).Path}
  if(Test-Path -LiteralPath $Path -PathType Leaf){
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $tmp=Join-Path ([IO.Path]::GetTempPath()) ('ViolettaVerify-'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Path $tmp|Out-Null
    Expand-Archive -LiteralPath $Path -DestinationPath $tmp -Force
    $m=Get-ChildItem -LiteralPath $tmp -Filter FILE_HASHES.sha256 -File -Recurse|Select-Object -First 1
    if(-not $m){throw 'FILE_HASHES.sha256 not found.'};return $m.DirectoryName
  }
  throw 'Package path not found.'
}
$root=Resolve-Package $PackagePath;$list=Join-Path $root 'FILE_HASHES.sha256';if(-not(Test-Path $list)){throw 'FILE_HASHES.sha256 missing.'}
$count=0
foreach($line in Get-Content -LiteralPath $list -Encoding UTF8){
  if($line -notmatch '^([0-9a-fA-F]{64})\s+\*(.+)$'){continue};$expected=$matches[1].ToLowerInvariant();$rel=$matches[2].Replace('/',[IO.Path]::DirectorySeparatorChar);$file=[IO.Path]::GetFullPath((Join-Path $root $rel));$base=[IO.Path]::GetFullPath($root).TrimEnd('\','/')+[IO.Path]::DirectorySeparatorChar;if(-not $file.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw "Unsafe hash path: $rel"};if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw "Missing: $rel"};$actual=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();if($actual-ne$expected){throw "HASH MISMATCH: $rel"};$count++
}
if($count-lt 1){throw 'No hashes verified.'};Write-Host "PASS: verified $count package files." -ForegroundColor Green
