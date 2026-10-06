# Модель данных

| Сущность | Ключ / идентификатор |
| --- | --- |
| Подтверждённый профиль | `vjaCandidateTruthProfile` |
| CV | `cvVaultRu`, `cvVaultEn` |
| Анализ вакансии | `vjaVacancyIntel:<id>` |
| Решение Save / Skip | `vjaVacancyDecision:<id>` |
| Отклик | `vjaApplicationJob:<id>`; plan + context + timeline |
| Ответ анкеты | `vjaQuestionnaireMemoryV1`; semantic key + vacancy scope |
| Learning | `vjaLearningEventsV1`, datasets, feature flags |
| Registry | `vjaModelRegistryV1`; отдельные activeModels по target |
| Глобальный режим | `vjaAutomationPolicyV1` |
| Product migration | product schema 3, запись последней миграции |
| IndexedDB | `violetta-product`, version 2: checkpoints / meta / records |

Records — зеркало payload с индексами collection, vacancyId, company, title, createdAt, analyzedAt, appliedAt, updatedAt, status, fitScore, outcome, source, canonicalFingerprint и compound collectionUpdated.

Идентификатор вакансии и canonicalFingerprint имеют разные роли. Совпадение числового ID на HH, Habr и Avito само по себе не означает одинаковую вакансию. Для Avito ключи памяти используют форму `avito:<itemId>`. Полная семантическая cross-site identity ещё не завершена.

Unknown поля legacy-объектов не удаляются миграцией. Время фиксируется числовыми timestamps; аналитика отсутствующих событий не должна создавать несуществующие действия.
