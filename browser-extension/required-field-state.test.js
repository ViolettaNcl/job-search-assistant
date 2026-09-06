const assert = require("node:assert/strict");
const required = require("./required-field-state.js");

assert.equal(required.labelMarksRequired("First name *"), true);
assert.equal(required.labelMarksRequired("Email (required)"), true);
assert.equal(required.labelMarksRequired("Обязательное поле"), true);
assert.equal(required.labelMarksRequired("Optional portfolio URL"), false);
assert.equal(required.labelMarksRequired("C# / .NET"), false);

assert.deepEqual(
  required.evaluate({ token: "a", nativeRequired: true, currentValue: "" }),
  { required: true, satisfied: false, missing: true, key: "a", currentValuePresent: false }
);
assert.equal(required.evaluate({ token: "b", ariaRequired: true, currentValue: "Athens" }).missing, false);
assert.equal(required.evaluate({ token: "c", label: "Phone *", currentValue: "" }).missing, true);
assert.equal(required.evaluate({ token: "d", label: "Phone", currentValue: "" }).missing, false);

const requiredRadio = required.evaluate({
  token: "r1",
  groupKey: "radio:form:workAuth",
  groupRequired: true,
  groupSatisfied: false,
  currentValue: ""
});
assert.equal(requiredRadio.required, true);
assert.equal(requiredRadio.missing, true);
assert.equal(requiredRadio.key, "radio:form:workAuth");
assert.equal(required.evaluate({ groupRequired: true, groupSatisfied: true, currentValue: "" }).missing, false);

const unique = required.uniqueMissing([
  { token: "r1", required: true, requiredSatisfied: false, requiredKey: "radio:form:q" },
  { token: "r2", required: true, requiredSatisfied: false, requiredKey: "radio:form:q" },
  { token: "x", required: true, requiredSatisfied: false, label: "Cover letter" },
  { token: "done", required: true, requiredSatisfied: true },
  { token: "optional", required: false, requiredSatisfied: false }
]);
assert.equal(unique.length, 2);
assert.equal(unique[0].token, "r1");
assert.equal(unique[1].token, "x");

console.log("required-field-state tests passed");