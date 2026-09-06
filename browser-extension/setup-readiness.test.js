const assert = require("assert");
const readiness = require("./setup-readiness.js");

const allReady = readiness.build({
  backend: { reachable: true, ready: true },
  candidate: { coreReady: true },
  contacts: { phone: true, linkedin: true },
  cv: { english: true, russian: true },
  queue: { strongCount: 4 },
  hh: { authorized: true, resumeSelected: true }
});
assert.equal(allReady.state, "ready");
assert.equal(allReady.capabilities.externalAts, true);
assert.equal(allReady.capabilities.contactAutofill, true);
assert.equal(allReady.capabilities.hhDirect, true);

const hhMissing = readiness.build({
  backend: { reachable: true, ready: true },
  candidate: { coreReady: true },
  contacts: { phone: true, linkedin: true },
  cv: { english: true, russian: true },
  queue: { strongCount: 2 },
  hh: { authorized: false, resumeSelected: false }
});
assert.equal(hhMissing.state, "ready", "HH must remain optional for external ATS applications");
assert.equal(hhMissing.capabilities.externalAts, true);
assert.equal(hhMissing.capabilities.hhDirect, false);

const contactsMissing = readiness.build({
  backend: { reachable: true, ready: true },
  candidate: { coreReady: true },
  contacts: { phone: true, linkedin: false },
  cv: { english: true, russian: true },
  queue: { strongCount: 3 },
  hh: { authorized: true, resumeSelected: true }
});
assert.equal(contactsMissing.state, "attention");
assert.equal(contactsMissing.capabilities.externalAts, true, "missing optional contact facts must not block application preparation");
assert.equal(contactsMissing.capabilities.contactAutofill, false);
assert.match(contactsMissing.items.find(x => x.id === "contacts").detail, /LinkedIn/);

const cvMissing = readiness.build({
  backend: { reachable: true, ready: true },
  candidate: { coreReady: true },
  contacts: { phone: true, linkedin: true },
  cv: { english: true, russian: false },
  queue: { strongCount: 3 },
  hh: { authorized: true, resumeSelected: true }
});
assert.equal(cvMissing.state, "attention");
assert.equal(cvMissing.capabilities.cvAutoload, false);

const queueEmpty = readiness.build({
  backend: { reachable: true, ready: true },
  candidate: { coreReady: true },
  contacts: { phone: true, linkedin: true },
  cv: { english: true, russian: true },
  queue: { strongCount: 0 },
  hh: { authorized: true, resumeSelected: true }
});
assert.equal(queueEmpty.state, "attention");
assert.equal(queueEmpty.capabilities.dailyQueue, false);

const backendDown = readiness.build({
  backend: { reachable: false, ready: false },
  candidate: { coreReady: true },
  contacts: { phone: true, linkedin: true },
  cv: { english: true, russian: true },
  queue: { strongCount: 5 },
  hh: { authorized: true, resumeSelected: true }
});
assert.equal(backendDown.state, "blocked");
assert.equal(backendDown.capabilities.externalAts, false);

const candidateIncomplete = readiness.build({
  backend: { reachable: true, ready: true },
  candidate: { coreReady: false },
  contacts: { phone: true, linkedin: true },
  cv: { english: true, russian: true },
  queue: { strongCount: 5 },
  hh: { authorized: true, resumeSelected: true }
});
assert.equal(candidateIncomplete.state, "blocked");

console.log("setup-readiness tests passed");
