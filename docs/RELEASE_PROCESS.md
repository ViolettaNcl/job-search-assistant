# Процесс выпуска

## Критерий Production

Automated tests PASS **и** критический пользовательский smoke-test HH. Поскольку живая приёмка не выполнена, эта поставка — **6.0.0 RC3**, хотя имена архивов используют запрошенное `6.0.0`. `manifest.version_name` и документация содержат RC3.

Не отмечайте Habr или Avito как VALIDATED по DOM-фикстурам. Avito one-click message sending остаётся BETA: одно явное действие, exact-chat verification, bounded retry и fail-closed stops; это не заменяет авторизованную live-проверку. Не объявляйте .NET PASS при отсутствии исходников или до assertions.

## Проверка файлов

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\VERIFY_RELEASE.ps1 `
  -PackagePath ".\Violetta-Apply-Assistant-6.0.0-FULL.zip"
```

Verifier проверяет пути ZIP, дубликаты, каждую строку manifest, SHA-256 файлов и наличие лишних файлов. Проверять нужно неизменённую распакованную поставку: запуск backend может создать дополнительные файлы.

SHA-256 подтверждает целостность, но не личность автора. Подписанные Git tags возможны только с отдельно настроенным ключом; приватного ключа в пакетах нет. Windows PowerShell-скрипты этой средой не выполнялись — их статус указан отдельно в отчёте.

## Обновление GitHub

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Publish-Violetta-6.0.0.ps1 `
  -RepoPath "C:\Users\1\Downloads\job-search-assistant" `
  -PackagePath ".\Violetta-Apply-Assistant-6.0.0-GITHUB-UPDATE.zip" -DryRun
```

После просмотра плана повторите без `-DryRun`. `-Push` — отдельное разрешение на отправку. Publisher проверяет origin `ViolettaNcl/job-search-assistant`, ветку main, чистую рабочую папку, baseline и хеши. Не использует force-push, reset или clean. Несовпадение локальных правок останавливает копирование.

Данный выпуск не выполняет push за пользователя. Проверки Git выполняются только в временном локальном репозитории с локальным bare remote.

## Артефакты

FULL, STANDALONE-EXTENSION, GITHUB-UPDATE, publisher, verifier, внешний SHA-256 список, test report и release notes. Персональный FULL не является файлом для GitHub Releases.
