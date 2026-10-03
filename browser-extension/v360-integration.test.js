const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('manifest and core expose 3.9.13',()=>{
  assert.equal(JSON.parse(read('manifest.json')).version,'3.9.13');
  assert.match(read('copilot-core.js'),/VERSION = '3\.9\.13'/);
});

test('main Apply routes job descriptions directly to auto-apply without opening popup auto page',()=>{
  const home=read('home.js');
  const universal=read('universal-content.js');
  assert.match(home,/JOB_DESCRIPTION'\?'auto-apply'/);
  assert.doesNotMatch(home,/popup\.html\?auto=1/);
  assert.match(universal,/action==='auto-apply'.*autoApply/s);
  assert.match(universal,/JOB_DESCRIPTION.*autoApply/s);
  assert.match(read('copilot-background.js'),/fileData:prepared\.cvFile\|\|null/);
});

test('bundled Russian and English CV PDFs ship with extension',()=>{
  for(const file of ['assets/cv/Violetta_Nicolaou_CV_RU.pdf','assets/cv/Violetta_Nicolaou_CV_EN.pdf']){
    const full=path.join(root,file);assert.ok(fs.existsSync(full),file);const b=fs.readFileSync(full);assert.equal(b.subarray(0,5).toString(),'%PDF-');
  }
  assert.match(read('bundled-cv.js'),/cvVaultRu/);assert.match(read('bundled-cv.js'),/cvVaultEn/);
});

test('chat pencil stays context-local and no vacancy chooser is rendered',()=>{
  const chat=read('recruiter-chat-content.js');
  assert.match(chat,/✎ AI/);
  assert.doesNotMatch(chat,/Другая вакансия|К какой вакансии относится этот чат/);
  assert.match(chat,/latestInbound/);
});

test('quick replies are Russian-only and ship requested default reply',()=>{
  const q=read('quick-replies.js');
  assert.match(q,/feedback_default/);assert.match(q,/Спасибо, буду ждать/);
  assert.match(q,/Здравствуйте! Спасибо за ответ\. Буду ждать обратной связи/);
  assert.match(q,/@Violet111/);
  assert.match(q,/violettanicolaou@gmail\.com/);
  assert.match(q,/slice\(0,5\)/);assert.doesNotMatch(q,/test_assignment|test_deadline|next_stage/);
});


test('floating Apply uses compact inline auto state and never opens internal application page',()=>{const u=read('universal-content.js');assert.match(u,/U\.toast/);assert.match(u,/request\('auto-apply'/);assert.doesNotMatch(u,/popup\.html\?auto=1/);assert.match(u,/✓ Отклик отправлен/);assert.match(u,/✓ Уже откликнулись/);assert.match(u,/refreshVacancyStatus\(\)/);});
test('cover letter memory persists and CV selection is simplified to vacancy language',()=>{const bg=read('copilot-background.js');const core=read('copilot-core.js');const html=read('options.html');assert.match(bg,/coverLetterMemory/);assert.match(bg,/submittedText/);assert.match(core,/function cvSelection/);assert.match(core,/language-default/);assert.doesNotMatch(core,/cvVaultRole:/);assert.doesNotMatch(html,/CV для конкретных ролей/);});
test('settings are separated into profile resume AI auto apply and developer sections',()=>{const html=read('options.html');assert.match(html,/Профиль/);assert.match(html,/Резюме/);assert.match(html,/AI и ответы/);assert.match(html,/Автоотклик/);assert.match(html,/Для разработчика/);});
test('chat bar can improve existing user draft in current conversation',()=>{const chat=read('recruiter-chat-content.js');assert.match(chat,/Улучшить текст/);assert.match(chat,/analyze\('polish',currentDraftText\(\),true\)/);});


test('user-controlled HH autopilot is present and targets remote IT vacancies',()=>{
  const popup=read('popup.html'),auto=read('browser-autopilot.js'),bg=read('background.js');
  assert.match(popup,/Запустить автопилот/);assert.match(popup,/Удалённо · IT по профилю/);
  assert.match(auto,/programmingOnly:true/);assert.match(auto,/remoteOnly:true/);assert.match(auto,/sessionLimit:5/);
  assert.match(bg,/browserAutopilotSession/);assert.match(bg,/3\.9\.13-evidence/);
});

test('backend dashboard no longer claims autopilot is disabled by Copilot 3.0',()=>{
  const file=path.join(root,'../backend/wwwroot/index.html');if(!fs.existsSync(file))return;const backend=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(backend,/Автоотправка отключена · Copilot 3\.0/);assert.match(backend,/Запустить автопилот/);
});


test('3.8.0 launcher exposes backend diagnostics and uses the exact loopback host',()=>{
  const rootPath=path.join(root,'..');
  const start=fs.readFileSync(path.join(rootPath,'start-assistant.cmd'),'utf8');
  const diag=fs.readFileSync(path.join(rootPath,'BACKEND_DIAGNOSTICS.cmd'),'utf8');
  const stop=fs.readFileSync(path.join(rootPath,'STOP_ASSISTANT.cmd'),'utf8');
  assert.match(start,/http:\/\/127\.0\.0\.1:8080/);
  assert.match(start,/BACKEND_DIAGNOSTICS\.cmd/);
  assert.match(start,/backend\.stdout\.log/);
  assert.match(start,/backend\.stderr\.log/);
  assert.match(start,/Security__EnableAutomaticSubmission=true/);
  assert.match(start,/ConnectionStrings__Sqlite=Data Source=/);
  assert.doesNotMatch(start,/start "" .*127\.0\.0\.1:8080/);
  assert.match(diag,/health\/live/);
  assert.match(diag,/health\/ready/);
  assert.match(diag,/backend-diagnostic\.txt/);
  assert.match(stop,/JobSearchAssistant/);
});

test('3.8.0 fresh backend config permits user-started autopilot and names bundled CVs correctly',()=>{
  const file=path.join(root,'../backend/appsettings.json');if(!fs.existsSync(file))return;const cfg=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(cfg.Security.EnableAutomaticSubmission,true);
  assert.equal(cfg.Candidate.EnglishCvFileName,'Violetta_Nicolaou_CV_EN.pdf');
  assert.equal(cfg.Candidate.RussianCvFileName,'Violetta_Nicolaou_CV_RU.pdf');
});

test('runtime API defaults use 127.0.0.1 rather than localhost',()=>{
  for(const file of ['background.js','popup.js','options.js','runtime-guard.js','local-contact-profile-popup.js']){
    const text=read(file);
    assert.match(text,/http:\/\/127\.0\.0\.1:8080/);
    assert.doesNotMatch(text,/http:\/\/localhost:8080/);
  }
});


test('chat AI exposes full-dialog analysis, current HH DOM fallback, and explicit one-shot consent',()=>{
  const chat=read('recruiter-chat-content.js'),bg=read('copilot-background.js'),adapters=read('site-adapters.js');
  assert.match(chat,/Проанализировать весь диалог и ответить/);
  assert.match(chat,/analyze\(style,typeof seed==='function'\?seed\(\):seed,true\)/);
  assert.match(chat,/explicitUserRequest/);
  assert.match(chat,/function conversationIdentity/);
  assert.match(bg,/function cpAssertChatPage/);
  assert.match(bg,/explicitUserRequest/);
  assert.match(bg,/cpAnswerCurrentChat/);assert.match(read('context-reply.js'),/LATEST|latest/i);
  assert.match(adapters,/fallbackMessageBlocks/);
  assert.match(adapters,/dom-fallback-/);
});



test('3.9.10 grants HH API access and keeps a full-vacancy fallback for Analysis and letters',()=>{
  const manifest=JSON.parse(read('manifest.json')),bg=read('copilot-background.js'),writing=read('writing-background.js');
  assert.ok(manifest.host_permissions.includes('https://api.hh.ru/*'));
  assert.match(bg,/async function cpWaitForVacancyReadable/);
  assert.match(bg,/cpAcquireHhVacancy\(selected,sender,\{fast:true\}\)/);
  assert.match(bg,/Promise\.any\(\[apiTask,liveTask\]\)/);
  assert.match(writing,/cpAcquireHhVacancy\(v,sender,\{fast:Boolean\(embedded\)\}\)/);
  assert.match(bg,/Не удалось прочитать полную HH-вакансию/);
});

test('HH list quick apply starts preparation on trusted click and supports current generic modal portals',()=>{
  const manifest=JSON.parse(read('manifest.json'));
  const scripts=manifest.content_scripts.find(x=>x.matches.some(m=>m.includes('hh.ru')))?.js||[];
  const apply=read('hh-list-quick-apply.js');
  const siteIndex=scripts.indexOf('site-apply-content.js');
  assert.ok(siteIndex>=0);
  assert.ok(scripts.indexOf('hh-list-quick-apply-core.js')>siteIndex);
  assert.ok(scripts.indexOf('hh-list-quick-apply.js')>siteIndex);
  assert.match(apply,/event\.isTrusted/);
  assert.match(apply,/const preparePromise=request\('quick-list-prepare'/);
  assert.match(apply,/coverLetterContainers/);
  assert.match(apply,/bloko-modal/);
  assert.match(apply,/quick-list-complete/);
  assert.match(apply,/Приложить письмо/);
  assert.match(apply,/vja-card-fast-apply/);
  assert.match(apply,/Отклик \+ письмо/);
  assert.match(apply,/preventDefault\(\)/);
  assert.match(apply,/waitForFirstStage/);
  assert.match(apply,/submitInitialLetter/);
});

test('IT cover letters include the candidate GitHub and list quick apply is configurable',()=>{
  const core=read('copilot-core.js'),html=read('options.html'),opts=read('copilot-options.js');
  assert.match(core,/githubSentence/);
  assert.match(core,/isItVacancy/);
  assert.match(html,/cpQuickListCoverLetter/);
  assert.match(opts,/quickListCoverLetter/);
});


test('3.7 home popup exposes one prominent rocket autopilot control with live status',()=>{
  const html=read('home.html'),js=read('home.js'),css=read('home.css'),bg=read('background.js');
  assert.match(html,/🚀 Запустить автопилот/);
  assert.match(html,/AI-агент поиска/);
  assert.match(html,/autopilotHomeStats/);
  assert.match(js,/\/api\/automation\/status/);
  assert.match(js,/\/api\/settings\/autoapply/);
  assert.match(js,/vjaAutopilotControlWake/);
  assert.match(js,/vjaHhBrowserSearch:true/);
  assert.match(css,/\.rocketButton/);
  assert.match(bg,/chrome\.runtime\.getURL\('home\.html'\)/);
});

test('3.7 autopilot targets junior-compatible development QA and technical support and defaults browser discovery on',()=>{
  const auto=read('browser-autopilot.js'),bg=read('background.js'),popup=read('popup.html');
  assert.match(auto,/manual qa/);
  assert.match(auto,/technical support/);
  assert.match(auto,/middle\|mid\[- \]\?level/);
  assert.match(bg,/vjaHhBrowserSearch !== false/);
  assert.match(popup,/Удалённо · IT по профилю/);
  assert.match(popup,/Middle\/Senior\/Lead\/Manager/);
});


test('3.9 standalone mode keeps Apply and Chat AI available without backend readiness',()=>{
  const manifest=JSON.parse(read('manifest.json')),adapters=read('site-adapters.js'),universal=read('universal-content.js'),chat=read('recruiter-chat-content.js'),home=read('home.js');
  assert.equal(manifest.version,'3.9.13');
  assert.ok(manifest.icons?.['128']);
  assert.ok(manifest.action?.default_icon?.['48']);
  assert.match(adapters,/direct HH vacancy URL/);
  assert.match(adapters,/negotiations/);
  assert.match(universal,/effectivePageType/);
  assert.match(universal,/visibilityWatch/);
  assert.match(chat,/chatVisibilityWatch/);
  assert.match(home,/работают без терминала|работать автономно|продолжают работать автономно/);
});

test('3.9.10 treats HeadHunter.kg as a first-class HH surface without opening the popup',()=>{
  const manifest=JSON.parse(read('manifest.json')),background=read('copilot-background.js'),site=read('site-apply.js'),home=read('home.js'),core=read('copilot-core.js');
  const scripts=manifest.content_scripts.find(x=>x.js?.includes('copilot-core.js'));
  assert.ok(manifest.host_permissions.includes('https://headhunter.kg/*'));
  assert.ok(manifest.host_permissions.includes('https://*.headhunter.kg/*'));
  assert.ok(scripts.matches.includes('https://headhunter.kg/*'));
  assert.ok(scripts.matches.includes('https://*.headhunter.kg/*'));
  assert.match(background,/headhunter\.kg/);
  assert.match(background,/hostSuffix:'headhunter\.kg'|hostSuffix:"headhunter\.kg"/);
  assert.match(site,/headhunter\.kg/);
  assert.match(home,/headhunter\.kg/);
  assert.match(core,/headhunter\.kg/);
});

test('3.9 service worker repairs already-open HH tabs after extension load',()=>{
  const bg=read('copilot-background.js');
  assert.match(bg,/async function cpRepairSupportedTabs/);
  assert.match(bg,/https:\/\/hh\.ru\/\*/);
  assert.match(bg,/https:\/\/\*\.hh\.ru\/\*/);
  assert.match(bg,/onInstalled\.addListener.*cpRepairSupportedTabs/s);
  assert.match(bg,/tabs\?\.onUpdated/);
});


test('3.9.10 HH vacancy detection does not mistake search forms for application forms',()=>{
  const adapters=read('site-adapters.js');
  assert.match(adapters,/classify the form by its own semantics/);
  assert.doesNotMatch(adapters,/\+url\)\|\|Boolean\(el\.querySelector\('\[name="email"\]'/);
  assert.ok(adapters.includes("/\\/vacancy\\/\\d+/i.test(path)"));
});

test('3.9.10 repairs HH surfaces on activation, navigation, and permission grant',()=>{
  const background=read('copilot-background.js');
  assert.match(background,/onActivated/);
  assert.match(background,/cpRepairHhTab/);
  assert.match(background,/permissions\?\.onAdded/);
  const home=read('home.js');
  assert.match(home,/https:\/\/\*\.hh\.ru\/\*/);
});

test('3.9.10 can continue an HH cover letter after resume submission',()=>{
  const background=read('copilot-background.js');
  assert.match(background,/function cpNeedsHhLetter/);
  assert.match(background,/letterContinuation/);
});


test('3.9.10 keeps HH Apply surfaces repaired across SPA history navigation',()=>{
  const manifest=JSON.parse(read('manifest.json')),background=read('copilot-background.js');
  assert.ok(manifest.permissions.includes('webNavigation'));
  assert.ok(manifest.permissions.includes('tabs'));
  assert.match(background,/onHistoryStateUpdated/);
  assert.match(background,/hostSuffix:'hh\.ru'|hostSuffix:'hh.ru'/);
});

test('3.9.10 submits the dedicated HH cover-letter modal instead of generic final-action detection',()=>{
  const content=read('site-apply-content.js'),core=read('site-apply.js');
  assert.match(content,/vjaHhCoverLetterSubmitAction/);
  assert.match(content,/hh-cover-letter-submit-not-found/);
  assert.match(content,/letterSubmit\.candidate\.el\.click/);
  assert.match(core,/chooseHhCoverLetterSubmit/);
});


test('3.9.10 persists HH card memory and resumes exact application forms safely',()=>{
  const list=read('hh-list-quick-apply.js'),bg=read('copilot-background.js'),universal=read('universal-content.js');
  assert.match(list,/quick-list-state/);assert.match(list,/restoreCardState/);assert.match(list,/Форма:.*проверить/);
  assert.match(bg,/vjaQuickListActive:/);assert.match(bg,/cpQuickListState/);assert.match(bg,/formMemory/);assert.match(bg,/30\*24\*60\*60\*1000/);assert.match(bg,/cpRepairPermittedApplicationTab/);
  assert.match(universal,/pageContextText/);assert.match(universal,/autoContinue/);assert.match(universal,/unresolved/);
  assert.match(universal,/safeNavigation/);assert.doesNotMatch(universal,/finalSubmit.*click/i);
});
