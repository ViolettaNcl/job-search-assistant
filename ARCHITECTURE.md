# Architecture · 3.9.13

## Overview

Violetta Apply Assistant состоит из двух уровней:

1. **Chrome extension** — основной пользовательский runtime. Он взаимодействует с HH DOM, хранит локальную память, готовит письма, анализирует вакансии и заполняет анкеты.
2. **Optional .NET backend** — расширенный режим для dashboard, очередей, background automation и server-side analytics.

Core workflow не должен зависеть от backend availability.

## High-level flow

```text
HH page
  │
  ├─ content scripts
  │   ├─ card detection
  │   ├─ Analysis UI
  │   ├─ quick apply
  │   ├─ questionnaire content
  │   └─ recruiter chat UI
  │
  ├─ extension service worker
  │   ├─ full vacancy reader
  │   ├─ HH API fallback
  │   ├─ writing / evidence engine
  │   ├─ persistent memory
  │   └─ optional backend bridge
  │
  └─ chrome.storage
      ├─ candidate profile
      ├─ vacancy memory
      ├─ cover-letter memory
      └─ questionnaire answer memory
```

## Vacancy identity

`vacancyId` — главный ключ состояния HH-вакансии. UI карточки, Analysis, prepared application, cover letter и questionnaire state должны быть сопоставлены с одним и тем же ID.

Это предотвращает:

- смешивание соседних карточек;
- использование search heading как vacancy title;
- потерю состояния при Back/reload;
- применение письма к другой вакансии.

## Full Vacancy Reader

Полная вакансия читается через единый reliable flow:

1. exact vacancy URL / vacancy ID;
2. inactive background tab;
3. DOM readiness (`interactive`/`complete` + readable content), без жёсткого ожидания `tab.status === complete`;
4. проверка vacancy ID после navigation;
5. retry при кратковременном SPA/message-channel transition;
6. fallback на `https://api.hh.ru/vacancies/<id>`;
7. отказ от generic writing, если полное описание не подтверждено.

Один и тот же reader используется Analysis и cover-letter preparation.

## Analysis engine

`hh-list-quick-apply-core.js` содержит детерминированную классификацию phone duties.

Отдельно различаются:

- фактические обязанности звонить;
- chat/ticket work;
- техническая настройка телефонии/SIP/VoIP.

Analysis state сохраняется в vacancy memory с timestamp и источником evidence.

## Writing pipeline

```text
full vacancy
→ requirement extraction
→ candidate truth / CV evidence
→ relevance ranking
→ draft generation
→ validation
→ cover-letter memory
```

Письмо не должно заявлять неподтверждённые факты.

Основные модули:

- `candidate-truth.js`
- `candidate-seed.js`
- `relevance-engine.js`
- `writing-provider.js`
- `writing-background.js`
- `copilot-core.js`
- `copilot-background.js`

## Smart Questionnaire Autofill

Questionnaire logic разделена на небольшие модули:

- `questionnaire-core.js` — normalization, classification, semantic keys;
- `questionnaire-answer-engine.js` — evidence-first answers и human fallback drafts;
- `questionnaire-memory.js` — reusable answer memory и vacancy-scoped form state;
- `questionnaire-content.js` — DOM discovery, MutationObserver, verified writes и UI statuses.

### Answer states

- `confirmed` — ответ основан на подтверждённых данных;
- `draft/review` — нейтральный human fallback, требует проверки;
- `unknown/review` — безопасный ответ построить нельзя.

### DOM verification

Поле считается заполненным только после повторного чтения DOM и подтверждения значения. Простое присваивание `.value` недостаточно.

### Dynamic forms

MutationObserver + debounce позволяют обрабатывать поздние поля и новые steps без бесконечного повторного заполнения и duplicate UI.

## Persistent memory

Vacancy memory хранит, как минимум:

```text
vacancyId
analysis
application state
cover letter
questionnaire progress
review fields
```

Questionnaire answer memory отделяет:

- универсальные подтверждённые ответы;
- vacancy/company-specific ответы;
- reviewable drafts.

Reviewable fallback draft не должен автоматически становиться подтверждённым фактом.

## Recruiter Chat

Chat assistant читает только активный доступный DOM-диалог, связывает его с известным vacancy context, создаёт draft и не отправляет сообщение автоматически.

## Backend

Backend source находится в `src/JobSearchAssistant/`.

Он предоставляет advanced workflows и не должен дублировать core browser behavior. Release bundle содержит published runtime в `backend/`, но эта папка не публикуется в source Git repository.

## Repository hygiene

Source repository и FULL bundle намеренно имеют разную структуру:

```text
FULL bundle                 Git source
-----------                 ----------
extension/          ->       browser-extension/
backend/            X        published runtime excluded
github-source/...   ->       .github/...
test-results/       X        excluded
```

`source-sync-manifest.json` определяет точное отображение release → source. Publisher проверяет каждый hash и whitelist target.

`tools/check-repo-hygiene.py` дополнительно блокирует случайное отслеживание FULL/runtime paths.
