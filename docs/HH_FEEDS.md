# HH recommendation feeds · Подборки на главной HH

**Build:** `6.0.0 RC3 HH Feeds | Avito One-Click Message BETA`  
**Base:** `6.0.0 RC3 AVITO-CHAT-SEND-HOTFIX`  
**Status:** implemented and fixture-tested; authenticated HH homepage acceptance is still pending.

## English

The HH list tools are no longer limited to `/search/vacancy`. When a supported HH page renders actual vacancy cards, the homepage feed receives the same **Analysis**, **Apply + letter**, **Match**, **Calls** and page-analysis toolbar. This covers the *For you*, *Near home*, *Part-time*, *Shift work*, youth and remote-work collections shown on the homepage.

`Analyze page` analyzes the cards loaded in the currently active collection. It does not browse every result page, scroll the entire site automatically or submit applications. The existing batch concurrency and page limit remain unchanged (default: three parallel reads, up to 80 unique vacancies per run). Newly loaded cards receive controls automatically; run the page analysis again to include them. Stored full-vacancy results are reused by vacancy ID.

A card preview is not treated as a full vacancy description. Analysis and cover-letter preparation use the existing full-description reader / HH API fallback. No result is fabricated from the feed title or tab label. A single **Apply + letter** click enters the existing vacancy-bound native HH flow, including the final Send step and existing bounded retry/verification. CAPTCHA and other review stops are unchanged.

### Lifecycle and identity

`hh-list-surfaces.js` is shared by the quick-apply UI and page adapter; the batch toolbar delegates to the same detection. Discovery uses validated HH vacancy links and a single vacancy ID per card, rather than generated CSS alone. Isolated title wrappers, whole-list containers, other websites and direct vacancy/chat/form routes cannot be selected as recommendation cards.

Native tab switches, appended cards, removed controls, Back/Forward and route-only changes are handled. Hidden native panels are excluded from the active batch. A recycled DOM node loses its old controls and memory flags when its vacancy ID changes. Delayed results for the old ID are not painted onto the new vacancy. A tab switch during application preparation stops before clicking a different card.

### Scope of changes

Avito-specific modules, the cover-letter generator, confirmed profile/CV data, browser storage schemas, background submit policy and Windows runtime are unchanged. The shared site adapter contains one new HH-only route classification; its Avito branch is untouched. The extension version remains `6.0.0` (RC3); `version_name` identifies this feature build. No additional host permissions are requested.

## Русский

На главной HH, включая `headhunter.kg`, доступны те же кнопки, что и в поиске: **Analysis**, **«Отклик + письмо»**, **процент Match**, **«Есть звонки / Без звонков / Неясно»** и **Analyze page**. Они появляются у карточек активной подборки: «Для вас», «У дома», «Подработка», «Вахта», возрастные подборки и «Удалённая работа».

**Analyze page — анализ загруженных вакансий текущей подборки**, а не автоматический обход всех страниц сайта. Существующие ограничения сохранены: по умолчанию до 80 уникальных вакансий, три параллельных чтения. Подгруженные карточки получают кнопки сами; повторный запуск анализа учитывает их и использует сохранённые результаты.

Одна кнопка **«Отклик + письмо»** использует прежний процесс: чтение полной вакансии → письмо по подтверждённым релевантным сведениям CV → штатный отклик HH → отправка письма → проверка результата. Общий анализ страницы ничего не отправляет. Женский род, контактные данные из профиля, правила упоминания GitHub и отсутствие утверждений о текущей занятости не менялись.

При переключении вкладок, перерисовке карточек и возвращении назад результаты привязаны к ID вакансии. Если подборка изменилась во время подготовки отклика, агент не нажимает кнопку другой вакансии. Проверки CAPTCHA, обязательных неизвестных фактов и остальных опасных действий сохранены.

## Install / Update

1. Export a backup from the existing extension / Сохраните резервную копию через расширение.
2. Replace files in the **same extension directory** / Замените файлы в **той же папке установленного расширения**. FULL uses `extension/`; source checkout uses `browser-extension/`.
3. Reload the existing extension card, then reload the already-open HH pages / Обновите существующую карточку расширения и затем перезагрузите открытые страницы HH.
4. Check the displayed build name above / Проверьте название сборки. Do not install a second copy / Вторую копию устанавливать не нужно.

## Verification

Automated commands and boundaries are in [HH_FEEDS_TEST_REPORT.md](HH_FEEDS_TEST_REPORT.md). The DOM fixtures reproduce the supplied layout and several selector variants; a screenshot is not a live DOM capture. A real authenticated homepage smoke test is still required before claiming live validation.

## GitHub publication

Use only the **HH-FEEDS-GITHUB-UPDATE** package. `scripts/Publish-HH-Feeds.ps1 -SourcePath <source root> -Push` verifies `HH_FEEDS_SOURCE_MANIFEST.json`, creates a new checkout, stages only verified source paths and compares the remote commit after pushing. It never deletes an existing checkout or publishes FULL/CV/runtime folders. A stopped operation is not reported as a successful publication. Hashes check package integrity, not a digital signature or GitHub account ownership.
