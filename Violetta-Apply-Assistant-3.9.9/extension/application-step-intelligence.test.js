const assert = require("node:assert/strict");
const steps = require("./application-step-intelligence.js");

const scan1 = {
  ats: "workday",
  fields: [
    { type: "text", label: "First name" },
    { type: "email", label: "Email" },
    { type: "select", label: "Country" }
  ]
};
const plan1 = { autofillCount: 2, reviewCount: 1, blockedCount: 0 };
const snap1 = steps.buildSnapshot(scan1, plan1, {
  jobUrl: "https://acme.wd5.myworkdayjobs.com/job/R123",
  currentUrl: "https://acme.wd5.myworkdayjobs.com/apply/R123/1",
  at: 1000
});

assert.equal(snap1.fieldCount, 3);
assert.equal(snap1.reviewCount, 1);
assert.ok(!JSON.stringify(snap1).includes("First name"));
assert.ok(!JSON.stringify(snap1).includes("Email"));

let result = steps.advance([], snap1);
assert.equal(result.stage, 1);
assert.equal(result.isNew, true);
assert.equal(result.history.length, 1);

const sameStage = steps.buildSnapshot({
  ats: "workday",
  fields: [
    { type: "text", label: "First name" },
    { type: "email", label: "Email" },
    { type: "select", label: "Country" }
  ]
}, { autofillCount: 1, reviewCount: 2, blockedCount: 0 }, {
  jobUrl: "https://acme.wd5.myworkdayjobs.com/job/R123",
  currentUrl: "https://acme.wd5.myworkdayjobs.com/apply/R123/1",
  at: 2000
});
result = steps.advance(result.history, sameStage);
assert.equal(result.stage, 1);
assert.equal(result.isNew, false);
assert.equal(result.history.length, 1);

const stage2 = steps.buildSnapshot({
  ats: "workday",
  fields: [
    { type: "textarea", label: "Why are you interested?" },
    { type: "select", label: "Work authorization" },
    { type: "file", label: "Resume" },
    { type: "checkbox", label: "Terms acknowledgement" }
  ]
}, { autofillCount: 0, reviewCount: 2, blockedCount: 1 }, {
  jobUrl: "https://acme.wd5.myworkdayjobs.com/job/R123",
  currentUrl: "https://acme.wd5.myworkdayjobs.com/apply/R123/2",
  at: 3000
});
result = steps.advance(result.history, stage2);
assert.equal(result.stage, 2);
assert.equal(result.isNew, true);
assert.equal(result.history.length, 2);
assert.ok(result.change.added >= 3);
assert.ok(result.change.removed >= 2);

const differentJob = steps.buildSnapshot(scan1, plan1, {
  jobUrl: "https://acme.wd5.myworkdayjobs.com/job/R999",
  currentUrl: "https://acme.wd5.myworkdayjobs.com/apply/R999/1",
  at: 4000
});
result = steps.advance(result.history, differentJob);
assert.equal(result.stage, 1);
assert.equal(result.history.length, 1);

const summary = steps.publicSummary(result);
assert.equal(summary.stage, 1);
assert.equal(summary.fieldCount, 3);
assert.equal(summary.reviewCount, 1);

assert.equal(steps.similarity(["a", "b"], ["a", "b"]), 1);
assert.equal(steps.similarity(["a"], ["b"]), 0);

console.log("application-step-intelligence tests passed");