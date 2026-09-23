const test=require('node:test');const assert=require('node:assert/strict');const S=require('./application-state-machine');
test('auto-apply state machine follows the normal path',()=>{let s=S.transition('IDLE','ANALYZING');s=S.transition(s,'CV_SELECTED');s=S.transition(s,'LETTER_READY');s=S.transition(s,'SUBMITTING');s=S.transition(s,'CONFIRMED');assert.equal(s.state,'CONFIRMED');assert.equal(S.label(s.state),'✓ Отклик отправлен');});
test('invalid terminal transition stays terminal',()=>{const s=S.transition({state:'CONFIRMED'},'SUBMITTING');assert.equal(s.state,'CONFIRMED');assert.equal(s.invalidTransition.to,'SUBMITTING');});
test('review state can retry after user fixes a field',()=>{let s=S.transition({state:'REVIEW_REQUIRED'},'ANALYZING');assert.equal(s.state,'ANALYZING');});
