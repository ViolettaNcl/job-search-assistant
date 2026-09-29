# Violetta Apply Assistant — Chrome extension 3.9.9


## Persistent vacancy memory + form continuation (3.9.9)

Search-card state is no longer DOM-only. Analysis and application progress are restored by the exact vacancy ID. A quick-list job is persisted before navigation, so an HH questionnaire can resume in the same tab and fill confirmed candidate data automatically. Unknown/high-risk answers remain marked for review and final submission stays user-controlled.


## HH already-viewed guard (3.9.8)

When HH refuses a late cover letter with `Отклик уже просмотрен работодателем`, the list quick-apply flow closes that exact modal automatically and marks the card `✓ Уже просмотрен`. It does not auto-close unrelated send failures.

## Inline Analysis on HH search cards

Each eligible vacancy card now has `Analysis` next to `✦ Отклик + письмо`. The analysis is tied to the exact vacancy ID, opens that exact vacancy in an inactive background tab, reads the full DOM, verifies the ID, and closes the tab automatically. It returns `✓ Без звонков` or `✕ Есть звонки`; if the full page and HH API both fail, it shows `↻ Повторить` instead of guessing. Analysis itself never submits an application.


Единая память кандидата по CV и подтверждённым владельцем данным HH, отбор фактов по вакансии, короткие сопроводительные письма и ответы на последнее сообщение работодателя.

## Основные действия

- **✦ Apply** и **🚀 Автопилот** используют полное прочитанное описание вакансии и один механизм отбора подтверждённых фактов.
- **✎ AI → Проанализировать весь диалог** читает доступные сообщения активной переписки, отличает участников и показывает, на какое сообщение готовит ответ. Сообщение не отправляется автоматически.
- **Настройки → Память кандидата** показывает источник каждого факта; новые структурированные данные импортируются только после предварительного просмотра и подтверждения.
- **Настройки → AI и ответы → Генерация текста**: локальный режим работает без API; для свободной переформулировки и сложных вопросов нужен подключённый совместимый Chat Completions API, модель и ключ. Локальный ответ не выдаётся за ответ модели.

Исходники на GitHub находятся в `browser-extension/`; в Windows-сборке это та же папка под именем `extension/`. Загружайте в Chrome только одну из них, согласно используемой установке.

Подробнее: [стратегия](../docs/WRITING_STRATEGY_3.8.md), [архитектура](../ARCHITECTURE.md), [проверки](../TESTING_GUIDE.md), [ограничения площадок](../SUPPORTED_SITES.md).

Никаких обещаний обхода AI-детекторов или фильтров ATS. Текущие сведения о Technical Support / Integration Support предоставлены владельцем; название работодателя хранится как source metadata, но не вставляется в сопроводительное письмо. Автоматической проверки трудоустройства нет. Исходные PDF не переписываются.

## Exact list-card context (3.9.7)

On HH/HeadHunter search results, every injected `✦ Отклик + письмо` control is bound to one vacancy ID. The extension reads the full linked vacancy in the background before writing. Search headings such as `Найдено N вакансий` are rejected and cannot seed a cover letter. If identity cannot be confirmed, the flow stops instead of sending a generic draft.
