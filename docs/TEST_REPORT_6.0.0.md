# Violetta Apply Assistant 6.0.0 RC3 — отчёт проверок

**Дата:** 6 октября 2026. **База:** предоставленный архив 6.0.0 RC2.  
**Статус:** Release Candidate — **NOT LIVE VALIDATED**, не Final Production.

## Среда и итог

Linux; Node.js 22.16.0; Python 3.13.5; Chromium 144.0.7559.96; Python Playwright. Проверки выполнялись локально, без авторизации в HH/Habr/Avito и без отправки откликов или сообщений. Windows PowerShell и .NET SDK в среде отсутствовали; C#-исходников в предоставленном архиве нет.

Базовая версия: **325 Node-тестов, 325 успешных**. Текущее дерево: **388 Node-тестов, 388 успешных, 0 проваленных, 0 пропущенных**. Python: **34 теста, 34 успешных, 0 пропущенных**. Промежуточные ошибки не были объявлены успешными: после исправлений выполнены повторные запуски.

| Проверка | Результат | Реальная граница |
| :--- | ---: | :--- |
| `node --test browser-extension/*.test.js` | 388 / 388 | Реальный JS; зависимости отдельных сценариев подменены |
| `python -m unittest discover -s tests -p 'test_*.py' -v` | 34 / 34 | ML/ranking/provenance, hygiene, manifest и локальный Git |
| `node tests/product_worker_600.cjs` | 10 / 10 assertions | Реальный worker; Chrome/HTTP подменены |
| `node tests/worker_authorization_rc3.cjs` | 19 / 19 assertions | Реальный worker: режим, opt-in, вкладка, origin, Fit и запреты |
| `python tests/browser_e2e.py` | 102 / 102 assertions | Chromium DOM-фикстуры; Chrome/HTTP и финальное разрешение подменены |
| `python tests/browser_os_rc3.py` | 21 / 21 assertions | Центр управления, импорт, выбор полей, mobile; Chrome/IDB/crypto подменены |
| `python tests/browser_product_600.py` | 16 / 16 assertions | Chromium DOM; storage/crypto/Chrome подменены |
| `python tests/browser_questionnaire_rc2.py` | 8 / 8 assertions | Redirected questionnaire DOM-фикстура |
| `python tests/browser_questionnaire_3912.py` | 9 / 9 assertions | Dynamic questionnaire DOM-фикстура |
| `python tests/browser_habr_rc2.py` | 5 / 5 assertions | Habr DOM-фикстура, не живая анкета |
| `python tests/browser_avito_beta.py` | 19 / 19 assertions | Avito list/detail fixture, hover persistence, Fit/Calls, exact chat fill/send; не живой аккаунт |
| `python tests/browser_memory_399.py` | 8 / 8 assertions | Память и переходы на DOM-фикстуре |
| `python tests/browser_batch_400.py` | 6 / 6 assertions | Batch/Calls/queue на DOM-фикстуре |
| `python tests/browser_learning_520.py` | 5 / 5 assertions | Learning Center DOM-фикстура |
| `python tests/hh_read_fallback_3910.py` | 3 / 3 assertions | Reader и API fallback с подменёнными ответами |
| `node --check` | 181 JS-файл | Только синтаксис |
| `py_compile` | 32 Python-файла | Только компиляция |
| Разбор workflow YAML | 5 файлов | Синтаксис и уникальность ключей; не remote CI run |
| `python tools/check-repo-hygiene.py` | PASS | Проверены разрешённые цели source manifest |

Числа разных наборов нельзя складывать в количество независимых end-to-end пользовательских сценариев. Общий браузерный набор отдельно подменяет разрешение финальной отправки, чтобы проверить legacy-селекторы; настоящие ограничения проверены отдельными worker-assertions. Это не доказывает безопасность всех неизвестных DOM сайтов.

## Проверенные изменения

