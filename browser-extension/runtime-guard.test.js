const assert = require("assert");
const guard = require("./runtime-guard.js");

(async () => {
  assert.equal(guard.messageTimeout("extractPage"), 10000);
  assert.equal(guard.messageTimeout("applyFieldPlan"), 20000);
  assert.equal(guard.messageTimeout("siteApplyNow"), 60000);
  assert.equal(await guard.withTimeout(Promise.resolve("ok"), 20), "ok");
  await assert.rejects(guard.withTimeout(new Promise(() => {}), 10, "Page response"), error => error.code === "VJA_TIMEOUT");
  assert.match(guard.userMessage({ code: "VJA_TIMEOUT", message: "timeout" }), /удалять расширение не нужно/);
  assert.match(guard.userMessage(new Error("Could not establish connection")), /Обновите страницу вакансии/);
  console.log("runtime guard tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
