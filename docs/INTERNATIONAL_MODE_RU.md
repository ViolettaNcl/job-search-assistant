# Международный режим: как должна работать система

## Цель

Не ограничиваться HH и российскими работодателями. Job Assistant должен быть единой CRM для вакансий по всему миру: США, Канада, Великобритания, Европа, Австралия и worldwide remote.

## Источники в версии 2

### HeadHunter

- Поиск вакансий.
- OAuth соискателя.
- Импорт уже сделанных откликов.
- Официальная отправка отклика, когда API это разрешает.

### Remotive

- Публичный API международных remote-вакансий.
- Не требует ключа.
- Вакансия сохраняется с attribution `Remotive` и ссылкой обратно на источник.
- Публичный feed может быть задержан примерно на сутки относительно live-площадки.

### Adzuna

- REST API международного агрегатора.
- Требует бесплатные/выданные разработчику `app_id` и `app_key`.
- Позволяет искать вакансии по country endpoint.
- В конфигурации по умолчанию добавлены US, UK, DE, CA, AU, FR, NL, PL.

## Почему система не делает blind auto-apply на каждом сайте

У разных площадок разные правила и технические модели.

- LinkedIn запрещает неавторизованных ботов/скраперы и автоматизированные действия.
- Wellfound предназначен для использования кандидатом через собственный интерфейс; массовая несанкционированная автоматизация создаёт риск блокировки.
- Greenhouse Job Board API позволяет публично читать вакансии, но endpoint отправки требует Job Board API Key работодателя.
- Lever умеет программно принимать application, но POST API требует API key конкретного Lever-аккаунта работодателя.
- Ashby публично предоставляет job-posting feed, а полноценные write/application API используют credentials организации.

То есть соискатель не получает универсальный API-key, позволяющий законно «рассылать резюме во все компании».

Правильная архитектура:

```text
Global sources / job boards / company careers
                 ↓
             Collectors
                 ↓
        Cross-source deduplication
                 ↓
        Match + eligibility scoring
                 ↓
             PostgreSQL
          ↙               ↘
     Telegram           Dashboard
          ↓
  official apply URL / supported API
          ↓
  mark as Applied + never duplicate
```

## Eligibility filter

Для международной вакансии Match Score — недостаточно. Нужна отдельная оценка `Eligibility`.

Примеры:

- `Remote worldwide`, `Anywhere`, `Global` → Eligible.
- `Visa sponsorship`, `relocation support` → Eligible/priority if relocation is acceptable.
- `Remote US only`, `must be authorized to work in the US`, `no sponsorship` → Likely ineligible.
- `Remote Europe/EMEA` → Verify: нужно проверить допустимые страны найма.
- Просто `Remote` без списка стран → Verify.

Фильтр не должен утверждать юридическую возможность трудоустройства — он только убирает очевидно неподходящие вакансии и просит проверить условия работодателя.

## Дедупликация

Система хранит:

1. `source + externalId` — точный дубль в одном источнике;
2. `CanonicalFingerprint(company + title + location)` — похожая вакансия, найденная через несколько агрегаторов;
3. глобальную Company entity по нормализованному названию — поэтому история одной компании видна даже при разных источниках.

При новой вакансии той же компании система не блокирует её автоматически, но показывает предыдущие отклики.

## Рекомендуемые следующие адаптеры

### Phase 3

- Greenhouse public job-board reader для списка выбранных компаний.
- Lever public postings reader для выбранных компаний.
- Ashby public job-board reader.
- Список `Watched Companies`: компания + ATS + board token/site slug.

Это даст прямые вакансии с карьерных страниц компаний, а не только агрегаторов.

### Phase 4

- CV variants: `.NET Backend`, `.NET Full-Stack`, English ATS CV.
- Автоматический выбор подходящей версии CV.
- Cover letter draft на языке вакансии.
- User approval перед внешней отправкой.

### Phase 5

- Email application adapter для компаний, которые официально принимают CV по email.
- Calendar reminders для интервью.
- Import replies/notifications from email with explicit account connection.

## США

Для США система должна искать две категории отдельно:

1. **Remote worldwide / international contractor** — приоритет.
2. **US on-site / hybrid with explicit visa sponsorship or relocation** — отдельная очередь.

Обычные `Remote US` без sponsorship не стоит автоматически считать международно-доступными.
