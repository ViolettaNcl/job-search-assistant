# Supported sites — 3.7.0


## HH-specific behavior in 3.7

- **Search-list native quick apply:** dedicated helper observes a real user click on HH `Откликнуться`, pins the vacancy by HH vacancy ID, starts letter preparation in capture phase, and supports current HH modal/popup portal editors when `Приложить письмо` appears. This is covered by a synthetic HH DOM integration fixture, not claimed as permanent live-DOM certification.
- **Recruiter chat:** full-dialog AI tolerates HH SPA route/query changes and has a current-DOM fallback for chats whose message bubbles no longer expose stable selectors. A trusted analysis click can run as one-shot AI without a Settings detour; stale-response checks remain strict.
- If HH changes the card/receipt/modal DOM, the helper must stop rather than guess a different button.

**«Есть adapter» не означает «проверено на живом аккаунте».** Категории ниже отделяют реализацию от live-валидации. Ни одно расширение нельзя по результатам синтетических DOM-тестов объявить гарантированно работающим на всех вариантах формы одной ATS.

## Fully supported

Полностью подтверждённых end-to-end **живых платформ** в этом релизе не заявлено. Локальными тестами проверены: семантическая HTML-форма, CV/Resume upload, отдельный portfolio input, explicit intermediate step, native поля, открытый Shadow DOM, чат с прямыми ID/author markers, старые сообщения, no-submit/no-send/stale guards. Это конкретные тестовые сценарии, не сертификация сайтов.

## Partially supported

| Платформа | Реализовано | Что требует проверки / ручного шага |
|---|---|---|
| HH.ru | Discovery/parser helpers, vacancy selectors, current-vacancy ✦ Apply, recruiter chat heuristics и **user-controlled 🚀 Autopilot** для remote IT search (development / QA / Technical Support) | Автопилот запускается пользователем из главного popup и использует score/daily/session limits; default browser discovery включён, если старый профиль ещё не сохранял эту настройку. Реальные варианты HH chat DOM, резюме аккаунта и изменения response flow требуют smoke test на аккаунте; prechecked legal/privacy/high-risk controls должны остановить auto-submit |
| LinkedIn Jobs | Job selectors, URL IDs, message selectors, общий form handler | Доступ origin выдаёт пользователь. Не все sender markers или окна Easy Apply распознаются |
| Indeed | Job title/company/description selectors, `jk` identity, generic form handling | Login/custom controls/переписка не сертифицированы |
| Greenhouse, Lever, Ashby | Selector profiles, JSON-LD, URL/tenant identity, native forms/upload | Custom widgets и переходы между доменами требуют ручной проверки |
| Workday | Description/title selectors, requisition identity с tenant scope, общие native-поля | Сложные wizard/custom widgets оставлены на ручное подтверждение; не заявлен полный автоматический Workday flow |
| SmartRecruiters, Teamtailor, Workable | Небольшие selectors + semantic form fallback | Реальные варианты UI, iframe и внутренние адреса требуют валидации |

## Generic mode

Habr Career, SuperJob, GeekJob, Glassdoor, BambooHR, Recruitee, Personio, Comeet, Jobvite имеют заготовленные selector profiles и работают поверх того же generic engine; глубокой live-интеграции для них не заявлено. Для неизвестных career pages используется JSON-LD JobPosting либо семантические признаки DOM: заголовок, описание, labels, безопасные поля, явные file inputs. Отдельная компания со стандартной HTML-формой может работать без нового адаптера.

Generic safe mode ничего не нажимает на полностью нераспознанной странице, не читает произвольный body для AI и не угадывает неизвестные профессиональные факты. Если приложение не распознано, стандартная ручная работа на сайте остаётся доступной.

## Needs dedicated adapter

Чаты без надёжного thread ID/отправителя, canvas UI, закрытый Shadow DOM, специфичные и виртуализированные ATS с нестандартной семантикой, нестабильные rich-text editors, некоторые custom radio/combobox/datepicker, капча, логин, MFA и cross-origin iframe без разрешения. Нет попыток обхода browser security, авторизации, CAPTCHA или защиты сайта.

Same-origin и разрешённые cross-origin frames получают content scripts через all_frames. Для отдельного домена iframe требуется отдельное разрешение и refresh. Popup ориентируется на верхнюю страницу; команды чата используют последний сфокусированный frame. Глубокая координация нескольких разных форм в nested iframe остаётся ограниченной.

## Проверка конкретного сайта

Основная `✦ Apply` теперь является автооткликом. Перед реальным использованием новой площадки проверить её на тестовой/небоевой форме; безопасный `✦ Fill`/advanced prepare остаётся для ручной проверки формы. Проверить page type, правильный ID вакансии, уникальность thread, отправителя, сохранение вводимых полей, назначение CV и ручные решения. При неоднозначности система должна остановиться. Заранее отмеченные юридические/privacy/visa/work-authorization controls также должны остановить explicit auto-apply до вашего реального взаимодействия с полем. Никогда не подтверждать live support только по совпадению CSS selector или наличию названия платформы в этом файле.