Подтверждённые ответы не заменяются автоматическими черновиками. Семантическая память соблюдает scope вакансии и reusable-флаг; параллельные записи сериализованы. Известный контакт заполняется, даже когда optional memory недоступна. Неизвестные факты, юридические согласия и неоднозначные варианты не придумываются.

Проверены native radio/select/multiselect/checkbox, dispatch событий и обнаружение потери значения после reactive reset. Автоматическое заполнение само по себе не нажимает Submit. Проверены допустимый Autopilot и отказы для отсутствующего opt-in, паузы, неподходящей категории, низкого Fit, неверной вкладки/origin и восьми видов риска.

Проверены additive migration на реалистично структурированных, но искусственных данных 5.2, сохранение неизвестных полей, повторный запуск и отказ от будущей схемы. Это **не миграция реальной личной базы пользователя**. Native IndexedDB migration/transactions в установленном extension origin не проверены.

Node/WebCrypto проверяет шифрование, неверный пароль, повреждённые данные и round-trip. Restore-plan и worker-проверки используют подменённое browser storage. Профиль/CV импортируется только после подтверждения; имеющийся CV не заменяется без отдельного выбора. Полной атомарной транзакции между Chrome local, sync и IndexedDB нет.

ML-проверки используют тестовые данные. Проверены метрики ranking/AP и guard происхождения меток. Эти результаты не означают качество персональной модели; production-модель на реальных метках в рамках этой работы не обучалась.

## Что не проверено и не объявлено PASS

| Область | Статус / причина |
| :--- | :--- |
| Живой критический маршрут HH | **NOT LIVE VALIDATED** — нет авторизованной пользовательской приёмки |
| Полный отклик и многошаговая анкета Habr | **NOT LIVE VALIDATED** — только DOM-фикстуры, провайдер BETA |
| Авторизованный Avito vacancy/chat workflow | **NOT LIVE VALIDATED** — fixture отправляет сообщение только в synthetic chat; реальный аккаунт/работодатель не использовался |
| Установленное расширение, permissions и service-worker lifecycle | **NOT VALIDATED** — DOM-исполнение не заменяет установку |
| Native IndexedDB, тысячи реальных записей, quota, crash recovery | **NOT VALIDATED** — контролируемые mocks и проверки структуры |
| .NET build/tests и запуск Windows runtime | **NOT RUN** — нет C#-исходников и .NET SDK |
| Windows publisher/verifier/vault-helper | **NOT EXECUTED ON WINDOWS** — проверены файлы/план; это не запуск PowerShell |
| GitHub Actions в пользовательском репозитории | **NOT RUN** — только локальные проверки, никакого push |
| Production ML / реальные embeddings / Gradient Boosting | **NOT TRAINED / NOT IMPLEMENTED** в заявленном полном объёме |
| Полный runtime-перенос браузерной памяти в LocalAppData | **PARTIAL** — только безопасное staging-копирование личных файлов |

## Проверка поставки

Каждый ZIP содержит `FILE_HASHES.sha256`. Внешний `Violetta-6.0.0-SHA256.txt` содержит SHA-256 архивов и сопроводительных файлов. При упаковке выполняются CRC-проверка ZIP, проверка путей/дубликатов, сверка всех файлов с manifest и отдельная проверка публичного состава. Проверка этих ZIP выполняется Python, а не несуществующим запуском Windows verifier.

SHA-256 — контроль целостности, не цифровая подпись. FULL содержит нешифрованные личные CV/профиль и предназначен только для пользователя. Публичные исходники не содержат эти файлы. Backend-бинарники сохранены из RC2; изменён только безопасный default автоматической отправки в конфигурации, исходная конфигурация сохранена в private-data.

## Приёмка

[Живой чек-лист](LIVE_ACCEPTANCE_6.0.0.md) содержит непроверенные пункты без фиктивных PASS. Полная матрица всех 52 требований, включая частично выполненные пункты: [IMPLEMENTATION_STATUS](../IMPLEMENTATION_STATUS.md). Переход в Final Production требует успешной живой проверки критического маршрута HH, а не только автоматических тестов.

