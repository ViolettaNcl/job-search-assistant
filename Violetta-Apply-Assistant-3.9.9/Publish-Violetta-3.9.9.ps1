#requires -Version 5.1
# Copies ONLY hash-checked source/documentation files. Never resets or force-pushes.
[CmdletBinding()]
param(
    [string]$RepoPath = (Join-Path $HOME 'Downloads\job-search-assistant'),
    [string]$PackagePath,
    [switch]$Push,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$Version = '3.9.9'
$temporary = $null
$backup = $null
$repo = $null
function Git-Checked {
    param([string[]]$ArgList, [int[]]$Accepted = @(0))
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = @(& git -C $repo @ArgList 2>&1)
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    $text = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    if ($Accepted -notcontains $code) { throw ("git {0}: exit {1}`n{2}" -f $ArgList[0], $code, $text) }
    return [pscustomobject]@{ Code = $code; Text = $text }
}
function Safe-Join {
    param([string]$Root, [string]$Relative)
    if ([string]::IsNullOrWhiteSpace($Relative) -or [IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[\\/])\.\.([\\/]|$)|:|(^|[\\/])\.git([\\/]|$)') { throw 'Unsafe relative path in package.' }
    $base = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
    $path = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (-not $path.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package path escapes its root.' }
    return $path
}
function Write-Utf8 {
    param([string]$Path, [string]$Text)
    [IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}
try {
    Write-Host 'Violetta 3.9.9 - source publication (no binaries, no force-push)' -ForegroundColor Cyan
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is not installed or not in PATH.' }
    if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) { throw "Repository not found. Specify -RepoPath. Expected: $RepoPath" }
    $repo = (Resolve-Path -LiteralPath $RepoPath).Path
    $origin = (Git-Checked -ArgList @('remote','get-url','origin')).Text.Trim()
    if ($origin -notmatch '^(https://github\.com/|git@github\.com:)ViolettaNcl/job-search-assistant(\.git)?/?$') { throw 'Wrong repository origin. Expected ViolettaNcl/job-search-assistant.' }
    $branch = (Git-Checked -ArgList @('branch','--show-current')).Text.Trim()
    if ($branch -ne 'main') { throw 'Switch to main after saving your work. Nothing was deleted.' }
    if ((Git-Checked -ArgList @('status','--porcelain')).Text.Trim()) { throw 'The repository has uncommitted changes. Save/commit them first. Nothing was reset, stashed or deleted.' }
    [void](Git-Checked -ArgList @('var','GIT_AUTHOR_IDENT'))

    if ([string]::IsNullOrWhiteSpace($PackagePath) -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'source-sync-manifest.json'))) { $PackagePath = $PSScriptRoot }
    if ([string]::IsNullOrWhiteSpace($PackagePath)) {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = 'Select the FULL Violetta 3.9.9 ZIP (not a documentation ZIP)'
        $dialog.Filter = 'ZIP archives (*.zip)|*.zip'
        $dialog.InitialDirectory = Join-Path $HOME 'Downloads'
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { throw 'Cancelled. No files were changed.' }
        $PackagePath = $dialog.FileName
        $dialog.Dispose()
    }
    if (-not (Test-Path -LiteralPath $PackagePath)) { throw 'The selected package does not exist.' }
    if (Test-Path -LiteralPath $PackagePath -PathType Leaf) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $temporary = Join-Path ([IO.Path]::GetTempPath()) ('Violetta396-' + [guid]::NewGuid().ToString('N'))
        [void](New-Item -ItemType Directory -Path $temporary)
        $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $PackagePath).Path)
        try { foreach ($entry in $archive.Entries) { if ($entry.FullName) { [void](Safe-Join -Root $temporary -Relative $entry.FullName) } } } finally { $archive.Dispose() }
        Write-Host 'Extracting the selected ZIP...'
        Expand-Archive -LiteralPath $PackagePath -DestinationPath $temporary -Force
        $candidates = @(Get-ChildItem -LiteralPath $temporary -Filter 'source-sync-manifest.json' -File -Recurse)
        if ($candidates.Count -ne 1) { throw 'This is not the full 3.9.9 package: no unique source manifest.' }
        $source = $candidates[0].DirectoryName
    } else { $source = (Resolve-Path -LiteralPath $PackagePath).Path }
    if ($source.TrimEnd([char[]]'\/') -eq $repo.TrimEnd([char[]]'\/')) { throw 'Select the release folder or ZIP, not the Git repository itself.' }
    $manifest = Get-Content -LiteralPath (Join-Path $source 'source-sync-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.version -ne $Version -or $manifest.repository -ne 'ViolettaNcl/job-search-assistant') { throw 'Wrong package/version.' }
    $allowed = '^(browser-extension/|tests/|docs/|tools/|scripts/|\.github/workflows/(?:ci|codeql|package-windows|site-apply-regression|candidate-memory-regression)\.yml$|README\.md$|ARCHITECTURE\.md$|IMPLEMENTATION_STATUS\.md$|SUPPORTED_SITES\.md$|TESTING_GUIDE\.md$|WHAT_CHANGED\.md$|START_HERE\.txt$|SECURITY\.md$|ROADMAP\.md$|start-assistant\.cmd$|STOP_ASSISTANT\.cmd$|BACKEND_DIAGNOSTICS\.cmd$|UPDATE_EXISTING\.cmd$|user-settings\.example\.cmd$)'
    $seen = @{}
    foreach ($entry in $manifest.files) {
        if ($entry.target -notmatch $allowed -or $entry.target -match '(?i)\.(dll|exe|pdb|zip|log|db|woff2?|ttf|otf)$|(^|/)node_modules/|test-results/|(^|/)\.env$|candidate\.private\.json$|appsettings\.local\.json$|(^|/)user-settings\.cmd$') { throw "Disallowed source publication path: $($entry.target)" }
        if ($seen.ContainsKey($entry.target)) { throw "Duplicate target: $($entry.target)" }
        $seen[$entry.target] = $true
        $file = Safe-Join -Root $source -Relative $entry.source
        [void](Safe-Join -Root $repo -Relative $entry.target)
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing source file: $($entry.source)" }
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Package integrity check failed: $($entry.source)" }
    }
    $currentManifest = Join-Path $repo 'browser-extension\manifest.json'
    if (Test-Path -LiteralPath $currentManifest) {
        $currentVersion = (Get-Content -LiteralPath $currentManifest -Raw -Encoding UTF8 | ConvertFrom-Json).version
        if ([version]$currentVersion -gt [version]$Version) { throw "Repository is newer ($currentVersion). Refusing a downgrade." }
    }
    $backendProject = Join-Path $repo 'src\JobSearchAssistant\JobSearchAssistant.csproj'
    if (Test-Path -LiteralPath $backendProject) {
        $backendText = Get-Content -LiteralPath $backendProject -Raw -Encoding UTF8
        $versionMatch = [regex]::Match($backendText, '<Version>([^<]+)</Version>')
        if ($versionMatch.Success) {
            $serverVersion = $versionMatch.Groups[1].Value
            if ([regex]::IsMatch($serverVersion, '^\d+\.\d+\.\d+$') -and ([version]$serverVersion -gt [version]$Version)) { throw 'Backend source has a newer release version. Refusing a downgrade.' }
        }
    }
    Write-Host ("Verified {0} source/documentation files. Backend EXE/DLL are excluded." -f @($manifest.files).Count)
    Write-Host 'The source contains your CVs and candidate facts. In a public repository they will be public.' -ForegroundColor Yellow
    if ($DryRun) { Write-Host 'Dry run complete. No copy, commit or push.' -ForegroundColor Green; return }
    Write-Host 'Checking Git history...'
    [void](Git-Checked -ArgList @('fetch','origin','main'))
    $ahead = (Git-Checked -ArgList @('merge-base','--is-ancestor','origin/main','HEAD') -Accepted @(0,1)).Code
    if ($ahead -eq 1) {
        $behind = (Git-Checked -ArgList @('merge-base','--is-ancestor','HEAD','origin/main') -Accepted @(0,1)).Code
        if ($behind -ne 0) { throw 'Branches diverged. No reset or force-push will be used. Resolve Git history before retrying.' }
        [void](Git-Checked -ArgList @('merge','--ff-only','origin/main'))
    }
    # Refuse unexpected upgrades received by the fast-forward as well.
    if (Test-Path -LiteralPath $currentManifest) {
        $currentVersion = (Get-Content -LiteralPath $currentManifest -Raw -Encoding UTF8 | ConvertFrom-Json).version
        if ([version]$currentVersion -gt [version]$Version) { throw 'Remote contains a newer extension. Stopping before copying files.' }
    }
    if ((Git-Checked -ArgList @('status','--porcelain')).Text.Trim()) { throw 'Working tree changed during fetch. Stop before copying.' }
    if (Test-Path -LiteralPath $backendProject) {
        $backendText = Get-Content -LiteralPath $backendProject -Raw -Encoding UTF8
        $versionMatch = [regex]::Match($backendText, '<Version>([^<]+)</Version>')
        if ($versionMatch.Success) {
            $serverVersion = $versionMatch.Groups[1].Value
            if ([regex]::IsMatch($serverVersion, '^\d+\.\d+\.\d+$') -and ([version]$serverVersion -gt [version]$Version)) { throw 'Remote backend source is newer. Stopping before copying.' }
        }
    }
    $backupRoot = [Environment]::GetFolderPath('LocalApplicationData')
    if (-not $backupRoot) { $backupRoot = [IO.Path]::GetTempPath() }
    $backup = Join-Path $backupRoot ('ViolettaApplyAssistant\git-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
    [void](New-Item -ItemType Directory -Path $backup -Force)
    $baseCommit = (Git-Checked -ArgList @('rev-parse','HEAD')).Text.Trim()
    Write-Utf8 -Path (Join-Path $backup 'BASE_COMMIT.txt') -Text $baseCommit
    $changed = New-Object 'System.Collections.Generic.List[string]'
    function Backup-File([string]$Relative) {
        $dest = Safe-Join -Root $repo -Relative $Relative
        if (Test-Path -LiteralPath $dest -PathType Leaf) {
            $copy = Safe-Join -Root $backup -Relative $Relative
            [void](New-Item -ItemType Directory -Path (Split-Path -Parent $copy) -Force)
            Copy-Item -LiteralPath $dest -Destination $copy -Force
        }
    }
    foreach ($entry in $manifest.files) {
        $dest = Safe-Join -Root $repo -Relative $entry.target
        Backup-File $entry.target
        [void](New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force)
        Copy-Item -LiteralPath (Safe-Join -Root $source -Relative $entry.source) -Destination $dest -Force
        $changed.Add($entry.target)
    }
    # Preserve backend source. Update release metadata only, without changing code/dependencies.
    $projectRel = 'src/JobSearchAssistant/JobSearchAssistant.csproj'
    $projectPath = Safe-Join -Root $repo -Relative $projectRel
    if (Test-Path -LiteralPath $projectPath) {
        $xml = Get-Content -LiteralPath $projectPath -Raw -Encoding UTF8
        if ($xml -match '<Version>[^<]+</Version>') {
            Backup-File $projectRel
            Write-Utf8 -Path $projectPath -Text ($xml -replace '<Version>[^<]+</Version>', '<Version>3.9.9</Version>')
            $changed.Add($projectRel)
        }
    }
    # Keep prior ignore rules; add missing source hygiene and secret protection.
    Backup-File '.gitignore'
    $ignorePath = Join-Path $repo '.gitignore'
    $ignore = if (Test-Path -LiteralPath $ignorePath) { Get-Content -LiteralPath $ignorePath -Raw -Encoding UTF8 } else { '' }
    $rules = @('/backend/','/extension/','/test-results/','/artifacts/','/dist/','**/bin/','**/obj/','node_modules/','*.zip','*.log','*.db','*.db-wal','*.db-shm','**/.env','**/.env.*','!**/.env.example','**/candidate.private.json','**/appsettings.local.json','**/user-settings.cmd','backend-diagnostic.txt')
    foreach ($rule in $rules) { if (($ignore -split '\r?\n') -notcontains $rule) { $ignore = $ignore.TrimEnd() + "`n" + $rule + "`n" } }
    Write-Utf8 -Path $ignorePath -Text $ignore
    $changed.Add('.gitignore')
    # CI/workflow files are hash-verified package inputs and copied through the manifest.
    $paths = @($changed | Select-Object -Unique)
    for ($i=0; $i -lt $paths.Count; $i+=30) {
        $end = [Math]::Min($i+29, $paths.Count-1)
        [void](Git-Checked -ArgList (@('add','--') + @($paths[$i..$end])))
    }
    $diff = Git-Checked -ArgList @('diff','--cached','--quiet') -Accepted @(0,1)
    if ($diff.Code -eq 1) {
        Write-Host (Git-Checked -ArgList @('diff','--cached','--stat')).Text
        Write-Host (Git-Checked -ArgList @('commit','-m','Add v3.9.9 persistent vacancy memory and form continuation')).Text
    } else { Write-Host 'No source changes to commit.' }
    $commit = (Git-Checked -ArgList @('rev-parse','HEAD')).Text.Trim()
    if ($Push) {
        Write-Host (Git-Checked -ArgList @('push','origin','HEAD:main')).Text
        $remoteLine = (Git-Checked -ArgList @('ls-remote','--heads','origin','main')).Text.Trim()
        if (-not $remoteLine.StartsWith($commit)) { throw 'Push returned but the remote head differs. Inspect the Git output; no success is assumed.' }
        Write-Host ("PUBLISHED: {0}" -f $commit) -ForegroundColor Green
    } else { Write-Host ("LOCAL COMMIT: {0}. Run with -Push to publish." -f $commit) -ForegroundColor Yellow }
    Write-Host "Backup retained outside the repository: $backup"
    Write-Host (Git-Checked -ArgList @('status','--short','--branch')).Text
} catch {
    Write-Host ('STOPPED: ' + $_.Exception.Message) -ForegroundColor Red
    if ($backup) { Write-Host "Backup: $backup" }
    Write-Host 'No history reset, force-push, database deletion or automatic cleanup was performed.'
    exit 1
} finally {
    # Retain extraction on failure for inspection. It is outside the repository and never committed.
    if ($temporary) { Write-Host "Temporary extraction: $temporary" }
}
