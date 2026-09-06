const assert = require("node:assert/strict");
const reconciliation = require("./fill-reconciliation.js");
const verification = require("./field-verification.js");

const plan = {
  fields: [
    { token: "email", action: "fill", value: "violetta@example.com" },
    { token: "auth", action: "fill", value: "Yes" },
    { token: "salary", action: "review", value: null }
  ]
};

const corrected = reconciliation.reconcile({
  fields: [
    { token: "email", type: "email", currentValue: "violetta@example.com", fillFailed: true },
    { token: "auth", type: "select", currentValue: "true", fillFailed: true },
    { token: "salary", type: "text", currentValue: "100000", fillFailed: true }
  ]
}, plan, verification);

assert.equal(corrected.clearedFailures, 2);
assert.equal(corrected.scan.fields[0].fillFailed, false);
assert.equal(corrected.scan.fields[0].fillRecovered, true);
assert.equal(corrected.scan.fields[1].fillFailed, false);
assert.equal(corrected.scan.fields[2].fillFailed, true);

const wrongValue = reconciliation.reconcile({
  fields: [{ token: "email", type: "email", currentValue: "wrong@example.com", fillFailed: true }]
}, plan, verification);
assert.equal(wrongValue.clearedFailures, 0);
assert.equal(wrongValue.scan.fields[0].fillFailed, true);

const blank = reconciliation.reconcile({
  fields: [{ token: "email", type: "email", currentValue: "", fillFailed: true }]
}, plan, verification);
assert.equal(blank.clearedFailures, 0);

console.log("fill-reconciliation tests passed");
