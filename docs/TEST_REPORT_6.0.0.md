# Violetta Apply Assistant 6.0.0 RC3 — отчёт проверок

**Дата:** 5 октября 2026. **База:** предоставленный архив 6.0.0 RC2.  
**Статус:** Release Candidate — **NOT LIVE VALIDATED**, не Final Production.

## Среда и итог

Linux; Node.js 22.16.0; Python 3.13.5; Chromium 144.0.7559.96; Python Playwright. Проверки выполнялись локально, без авторизации в HH/Habr и без отправки откликов. Windows PowerShell и .NET SDK в среде отсутствовали; C#-исходников в предоставленном архиве нет.

Базовая версия: **325 Node-тестов, 325 успешных**. После изменений: **367 Node-тестов, 367 успешных, 0 проваленных, 0 пропущенных**. Python: **34 теста, 34 успешных, 0 пропущенных**. Промежуточные ошибки не были объявлены успешными: после исправлений выполнены повторные запуски.

| Проверка | Результат | Реальная граница |
| :--- | ---: | :--- |
| `node --test extension/*.test.js` | 367 / 367 | Реальный JS; зависимости отдельных сценариев подменены |
| `python -m unittest discover -s tests -p 'test_*.py' -v` | 34 / 34 | ML/ranking/provenance, hygiene, manifest и локальный Git |
| `node tests/product_worker_600.cjs` | 10 / 10 assertions | Реальный worker; Chrome/HTTP подменены |
| `node tests/worker_authorization_rc3.cjs` | 15 / 15 assertions | Реальный worker: режим, opt-in, вкладка, origin, Fit и запреты |
| `python tests/browser_e2e.py` | 102 / 102 assertions | Chromium DOM-фикстуры; Chrome/HTTP и финальное разрешение подменены |
| `python tests/browser_os_rc3.py` | 21 / 21 assertions | Центр управления, импорт, выбор полей, mobile; Chrome/IDB/crypto подменены |
| `python tests/browser_product_600.py` | 16 / 16 assertions | Chromium DOM; storage/crypto/Chrome подменены |
| `python tests/browser_questionnaire_rc2.py` | 8 / 8 assertions | Redirected questionnaire DOM-фикстура |
| `python tests/browser_questionnaire_3912.py` | 9 / 9 assertions | Dynamic questionnaire DOM-фикстура |
| `python tests/browser_habr_rc2.py` | 5 / 5 assertions | Habr DOM-фикстура, не живая анкета |
| `python tests/browser_memory_399.py` | 8 / 8 assertions | Память и переходы на DOM-фикстуре |
| `python tests/browser_batch_400.py` | 6 / 6 assertions | Batch/Calls/queue на DOM-фикстуре |
| `python tests/browser_learning_520.py` | 5 / 5 assertions | Learning Center DOM-фикстура |
| `python tests/hh_read_fallback_3910.py` | 3 / 3 assertions | Reader и API fallback с подменёнными ответами |
| `node --check` | 177 JS-файлов | Только синтаксис |
| `py_compile` | 29 Python-файлов | Только компиляция |
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
