# Violetta Apply Assistant 3.9.9

## Persistent vacancy memory + automatic form continuation

- `Analysis` and application state are persisted by exact HH vacancy ID instead of living only in the current search-page DOM.
- Back/reload/repeated cards restore green/red Analysis and the saved application/form status automatically.
- Before leaving a search card for an HH questionnaire, the exact prepared application is persisted and bound to the navigation context.
- On the questionnaire page, confirmed candidate fields, the prepared cover letter and the selected CV are filled automatically when the field/control can be verified.
- Unknown salary, legal consent, work authorization, start-date and other unsupported answers are never fabricated; they stay in the review list.
- Form progress (`filled`, unresolved/review count, CV/letter state) is stored in the application memory and restored on return to the vacancy list.
- Automatic continuation may advance only through a safe intermediate step; it never presses a final Submit.
- Existing 3.9.8 `✓ Уже просмотрен` and 3.9.7 full-vacancy call Analysis behavior remain intact.

---

# Violetta Apply Assistant 3.9.8

## HH: уже просмотренный отклик больше не блокирует список

- После нажатия `✦ Отклик + письмо` расширение отслеживает результат именно в модальном окне сопроводительного письма.
- Если HH сообщает **`Отклик уже просмотрен работодателем`**, расширение автоматически нажимает уникальную кнопку **`Закрыть`** в этом же окне.
- Текущая страница поиска остаётся открыта; пользователь сразу может перейти к следующей вакансии.
- Карточка получает терминальное состояние **`✓ Уже просмотрен`**, а не `! Повторить`.
- В Application history событие фиксируется как `Viewed`; при этом система **не утверждает**, что сопроводительное письмо было отправлено.
- Автозакрытие привязано только к этому конкретному сообщению HH. Обычные ошибки, неоднозначные модальные окна и другие причины отказа остаются видимыми для проверки.
- Логика 3.9.7 Analysis (полная вакансия в фоновой вкладке, точный vacancy ID, `✓ Без звонков / ✕ Есть звонки`) сохранена без изменений.

---

# Violetta Apply Assistant 3.9.7

## Full-vacancy Analysis from the HH search list

- `Analysis` no longer decides from the short search-card text when a full vacancy can be opened.
- The exact selected vacancy ID is opened in an **inactive background tab**. The assistant reads the full vacancy DOM, verifies that the opened vacancy ID still matches the card, analyzes the complete description, and closes the background tab automatically.
- The user stays on the search-results page; the analysis tab is never activated.
- If the live vacancy page cannot be read, the assistant falls back to the exact HH vacancy API. Only if both full-detail routes fail does it use the card snippet, and a snippet without explicit call wording is never treated as proof.
- `✕ Есть звонки` is returned for actual phone-call duties: inbound/outbound calls, generic required calls, call-center work, phone/voice support, phone consultations and customer/employee calling.
- `✓ Без звонков` is returned for explicit chat/no-call work or when a confirmed full vacancy contains no call duty.
- Technical wording such as **“настраивать телефонию / SIP / VoIP”** is not treated as a call-center duty by itself.
- `входящие обращения` without phone/call wording is not treated as `входящие звонки`.
- If neither the live page nor HH API can be read, the button becomes `↻ Повторить` instead of silently presenting an uncertain green result.
- Analysis remains separate from `✦ Отклик + письмо` and never submits an application.

## Preserved 3.9.5–3.9.6 protections

- `✦ Отклик + письмо` remains pinned to one exact vacancy ID/card.
- `Найдено N вакансий` is rejected as a vacancy title.
- Mandatory-letter-before-submit and post-response `Приложить письмо → Отправить` flows remain covered.
- Vacancy-specific cover-letter evidence and CV selection are unchanged.

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
