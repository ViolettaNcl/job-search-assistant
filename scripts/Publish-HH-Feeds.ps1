#requires -Version 5.1
<#
Publish the HH-FEEDS source-only package. No FULL files, no forced push,
no deletion of an existing checkout, no modification of installed extension data.
Run from an extracted GITHUB-UPDATE package with -SourcePath <package root> -Push.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SourcePath,
    [switch]$Push
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$RepositoryUrl = 'https://github.com/ViolettaNcl/job-search-assistant.git'
$RepositoryName = 'ViolettaNcl/job-search-assistant'
$ManifestPath = 'docs/HH_FEEDS_SOURCE_MANIFEST.json'
$repo = $null

function Git-Checked {
    param([string[]]$ArgList, [int[]]$Accepted = @(0))
    $old = $ErrorActionPreference
    # Windows PowerShell treats native stderr as ErrorRecords; check the exit code instead.
    $ErrorActionPreference = 'Continue'
    try {
        if ($repo) { $lines = @(& git -C $repo @ArgList 2>&1) }
        else { $lines = @(& git @ArgList 2>&1) }
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $old }
    $text = ($lines | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    if ($Accepted -notcontains $code) { throw ("git {0} failed (exit {1}):`n{2}" -f $ArgList[0], $code, $text) }
    return [pscustomobject]@{ Code = $code; Text = $text }
}
function Safe-Path {
    param([string]$Root, [string]$Relative)
    if ([string]::IsNullOrWhiteSpace($Relative) -or [IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[\\/])\.\.([\\/]|$)|:|(^|[\\/])\.git([\\/]|$)') { throw 'Unsafe package path.' }
    $base = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
    $result = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (-not $result.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package path leaves its directory.' }
    return $result
}
function Check-Publish-Path {
    param([string]$Relative)
    $allowed = '^(browser-extension/|docs/|tests/|tools/|scripts/|\.github/workflows/|\.gitignore$|README\.md$|ARCHITECTURE\.md$|IMPLEMENTATION_STATUS\.md$|SUPPORTED_SITES\.md$|TESTING_GUIDE\.md$|WHAT_CHANGED\.md$|START_HERE\.txt$|SECURITY\.md$|ROADMAP\.md$|start-assistant\.cmd$|STOP_ASSISTANT\.cmd$|BACKEND_DIAGNOSTICS\.cmd$|UPDATE_EXISTING\.cmd$|user-settings\.example\.cmd$)'
    $forbidden = '(?i)\.(zip|exe|dll|pdb|db|sqlite3?|log|vja|jsonl|pyc|pem|key|pdf|docx?|ttf|otf|woff2?)$|(^|/)(node_modules|__pycache__|bin|obj|test-results|artifacts|private-data|backups)/|(^|/)\.env(?:\.|$)|(^|/)(candidate\.private\.json|appsettings\.local\.json|user-settings\.cmd)$|^browser-extension/assets/cv/'
    if ($Relative -notmatch $allowed -or $Relative -match $forbidden) { throw "Not a publishable source path: $Relative" }
}

try {
    [void](Get-Command git -ErrorAction Stop)
    $source = (Resolve-Path -LiteralPath $SourcePath -ErrorAction Stop).Path
    if (-not (Test-Path -LiteralPath (Join-Path $source 'browser-extension/manifest.json') -PathType Leaf) -or -not (Test-Path -LiteralPath (Join-Path $source 'README.md') -PathType Leaf)) {
        throw 'Select the extracted HH-FEEDS GITHUB-UPDATE root, not the FULL/extension folder.'
    }
    foreach ($privateName in @('private-data', 'backend', 'extension', '.git')) {
        if (Test-Path -LiteralPath (Join-Path $source $privateName)) { throw "Refusing a private/runtime/checkout folder: $privateName" }
    }
    $release = Get-Content -LiteralPath (Join-Path $source $ManifestPath) -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($release.schemaVersion -ne 1 -or $release.repository -ne $RepositoryName -or $release.build -ne '6.0.0-rc3-hh-feeds') { throw 'Wrong release source manifest.' }
    $paths = New-Object 'System.Collections.Generic.List[string]'
    $seen = @{}
    foreach ($entry in $release.files) {
        $relative = [string]$entry.path
        Check-Publish-Path $relative
        if ($seen.ContainsKey($relative) -or $relative -eq $ManifestPath) { throw "Duplicate/self-referential source hash: $relative" }
        $seen[$relative] = $true
        $file = Safe-Path $source $relative
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing package file: $relative" }
        if ((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Symlink/junction is not allowed: $relative" }
        $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hash -ne [string]$entry.sha256) { throw "SHA-256 mismatch: $relative. Nothing published." }
        $paths.Add($relative)
    }
    if ($paths.Count -lt 20) { throw 'Incomplete package: not enough source files.' }
    $paths.Add($ManifestPath)
    $seen[$ManifestPath] = $true
    foreach ($file in Get-ChildItem -LiteralPath $source -Force -Recurse -File) {
        $relative = $file.FullName.Substring($source.TrimEnd([char[]]'\/').Length + 1).Replace('\','/')
        if (-not $seen.ContainsKey($relative)) { throw "Unexpected file in source package: $relative. Nothing published." }
    }
    Write-Host ("Verified {0} source/documentation files. No FULL or private runtime files will be copied." -f $paths.Count)
    $downloads = Join-Path $HOME 'Downloads'
    [void](New-Item -ItemType Directory -Path $downloads -Force)
    $destination = Join-Path $downloads ('job-search-assistant-hh-feeds-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6))
    # A NEW checkout preserves all previous clones and any unfinished local work.
    Write-Host (Git-Checked -ArgList @('clone','--branch','main','--single-branch',$RepositoryUrl,$destination)).Text
    $repo = $destination
    $base = (Git-Checked -ArgList @('rev-parse','HEAD')).Text.Trim()
    $currentManifest = Join-Path $repo 'browser-extension/manifest.json'
    if (Test-Path -LiteralPath $currentManifest) {
        $oldVersion = (Get-Content -LiteralPath $currentManifest -Raw -Encoding UTF8 | ConvertFrom-Json).version
        if ([version]$oldVersion -gt [version]'6.0.0') { throw "GitHub has a newer version ($oldVersion). Refusing a downgrade." }
    }
    # Refuse to overwrite a later or locally customized source release even when
    # its numeric manifest version is still 6.0.0. Accept only known supplied bases.
    foreach ($entry in $release.files) {
        $target = Safe-Path $repo ([string]$entry.path)
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            if ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing a linked repository path: $($entry.path)" }
            $raw = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($raw -eq [string]$entry.sha256) { continue }
            $text = [IO.File]::ReadAllText($target).Replace("`r`n", "`n")
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $normalized = ([BitConverter]::ToString($sha.ComputeHash((New-Object System.Text.UTF8Encoding($false)).GetBytes($text)))).Replace('-', '').ToLowerInvariant() }
            finally { $sha.Dispose() }
            $accepted = @($entry.acceptedBaseSha256)
            if ($accepted -notcontains $raw -and $accepted -notcontains $normalized) {
                throw "GitHub file differs from all supplied release bases: $($entry.path). No files copied; review this change first."
            }
        }
    }
    [void](Git-Checked -ArgList @('var','GIT_AUTHOR_IDENT'))
    if ((Git-Checked -ArgList @('status','--porcelain')).Text.Trim()) { throw 'New checkout is not clean.' }
    foreach ($relative in $paths) {
        $target = Safe-Path $repo $relative
        [void](New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force)
        Copy-Item -LiteralPath (Safe-Path $source $relative) -Destination $target -Force
    }
    # Stage ONLY the verified package paths; keep unrelated repository files untouched.
    for ($i = 0; $i -lt $paths.Count; $i += 25) {
        $end = [Math]::Min($i + 24, $paths.Count - 1)
        [void](Git-Checked -ArgList (@('add','--') + @($paths[$i..$end])))
    }
    $staged = (Git-Checked -ArgList @('-c','core.quotepath=false','diff','--cached','--name-only')).Text
    foreach ($relative in ($staged -split '\r?\n')) {
        if ($relative -and -not $seen.ContainsKey($relative)) { throw "Unrelated staged path: $relative" }
    }
    $changed = (Git-Checked -ArgList @('diff','--cached','--quiet') -Accepted @(0,1)).Code -eq 1
    if ($changed) {
        Write-Host (Git-Checked -ArgList @('diff','--cached','--stat')).Text
        Write-Host (Git-Checked -ArgList @('commit','-m','feat: add HH recommendation-feed analysis and one-click apply')).Text
    }
    $commit = (Git-Checked -ArgList @('rev-parse','HEAD')).Text.Trim()
    if ($Push) {
        [void](Git-Checked -ArgList @('fetch','origin','main'))
        $latest = (Git-Checked -ArgList @('rev-parse','origin/main')).Text.Trim()
        if ($latest -ne $base) { throw 'Remote main changed during publication. Local work is retained; no force/rebase was attempted.' }
        if ($changed) { Write-Host (Git-Checked -ArgList @('push','origin','HEAD:main')).Text }
        $remote = (Git-Checked -ArgList @('ls-remote','--heads','origin','refs/heads/main')).Text.Trim()
        $remoteSha = ($remote -split '\s+')[0]
        if ($remoteSha -ne $commit) { throw 'Remote verification failed: GitHub main does not match the local commit.' }
        if ($changed) { Write-Host ("PUBLISHED AND VERIFIED: {0}" -f $commit) -ForegroundColor Green }
        else { Write-Host ("ALREADY CURRENT: package matches GitHub at {0}; no new commit needed." -f $commit) -ForegroundColor Green }
    } else { Write-Host ("LOCAL ONLY: {0}. No GitHub push requested." -f $commit) -ForegroundColor Yellow }
    Write-Host "Checkout retained: $repo"
    Write-Host (Git-Checked -ArgList @('log','-1','--oneline')).Text
    Write-Host $RepositoryUrl
} catch {
    Write-Host ('STOPPED: ' + $_.Exception.Message) -ForegroundColor Red
    if ($repo) { Write-Host "Checkout retained: $repo" }
    Write-Host 'No force-push, history reset or deletion of existing project folders was performed.'
    exit 1
}
