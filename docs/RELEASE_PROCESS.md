# Release Process

## Main rule

Never copy a FULL bundle over the Git source repository.

Wrong:

```powershell
robocopy "...FULL" "...job-search-assistant" /E
```

A FULL bundle contains packaged `extension/`, runtime `backend/`, test output and release helpers. GitHub should receive only the source subset defined by `source-sync-manifest.json`.

## Safe 5.0 publication

1. Clone/open the existing repository and ensure it is clean.

```powershell
cd C:\Users\1\Downloads\job-search-assistant
git status
git pull --ff-only origin main
```

2. Run repository hygiene.

```powershell
python tools/check-repo-hygiene.py
```

3. Run the release publisher from the extracted FULL bundle.

```powershell
Set-ExecutionPolicy -Scope Process Bypass

& "<FULL_FOLDER>\Publish-Violetta-5.0.0.ps1" `
  -RepoPath "C:\Users\1\Downloads\job-search-assistant" `
  -PackagePath "<FULL_FOLDER>" `
  -Push
```

The publisher verifies origin, `main`, clean working tree, file SHA-256 values and the target whitelist. It keeps a backup outside the repository and does not use reset/clean/stash/force-push.

## Verify after publication

```powershell
(Get-Content .\browser-extension\manifest.json -Raw | ConvertFrom-Json).version
Select-String .\src\JobSearchAssistant\JobSearchAssistant.csproj -Pattern '<Version>'
python tools/check-repo-hygiene.py
git status
git log -3 --oneline
```

Expected release version: `5.0.0`.
