const assert = require("node:assert/strict");
const gate = require("./final-review-gate.js");

assert.equal(gate.evaluate(null).state, "not-analyzed");

let result = gate.evaluate({
  reviewCount: 1,
  failedCount: 1,
  blockedCount: 1,
  cvCheckpoint: { status: "inserted" }
});
assert.equal(result.state, "unresolved");
assert.equal(result.canLocateSubmit, false);
assert.match(result.title, /3 checkpoints/);

const attachmentReadiness = {
  reviewCount: 0,
  failedCount: 0,
  blockedCount: 0,
  cvCheckpoint: { status: "check" }
};
result = gate.evaluate(attachmentReadiness);
assert.equal(result.state, "attachment-review");
assert.equal(result.canConfirmReview, false);
assert.equal(result.canConfirmAttachment, true);

result = gate.evaluate(attachmentReadiness, { found: false }, { attachmentVerified: true });
assert.equal(result.state, "ready-no-submit");
assert.equal(result.canConfirmReview, true);

result = gate.evaluate({
  reviewCount: 0,
  failedCount: 0,
  blockedCount: 0,
  cvCheckpoint: { status: "inserted" }
}, { found: true, label: "Submit application" });
assert.equal(result.state, "ready");
assert.equal(result.canConfirmReview, true);
assert.equal(result.submitLabel, "Submit application");

const completed = gate.afterCandidateReview(result);
assert.equal(completed.readyToSubmit, true);
assert.match(completed.title, /Submit application/);

result = gate.evaluate({
  reviewCount: 0,
  failedCount: 0,
  blockedCount: 0,
  cvCheckpoint: { status: "unknown" }
}, { found: false, ambiguous: true, count: 2 });
assert.equal(result.state, "submit-ambiguous");
assert.equal(result.canConfirmReview, true);

result = gate.evaluate({
  reviewCount: 0,
  failedCount: 0,
  blockedCount: 0,
  cvCheckpoint: { status: "unknown" }
}, { found: false, ambiguous: false, count: 0 });
assert.equal(result.state, "ready-no-submit");
assert.equal(gate.afterCandidateReview(result).readyToSubmit, true);

console.log("final-review-gate tests passed");
