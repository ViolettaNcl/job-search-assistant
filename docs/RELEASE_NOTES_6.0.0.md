# Violetta Apply Assistant 6.0.0 RC3

**Дата:** 5 октября 2026. **База:** предоставленный 6.0.0 RC2. **Канал:** Release Candidate, не Final Production.

## Анкеты и факты

Устранены несколько жёстко заданных биографических ответов. Неизвестный факт не заменяется выдуманным положительным или отрицательным опытом. Подтверждённая память отделена от черновиков; юридические ответы требуют отдельной проверки. Добавлены категории языков, SLA, тикетов, timezone и ряда профессиональных вопросов.

Ответы имеют vacancy scope, историю правок и явный reusable-флаг. Запись сериализована, чтобы параллельные изменения не затирали друг друга. Подтверждённый ответ не заменяется автоматическим черновиком. Недоступность optional memory не блокирует известный контакт.

Добавлен exact-match setter для native/ARIA-контролов, группировка radio и повторная проверка значения после событий. Неоднозначный вариант остаётся ручным.

## Режимы и приватность

Добавлены Manual/Assist/Autopilot, explicit opt-in, разрешённые категории, лимит, пауза и повторная worker-проверка перед финальными действиями расширения. Свежий legacy backend appsettings больше не включает автоматическую отправку; updater не включает её принудительно.

Публичный seed и defaults очищены. CV и исходный профиль сохранены в приватной части FULL; новая установка использует проверяемый импорт. Existing profile/CV сохраняются. Файловый LocalAppData helper выполняет копирование без удаления источника.

## Данные и интерфейс

IndexedDB-зеркало с индексами и постраничным чтением, аддитивные миграции, richer backup с разрешёнными sync-настройками, проверка local/sync после restore и остановка автоматизации. Центр управления дополнен историей, режимами, импортом, follow-up, интервью и аналитикой по роли/CV/письму с n и интервалами.

Исправлено сопоставление пустых описаний и одинаковых ID на разных провайдерах. ML evaluation дополнен AP/PR-AUC и ranking metrics; real-label обучение требует явного подтверждения происхождения, synthetic/test fixtures не допускаются в production-режим.

## Документация и поставка

README переработан: навигация, реальный демонстрационный скриншот, сворачиваемые разделы и явный статус выпуска. Служебные накопленные заметки заменены актуальными руководствами. Добавлены миграция, backup/restore, диагностика, матрица 52 требований и live-чек-лист.

Пакеты разделены на персональный FULL, standalone и исходное GitHub-обновление. Генерируются SHA-256 и строгий verifier. Publisher сохраняет существующие исходники, не выполняет force-push и не публикует приватную часть FULL.


## Documentation refresh

The RC3 documentation was reorganized into a bilingual, architecture-first presentation. The main README now includes English and Russian product views, an animated local workflow asset, GitHub-native Mermaid diagrams, explicit truth/safety and data-boundary models, automation modes, release gates and a concise documentation index.

`ARCHITECTURE.md`, `SECURITY.md`, `TESTING_GUIDE.md`, privacy, feature and repository-layout documentation were expanded with system/data-flow diagrams and clearer distinctions between implemented, automated-tested, live-validated and production-ready states. Duplicate release-detail content remains linked from canonical reports rather than repeated in the README.

## RC3 hotfix · автоматический one-click отклик с письмом

Исправлен regression в HH list-card и direct-vacancy flow. Явный клик пользователя по **«✦ Отклик + письмо» / Apply** теперь несёт ограниченный one-shot submit intent до штатной кнопки **«Отправить»**. Расширение не останавливается на сообщениях «Письмо сохранено» или «Автоматическая отправка не разрешена», если активная HH-форма безопасна и относится к выбранной вакансии.

Перед отправкой используется полное описание вакансии через background reader / HH API fallback. Письмо строится из релевантных подтверждённых фактов CV/профиля, включает только обоснованные ключевые термины вакансии, остаётся коротким и не выдумывает коммерческий опыт, навыки, работодателей или юридические сведения. Поддержаны обязательное письмо до отклика и позднее «Приложить письмо» после отправки резюме. После подтверждения Send модальное окно закрывается автоматически.

Submission guard теперь проверяет активную application/cover-letter область, а не всю страницу поиска: пустой обязательный фильтр поиска больше не считается неизвестным фактом анкеты. Global pause продолжает блокировать фоновую автоматизацию, но не отменяет один конкретный submit, который пользователь уже подтвердил специальной кнопкой. Hard safety gates остаются fail-closed.

