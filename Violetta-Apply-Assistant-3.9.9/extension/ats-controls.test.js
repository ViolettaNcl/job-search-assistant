const assert = require("node:assert/strict");
const controls = require("./ats-controls.js");

assert.equal(controls.classifyElementMeta({ tagName: "input", role: "combobox" }), "combobox");
assert.equal(controls.classifyElementMeta({ tagName: "div", role: "radiogroup" }), "radiogroup");
assert.equal(controls.classifyElementMeta({ tagName: "button", ariaHasPopup: "listbox" }), "combobox");
assert.equal(controls.classifyElementMeta({ tagName: "div", role: "button", ariaHasPopup: "true" }), "combobox");
assert.equal(controls.classifyElementMeta({ tagName: "select" }), "");
assert.equal(controls.classifyElementMeta({ tagName: "button", ariaHasPopup: "menu" }), "");
assert.equal(controls.isInteractiveReviewType("combobox"), true);
assert.equal(controls.isInteractiveReviewType("radiogroup"), true);
assert.equal(controls.isInteractiveReviewType("select"), false);

console.log("ats-controls tests passed");
