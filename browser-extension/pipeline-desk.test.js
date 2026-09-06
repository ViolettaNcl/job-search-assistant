const assert = require("node:assert/strict");
const desk = require("./pipeline-desk.js");

const id = "33333333-3333-4333-8333-333333333333";

assert.equal(desk.safeHttpUrl("javascript:alert(1)"), "");
assert.equal(desk.normalizeRow({ id: "bad", status: "Applied" }), null);
assert.equal(desk.normalizeRow({ id, status: "New" }), null);

const row = desk.normalizeRow({
  id,
  title: " Junior   .NET Developer ",
  company: "Acme",
  url: "https://jobs.example.com/123",
  status: "Applied",
  matchScore: 150
});
assert.equal(row.title, "Junior .NET Developer");
assert.equal(row.matchScore, 100);
assert.equal(row.status, "Applied");

assert.deepEqual(desk.allowedTargets("Applied"), ["HrContact", "HrInterview", "TechInterview", "TestTask", "Offer", "Rejected"]);
assert.deepEqual(desk.allowedTargets("Offer"), []);
assert.ok(desk.allowedTargets("TestTask").includes("TechInterview"));
assert.equal(desk.label("HrContact"), "HR contacted me");

const request = desk.buildStatusRequest(id, "Applied", "HrContact", "Recruiter replied on HH");
assert.equal(request.path, `/api/vacancies/${id}/status`);
assert.equal(request.method, "POST");
assert.deepEqual(request.body, { status: "HrContact", note: "Recruiter replied on HH" });
assert.equal(desk.buildStatusRequest(id, "Offer", "HrContact"), null, "terminal Offer must not be downgraded in compact desk");
assert.equal(desk.buildStatusRequest("../../bad", "Applied", "Rejected"), null);
assert.equal(desk.buildStatusRequest(id, "Applied", "Skipped"), null);

const rows = desk.normalizePipeline([
  { id, title: "A", company: "Acme", status: "Applied" },
  { id: "44444444-4444-4444-8444-444444444444", title: "B", company: "Beta", status: "Offer" },
  { id: "55555555-5555-4555-8555-555555555555", title: "C", company: "Gamma", status: "Rejected" }
]);
assert.equal(rows.length, 2, "Rejected rows are no longer active pipeline selections");

console.log("pipeline-desk tests passed");
