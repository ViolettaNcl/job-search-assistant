# Violetta Apply Assistant 3.9.5

## Exact vacancy-card writing on HH lists

- `✦ Отклик + письмо` is now pinned to one exact vacancy ID/card before any click.
- Search-page headings such as `Найдено 19 718 вакансий` are rejected as vacancy titles and can never seed a cover letter.
- The background reader verifies the hidden detail tab still points to the same vacancy ID before accepting its title/description.
- If HeadHunter redirects to a different/search page, the letter is stopped instead of generating generic text.
- `✦ Fill` inside a list/modal reuses the selected vacancy context instead of the search page body.
- Cover-letter validation now rejects drafts with no detectable connection to the selected vacancy.
- Both HH flows remain supported: mandatory letter before response, and response first → `Приложить письмо` → `Отправить`.

---


## 3.9.4 — HeadHunter.kg persistent UI and cover-letter continuation

- Added first-class HeadHunter.kg host permissions and content-script matches.
- ✦ Apply and ✎ AI now inject automatically on `headhunter.kg` / subdomains instead of appearing only after opening the extension popup.
- HH-specific cover-letter continuation now recognizes HeadHunter.kg as the same provider, so the flow can click «Приложить сопроводительное письмо», fill the modal and click its dedicated «Отправить».
- Existing vacancy-first writing rules remain: technical letters use role/responsibility/project evidence and technical education where relevant, without previous employer names.
# Violetta Apply Assistant 3.9.4

## ⚡ 3.9.4 — card-level quick apply

- HH/HeadHunter search cards now get a compact **`✦ Отклик + письмо`** action beside the native response control.
- Clicking it visually highlights the exact selected card and prepares the cover letter for that vacancy only.
- Both common HeadHunter flows are supported: **mandatory cover letter before the first response** and **post-response `Приложить письмо`**.
- The assistant fills the detected letter editor and presses the unique submit control for that modal.
- The original native `Откликнуться` button still works and keeps the automatic cover-letter continuation.
- Ambiguous questionnaires or unsupported forms stop for review instead of clicking another vacancy or unrelated action.


## Постоянные ✦ Apply / ✎ AI на HH

- Исправлено определение прямой HH-вакансии: поисковые/фильтровые формы на `/vacancy/<id>` больше не скрывают `✦ Apply`.
- Service worker восстанавливает UI после install/startup, активации вкладки, обычной навигации и HH SPA `history.pushState`/`replaceState` переходов.
- После одного явного Chrome permission grant доступ запрашивается сразу для `https://hh.ru/*` и `https://*.hh.ru/*`.
- Если Chrome вручную настроен на «доступ только при нажатии», расширение не может обойти это ограничение: нужен один явный persistent grant для HH.ru / HeadHunter.kg.

## Полный HH Apply + сопроводительное письмо

`✦ Apply` теперь обрабатывает двухэтапный HH flow:

```text
вакансия
→ анализ + CV + письмо
→ Откликнуться
→ подтверждение отклика резюме
→ Приложить сопроводительное письмо
→ заполнить textarea
→ Отправить
→ сохранить точный текст в Application / Cover Letter Memory
```

Исправлен конкретный случай, когда модальное окно письма было уже открыто, поле заполнено, но кнопка `Отправить` не нажималась из-за общего `final-action-not-found`. Для HH cover-letter modal используется отдельный строгий детектор `Отправить / Отправить письмо / Отправить сопроводительное письмо`.

## Более релевантные человеческие письма

- Перед письмом используется vacancy-first evidence selection.
- Для Technical / Integration Support берутся подтверждённые задачи: SaaS, тикеты, диагностика, логи, SQL, API, интеграции, тестирование исправлений.
- Для .NET / Backend / Full-Stack — freelance/client development, C#/.NET/ASP.NET Core/SQL/REST и релевантный проект.
- Для QA — воспроизведение ошибок, тестирование исправлений, API/SQL и релевантные технические проекты.
- Для технических ролей может использоваться профильное образование в области информационных систем и программирования.
- **В cover letter не пишутся названия прежних работодателей или учебного заведения**. Вместо этого описываются роль, задачи и доказательства релевантности.
- Crowne Plaza / Front Desk / hospitality и нерелевантное преподавание не используются в developer/QA письмах.
- GitHub добавляется только в техническом контексте.

## Extension-first

Основные `✦ Apply`, HH quick apply, Candidate Truth Memory, local writing fallback и `✎ AI` работают без обязательного `start-assistant.cmd`. Локальный backend остаётся расширенным режимом для Autopilot queue/dashboard.

## GitHub / CI

Source publication остаётся source-only: без runtime DLL/EXE, ZIP, локальных DB и `test-results`. Workflows обновлены под текущий `browser-extension/` source layout.

Дополнительно исправлены очевидные CI-конфликты предыдущего commit:
- backend tests больше не запускаются с `--no-build` после сборки только application project;
- package/CI не требуют искусственного равенства номера extension release и неизменившегося backend source release;
- CodeQL разделён на независимые JavaScript и C# jobs с детерминированной manual C# build.

## Локальная проверка

- Node extension tests: **210 / 210**
- Browser integration assertions: **76 / 76**
- Source publication tests: **7 / 7**
- JavaScript syntax: **120 files**

Synthetic/browser fixtures не являются бессрочной гарантией production DOM HH.ru / HeadHunter.kg.
