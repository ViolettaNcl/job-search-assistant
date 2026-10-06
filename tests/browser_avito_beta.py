"""Avito vacancies BETA DOM fixture.

Validates the Avito-only bundle on synthetic search/detail pages, including the
explicit one-click flow: analyze -> native Write -> fill -> Send. No live Avito
account or production message is used.
"""
import asyncio
import json
import shutil
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / ("browser-extension" if (ROOT / "browser-extension").exists() else "extension")


def avito_scripts():
    manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    for block in manifest.get("content_scripts", []):
        if any("avito.ru" in value for value in block.get("matches", [])):
            return block["js"]
    raise AssertionError("Avito content-script bundle is missing")


async def main():
    passed = []

    def check(name, value):
        assert value, name
        passed.append(name)
        print("PASS", name, flush=True)

    scripts = avito_scripts()
    chrome_mock = r"""
    (() => {
      const listeners = [];
      const storage = {};
      window.__copiedText = '';
      window.__nativeChatClicks = 0;
      window.__sentMessages = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => { window.__copiedText = String(text || ''); } }
      });
      const storageGet = async keys => {
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        if (Array.isArray(keys)) return Object.fromEntries(keys.map(key => [key, storage[key]]));
        if (keys && typeof keys === 'object') return Object.fromEntries(Object.keys(keys).map(key => [key, storage[key] ?? keys[key]]));
        return { ...storage };
      };
      window.openFixtureChat = (company, vacancyTitle) => {
        window.__nativeChatClicks++;
        document.querySelector('#fixture-avito-chat')?.remove();
        const panel = document.createElement('aside');
        panel.id = 'fixture-avito-chat';
        panel.dataset.marker = 'messenger-chat';
        panel.style.cssText = 'position:fixed;right:0;top:0;width:440px;height:100vh;background:white;z-index:999999;padding:20px;';
        panel.innerHTML = `<h2>${company}</h2><div>${vacancyTitle}</div><form><textarea placeholder="Сообщение" aria-label="Сообщение"></textarea><button type="submit" aria-label="Отправить">Отправить</button></form>`;
        panel.querySelector('form').addEventListener('submit', event => {
          event.preventDefault();
          const field = panel.querySelector('textarea');
          window.__sentMessages.push(field.value);
          field.value = '';
          field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        document.body.append(panel);
      };
      window.chrome = {
        runtime: {
          id: 'fixture',
          getURL: p => 'chrome-extension://fixture/' + p,
          onMessage: { addListener: fn => listeners.push(fn) },
          sendMessage: async message => {
            const vacancy = message.vacancy || {};
            if (message.op === 'quick-list-state') return { ok: true };
            if (message.op === 'quick-list-full-analysis') return {
              ok: true,
              vacancy,
              source: 'fixture-full-dom',
              analysis: {
                status: vacancy.vacancyId === '222222222' ? 'calls' : 'no-calls',
                hasCalls: vacancy.vacancyId === '222222222',
                canApply: vacancy.vacancyId !== '222222222',
                confidence: 0.96,
                reason: vacancy.vacancyId === '222222222' ? 'Требуются исходящие звонки.' : 'Работа в сообщениях; звонки не указаны.',
                evidence: vacancy.description || ''
              },
              fit: {
                score: vacancy.vacancyId === '222222222' ? 36 : 91,
                decision: vacancy.vacancyId === '222222222' ? 'SKIP' : 'READY',
                reasons: ['Удалённый формат', 'Клиентская поддержка', 'Письменная коммуникация'],
                risks: vacancy.vacancyId === '222222222' ? ['Исходящие звонки'] : []
              }
            };
            if (message.op === 'quick-list-prepare') return {
              ok: true,
              coverLetter: `Здравствуйте! Заинтересовала вакансия «${vacancy.title}». У меня есть опыт клиентской и технической поддержки SaaS, письменной коммуникации и работы с запросами пользователей. Свободно владею русским и английским языками. Буду рада обсудить задачи и формат работы.\n\nСвязаться со мной можно: Telegram: @candidate_fixture · email: candidate@example.invalid.`,
              application: { id: 'fixture-' + vacancy.vacancyId, vacancy }
            };
            if (message.op === 'update-letter') return { ok: true };
            if (message.op === 'quick-list-complete') return { ok: true, result: { submitted: true, coverLetterFilled: true } };
            return { ok: true };
          }
        },
        storage: {
          local: {
            get: storageGet,
            set: async value => Object.assign(storage, value),
            remove: async keys => { for (const key of (Array.isArray(keys) ? keys : [keys])) delete storage[key]; }
          },
          session: { get: storageGet, set: async value => Object.assign(storage, value), remove: async keys => { for (const key of (Array.isArray(keys) ? keys : [keys])) delete storage[key]; } },
          sync: { get: async () => ({}) }
        }
      };
      window.dispatchExtensionMessage = message => new Promise(resolve => {
        let handled = false;
        for (const fn of listeners) {
          const response = fn(message, {}, value => { handled = true; resolve(value); });
          if (response === true || handled) return;
        }
        resolve(null);
      });
    })();
    """

    list_html = """
    <html><head><base href="https://www.avito.ru/"></head><body>
      <main>
        <article data-marker="item" data-item-id="111111111" id="card-one">
          <a data-marker="item-title" href="https://www.avito.ru/volgograd/vakansii/specialist_klientskoy_podderzhki_111111111"><h3>Специалист клиентской поддержки (удалённо)</h3></a>
          <div data-marker="seller-info/name">Support Cloud</div>
          <div data-marker="item-address">Волгоград</div>
          <p data-marker="item-description">Поддержка пользователей в сообщениях, Helpdesk, SaaS и английский язык. Удалённо. Без холодных звонков.</p>
          <button class="native-chat" onclick="openFixtureChat('Support Cloud','Специалист клиентской поддержки')">Написать</button>
        </article>
        <article data-marker="item" data-item-id="222222222" id="card-two">
          <a data-marker="item-title" href="https://www.avito.ru/volgograd/vakansii/operator_ishodyaschih_zvonkov_222222222"><h3>Оператор исходящих звонков</h3></a>
          <div data-marker="seller-info/name">Phone Sales</div>
          <p data-marker="item-description">Ежедневные исходящие звонки по клиентской базе и продажи.</p>
          <button class="native-chat" onclick="openFixtureChat('Phone Sales','Оператор исходящих звонков')">Написать</button>
        </article>
      </main>
    </body></html>
    """

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=shutil.which("chromium") or None,
            headless=True,
            args=["--no-sandbox", "--disable-gpu"],
        )
        page = await browser.new_page(viewport={"width": 1400, "height": 1000})
        await page.set_content(list_html)
        await page.evaluate("window.__vjaLocation = new URL('https://www.avito.ru/volgogradskaya_oblast_volzhskiy/vakansii?format_raboty=udaleno')")
        await page.add_script_tag(content=chrome_mock)
        for script in scripts:
            content = (EXT / script).read_text(encoding="utf-8").replace("location.", "__vjaLocation.")
            await page.add_script_tag(content=content)
        await page.wait_for_timeout(700)

        check("Avito search page renders controls for every vacancy", await page.locator('[data-vja-root="avito-controls"]').count() == 2)
        check("Avito page toolbar is rendered", await page.locator('#vja-avito-toolbar').count() == 1)

        await page.locator('#card-one [data-role="analyze"]').click()
        await page.locator('#card-one [data-role="fit"]').filter(has_text="91% Match").wait_for(timeout=4000)
        check("Avito analysis keeps Fit and Calls independent", "Без звонков" in await page.locator('#card-one [data-role="calls"]').inner_text())

        await page.locator('#card-two [data-role="analyze"]').click()
        await page.locator('#card-two [data-role="fit"]').filter(has_text="36% Match").wait_for(timeout=4000)
        check("Avito call-heavy vacancy is marked separately", "Есть звонки" in await page.locator('#card-two [data-role="calls"]').inner_text())

        # Simulate Avito trying to hide injected controls on hover. The extension's
        # important persistent style and hover guard must restore them.
        await page.evaluate("""
          const card=document.querySelector('#card-one');
          card.addEventListener('mouseenter',()=>{const bar=card.querySelector('[data-vja-root="avito-controls"]');if(bar)bar.style.display='none';},{once:true});
        """)
        await page.locator('#card-one').hover()
        await page.wait_for_timeout(350)
        check("Avito controls remain visible while the native card hover UI appears", await page.locator('#card-one [data-vja-root="avito-controls"]').is_visible())

        await page.locator('#card-one [data-role="letter"]').click()
        await page.wait_for_function("window.__sentMessages.length === 1", timeout=10000)
        letter = await page.evaluate("window.__sentMessages[0]")
        check("Avito letter is vacancy-specific", "Специалист клиентской поддержки" in letter)
        check("Avito letter uses confirmed support/language context", "SaaS" in letter and "английским" in letter)
        check("Avito letter keeps feminine Russian grammar", "Буду рада" in letter and "Буду рад " not in letter)
        check("Avito letter always includes Telegram and email", "@candidate_fixture" in letter and "candidate@example.invalid" in letter)
        check("Avito Letter click uses the exact native Write button", await page.evaluate("window.__nativeChatClicks") == 1)
        check("Avito Letter click fills and sends the message automatically", await page.evaluate("window.__sentMessages.length") == 1)
        check("Normal successful Avito flow does not open a manual copy modal", await page.locator('#vja-avito-letter-modal').count() == 0)

        await page.locator('#vja-avito-toolbar select').select_option('no-calls')
        await page.wait_for_timeout(100)
        check("Avito no-calls filter hides call-heavy cards", await page.locator('#card-two').get_attribute('data-vja-avito-hidden') == '1')

        detail = await browser.new_page(viewport={"width": 1200, "height": 900})
        await detail.set_content("""
        <html><head><base href="https://www.avito.ru/"></head><body><main>
          <h1 data-marker="item-view/title-info">Специалист клиентской поддержки</h1>
          <div data-marker="seller-info/name">Support Cloud</div>
          <div data-marker="item-view/item-description">Поддержка пользователей в сообщениях и Helpdesk. Удалённая работа. Английский язык.</div>
          <button onclick="openFixtureChat('Support Cloud','Специалист клиентской поддержки')">Написать</button>
        </main></body></html>
        """)
        await detail.evaluate("window.__vjaLocation = new URL('https://www.avito.ru/volgograd/vakansii/specialist_klientskoy_podderzhki_111111111')")
        await detail.add_script_tag(content=chrome_mock)
        for script in scripts:
            content = (EXT / script).read_text(encoding="utf-8").replace("location.", "__vjaLocation.")
            await detail.add_script_tag(content=content)
        await detail.wait_for_timeout(600)
        check("Avito detail page renders Analysis and Letter panel", await detail.locator('#vja-avito-detail-panel').count() == 1)
        snapshot = await detail.evaluate("window.dispatchExtensionMessage({type:'vjaCopilotPage',action:'vacancy',expectedVacancyId:'111111111'})")
        check("Avito hidden reader returns the exact vacancy", snapshot and snapshot.get('ok') and snapshot['vacancy']['vacancyId'] == '111111111')
        await detail.locator('#vja-avito-detail-panel [data-role="letter"]').click()
        await detail.wait_for_function("window.__sentMessages.length === 1", timeout=10000)
        check("Avito detail Letter also opens, fills and sends the exact chat", await detail.evaluate("window.__nativeChatClicks === 1 && window.__sentMessages.length === 1"))

        # Regression: if Avito's native Write control is not present on the first
        # attempt, the saved-letter modal must expose an explicit Send to chat
        # action. Once the native control appears, that action must open the
        # exact chat, insert the edited letter and send it without manual paste.
        fallback = await browser.new_page(viewport={"width": 1200, "height": 900})
        await fallback.set_content("""
        <html><head><base href="https://www.avito.ru/"></head><body><main>
          <article data-marker="item" data-item-id="333333333" id="card-fallback">
            <a data-marker="item-title" href="https://www.avito.ru/volgograd/vakansii/support_specialist_333333333"><h3>Специалист поддержки пользователей</h3></a>
            <div data-marker="seller-info/name">Fallback Support</div>
            <p data-marker="item-description">Поддержка пользователей в чате, Helpdesk, удалённо, без звонков.</p>
          </article>
        </main></body></html>
        """)
        await fallback.evaluate("window.__vjaLocation = new URL('https://www.avito.ru/volgograd/vakansii?format_raboty=udaleno')")
        await fallback.add_script_tag(content=chrome_mock)
        for script in scripts:
            content = (EXT / script).read_text(encoding="utf-8").replace("location.", "__vjaLocation.")
            await fallback.add_script_tag(content=content)
        await fallback.wait_for_timeout(650)
        await fallback.locator('#card-fallback [data-role="letter"]').click()
        await fallback.locator('#vja-avito-letter-modal').wait_for(timeout=9000)
        send_chat = fallback.locator('#vja-avito-letter-modal [data-role="send-to-chat"]')
        check("Avito fallback letter modal exposes Send to chat", await send_chat.is_visible() and await send_chat.inner_text() == "Отправить в чат")
        await fallback.evaluate("""
          const card=document.querySelector('#card-fallback');
          const button=document.createElement('button');
          button.className='native-chat';
          button.textContent='Написать';
          button.addEventListener('click',()=>openFixtureChat('Fallback Support','Специалист поддержки пользователей'));
          card.append(button);
        """)
        await send_chat.click()
        await fallback.wait_for_function("window.__sentMessages.length === 1", timeout=10000)
        check("Avito Send to chat opens the exact native chat and sends the saved letter", await fallback.evaluate("window.__nativeChatClicks === 1 && window.__sentMessages.length === 1"))
        await fallback.locator('#vja-avito-letter-modal').wait_for(state='detached', timeout=3000)
        check("Avito Send to chat closes the saved-letter modal after confirmed send", await fallback.locator('#vja-avito-letter-modal').count() == 0)

        await browser.close()

    print(f"{len(passed)} Avito BETA browser assertions passed.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
