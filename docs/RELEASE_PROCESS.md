# Release Process · 5.2

## Main rule

Never copy a FULL bundle over the Git source repository. FULL contains packaged runtime material; GitHub receives only the hash-verified source subset from `source-sync-manifest.json`.

## Safe publication

```powershell
cd C:\Users\1\Downloads\job-search-assistant
git switch main
git pull --ff-only origin main
git status
python tools/check-repo-hygiene.py
```

From the extracted FULL bundle run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

& "<FULL_FOLDER>\Publish-Violetta-5.2.0.ps1" `
  -RepoPath "C:\Users\1\Downloads\job-search-assistant" `
  -PackagePath "<FULL_FOLDER>" `
  -Push
```

The publisher verifies origin, branch, clean working tree, manifest version, SHA-256 hashes and target allowlist. It creates an external backup and never uses reset/clean/stash/force-push.

## Verify

```powershell
(Get-Content .\browser-extension\manifest.json -Raw | ConvertFrom-Json).version
Select-String .\src\JobSearchAssistant\JobSearchAssistant.csproj -Pattern '<Version>'
python tools/check-repo-hygiene.py
git status
git log -3 --oneline
```

Expected version: `5.2.0`.
