# Repository Layout

GitHub repository является **source repository**. FULL ZIP — это release bundle и не должен целиком копироваться в Git.

## Разрешённая верхнеуровневая структура

```text
.github/             GitHub Actions
browser-extension/   исходники Chrome extension
src/                 .NET backend source
docs/                документация и assets
tests/               browser/source publication tests
tools/               release/developer utilities
scripts/             source-side Windows helpers
```

Корневые `.md`, `.cmd`, Docker/Vercel files являются частью source project.

## Запрещённые release/runtime папки

В source repository не должны появляться:

```text
Violetta-Apply-Assistant-*/
backend/
extension/
github-source/
test-results/
artifacts/
dist/
node_modules/
```

`extension/` допустима внутри FULL bundle, но source equivalent в GitHub называется `browser-extension/`.

## Запрещённые tracked artifacts

- `*.dll`
- `*.exe`
- `*.pdb`
- `*.zip`
- `*.db`, `*.db-wal`, `*.db-shm`
- `*.log`
- `.env`
- `candidate.private.json`
- `appsettings.local.json`
- `user-settings.cmd`

## Автоматическая проверка

```powershell
python tools/check-repo-hygiene.py
```

Команда завершается с ненулевым кодом, если в Git tracked files обнаружен запрещённый путь.

CI запускает эту проверку на push и pull request.
