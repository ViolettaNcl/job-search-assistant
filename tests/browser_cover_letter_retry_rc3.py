"""Focused RC3 regression for a stubborn HH cover-letter modal.
The first two native Send clicks intentionally leave the modal open. The extension
must re-find the current button, preserve the letter, click again, verify the
modal closed, and return a confirmed result. No live HH traffic is performed.
"""
import asyncio
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "browser-extension"


async def main():
    html = """<!doctype html><html><body>
      <p id="stale-receipt">Сопроводительное письмо отправлено для другой вакансии</p>
      <main>
        <h1>Специалист поддержки пользователей</h1>
        <section id="response">
          <p>Вы откликнулись</p>
          <button id="attach">Приложить письмо</button>
        </section>
      </main>
      <script>
        window.sendClicks = 0;
        window.sentLetter = '';
        window.closedAfterSend = false;
        attach.addEventListener('click', () => {
          const overlay = document.createElement('div');
          overlay.className = 'bloko-modal cover-overlay';
          overlay.innerHTML = '<div role="dialog"><h2>Сопроводительное письмо</h2><textarea placeholder="Сопроводительное письмо"></textarea><button class="close">Закрыть</button></div><footer><button id="finish">Отправить</button></footer>';
          document.body.append(overlay);
          overlay.querySelector('.close').addEventListener('click', () => overlay.remove());
          overlay.querySelector('#finish').addEventListener('click', () => {
            window.sendClicks += 1;
            window.sentLetter = overlay.querySelector('textarea').value;
            if (window.sendClicks < 3) return;
            overlay.remove();
            window.closedAfterSend = true;
            attach.remove();
            response.insertAdjacentHTML('beforeend', '<p>Сопроводительное письмо отправлено</p>');
          });
        });
      </script>
    </body></html>"""

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=shutil.which("chromium") or None,
            headless=True,
            args=["--no-sandbox", "--disable-gpu"],
        )
        page = await browser.new_page(viewport={"width": 1200, "height": 800})
        await page.set_content('<base href="https://hh.ru/">' + html)
        await page.evaluate("window.__vjaLocation=new URL('https://hh.ru/vacancy/777')")

        chrome_mock = r"""(() => {
          const storage = {};
          window.__siteApplyListeners = [];
          window.chrome = {
            runtime: {
              sendMessage: async message => {
                if (message?.type === 'vjaSiteApplyStorage') {
                  if (message.operation === 'get') return {ok:true,value:storage[message.key]};
                  if (message.operation === 'set') { storage[message.key]=message.value; return {ok:true}; }
                  if (message.operation === 'remove') { delete storage[message.key]; return {ok:true}; }
                }
                return {ok:true};
              },
              onMessage: { addListener(listener) { window.__siteApplyListeners.push(listener); } }
            }
          };
          window.vjaSubmissionGuard = { allow: async () => true };
          window.vjaSubmissionReceipt = {
            detect: input => {
              const confirmed = /сопроводительное письмо отправлено/i.test(input.text || '');
              return {confirmed,score:confirmed?9:0,signal:confirmed?'cover-letter-sent':'none'};
            }
          };
        })();"""
        await page.add_script_tag(content=chrome_mock)
        for filename in ["site-apply.js", "final-submit-control.js", "site-apply-content.js"]:
            source = (EXT / filename).read_text(encoding="utf-8")
            if filename == "site-apply-content.js":
                source = source.replace("location.", "__vjaLocation.")
            await page.add_script_tag(content=source)

        letter = (
            "Здравствуйте! Откликаюсь на вакансию «Специалист поддержки пользователей». "
            "Работаю с обращениями клиентов, воспроизвожу ошибки и помогаю с настройкой SaaS-сервисов. "
            "Свободно использую английский язык и умею понятно фиксировать технический контекст."
        )
        result = await page.evaluate(
            """plan => new Promise((resolve, reject) => {
              const listener = window.__siteApplyListeners.find(fn => typeof fn === 'function');
              if (!listener) return reject(new Error('site apply listener missing'));
              const keep = listener({type:'siteApplyNow',plan}, {}, resolve);
              if (keep !== true) reject(new Error('listener did not keep response channel open'));
            })""",
            {
                "id": "app-777",
                "trackedId": "777",
                "sourceUrl": "https://hh.ru/vacancy/777",
                "jobTitle": "Специалист поддержки пользователей",
                "coverLetter": letter,
                "startClicked": True,
                "userInitiated": True,
                "intent": "vacancy-page-apply-letter",
            },
        )

        assert result["submitted"] is True
        assert result["status"] == "confirmed"
        assert result["coverLetterFilled"] is True
        assert result["submitAttempts"] == 3
        assert await page.evaluate("window.sendClicks") == 3
        assert await page.evaluate("window.closedAfterSend") is True
        assert await page.evaluate("window.sentLetter") == letter
        assert await page.locator(".cover-overlay").count() == 0

        print("PASS direct HH cover-letter modal retries Send until a stubborn modal closes")
        print("PASS unrelated stale success text does not short-circuit the current vacancy")
        print("PASS tailored letter remains intact across the retry")
        print("PASS modal closure is verified before the application is marked confirmed")
        await browser.close()


asyncio.run(main())
