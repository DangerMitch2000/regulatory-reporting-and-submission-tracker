const assert=require('node:assert/strict');
const {compile,matches,years}=require('./submission-period');
const dated=value=>({state:'valid',date:Date.parse(value+'T00:00:00Z')});
const y=compile({mode:'year:2027'});
for(const day of ['2027-01-01','2027-06-10','2027-12-31'])assert.equal(matches(dated(day),y),true);
for(const day of ['2026-12-31','2028-01-01'])assert.equal(matches(dated(day),y),false);
const range=compile({mode:'custom',from:'2027-03-01',to:'2027-03-31'});
assert.equal(matches(dated('2027-03-01'),range),true);assert.equal(matches(dated('2027-03-31'),range),true);assert.equal(matches(dated('2027-04-01'),range),false);
assert.equal(matches(dated('2020-01-01'),compile({mode:'custom',to:'2026-12-31'})),true);
assert.equal(matches(dated('2030-01-01'),compile({mode:'custom',from:'2027-01-01'})),true);
assert.equal(matches(dated('1960-01-01'),compile({mode:'custom'})),true);
for(const state of ['missing','unmapped','conflicting','invalid']){assert.equal(matches({state,date:null},compile({mode:'all'})),true);assert.equal(matches({state,date:null},compile({mode:'undated'})),true);assert.equal(matches({state,date:null},y),false);}
assert.equal(matches(dated('2027-01-01'),compile({mode:'undated'})),false);
for(const selection of [{mode:'custom',from:'2027-02-30'},{mode:'custom',from:'2028-01-01',to:'2027-01-01'},{mode:'custom',to:'9999-01-01'},{mode:'year:9999'},{mode:'bad'}]){const period=compile(selection);assert.ok(period.error);assert.equal(matches(dated('2027-01-01'),period),false);}
assert.equal(matches(dated('2028-02-29'),compile({mode:'custom',from:'2028-02-29',to:'2028-02-29'})),true);
assert.deepEqual(years([dated('2027-01-01'),dated('2026-01-01'),dated('2027-04-01'),{state:'conflicting',date:Date.parse('2025-01-01')},dated('9999-01-01')]),[2027,2026]);
console.log('PASS: inclusive years/ranges, open bounds, leap dates, unusable dates and invalid-range handling.');
