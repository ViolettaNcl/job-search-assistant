#requires -Version 5.1
# Integrity check only. SHA-256 is not proof of the publisher's identity.
[CmdletBinding()]
param([string]$PackagePath=$PSScriptRoot)
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$temporary=$null
function Safe-Path([string]$Root,[string]$Relative) {
  if ([string]::IsNullOrWhiteSpace($Relative) -or [IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[\\/])\.\.([\\/]|$)|:|(^|[\\/])\.git([\\/]|$)') { throw "Unsafe path: $Relative" }
  $base=[IO.Path]::GetFullPath($Root).TrimEnd([char[]]'\/')+[IO.Path]::DirectorySeparatorChar
  $full=[IO.Path]::GetFullPath((Join-Path $Root $Relative))
  if (-not $full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)) { throw "Path escape: $Relative" }
  return $full
}
try {
  if (Test-Path -LiteralPath $PackagePath -PathType Leaf) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $temporary=Join-Path ([IO.Path]::GetTempPath()) ('ViolettaVerify-'+[guid]::NewGuid().ToString('N'))
    [void](New-Item -ItemType Directory -Path $temporary)
    $zip=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $PackagePath).Path)
    $seenEntries=@{};[long]$size=0
    try {
      if ($zip.Entries.Count -gt 20000) { throw 'Too many ZIP entries.' }
      foreach ($entry in $zip.Entries) {
        [void](Safe-Path $temporary $entry.FullName)
        if ($seenEntries.ContainsKey($entry.FullName)) { throw 'Duplicate ZIP path.' }
        $seenEntries[$entry.FullName]=$true;$size+=$entry.Length
        if ($size -gt 2GB) { throw 'Uncompressed package exceeds 2 GiB safety limit.' }
        if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'ZIP symbolic links are not allowed.' }
      }
    } finally { $zip.Dispose() }
    Expand-Archive -LiteralPath $PackagePath -DestinationPath $temporary
    $lists=@(Get-ChildItem -LiteralPath $temporary -Filter 'FILE_HASHES.sha256' -File -Recurse)
    if ($lists.Count -ne 1) { throw 'Expected exactly one FILE_HASHES.sha256.' }
    $root=$lists[0].DirectoryName
  } elseif (Test-Path -LiteralPath $PackagePath -PathType Container) { $root=(Resolve-Path -LiteralPath $PackagePath).Path }
  else { throw 'Package path not found.' }
  $manifest=Join-Path $root 'FILE_HASHES.sha256'
  if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { throw 'FILE_HASHES.sha256 is missing.' }
  $listed=@{};$count=0
  foreach ($line in Get-Content -LiteralPath $manifest -Encoding UTF8) {
    if ($line -notmatch '^([0-9a-fA-F]{64}) \*(.+)$') { throw 'Malformed hash manifest line.' }
    $expected=$matches[1];$relative=$matches[2].Replace('\','/');$file=Safe-Path $root $relative
    if ($relative -eq 'FILE_HASHES.sha256' -or $listed.ContainsKey($relative)) { throw 'Duplicate or recursive hash entry.' }
    $listed[$relative]=$true
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing file: $relative" }
    if ((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point: $relative" }
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $expected) { throw "HASH MISMATCH: $relative" }
    $count++
  }
  $base=$root.TrimEnd([char[]]'\/')+[IO.Path]::DirectorySeparatorChar
  foreach ($file in Get-ChildItem -LiteralPath $root -File -Recurse -Force) {
    $relative=$file.FullName.Substring($base.Length).Replace('\','/')
    if ($relative -ne 'FILE_HASHES.sha256' -and -not $listed.ContainsKey($relative)) { throw "Unlisted extra file: $relative" }
  }
  if ($count -lt 1) { throw 'Empty package manifest.' }
  Write-Host "VERIFIED: $count files; SHA-256 integrity only." -ForegroundColor Green
} finally {
  if ($temporary -and (Test-Path -LiteralPath $temporary)) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
