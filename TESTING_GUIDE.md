# Проверки

Актуальные числа и ограничения: [отчёт 6.0.0](docs/TEST_REPORT_6.0.0.md).

В FULL используйте `extension`; в исходниках — `browser-extension`.

```bash
node --test extension/*.test.js
node tests/product_worker_600.cjs
node tests/worker_authorization_rc3.cjs
python -m unittest discover -s tests -p 'test_*.py' -v
python tests/browser_os_rc3.py
python tests/browser_e2e.py
python tools/check-repo-hygiene.py
```

Для Chromium-фикстур нужны Python Playwright и установленный Chromium. Остальные браузерные сценарии находятся в `tests/browser_*.py`, fallback — в `tests/hh_read_fallback_3910.py`. В исходном репозитории workflow предоставляет нужные зависимости; наличие workflow не означает его успешный remote run.

## Границы тестов

Node-тесты выполняют assertions над реальным JS, в том числе WebCrypto. Worker-bridge выполняет сервисный код с подменёнными Chrome API / HTTP. Chromium использует настоящий DOM, но без авторизации на реальных сайтах и без установленного extension origin. Legacy `browser_e2e.py` отдельно подменяет разрешение финальной отправки для проверки прежних селекторов; настоящая политика проверяется `worker_authorization_rc3.cjs`.

Нельзя складывать Node, Python и DOM-проверки в одно число независимых end-to-end сценариев. Статический syntax/YAML check тоже не заменяет функциональный тест.

Native IndexedDB, живой HH/Habr, Windows publisher и .NET имеют самостоятельные статусы. Отсутствие инструмента не равно PASS. Ручной чек-лист: [LIVE_ACCEPTANCE_6.0.0.md](docs/LIVE_ACCEPTANCE_6.0.0.md).
