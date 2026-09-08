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

// Simulate a browser that queues a class mutation even for a redundant add().
// The observer must converge; a timeout cannot interrupt an infinite microtask loop.
{
  const fs = require("fs");
  const vm = require("vm");
  const source = fs.readFileSync(require.resolve("./site-apply-popup.js"), "utf8");
  const fn = source.slice(source.indexOf("function vjaPreferWebsiteApplyForHh()"), source.indexOf("\nvjaPreferWebsiteApplyForHh();"));
  let hidden = false, pending = 1, writes = 0;
  const button = { classList: { contains: () => hidden, add: () => { hidden = true; writes++; pending++; } } };
  const context = { $: () => button };
  vm.createContext(context);
  vm.runInContext(fn, context);
  for (let i = 0; pending > 0 && i < 10; i++) { pending--; context.vjaPreferWebsiteApplyForHh(); }
  assert.equal(pending, 0, "class observer must settle without starving the popup");
  assert.equal(writes, 1);
  hidden = false; context.vjaPreferWebsiteApplyForHh();
  assert.equal(hidden, true, "external button updates are still reconciled");
}
