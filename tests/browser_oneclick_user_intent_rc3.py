"""Focused RC3 regression for HH search-page one-click apply.
The test uses a real Chromium DOM and mocked Chrome messaging. It verifies that an
unrelated required search filter does not block the cover-letter Send button.
No live HH traffic or real application is performed.
"""
import asyncio
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "browser-extension"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=shutil.which("chromium") or None,
            headless=True,
            args=["--no-sandbox", "--disable-gpu"],
        )
        page = await browser.new_page(viewport={"width": 1200, "height": 800})
        html = """<html><body>
        <div id="stale-other-vacancy">Сопроводительное письмо отправлено для другой вакансии</div>
        <form id="search-filters"><input aria-label="Обязательный фильтр поиска" required value=""></form>
        <div data-qa="vacancy-serp__vacancy" id="card">
          <a data-qa="serp-item__title" href="https://hh.ru/vacancy/999">Специалист клиентской поддержки</a>
          <div data-qa="vacancy-serp__vacancy-employer">Fixture</div>
          <p>Чат-поддержка клиентов, решение вопросов, API и английский язык.</p>
          <button id="native">Откликнуться</button>
        </div>
        <script>
        window.sentLetter=''; window.authMessages=[]; window.toasts=[]; window.closedAfterSend=false; window.sendClicks=0;
        native.addEventListener('click',()=>{
          card.insertAdjacentHTML('beforeend','<span class="applied">Вы откликнулись</span><button id="attach">Приложить письмо</button>');
          attach.addEventListener('click',()=>{
            const overlay=document.createElement('div'); overlay.className='cover-overlay';
            overlay.innerHTML='<div role="dialog"><h2>Сопроводительное письмо</h2><textarea placeholder="Сопроводительное письмо"></textarea><button class="close">Закрыть</button></div><footer><button id="finish">Отправить</button></footer>';
            document.body.append(overlay);
            overlay.querySelector('.close').addEventListener('click',()=>overlay.remove());
            overlay.querySelector('#finish').addEventListener('click',()=>{
              window.sendClicks+=1;
              window.sentLetter=overlay.querySelector('textarea').value;
              if(window.sendClicks<3)return;
              overlay.remove(); window.closedAfterSend=true;
              card.querySelector('#attach')?.remove();
              card.insertAdjacentHTML('beforeend','<span>Сопроводительное письмо отправлено</span>');
            });
          });
        });
        </script></body></html>"""
        await page.set_content('<base href="https://hh.ru/">' + html)
        await page.evaluate("window.__vjaLocation=new URL('https://hh.ru/search/vacancy?text=support')")
        chrome_mock = r"""(()=>{
          const isVisible=el=>!!(el&&el.isConnected&&el.getClientRects().length);
          window.chrome={runtime:{sendMessage:async m=>{
            if(m?.type==='vjaSubmitAuthorization'){
              window.authMessages.push(m);
              const allowed=m.userInitiated===true&&m.intent==='quick-list-apply-letter'&&!m.risks?.unknownRequiredFact&&!m.risks?.legal&&!m.risks?.captcha;
              return {allowed,reason:allowed?'explicit-user-submit':'review-required',stop:allowed?[]:['unknownRequiredFact']};
            }
            if(m?.type==='vjaCopilot'&&m.op==='bootstrap')return {settings:{quickListCoverLetter:true}};
            if(m?.type==='vjaCopilot'&&m.op==='quick-list-state')return {ok:true};
            if(m?.type==='vjaCopilot'&&m.op==='quick-list-prepare')return {ok:true,application:{id:'app-999',vacancy:{vacancyId:'999'}},coverLetter:'Здравствуйте! Откликаюсь на вакансию «Специалист клиентской поддержки». В SaaS-поддержке разбираю обращения, воспроизвожу ошибки и помогаю пользователям с настройкой. Для этой роли релевантны мой опыт работы с API и письменная коммуникация на английском языке. Буду рада обсудить детали.'};
            if(m?.type==='vjaCopilot'&&m.op==='quick-list-complete')return {ok:true};
            return {ok:true};
          }}};
          window.vjaCopilotUI={toast:(m)=>{window.toasts.push(m);return {remove(){}}}};
          window.vjaQuestionnaireCore={classify:()=> 'UNKNOWN'};
          window.vjaSiteAdapters={
            make:()=>({detectPageType:()=> 'JOB_LIST',detectApplicationForm:()=>null}),
            formFields:scope=>[...scope.querySelectorAll('input,textarea,select')].filter(isVisible),
            descriptor:el=>({label:el.getAttribute('aria-label')||el.getAttribute('placeholder')||'',type:el.tagName==='TEXTAREA'?'textarea':(el.type||'text'),required:!!el.required,currentValue:el.value||''})
          };
        })();"""
        await page.add_script_tag(content=chrome_mock)
        for filename in ["hh-list-quick-apply-core.js", "submission-guard-content.js", "hh-list-quick-apply.js"]:
            source = (EXT / filename).read_text(encoding="utf-8").replace("location.", "__vjaLocation.")
            await page.add_script_tag(content=source)
        await page.wait_for_timeout(300)

        button = page.get_by_role("button", name="✦ Отклик + письмо", exact=True)
        assert await button.count() == 1
        await button.click()
        await page.wait_for_function("window.closedAfterSend===true", timeout=18000)
        sent = await page.evaluate("window.sentLetter")
        auth = await page.evaluate("window.authMessages")
        toasts = await page.evaluate("window.toasts")
        closed = await page.evaluate("window.closedAfterSend")
        send_clicks = await page.evaluate("window.sendClicks")

        assert "Специалист клиентской поддержки" in sent
        assert "API" in sent
        assert auth and auth[-1].get("userInitiated") is True
        assert auth[-1].get("intent") == "quick-list-apply-letter"
        assert auth[-1]["risks"].get("unknownRequiredFact") is False
        assert closed is True
        assert send_clicks == 3
        assert not any("Автоматическая отправка не разрешена" in item for item in toasts)
        assert not any("Письмо сохранено" in item for item in toasts)
        await page.get_by_role("button", name="✓ Отклик + письмо", exact=True).wait_for(timeout=3000)

        print("PASS search-page Apply + letter clicks the native Send button")
        print("PASS unrelated required search filters do not block submission authorization")
        print("PASS cover-letter Send is retried when earlier clicks leave the modal open")
        print("PASS cover-letter modal closes after confirmed send")
        print("PASS prepared vacancy-specific letter is inserted before sending")
        await browser.close()


asyncio.run(main())
