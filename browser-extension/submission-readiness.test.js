const assert = require("node:assert/strict");
const readiness = require("./submission-readiness.js");

function field(token, label, currentValue = "", type = "text") {
  return { token, label, currentValue, type };
}

assert.equal(readiness.build({ fields: [], uploadFields: 0 }, { fields: [] }).state, "clear");

const review = readiness.build(
  { fields: [field("a", "Work authorization", "", "combobox")], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", memoryKey: "workAuthorization", reason: "Choose manually." }] }
);
assert.equal(review.state, "review");
assert.equal(review.reviewCount, 1);
assert.equal(review.items[0].label, "Work authorization");
assert.equal(review.items[0].currentValuePresent, false);

const answeredReview = readiness.build(
  { fields: [field("a", "Location", "Berlin", "combobox")], uploadFields: 0 },
  { fields: [{ token: "a", action: "review", reason: "Verify ATS location." }] }
);
assert.equal(answeredReview.items[0].currentValuePresent, true);
assert.equal(answeredReview.state, "review");

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
