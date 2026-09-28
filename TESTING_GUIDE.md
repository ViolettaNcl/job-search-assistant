# Тестирование · 3.8.0

В source clone используйте `browser-extension/`; в Windows ZIP — `extension/`. Тестовый bridge автоматически различает две структуры.

## Node

```powershell
$ext = if (Test-Path .\browser-extension) { '.\browser-extension' } else { '.\extension' }
$cases = Get-ChildItem $ext -Filter '*.test.js' -File | Select-Object -ExpandProperty FullName
node --test @cases
if ($LASTEXITCODE -ne 0) { throw 'Node tests failed' }
```

## Chromium

Требуются Python, Playwright и Chromium. Linux runner использует системный `chromium`; без него Playwright должен иметь установленный браузер.

```powershell
python -m pip install playwright
python -m playwright install chromium
python .\tests\browser_e2e.py
if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed' }
```

Fixtures используют реальные модули worker/content scripts, но подменяют Chrome API, HTTP, вкладки загрузки вакансий и ответ модели. Они не отправляют реальные отклики и не расходуют AI-кредиты.

## Новые сценарии

Миграция/приоритет источников; сохранение ручных CV; AppXite; разные проекты для WPF/PHP/backend; исключение Crowne; beginner French; отсутствие выдуманного Jira/стажа/зарплаты; последнее сообщение работодателя; несколько открытых вопросов; stale A→B; пустой чат; подтверждение неизвестного автора; full vacancy before HH-list letter; модель/локальный режим и содержимое model payload.

## Windows / реальный аккаунт

Обновить старую установку, Reload расширения, refresh HH. Проверить профиль и дату источников. Сначала выполнить предпросмотр письма без отправки и chat draft. Затем проверить один явно выбранный реальный отклик. Автопилот сначала ограничить одной заявкой за сессию.

PowerShell-публикатор этой поставки проверен по структуре/ограничениям и Git-плану, но не исполнялся под Windows PowerShell. Windows backend EXE не запускался в Linux-среде; совпадение файлов не является runtime-тестом.

Локальные отчёты и screenshots относятся к `test-results/` и не коммитятся. Числа фактического финального прогона находятся в `TEST_REPORT.md` Windows-пакета и отдельном отчёте поставки.
