# Privacy and Local Data

Violetta Apply Assistant хранит часть кандидатского контекста локально в расширении и использует его для писем, анкет и recruiter-chat drafts.

## Что может находиться в проекте

В FULL bundle могут присутствовать:

- CV assets;
- Candidate Truth / candidate seed;
- локальные настройки и memory.

## GitHub visibility

Если repository временно становится public, учитывайте, что любые уже tracked CV/candidate files становятся публично доступными. Переключение repository обратно в private не отменяет факт предыдущей публикации и не удаляет копии, которые могли быть скачаны.

Для полностью public-safe open-source варианта рекомендуется в будущем вынести личный профиль и CV из source tree в локальный импортируемый vault.

## Секреты

Не коммитьте:

- API keys;
- `.env`;
- `user-settings.cmd`;
- `candidate.private.json`;
- `appsettings.local.json`.

Эти пути блокируются publisher/hygiene rules.
