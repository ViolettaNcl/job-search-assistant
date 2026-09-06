const assert = require("node:assert/strict");
const controls = require("./final-submit-control.js");

assert.equal(controls.score("Continue"), -100);
assert.equal(controls.score("Next"), -100);
assert.equal(controls.score("Save and continue"), -100);
assert.equal(controls.score("Submit application") > controls.score("Apply"), true);
assert.equal(controls.score("Отправить отклик") >= 10, true);

let choice = controls.choose([
  { label: "Continue", metadata: { submitType: true, inForm: true, applicationRoute: true } },
  { label: "Submit application", metadata: { submitType: true, inForm: true, applicationRoute: true } }
]);
assert.equal(choice.found, true);
assert.equal(choice.candidate.label, "Submit application");

choice = controls.choose([
  { label: "Submit application", metadata: { submitType: true, inForm: true, applicationRoute: true } },
  { label: "Submit application", metadata: { submitType: true, inForm: true, applicationRoute: true } }
]);
assert.equal(choice.found, false);
assert.equal(choice.ambiguous, true);
assert.equal(choice.count, 2);

choice = controls.choose([{ label: "Back" }, { label: "Save" }]);
assert.equal(choice.found, false);
assert.equal(choice.ambiguous, false);

choice = controls.choose([
  { label: "Apply", metadata: { submitType: false, inForm: false, applicationRoute: false } },
  { label: "Submit", metadata: { submitType: true, inForm: true, applicationRoute: true } }
]);
assert.equal(choice.candidate.label, "Submit");

console.log("final-submit-control tests passed");
