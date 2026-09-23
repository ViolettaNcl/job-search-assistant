# Testing guide — 3.7.0

## Автоматические проверки

Node 22+:

```powershell
$tests = Get-ChildItem .\extension\*.test.js | Select-Object -ExpandProperty FullName
foreach ($test in $tests) {
  node $test
  if ($LASTEXITCODE -ne 0) { throw "Failed: $test" }
}
```

Synthetic Chromium fixture:

```powershell
python -m pip install playwright
python -m playwright install chromium
python .\tests\browser_e2e.py
```

Fixture test использует mocked Chrome/HTTP boundary и не открывает реальные employer accounts.

## Ручная приёмка Windows

1. **Update.** `UPDATE_EXISTING.cmd` → старая папка → Reload existing extension → refresh job/chat tabs. Version должна быть `3.7.0`.
2. **Profile/CV.** Проверить email, Telegram, phone, confirmed facts и две версии CV: RU/EN.
3. **Safe Fill.** Имя/email заполняются; salary/years/legal не угадываются; final Submit не нажимается.
4. **Main Apply.** На тестовой вакансии нажать `✦ Apply`: основной маршрут должен сразу запускать автоотклик в текущей вкладке. Unique final button нажимается только после успешного preflight; high-risk/неоднозначное поле останавливает отправку.
5. **High-risk precheck.** Prechecked privacy/terms/work authorization без реального пользовательского подтверждения должен остановить auto-submit.
6. **Quick reply.** Сообщение «рассмотрим резюме» → кнопка `Спасибо, буду ждать`; текст с `@Violet111` и email вставляется, Send не нажимается.
7. **✎ AI.** Проверить improve / answer all / recruiter question и chat isolation A→B.
8. **Explicit feedback deadline.** В тестовом чате сообщение «дадим обратную связь через 2–3 дня» или «до пятницы» → в `Мои отклики` появляется next action.
9. **No invented deadline.** Сообщение «мы рассмотрим резюме» без срока → автоматический deadline не создаётся.
10. **Manual follow-up.** Для Applied/Viewed/Recruiter Replied без next action нажать `Напомнить через 3 раб. дня`.
11. **Reminder actions.** Проверить `Готово` и `+1 день`; badge должен уменьшаться после закрытия просроченного action.
12. **Tracker.** Новый inbound должен позволить статусу перейти к `Recruiter Replied`; detected stage показывается отдельно.
13. **Analytics.** В popup числа по funnel/CV/roles должны соответствовать сохранённым application statuses и Timeline.
14. **Permissions.** На новом домене доступ появляется только после явного `Включить для этого сайта`.
15. **Autopilot disabled.** При выключенном автопилоте background timer не должен отправлять вакансии.
16. **Autopilot main button.** В обычном компактном popup должна быть отдельная `🚀 Запустить автопилот`; после нажатия она меняется на `⏹ Остановить автопилот`, а status показывает threshold/session/day counters.
17. **Autopilot enabled.** Задать высокий порог и session limit 1; проверить, что выбирается только remote IT vacancy подходящего уровня, открывается фоновая vacancy tab и один автоматический отклик содержит короткое письмо под вакансию.
18. **Autopilot level/role guard.** Explicit Middle/Senior/Lead/Manager должен пропускаться; Junior .NET / QA / Technical Support может пройти только при достаточном match score.
19. **Autopilot stop.** Нажать `⏹ Остановить автопилот` и убедиться, что новые автоматические отправки прекращаются.
20. **Real-site smoke test.** Каждый новый live site сначала проверять через `✦ Fill`, затем отдельной небоевой формой проверять Auto Apply.

## Не считать подтверждённым этими тестами

- все production DOM-варианты HH/LinkedIn/Indeed/Workday и других ATS;
- CAPTCHA/MFA;
- closed Shadow DOM/canvas chat;
- нестандартные custom editors/datepicker;
- внешний AI provider;
- выполнение Windows updater/backend в Linux test environment.

Фактические результаты — `TEST_REPORT.md`.


## 3.5.1 regression

- Проверить, что main `✦ Apply` маршрутизируется в `auto-apply`, а не в safe prepare.
- Проверить отсутствие `popup.html?auto=1` в основном маршруте.
- Проверить наличие обоих bundled PDF и `%PDF-` header.
- Открыть старый/unlinked recruiter chat: `✎ AI` должна отображаться и создавать draft без выбора вакансии.
- Quick Replies: только русские personal templates; стандартный feedback reply содержит Telegram/email и заметку про обычный звонок.
- Settings: Profile, RU/EN CV, AI/replies, Auto Apply и developer tools разделены; role-specific CV section отсутствует.
- Cover letter: developer test must contain a relevant technical project/stack and must not contain Crowne Plaza / Front Desk.
- Quick Replies: built-in library is capped at five.
- Autopilot: disabled stays idle; enabled mode respects programming/seniority/remote filters and session/daily limits.

## 3.6.1 regression retained

- `✎ AI` → `🧠 Проанализировать весь диалог и ответить` должен прочитать >0 сообщений в текущем HH-чате даже без старых message data-qa selectors. Явный click должен работать без обязательного перехода в Settings; late Chat A response после переключения в Chat B отбрасывается.
- На HH search list нажать native `Откликнуться`: preparation должна стартовать сразу, а при появлении `Приложить письмо` текущий modal/popup editor (включая `bloko-modal`) должен заполниться/отправиться для той же vacancy ID без открытия detail page.
- Programmatic click/autopilot не должен дублировать HH list shortcut.
- IT vacancy cover letter содержит `https://github.com/ViolettaNcl`, релевантный technical project/stack и не содержит Crowne Plaza / Front Desk для developer role.
- Settings → Автоотклик содержит toggle для list quick cover letter.
- Изменение HH SPA query/hash в том же чате не должно само по себе давать `Контекст страницы изменился`; переключение на другой conversation по-прежнему отбрасывает late AI response.



## 3.7.0 regression

- `home.html` contains one prominent `🚀 Запустить автопилот` control and a compact live status area.
- Main-window start/stop uses `/api/settings/autoapply` and wakes the existing background worker; no second automation engine is created.
- Background accepts control wake from extension-owned `home.html` and `popup.html`, not arbitrary pages.
- `vjaHhBrowserSearch` defaults to browser discovery when the preference is absent.
- Default target set includes development, QA and Technical Support; explicit Middle/Senior/Lead/Manager titles are rejected.
- Existing `✦ Apply`, HH list quick cover letter and recruiter `✎ AI` flows remain unchanged by the rocket UI.
