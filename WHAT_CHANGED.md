# Violetta Apply Assistant 3.7.0

## 🚀 Автопилот вынесен в главное окно

- В компактном окне расширения появилась отдельная заметная кнопка **`🚀 Запустить автопилот`**. Больше не нужно открывать прежнюю advanced-панель, чтобы включить агента.
- Кнопка показывает состояние `работает / выключен / нет связи`, а также порог соответствия, лимит текущей сессии и дневной лимит.
- Повторное нажатие останавливает автопилот.
- Запуск остаётся **явным пользовательским действием**. Если backend не запущен, окно прямо предлагает запустить `start-assistant.cmd`.
- При первом запуске browser-discovery теперь по умолчанию действительно включён, даже если старый профиль ещё не сохранил `vjaHhBrowserSearch`.

## Что делает агент после запуска

```text
🚀 пользователь запускает автопилот
  → ищется очередь/HH search
  → vacancy анализируется и получает match score
  → проверяется уровень и IT-направление
  → Middle/Senior/Lead/Manager и нерелевантные роли пропускаются
  → проверяется remote-фильтр
  → для подходящей vacancy создаётся короткое vacancy-specific письмо
  → IT-письмо содержит https://github.com/ViolettaNcl
  → вакансия открывается в фоновой вкладке
  → existing application executor отправляет отклик
  → подтверждённый результат записывается в Application Registry/Cover Letter Memory
  → неоднозначные обязательные поля останавливают только текущую вакансию для проверки
```

В дефолтный IT-target добавлены не только C#/.NET/Backend/Full-Stack/QA Automation, но также **Manual QA** и **Technical Support**. Match score и фактические требования вакансии по-прежнему используются как дополнительный фильтр.

## Сохранено из 3.6.1

- `✦ Apply` — автоотклик по текущей открытой вакансии без перехода на внутреннюю страницу расширения.
- Native HH list quick apply: пользователь нажимает `Откликнуться`, после чего ассистент добавляет vacancy-specific cover letter без открытия detail page, если HH flow однозначен.
- `✎ AI → 🧠 Проанализировать весь диалог и ответить` — current-chat analysis с DOM fallback для текущей HH-разметки.
- Recruiter Send остаётся ручным.
- RU/EN bundled CV, Cover Letter Memory, до пяти русских Quick Replies, follow-up/timeline/analytics.
- High-risk salary/visa/legal/privacy/work-authorization поля не заполняются выдуманными значениями.
- Backend startup fix: `127.0.0.1`, diagnostics, persistent SQLite и без auto-open dashboard.
