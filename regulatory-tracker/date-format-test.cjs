const assert=require('node:assert/strict'),dates=require('./date-format');
assert.equal(dates.format('2026-10-23'),'23 Oct 2026');
assert.equal(dates.format('2026-09-09'),'09 Sep 2026');
for(let month=0;month<12;month++)assert.equal(dates.format(Date.UTC(2026,month,1)),'01 '+dates.months[month]+' 2026');
assert.equal(dates.format('2026-10-23T00:15:00+14:00'),'23 Oct 2026');
assert.equal(dates.format('2026-10-23T23:45:00-12:00'),'23 Oct 2026');
assert.equal(dates.format(new Date('2026-10-23T23:45:00-12:00')),'24 Oct 2026');
assert.equal(dates.format('2028-02-29'),'29 Feb 2028');
assert.equal(dates.format('9 sep 2026'),'09 Sep 2026');
assert.equal(dates.format('9000-12-31'),'31 Dec 9000');
for(const value of [null,undefined,'',NaN,Infinity,new Date(NaN),'2026-02-29','31 Feb 2026','2026-13-01','2026-10-00','not a date'])assert.equal(dates.format(value),'Not recorded');
assert.equal(dates.recorded('not a date'),'not a date');
assert.equal(dates.recorded('2026-02-31'),'2026-02-31');
for(const value of ['2026-09-05T99:99Z','2026-09-05T12:00:60Z','2026-09-05T12:00:00+24:00','2026-09-05T12:00:00+01:99']){
 assert.equal(dates.recorded(value),value);
 assert.equal(dates.format(value),'Not recorded');
}
assert.equal(dates.recorded('2026-10-23'),'23 Oct 2026');
console.log('PASS: consistent English date display, all months, leap days, offsets, invalid input and sentinel years.');
