const assert=require('node:assert/strict'),events=require('./events');
assert.equal(events.dateField([{d:'2026-04-01T23:00:00Z'},{d:'2026-04-01T00:00:00Z'}],'d').label,'2026-04-01');
assert.equal(events.dateField([{d:'2026-02-30'}],'d').value,null);
assert.match(events.dateField([{d:'2026-04-01'},{d:'2026-04-02'}],'d').label,/Conflicting/);
assert.equal(events.dateField([{d:'9999-01-01'}],'d').value,null);
assert.equal(events.dateField([{d:null}],'d').label,'Not recorded');
console.log('PASS: optional event date validation and calendar-day conflicts.');
