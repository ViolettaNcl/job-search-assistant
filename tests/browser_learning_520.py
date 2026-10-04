"""Focused Chromium regression for the 5.2 Learning & Model Center UI.
Uses mocked extension messages; no live HH account or real model is activated.
"""
import asyncio, json, shutil
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/('browser-extension' if (ROOT/'browser-extension').exists() else 'extension')

async def main():
    passed=[]
    def check(name, cond):
        assert cond,name;passed.append(name);print('PASS',name,flush=True)
    summary={
      'ok':True,'schemaVersion':2,'events':120,'labels':105,'engagementLabels':64,
      'trainingReady':True,'experimentalTrainingReady':True,'minimumRecommendedLabels':100,
      'signals':{'roleWeights':{'support':2.4},'techWeights':{'sql':1.2}},
      'registry':{'activeModel':'pref-active','activeModels':{'preference':'pref-active','engagement':'eng-active'},'models':[
        {'modelVersion':'pref-active','modelType':'personal-vacancy-logreg','status':'active','trainingLabels':120,'validation':{'f1':.72}},
        {'modelVersion':'eng-active','modelType':'employer-engagement-logreg','status':'active','trainingLabels':80,'validation':{'f1':.65}},
        {'modelVersion':'pref-candidate','modelType':'personal-vacancy-logreg','status':'candidate','trainingLabels':140,'validation':{'f1':.76}}
      ]},
      'monitor':{'kind':'preference','modelVersion':'pref-active','labelledPredictions':44,'metrics':{'accuracy':.7,'f1':.68,'brier':.19,'ece':.08},'drift':{'available':True,'meanPredictionShift':.02,'positiveRateShift':.03},'retraining':{'recommended':False,'labelsSinceTraining':44,'reasons':[]}},
      'engagementMonitor':{'kind':'engagement','modelVersion':'eng-active','labelledPredictions':31,'metrics':{'accuracy':.65,'f1':.6,'brier':.22,'ece':.11},'drift':{'available':False},'retraining':{'recommended':True,'labelsSinceTraining':31,'reasons':['Обнаружен drift']}}
    }
    applications={'ok':True,'outcomeAnalytics':{'applied':50,'reply':12,'interview':5,'offer':1,'replyRate':24,'interviewRate':10,'sampleSize':50,'lowSample':False}}
    html=(EXT/'learning.html').read_text(encoding='utf-8').replace('<script src="learning.js"></script>','')
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-gpu'])
        page=await browser.new_page(viewport={'width':1200,'height':900})
        await page.set_content(html)
        await page.evaluate("""({summary,applications})=>{
          window.__ops=[];
          window.chrome={runtime:{sendMessage:async m=>{window.__ops.push(m);if(m.op==='learning-summary')return summary;if(m.op==='applications')return applications;if(m.op==='learning-model-promote')return {ok:true,registry:summary.registry};if(m.op==='learning-model-disable')return {ok:true,registry:summary.registry};if(m.op==='learning-export')return {ok:true,data:{dataset:[],engagementDataset:[],events:[]}};return {ok:true};}}};
        }""",{'summary':summary,'applications':applications})
        page.on('dialog',lambda d: asyncio.create_task(d.accept()))
        await page.add_script_tag(content=(EXT/'learning.js').read_text(encoding='utf-8'))
        await page.wait_for_function("document.getElementById('events').textContent==='120'")
        check('5.2 Learning Center renders preference and engagement label counts',await page.locator('#labels').inner_text()=='105' and await page.locator('#engagementLabels').inner_text()=='64')
        check('5.2 renders both active model monitors','pref-active' in await page.locator('#monitor').inner_text() and 'eng-active' in await page.locator('#engagementMonitor').inner_text())
        check('5.2 shows production training readiness','production-ready' in await page.locator('#ready').inner_text())
        await page.locator('#modelSelect').select_option('pref-candidate')
        await page.locator('#promote').click();await page.wait_for_timeout(120)
        ops=await page.evaluate("window.__ops.map(x=>x.op)")
        check('5.2 promotion remains an explicit user action','learning-model-promote' in ops)
        check('5.2 engagement retraining recommendation is visibly separate','переобуч' in (await page.locator('#engagementRetrain').inner_text()).lower())
        await browser.close()
    print(f'{len(passed)} focused 5.2 Learning Center assertions passed.',flush=True)

if __name__=='__main__': asyncio.run(main())
