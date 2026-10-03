# 3.9 release line — concise history

## 3.9.12

Smart Questionnaire Autofill получил reviewable Human Fallback Drafts для обычных свободных текстовых вопросов без подтверждённого факта. Numeric/legal/identity facts по-прежнему не угадываются.

## 3.9.11

Добавлен semantic questionnaire engine, persistent questionnaire memory, DOM-verified autofill и review gating.

## 3.9.10

Исправлено чтение полной HH-вакансии: DOM-ready hidden-tab reader + `api.hh.ru` fallback для Analysis и cover-letter preparation.

## 3.9.9

Добавлена persistent vacancy/form memory по точному `vacancyId`.

## 3.9.8

Известный modal `Отклик уже просмотрен работодателем` автоматически закрывается без ложного статуса успешной отправки письма.

## 3.9.7

Добавлен full-vacancy Analysis непосредственно из search list.

## 3.9.5

Quick-list cover letters изолированы по exact vacancy card/ID; search-page headings перестали попадать в письмо.
