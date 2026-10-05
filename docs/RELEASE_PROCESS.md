# Safe publication of 6.0 RC2

1. Test Standalone while preserving the existing extension ID/history.
2. Unzip GITHUB-UPDATE outside the Git repository.
3. Run its `Publish-Violetta-6.0.0-RC2.ps1` with -RepoPath. Use -DryRun to inspect; -Push creates a local commit and publishes after checks.
4. The script requires the exact repository origin and clean main. It fast-forwards only, checks file hashes, keeps an external backup and refuses conflicting source edits. It never resets/stashes history, force-pushes, or copies whole FULL folders.
5. Version in manifest becomes 6.0.0; version_name marks RC2. Backend csproj release metadata may be updated, but the included runtime binary is retained from 5.2 distribution, not freshly rebuilt here.

Do not use robocopy /E to publish FULL. No git init in a release package. Do not add .vja, datasets, logs, ZIP or DLL files. Previous personal files in Git history are not removed by this delta.

GitHub push is not executed by the release builder. Windows PowerShell should be tested first with -DryRun.
