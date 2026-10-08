# Поддерживаемые сайты

| Провайдер | Состояние RC3 | Поддерживаемый workflow | Проверенная граница |
| --- | --- | --- | --- |
| HH / hh.ru | Основной провайдер; **NOT LIVE VALIDATED** для RC3 | Поиск + главная / подборки, Analysis/Batch, Fit/Calls, vacancy-specific письмо, анкеты, one-click submit с safety gates | Node + Chromium DOM-фикстуры, mock API/transport |
| HeadHunter.kg | Совместимые HH-механизмы чтения и форм; без живой проверки | Direct vacancy / поиск / главная / подборки, письмо и формы в совместимых вариантах DOM | Legacy DOM-regression; trusted-origin policy |
| Habr Career | **BETA — NOT LIVE VALIDATED** | Адаптер чтения, Fit и подготовка application context | Фикстуры адаптера/DOM; live application не проверен |
| Avito Vacancies | **BETA — NOT LIVE VALIDATED** | Постоянные controls на карточке/странице, background full read, Fit/Calls, женская форма письма, Telegram/email, exact native chat fill + send | 8 Node contracts + 16 Chromium fixture assertions; авторизованный чат не проверен |
| Внешние ATS / анкеты | EXPERIMENTAL, доступ на конкретный origin | Generic form detection, Fill в связанном vacancy context | Известные fixtures; custom widgets могут требовать ручной проверки |

## Avito safety boundary

Avito использует отдельный content bundle и не получает HH auto-submit scripts. Одно явное нажатие **Письмо** разрешает ровно одно сообщение для одной точной вакансии: расширение проверяет чат, вставляет vacancy-specific текст и нажимает send. Это не фоновая массовая рассылка и не означает live validation.

Avito vacancy memory использует provider-qualified identity (`avito:<itemId>`), чтобы одинаковый цифровой ID на другом сайте не считался той же вакансией. Tracking-параметры не меняют canonical identity.

Подробнее: [browser-extension/AVITO_VACANCIES_BETA.md](browser-extension/AVITO_VACANCIES_BETA.md).

Состояние BETA не означает завершённый live-workflow. Изменения DOM, авторизации и особенностей аккаунта могут нарушить селекторы. Если exact chat/composer/send нельзя подтвердить, отправка прекращается, а текст сохраняется для безопасного повтора.

Чек-лист живой приёмки: [LIVE_ACCEPTANCE_6.0.0.md](docs/LIVE_ACCEPTANCE_6.0.0.md).

## HH homepage / recommendation feeds

«Для вас», «У дома», «Подработка», «Вахта» и другие подборки используют общий vacancy-card pipeline. Скрытые native-вкладки не входят в активный batch; карточки, появившиеся после переключения или подгрузки, получают controls автоматически. [Область поддержки](docs/HH_FEEDS.md) · [Проверки сборки](docs/HH_FEEDS_TEST_REPORT.md).
