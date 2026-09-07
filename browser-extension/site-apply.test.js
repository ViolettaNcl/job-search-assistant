const test = require('node:test');
const assert = require('node:assert/strict');
const siteApply = require('./site-apply.js');

function button(text) {
  return {
    innerText: text,
    disabled: false,
    offsetParent: {},
    getAttribute() { return ''; },
    getClientRects() { return [1]; }
  };
}

function documentWithButtons(values) {
  const buttons = values.map(button);
  return {
    querySelectorAll(selector) {
      if (selector.includes('button')) return buttons;
      return [];
    }
  };
}

test('detects Russian Habr-style Откликнуться trigger', () => {
  const doc = documentWithButtons(['Сохранить', 'Откликнуться']);
  assert.equal(siteApply.findApplyTrigger(doc).innerText, 'Откликнуться');
});

test('detects English Apply now trigger', () => {
  const doc = documentWithButtons(['Share', 'Apply now']);
  assert.equal(siteApply.findApplyTrigger(doc).innerText, 'Apply now');
});

test('does not confuse unrelated buttons with Apply', () => {
  const doc = documentWithButtons(['Save', 'Share', 'Cancel']);
  assert.equal(siteApply.findApplyTrigger(doc), null);
});
