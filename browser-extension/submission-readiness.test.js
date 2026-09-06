const assert = require("node:assert/strict");
const readiness = require("./submission-readiness.js");

function field(token, label, currentValue = "", type = "text", extra = {}) {
  return { token, label, currentValue, type, ...extra };
}

assert.equal(readiness.build({ fields: [], uploadFields: 0 }, { fields: [] }).state, "clear");

const review = readiness.build(
  { fields: [field("a", "Work authorization", "", "combobox")], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", memoryKey: "workAuthorization", reason: "Choose manually." }] }
);
assert.equal(review.state, "review");
assert.equal(review.reviewCount, 1);
assert.equal(review.failedCount, 0);
assert.equal(review.items[0].label, "Work authorization");
assert.equal(review.items[0].currentValuePresent, false);

const answeredReview = readiness.build(
  { fields: [field("a", "Location", "Berlin", "combobox")], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", reason: "Verify ATS location." }] }
);
assert.equal(answeredReview.items[0].currentValuePresent, true);
assert.equal(answeredReview.state, "review");

const confirmedReview = readiness.build(
  { fields: [field("a", "Location", "Berlin", "combobox", { candidateConfirmed: true })], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", reason: "Verify ATS location." }] }
);
assert.equal(confirmedReview.state, "clear");
assert.equal(confirmedReview.reviewCount, 0);
assert.equal(confirmedReview.items.length, 0);
assert.equal(confirmedReview.confirmedCount, 1);
assert.match(confirmedReview.detail, /candidate-reviewed checkpoint/i);

const failedFill = readiness.build(
  { fields: [field("f", "Email", "", "email", { fillFailed: true })], uploadFields: 0 },
  { fields: [{ token: "f", action: "fill", value: "violetta@example.com", memoryKey: "email", reason: "Verified email." }] }
);
assert.equal(failedFill.state, "review");
assert.equal(failedFill.failedCount, 1);
assert.equal(failedFill.reviewCount, 0);
assert.equal(failedFill.items[0].action, "failed");
assert.match(failedFill.items[0].reason, /did not persist|could not be verified/i);

const failedFillWithCurrentValue = readiness.build(
  { fields: [field("f", "Email", "violetta@example.com", "email", { fillFailed: true })], uploadFields: 0 },
  { fields: [{ token: "f", action: "fill", value: "violetta@example.com" }] }
);
assert.equal(failedFillWithCurrentValue.items[0].currentValuePresent, true);
assert.equal(failedFillWithCurrentValue.failedCount, 1);

const confirmedFailedFill = readiness.build(
  { fields: [field("f", "Email", "violetta@example.com", "email", { fillFailed: true, candidateConfirmed: true })], uploadFields: 0 },
  { fields: [{ token: "f", action: "fill", value: "violetta@example.com" }] }
);
assert.equal(confirmedFailedFill.state, "clear");
assert.equal(confirmedFailedFill.failedCount, 0);
assert.equal(confirmedFailedFill.confirmedCount, 1);

const blocked = readiness.build(
  { fields: [field("a", "Salary"), field("b", "Date of birth", "1990-01-01", "date")], uploadFields: 1 },
  { fields: [
    { token: "a", action: "review", reason: "Choose salary." },
    { token: "b", action: "blocked", reason: "Sensitive field." }
  ] },
  { recommendedName: "Violetta-English.pdf" }
);
assert.equal(blocked.state, "blocked");
assert.equal(blocked.blockedCount, 1);
assert.equal(blocked.reviewCount, 1);
assert.equal(blocked.failedCount, 0);
assert.equal(blocked.cvCheckpoint.status, "check");

const confirmedBlocked = readiness.build(
  { fields: [field("b", "Date of birth", "1990-01-01", "date", { candidateConfirmed: true })], uploadFields: 0 },
  { fields: [{ token: "b", action: "blocked", reason: "Sensitive field." }] }
);
assert.equal(confirmedBlocked.state, "clear");
assert.equal(confirmedBlocked.blockedCount, 0);
assert.equal(confirmedBlocked.confirmedCount, 1);

const inserted = readiness.build(
  { fields: [], uploadFields: 1 },
  { fields: [] },
  { recommendedName: "English.pdf", uploadedName: "English.pdf" }
);
assert.equal(inserted.cvCheckpoint.status, "inserted");
assert.match(inserted.cvCheckpoint.label, /English\.pdf/);

const fallback = readiness.build(
  { fields: [field("x", "")], uploadFields: 0 },
  { fields: [{ token: "x", action: "review", memoryKey: "custom:question", reason: "" }] }
);
assert.equal(fallback.items[0].label, "custom:question");
assert.ok(fallback.items[0].reason.length > 0);

console.log("submission-readiness tests passed");
