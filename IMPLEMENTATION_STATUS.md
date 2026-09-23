# Статус большого ТЗ — 3.7.0

| Направление | Статус |
|---|---|
| Existing architecture reuse | Выполнено; новый repository/backend/database не создавался |
| Candidate Truth Profile | Выполнено: CONFIRMED / TRANSFERABLE / INFERENCE / UNKNOWN |
| RU/EN CV resolver | Выполнено: две версии по языку вакансии; role-CV UI удалён |
| Bundled CV | Выполнено: оба пользовательских PDF встроены |
| Vacancy/role detection | Выполнено для существующих DOM/JSON-LD/adapters; generic mode best-effort |
| Cover letter | Short vacancy-first, matched confirmed skills + relevant project; IT letters include GitHub |
| Irrelevant hospitality exclusion | Выполнено и покрыто тестом для developer letters |
| Cover Letter Memory | Выполнено: exact generated/submitted text per Application |
| `✦ Apply` | Выполнено: current-vacancy auto-apply без internal page navigation |
| Native HH list quick apply | Выполнено для synthetic current HH card/modal flow; trusted user click only |
| `✦ Fill` | Выполнено: безопасное заполнение открытой формы |
| **🚀 Main-window Autopilot** | **3.7.0:** отдельная start/stop кнопка в компактном popup + live status + score/session/day counters |
| Autopilot browser discovery | **3.7.0:** browser search default = on when preference ещё не сохранён |
| Autopilot target profile | Remote IT: development + QA + Technical Support; match threshold + junior-compatible seniority guard |
| Autopilot limits | Score threshold + daily limit + session limit; bounded concurrency |
| Autopilot high-risk stop | Salary/visa/legal/privacy/work-authorization + ambiguous required controls |
| Application registry / duplicate protection | Выполнено через существующие `vjaApplicationJob:*` |
| Live recruiter chat | Выполнено для доступного DOM; old/unlinked active chat fallback |
| Full-dialog AI action | HH current-DOM fallback reads active right-side chat; explicit user click can run one-shot AI |
| Chat SPA context stability | Harmless HH query/hash churn не считается сменой conversation |
| Recruiter Send | Всегда ручной |
| Quick Replies | Максимум пять русских built-ins + один editable primary reply |
| Follow-up / timeline / analytics | Сохранено |
| Dedicated live adapters | Частично; см. `SUPPORTED_SITES.md` |
| CAPTCHA/MFA bypass | Не реализуется |
| Encrypted backup/restore | Ещё не реализовано |
| Automated tests | См. `TEST_REPORT.md` |

Live production DOM каждой площадки требует smoke test после изменений сайта.
