const assert = require("node:assert/strict");
const navigator = require("./review-navigator.js");

const items = [
  { token: "blocked", action: "blocked", label: "Legal declaration", reason: "Manual answer required." },
  { token: "review", action: "review", label: "Salary", reason: "Review this answer." },
  { token: "failed", action: "failed", label: "Email", reason: "Autofill did not persist.", currentValuePresent: true },
  { token: "ignored", action: "fill", label: "Name" }
];

const ordered = navigator.ordered(items);
assert.deepEqual(ordered.map(x => x.token), ["failed", "review", "blocked"]);

let selection = navigator.next(items);
assert.equal(selection.item.token, "failed");
assert.equal(selection.index, 0);
assert.equal(selection.total, 3);
assert.equal(navigator.badge(selection.item), "Verify fill");
assert.match(navigator.summary(selection), /^1\/3 · Verify fill · Email/);

selection = navigator.next(items, "failed");
assert.equal(selection.item.token, "review");
selection = navigator.next(items, "review");
assert.equal(selection.item.token, "blocked");
selection = navigator.next(items, "blocked");
assert.equal(selection.item.token, "failed");

selection = navigator.next([]);
assert.equal(selection.item, null);
assert.equal(navigator.summary(selection), "No unresolved detected fields.");

assert.equal(navigator.badge({ action: "review", currentValuePresent: false }), "Review");
assert.equal(navigator.badge({ action: "blocked" }), "Manual only");

console.log("review-navigator tests passed");