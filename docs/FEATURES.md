# Feature Reference

## Core extension

| Функция | Статус | Примечание |
|---|---|---|
| HH search-card integration | Ready | Работает на поддерживаемых HH/HeadHunter hosts |
| Full vacancy reader | Ready | Hidden DOM + HH API fallback |
| Call-duty Analysis | Ready | Vacancy-ID bound |
| Quick apply + cover letter | Ready | Vacancy-specific evidence |
| Employer-already-viewed handling | Ready | Автозакрытие только известного терминального modal |
| Persistent vacancy memory | Ready | Analysis/application/form state по vacancyId |
| Smart Questionnaire Autofill | Ready | Semantic question classification |
| Human fallback drafts | Ready | Только reviewable non-factual free text |
| Questionnaire answer memory | Ready | Подтверждённые универсальные ответы |
| Recruiter Chat Assistant | Ready | Draft only, без automatic Send |
| Bundled RU/EN CV selection | Ready | Локальные CV assets |
| External AI provider | Optional | Через extension settings |

## Advanced backend

| Функция | Статус |
|---|---|
| Local dashboard | Available |
| Application queue | Available |
| Browser Autopilot | Available |
| Analytics / follow-up workflows | Available |

## Safety boundaries

Расширение специально останавливается или переводит поле на review, если нельзя надёжно подтвердить значение. Это относится к юридическим данным, точным числовым ожиданиям, work authorization и другим проверяемым фактам.

## Не является гарантией

Проект не гарантирует:

- приглашение на интервью;
- прохождение ATS;
- отсутствие изменений production DOM HH;
- прохождение CAPTCHA/MFA без участия пользователя.
