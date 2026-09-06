const assert = require("node:assert/strict");
const audit = require("./ats-form-audit.js");

function field(token, label, type, required, currentValue, extra = {}) {
  return { token, label, type, required, currentValue, valid: true, groupKey: token, ...extra };
}

function testReadyForm() {
  const result = audit.audit([
    field("name", "Full name", "text", true, "Violetta Nicolaou"),
    field("email", "Email", "email", true, "violetta@example.com")
  ], [
    { token: "name", action: "fill", reason: "verified" },
    { token: "email", action: "fill", reason: "verified" }
  ]);

  assert.equal(result.requiredFields, 2);
  assert.equal(result.missingRequired.length, 0);
  assert.equal(result.readyForManualSubmitReview, true);
}

function testMissingRequiredField() {
  const result = audit.audit([
    field("location", "Current location", "combobox", true, "", { valid: false })
  ], [
    { token: "location", action: "review", reason: "Select an ATS suggestion." }
  ]);

  assert.equal(result.readyForManualSubmitReview, false);
  assert.equal(result.missingRequired.length, 1);
  assert.equal(result.missingRequired[0].label, "Current location");
  assert.equal(result.requiredAttention.length, 1);
}

function testRadioGroupCountsOnce() {
  const fields = [
    field("yes", "Are you authorized to work? Yes", "radio", true, "", { valid: false, groupKey: "workauth" }),
    field("no", "Are you authorized to work? No", "radio", true, "", { valid: false, groupKey: "workauth" })
  ];
  const result = audit.audit(fields, [
    { token: "yes", action: "fill", reason: "verified" },
    { token: "no", action: "fill", reason: "verified" }
  ]);

  assert.equal(result.requiredFields, 1);
  assert.equal(result.missingRequired.length, 1);
}

function testSelectedRadioGroupIsReady() {
  const fields = [
    field("yes", "Are you authorized to work? Yes", "radio", true, "yes", { valid: true, groupKey: "workauth", checked: true }),
    field("no", "Are you authorized to work? No", "radio", true, "", { valid: true, groupKey: "workauth", checked: false })
  ];
  const result = audit.audit(fields, []);
  assert.equal(result.missingRequired.length, 0);
}

function testBlockedVerificationIsVisible() {
  const result = audit.audit([
    field("code", "Security Code", "text", true, "", { valid: false })
  ], [
    { token: "code", action: "blocked", reason: "Human verification is never automated." }
  ]);

  assert.equal(result.blocked.length, 1);
  assert.equal(result.requiredAttention.length, 1);
  assert.equal(result.missingRequired.length, 1);
}

testReadyForm();
testMissingRequiredField();
testRadioGroupCountsOnce();
testSelectedRadioGroupIsReady();
testBlockedVerificationIsVisible();
console.log("ATS form audit tests passed");
