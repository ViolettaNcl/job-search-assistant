# Testing — 6.0 RC1

In source clone, extension path is browser-extension; in FULL it is extension.

```sh
node --test browser-extension/*.test.js
node tests/product_worker_600.cjs
python -m unittest discover -s tests -p 'test_*.py' -v
python tests/browser_product_600.py
python tests/browser_memory_399.py
python tests/browser_questionnaire_3912.py
python tests/browser_batch_400.py
python tests/hh_read_fallback_3910.py
python tests/browser_learning_520.py
python tests/browser_e2e.py
python tools/check-repo-hygiene.py
```

Browser tests require Playwright and Chromium. Product browser tests use explicit Chrome/IDB/crypto boundary mocks. Native WebCrypto encrypt/decrypt/tamper behavior is covered separately in Node. Worker integration uses actual background JS with mocked Chrome/HTTP, not live HH.

The Test Report lists exactly which commands completed and which failed/timed out. A timeout is not reported as a clean pass. No .NET rebuild or Windows PowerShell execution is implied by Python publication-plan tests.
