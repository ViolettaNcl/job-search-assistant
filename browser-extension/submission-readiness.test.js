const assert = require("node:assert/strict");
const readiness = require("./submission-readiness.js");

function field(token, label, currentValue = "", type = "text", extra = {}) {
  return { token, label, currentValue, type, ...extra };
}

const empty = readiness.build({ fields: [], uploadFields: 0 }, { fields: [] });
assert.equal(empty.state, "clear");
assert.equal(empty.requiredCount, 0);

const missingRequired = readiness.build(
  { fields: [field("req", "First name *", "", "text", { required: true, requiredSatisfied: false, requiredKey: "req" })], uploadFields: 0 },
  { fields: [{ token: "req", action: "fill", value: "Violetta", reason: "Verified profile name." }] }
);
assert.equal(missingRequired.state, "review");
assert.equal(missingRequired.requiredCount, 1);
assert.equal(missingRequired.items[0].action, "required");
assert.match(missingRequired.items[0].reason, /required/i);

const completedRequired = readiness.build(
  { fields: [field("req", "First name *", "Violetta", "text", { required: true, requiredSatisfied: true, requiredKey: "req" })], uploadFields: 0 },
  { fields: [{ token: "req", action: "fill", value: "Violetta" }] }
);
assert.equal(completedRequired.state, "clear");
assert.equal(completedRequired.requiredCount, 0);

const groupedRequired = readiness.build(
  { fields: [
    field("r1", "Are you authorized? Yes", "", "radio", { required: true, requiredSatisfied: false, requiredKey: "radio:auth" }),
    field("r2", "Are you authorized? No", "", "radio", { required: true, requiredSatisfied: false, requiredKey: "radio:auth" })
  ], uploadFields: 0 },
  { fields: [] }
);
assert.equal(groupedRequired.requiredCount, 1);
assert.equal(groupedRequired.items.length, 1);

const requiredAlreadyReviewed = readiness.build(
  { fields: [field("a", "Work authorization *", "", "combobox", { required: true, requiredSatisfied: false, requiredKey: "auth" })], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", memoryKey: "workAuthorization", reason: "Choose manually." }] }
);
assert.equal(requiredAlreadyReviewed.state, "review");
assert.equal(requiredAlreadyReviewed.reviewCount, 1);
assert.equal(requiredAlreadyReviewed.requiredCount, 0, "required field already represented by review must not be duplicated");
assert.equal(requiredAlreadyReviewed.items.length, 1);

const review = readiness.build(
  { fields: [field("a", "Work authorization", "", "combobox")], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", memoryKey: "workAuthorization", reason: "Choose manually." }] }
);
assert.equal(review.state, "review");
assert.equal(review.reviewCount, 1);
assert.equal(review.failedCount, 0);
assert.equal(review.requiredCount, 0);
assert.equal(review.items[0].label, "Work authorization");
assert.equal(review.items[0].currentValuePresent, false);

const answeredReview = readiness.build(
  { fields: [field("a", "Location", "Berlin", "combobox")], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", reason: "Verify ATS location." }] }
);
assert.equal(answeredReview.items[0].currentValuePresent, true);
assert.equal(answeredReview.state, "review");

const failedFill = readiness.build(
  { fields: [field("f", "Email", "", "email", { fillFailed: true })], uploadFields: 0 },
  { fields: [{ token: "f", action: "fill", value: "violetta@example.com", memoryKey: "email", reason: "Verified email." }] }
);
assert.equal(failedFill.state, "review");
assert.equal(failedFill.failedCount, 1);
assert.equal(failedFill.reviewCount, 0);
assert.equal(failedFill.requiredCount, 0);
assert.equal(failedFill.items[0].action, "failed");
assert.match(failedFill.items[0].reason, /did not persist|could not be verified/i);

const failedRequiredFill = readiness.build(
  { fields: [field("f", "Email *", "", "email", { fillFailed: true, required: true, requiredSatisfied: false, requiredKey: "email" })], uploadFields: 0 },
  { fields: [{ token: "f", action: "fill", value: "violetta@example.com" }] }
);
assert.equal(failedRequiredFill.failedCount, 1);
assert.equal(failedRequiredFill.requiredCount, 0, "failed fill already represents required field");
assert.equal(failedRequiredFill.items.length, 1);

const failedFillWithCurrentValue = readiness.build(
  { fields: [field("f", "Email", "violetta@example.com", "email", { fillFailed: true })], uploadFields: 0 },
  { fields: [{ token: "f", action: "fill", value: "violetta@example.com" }] }
);
assert.equal(failedFillWithCurrentValue.items[0].currentValuePresent, true);
assert.equal(failedFillWithCurrentValue.failedCount, 1);

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
assert.equal(blocked.requiredCount, 0);
assert.equal(blocked.cvCheckpoint.status, "check");

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
