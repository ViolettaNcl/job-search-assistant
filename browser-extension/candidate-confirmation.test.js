const assert = require("node:assert/strict");
const confirmation = require("./candidate-confirmation.js");

(async () => {
  const field = {
    token: "vja-1",
    label: "Are you legally authorized to work in this country?",
    type: "select",
    currentValue: "Yes"
  };

  const state = await confirmation.confirm(field, null, 12345);
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].at, 12345);
  assert.equal(state.records[0].fieldHash.length, 64);
  assert.equal(state.records[0].valueHash.length, 64);

  const serialized = JSON.stringify(state).toLowerCase();
  assert.equal(serialized.includes("authorized"), false);
  assert.equal(serialized.includes('"yes"'), false);

  let annotated = await confirmation.annotate([field], state);
  assert.equal(annotated[0].candidateConfirmed, true);

  annotated = await confirmation.annotate([{ ...field, currentValue: "No" }], state);
  assert.equal(annotated[0].candidateConfirmed, false, "changing the answer must invalidate confirmation");

  annotated = await confirmation.annotate([{ ...field, label: "Different question" }], state);
  assert.equal(annotated[0].candidateConfirmed, false, "changing field identity must invalidate confirmation");

  const second = await confirmation.confirm({
    token: "vja-2",
    label: "Notice period",
    type: "text",
    currentValue: "2 weeks"
  }, state, 45678);
  assert.equal(second.records.length, 2);

  await assert.rejects(
    confirmation.confirm({ label: "Empty required field", type: "text", currentValue: "" }, state),
    /answer or select/i
  );

  const polluted = confirmation.sanitizeState({
    salt: state.salt,
    records: [{ ...state.records[0], answer: "secret", label: "sensitive label" }]
  });
  assert.deepEqual(Object.keys(polluted.records[0]).sort(), ["at", "fieldHash", "valueHash"]);

  console.log("candidate-confirmation tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});