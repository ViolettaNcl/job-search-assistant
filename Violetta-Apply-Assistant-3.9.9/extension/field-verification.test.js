const assert = require("node:assert/strict");
const verification = require("./field-verification.js");

assert.equal(verification.matchesExpected("text", ["Violetta Nicolaou"], "Violetta Nicolaou"), true);
assert.equal(verification.matchesExpected("text", ["Violetta"], "Violetta Nicolaou"), false);
assert.equal(verification.matchesExpected("textarea", ["Hello\nworld"], "Hello world"), true);
assert.equal(verification.matchesExpected("select", ["true", "Yes"], "Yes"), true);
assert.equal(verification.matchesExpected("select", ["false", "No"], "No"), true);
assert.equal(verification.matchesExpected("select", ["DE", "Germany"], "Germany"), true);
assert.equal(verification.matchesExpected("radio", ["on", "Yes"], "Yes"), true);
assert.equal(verification.matchesExpected("radio", ["on", "No"], "Yes"), false);
assert.equal(verification.matchesExpected("email", ["violetta@example.com"], "other@example.com"), false);
assert.equal(verification.booleanMeaning("Да"), true);
assert.equal(verification.booleanMeaning("Нет"), false);
assert.equal(verification.booleanMeaning("maybe"), null);

console.log("field-verification tests passed");