## RC3 automatic cover-letter submit hotfix

- Node unit/integration: **379 / 379 PASS**.
- Python tests: **34 / 34 PASS**.
- Real worker authorization (`worker_authorization_rc3.cjs`): **19 / 19 PASS**.
- Focused Chromium one-click regression: **4 / 4 PASS**.
- Long Chromium E2E: direct HH, HeadHunter.kg, native list-card, mandatory pre-submit letter and post-response attach-letter checks passed before the runner reached its execution limit. The long suite is therefore **not** reported as a complete-suite PASS.

The focused regression verifies that the dedicated **«✦ Отклик + письмо»** control carries explicit user intent into final-action authorization, ignores unrelated required search filters, inserts the prepared vacancy-specific letter, clicks the native **«Отправить»** button, observes the modal closing, and does not emit the legacy manual-review denial.
## RC3 Send-retry hotfix · 6 октября 2026

Проверена отдельная ошибка, при которой HH оставлял форму сопроводительного письма открытой после первого нажатия **«Отправить»**. Новая логика повторно находит кнопку после reactive re-render, восстанавливает текст при сбросе поля и выполняет не более шести попыток. Успех фиксируется только после закрытия текущей формы или подтверждения внутри контекста текущей вакансии; аналогичная надпись у другой карточки игнорируется.

| Проверка | Результат | Граница |
| :--- | ---: | :--- |
| `node --test browser-extension/*.test.js` | **380 / 380 PASS** | JS unit/integration и структурные regression contracts |
| `python -m unittest discover -s tests -p 'test_*.py' -v` | **34 / 34 PASS** | Python ML/publication/hygiene tests |
| `node tests/product_worker_600.cjs` | **10 / 10 PASS** | Реальный worker, mocked Chrome/HTTP |
| `node tests/worker_authorization_rc3.cjs` | **19 / 19 PASS** | One-shot user intent и hard safety gates |
| `python tests/browser_oneclick_user_intent_rc3.py` | **PASS** | Поиск HH: первые два Send no-op, третий закрывает форму; stale success другой карточки игнорируется |
| `python tests/browser_cover_letter_retry_rc3.py` | **PASS** | Страница вакансии: два no-op клика, третий Send, сохранность письма, verified closure |
| `python tools/check-repo-hygiene.py` | **PASS** | Публичный source plan без приватных/runtime-файлов |

Эти сценарии используют Chromium DOM-фикстуры и не отправляют реальный отклик. Живая авторизованная проверка HH остаётся **NOT LIVE VALIDATED**.



## Avito Vacancies BETA validation · 6 октября 2026

Добавлен отдельный Avito-only content bundle без HH auto-submit scripts. Он распознаёт vacancy list/detail routes, использует provider-qualified item identity, читает полное объявление в неактивной вкладке, сохраняет независимые Fit и Calls, удерживает controls при hover UI и выполняет vacancy-scoped one-click message flow после явного нажатия **Письмо**.

| Проверка | Результат | Граница |
| :--- | ---: | :--- |
| `node --test extension/*.test.js` | **390 / 390 PASS** | Включает 8 Avito provider/identity/writing/manifest contracts |
| `python -m pytest -q` | **34 / 34 PASS** | Source publication, hygiene, ML/tooling after manifest refresh |
| `python tests/browser_avito_beta.py` | **19 / 19 PASS** | Synthetic Chromium list/detail pages; hover persistence, exact chat, fill/send; no login or real employer |
| `node --check extension/*.js` | **182 / 182 PASS** | Syntax only |

Avito remains **BETA / NOT LIVE VALIDATED**. The fixture verifies persistent controls, exact native **Написать** activation, feminine vacancy-specific text with confirmed contacts, composer fill, one-message send and completion verification in a synthetic chat. It does not validate an authenticated account, anti-bot states or current production DOM variants.
