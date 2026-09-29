# Статус 3.9.9

| Пункт стратегии | Реализация |
|---|---|
| Единая память кандидата | Миграция существующего профиля; 56 исходных фактов + актуальные контакты; исходные даты и source IDs. |
| Новые сведения HH | Импортирован присланный пользователем текст AppXite/фриланс/переводы/Crowne. Автоматический вход в аккаунт HH для чтения CV не выполнялся. |
| CV | Три исходных PDF сохранены. Основной выбор по языку — RU/EN; ручные CV пользователя при миграции не перезаписываются. |
| Source Reconciler | Preview/confirm новых структурированных фактов и конфликтов в настройках. Нет автоматического извлечения произвольного нового PDF/HH-резюме. |
| Role Context Router / Evidence Selector | Разработка, backend/fullstack, QA, technical/integration support, customer support, implementation, teaching и прочие направления. |
| Отрицательная релевантность | Нерелевантные hospitality/teaching блоки исключены из технических писем. |
| Полный анализ перед письмом | Apply, автопилот, HH-list, dashboard/advanced. Ошибка получения текста останавливает письмо. |
| Индивидуальность | Разные требования меняют выбранные факты/проект. Локальный вариант ограничен шаблоном; свободная переформулировка — через настроенную модель. |
| ATS / естественный стиль | Только подтверждённые термины, краткость, без пересказа CV/keyword stuffing. Обход фильтров/детекторов не обещается. |
| GitHub | Технические письма — да, преподавание по умолчанию — нет. |
| Chat Reader | Активная область, целые сообщения, авторы, последнее сообщение, ограниченная подгрузка, диагностика. Неизвестный автор требует подтверждения. |
| Полноценный chat context | Актуальные факты, текущий чат, открытые вопросы, связанная вакансия и сохранённое письмо. |
| Quick vs full reply | Отделены. Пустое чтение и неподтверждённые ответы не маскируются canned replies. |
| Reply verification | Пропуски вынесены отдельно; проверяются evidence IDs, язык, вопросы, длина и ряд ложных утверждений. Проверка не является формальным доказательством. |
| Memory separation | Переписка/черновики не обновляют глобальные личные факты автоматически. |
| Свободная AI-генерация | Реальный необязательный Chat Completions transport; нужен endpoint/model/key и согласие. Без модели — локальный фактический режим. |
| Employer-neutral cover letters | Названия прежних работодателей/учебного заведения не пишутся в cover letter; используются роль, обязанности, проекты и профильное образование. |
| HH cover-letter continuation | После штатного отклика распознаётся «Приложить сопроводительное письмо», поле заполняется и отдельная HH-кнопка `Отправить` нажимается без generic `final-action-not-found`. |
| Публикация Git | Whitelist/hash checks, обычный commit/push, резервная копия. Нет force/reset/mirror/delete. |
| Standalone core | ✦ Apply, ✎ AI, local memory/CV/quick replies не требуют backend readiness. |
| Persistent page UI | HH vacancy URL fallback, chat fallback scope, SPA watchdog и repair уже открытых HH-вкладок. |
| Extension icon | Новый Violet icon set 16/32/48/128 и toolbar action icon. |
| Advanced backend | Локальный .NET сервис остаётся для 🚀 Autopilot queue/dashboard и не блокирует core readiness. |

Не выполнено: подтверждение трудоустройства внешними источниками, переписывание backend ranking/компиляция сервера, реальный логин HH, live-тест внешней модели, запуск Windows EXE и PowerShell на Windows. Это не заявлено выполненным.

| Persistent vacancy/card memory | ✅ 3.9.9: Analysis + application/form state rehydrate by exact vacancy ID after Back/reload/repeated cards |
| HH form continuation | ✅ 3.9.9: prepared quick-list application resumes on the questionnaire in the same tab; safe known fields/CV/letter are filled, unresolved fields are recorded, final Submit remains user-controlled |
| Already-viewed cover-letter modal | ✅ 3.9.8: exact HH notice → click unique `Закрыть` → `✓ Уже просмотрен`; no false claim that the letter was sent |
| Inline call Analysis | ✅ 3.9.7: exact vacancy ID → full HH description → green no-calls / red calls / neutral unknown; no auto-submit |
| Search-page heading isolation | ✅ 3.9.7: выбранная карточка закрепляется по vacancy ID; `Найдено N вакансий` отклоняется как title |
| Manual Fill in HH list modal | ✅ 3.9.7: использует pinned vacancy context, а не body страницы поиска |