Проверки hotfix: `379/379` Node tests, `34/34` Python tests, `19/19` real-worker authorization checks и focused Chromium regression (`4/4`). В длинном Chromium E2E до ограничения времени прошли direct HH, HeadHunter.kg, native list-card, mandatory pre-submit letter и post-response attach-letter сценарии. Полный длинный suite не считается завершённым PASS; live authenticated HH validation всё ещё ожидается, поэтому это RC3, а не Final Production.

## Известные ограничения

Нет живой приёмки HH/Habr/Avito, native extension-origin проверки и пересборки .NET. Полный filesystem vault runtime, native IndexedDB end-to-end, embeddings, Gradient Boosting, production personal training и все 52 требования в полном объёме не завершены. Конкретные границы перечислены в IMPLEMENTATION_STATUS, а выполненные команды — в test report.
## RC3 hotfix · verified Send retry

HH can occasionally keep the cover-letter modal open after the first native **Send** click. The one-click workflow now re-resolves the current modal/button after reactive re-renders, restores the prepared letter if HH reset the field, retries the same user-authorized action up to six times, and marks success only after the current form closes or a letter-sent signal appears inside the current vacancy context. A stale success label from another search card is ignored.

The retry is bounded and vacancy-scoped. It does not grant background Autopilot a broader permission and it does not continue through CAPTCHA, legal, identity, payment, unknown-required-fact or unresolved-review stops. The compact HH action label **«Приложить письмо»** is now recognized in addition to the longer wording.



## Avito Vacancies BETA · one-click message update · 6 октября 2026

Avito-карточки и detail page получили отдельный provider bundle: точная provider-qualified идентичность объявления, page/card analysis, background full-vacancy read, независимые Fit и Calls, фильтры и vacancy-specific письмо. Внедрённые Analysis/Письмо/Fit/Calls сохраняются при hover-перерисовке карточки, когда Avito показывает собственное действие **Написать**.

Одно явное нажатие **Письмо** теперь разрешает ровно одно сообщение по выбранной вакансии. Агент читает полное объявление, выбирает подтверждённые релевантные факты CV/профиля, нормализует русский текст в женском роде, добавляет подтверждённые Telegram/email, активирует штатную кнопку **Написать**, проверяет exact chat, вставляет текст и нажимает живой send control. Успех фиксируется только после очистки composer или появления сообщения; reactive re-render/ignored click обрабатывается ограниченным retry до шести попыток.

Avito не использует HH auto-submit scripts и не получает фоновую массовую рассылку. Если exact chat/composer/send, CAPTCHA, identity/payment/upload state нельзя подтвердить, flow останавливается и сохраняет подготовленный текст. Авторизованный аккаунт и все варианты текущего DOM ещё не прошли live validation, поэтому состояние провайдера — **BETA / NOT LIVE VALIDATED**.

Проверки текущего дерева после chat-send hotfix: **390/390 Node**, **34/34 Python**, **19/19 Avito Chromium fixture assertions**. Fixture подтверждает list/detail controls, hover persistence, Fit/Calls separation, vacancy-specific feminine text, обязательные Telegram/email, exact native Write activation, composer fill, one-message send и completion verification; реального работодателя тест не затрагивает.

## Avito chat-send fallback hotfix · 7 октября 2026

Добавлена явная кнопка **«Отправить в чат»** в fallback-окне подготовленного Avito-письма. Это закрывает сценарий, когда письмо уже создано, но текущий DOM Avito не позволил первой автоматической попытке найти или открыть native **«Написать»**. Кнопка сохраняет отредактированный текст, повторно связывается с точной вакансией, открывает matching chat, заполняет composer, нажимает native send и закрывает окно после подтверждения. Если exact chat уже открыт, используется он. Ошибка не скрывается: окно остаётся доступным для повторной попытки или копирования.

## RC3 HH Feeds · homepage recommendations

Base: AVITO-CHAT-SEND-HOTFIX. Added card-driven list detection for the HH homepage and its recommendation collections, including headhunter.kg. The existing batch, Fit/Calls, single-card analysis and user-initiated apply-with-letter paths are reused. Native hidden panels are excluded; late cards, DOM recycling and route changes are handled without broadening submit permissions. Avito, letter generation and private profile/CV files are unchanged.

[Behavior](HH_FEEDS.md) · [Current-build verification](HH_FEEDS_TEST_REPORT.md). This remains RC3 / not live-validated.
