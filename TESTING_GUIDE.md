# Тестирование · 3.9.9



## 3.9.9 persistent-memory regression

Focused Chromium test `tests/browser_memory_399.py` verifies the requested flow end to end with mocked Chrome/HH boundaries:

- Analysis reaches a confirmed state and a duplicate card restores it without another click;
- quick-list application context is persisted before navigation;
- an HH questionnaire fills confirmed profile fields, cover letter and selected CV;
- unknown salary and legal consent stay unresolved;
- final Submit is not auto-clicked;
- form progress is written back to vacancy memory;
- returning to the list restores the saved review state instead of resetting the card.

Run it with:

```powershell
python .\tests\browser_memory_399.py
if ($LASTEXITCODE -ne 0) { throw '3.9.9 memory regression failed' }
```

## 3.9.8 already-viewed HH regression

Browser regression opens a synthetic HH list card, submits a cover letter, returns `Отклик уже просмотрен работодателем.`, and verifies that the extension clicks the modal's unique `Закрыть`, removes the dialog, sets the card action to `✓ Уже просмотрен`, records `Viewed`, and does not claim `coverLetterFilled=true`.

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

Миграция/приоритет источников; сохранение ручных CV; актуальный Technical Support / Integration Support опыт; разные проекты для WPF/PHP/backend; отсутствие названий прежних работодателей в cover letter; исключение hospitality из technical letters; профильное образование без названия учебного заведения; beginner French; отсутствие выдуманного Jira/стажа/зарплаты; последнее сообщение работодателя; несколько открытых вопросов; stale A→B; пустой чат; подтверждение неизвестного автора; full vacancy before HH-list letter; модель/локальный режим и содержимое model payload.

Отдельный HH fixture воспроизводит текущий двухэтапный flow со скриншота: `Откликнуться` → receipt «Ваш отклик отправлен работодателю» → `Приложить сопроводительное письмо` → modal textarea → `Отправить`. Проверяется, что письмо реально записано в textarea, dedicated Send нажат, modal закрыт и результат отмечен как confirmed.

## Windows / реальный аккаунт

Обновить старую установку, Reload расширения, refresh HH. Проверить профиль и дату источников. Сначала выполнить предпросмотр письма без отправки и chat draft. Затем проверить один явно выбранный реальный отклик. Автопилот сначала ограничить одной заявкой за сессию.

PowerShell-публикатор этой поставки проверен по структуре/ограничениям и Git-плану, но не исполнялся под Windows PowerShell. Windows backend EXE не запускался в Linux-среде; совпадение файлов не является runtime-тестом.

Локальные отчёты и screenshots относятся к `test-results/` и не коммитятся. Числа фактического финального прогона находятся в `TEST_REPORT.md` Windows-пакета и отдельном отчёте поставки.


## 3.9.7 CI refresh

GitHub workflows now validate the current `browser-extension/` source rather than old exact popup text from pre-3.9 UI. `package-windows` packages the current root launcher, and CodeQL uses .NET 10 manual build for C# plus no-build JavaScript analysis.

## 3.9.7 exact list-card regression

- Search page with heading `Найдено 19 718 вакансий` and multiple vacancy cards.
- Each card must get its own `✦ Отклик + письмо`.
- Clicking one card must persist that exact vacancy ID and full vacancy title.
- The search-page heading must never appear in the cover letter.
- Hidden detail-tab reading must confirm the same vacancy ID before accepting text.
- Manual `✦ Fill` inside a list/modal must reuse the selected vacancy context.
- Both HH cover-letter variants remain covered: required-before-submit and append-after-response.

## 3.9.7 inline call-analysis regression

The browser fixture verifies two HH search cards at once: a chat-only vacancy becomes `✓ Без звонков`, a vacancy with explicit inbound calls becomes `✕ Есть звонки`, the exact `/vacancies/<id>` API request is observed, and the original vacancy-specific `✦ Отклик + письмо` flow still completes afterward.
