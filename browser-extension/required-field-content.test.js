const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

class FakeInput {
  constructor({ type = "text", name = "", required = false, checked = false, ariaRequired = "", form = null } = {}) {
    this.type = type;
    this.name = name;
    this.required = required;
    this.checked = checked;
    this.form = form;
    this.attrs = new Map();
    if (required) this.attrs.set("required", "");
    if (ariaRequired) this.attrs.set("aria-required", ariaRequired);
  }
  hasAttribute(name) { return this.attrs.has(name); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  querySelector() { return null; }
}

const form = { id: "apply-form" };
const firstName = new FakeInput({ type: "text", required: true, form });
const yes = new FakeInput({ type: "radio", name: "workAuth", required: true, checked: false, form });
const no = new FakeInput({ type: "radio", name: "workAuth", checked: false, form });
const optional = new FakeInput({ type: "text", form });

const byToken = new Map([
  ["first", firstName],
  ["yes", yes],
  ["no", no],
  ["optional", optional]
]);

const context = {
  console,
  HTMLInputElement: FakeInput,
  CSS: { escape: value => String(value) },
  document: {
    querySelector(selector) {
      const match = selector.match(/data-vja-field-token="([^"]+)"/);
      return match ? byToken.get(match[1]) || null : null;
    },
    getElementsByName(name) {
      return [...byToken.values()].filter(el => el.name === name);
    }
  }
};
context.window = context;
vm.createContext(context);

const helper = fs.readFileSync(path.join(__dirname, "required-field-state.js"), "utf8");
const wrapper = fs.readFileSync(path.join(__dirname, "required-field-content.js"), "utf8");
vm.runInContext(helper, context);

context.scanFields = () => ({
  ats: "generic",
  fields: [
    { token: "first", label: "First name", type: "text", currentValue: "Violetta" },
    { token: "yes", label: "Work authorization Yes", type: "radio", currentValue: "" },
    { token: "no", label: "Work authorization No", type: "radio", currentValue: "" },
    { token: "optional", label: "Portfolio URL", type: "text", currentValue: "" }
  ],
  uploadFields: 0
});

vm.runInContext(wrapper, context);
let scan = context.scanFields();
assert.equal(scan.fields[0].required, true);
assert.equal(scan.fields[0].requiredSatisfied, true);
assert.equal(scan.fields[1].required, true);
assert.equal(scan.fields[1].requiredSatisfied, false);
assert.equal(scan.fields[1].requiredKey, "radio:apply-form:workAuth");
assert.equal(scan.fields[2].requiredKey, "radio:apply-form:workAuth");
assert.equal(scan.fields[3].required, false);
assert.equal(scan.requiredMissing, 1, "one required radio group should count once");

yes.checked = true;
scan = context.scanFields();
assert.equal(scan.fields[1].requiredSatisfied, true);
assert.equal(scan.fields[2].requiredSatisfied, true);
assert.equal(scan.requiredMissing, 0);

console.log("required-field-content tests passed");