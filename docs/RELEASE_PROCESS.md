# Release Process

## Главное правило

**Никогда не копируйте FULL bundle целиком поверх Git repository.**

Неправильно:

```powershell
robocopy "...FULL" "...job-search-assistant" /E
```

FULL bundle содержит packaged `extension/`, runtime `backend/`, test output и release helpers. Для GitHub нужен только source subset.

## Правильный процесс

1. Убедитесь, что локальный repository clean:

```powershell
cd C:\Users\1\Downloads\job-search-assistant
git status
git pull --ff-only origin main
```

2. Запустите hygiene check:

```powershell
python tools/check-repo-hygiene.py
```

3. Используйте release publisher:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

& "<FULL_FOLDER>\Publish-Violetta-3.9.13.ps1" `
  -RepoPath "C:\Users\1\Downloads\job-search-assistant" `
  -PackagePath "<FULL_FOLDER>" `
  -Push
```

Publisher:

- проверяет origin;
- требует `main` и clean working tree;
- проверяет source manifest и SHA-256;
- допускает только whitelisted source paths;
- сохраняет backup изменяемых файлов вне repository;
- не делает reset/clean/stash;
- не использует force-push;
- проверяет remote HEAD после push.

## После публикации

```powershell
(Get-Content .\browser-extension\manifest.json -Raw | ConvertFrom-Json).version
Select-String .\src\JobSearchAssistant\JobSearchAssistant.csproj -Pattern '<Version>'
python tools/check-repo-hygiene.py
git status
git log -3 --oneline
```

Ожидается clean working tree и версия `3.9.13`.
