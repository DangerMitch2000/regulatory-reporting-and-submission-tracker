import assert from 'node:assert/strict';
import {dateField,mapTable,planningDates,parsePlanningDate} from './logic.mjs';

const asOf=Date.UTC(2026,10,11),read=value=>dateField([{d:value}],'d',asOf);
for(const value of ['2026-02-30','10/11/2026','not a date','2026-11-10T25:00:00Z']){
 const result=read(value);
 assert.equal(result.kind,'invalid');
 assert.equal(result.value,null);
 assert.equal(result.label,'Invalid / unrecognized date format');
 assert.deepEqual(result.raw,[value],'unusable source date remains available for review');
}
for(const value of ['1899-12-31','2101-01-01','9000-01-01']){
 const result=read(value);
 assert.equal(result.kind,'invalid');
 assert.equal(result.value,null);
 assert.equal(result.label,'Outside 1900–2100');
 assert.deepEqual(result.raw,[value]);
}
for(const value of ['1900-01-01','2100-12-31','2026-11-10T12:34:56.123Z','10 Nov 2026'])assert.equal(read(value).kind,'dated');
assert.equal(read('10/11/2026').value,null,'never guess day/month order');
assert.equal(read(2026).kind,'invalid','a numeric Date-hierarchy year is not an epoch date');
assert.equal(read(46336).kind,'invalid','an untyped Excel serial is not silently guessed');
assert.equal(read(Date.UTC(2026,10,10)).kind,'invalid','numeric date encoding remains unsupported until source encoding is known');
assert.equal(read('').kind,'missing');
assert.equal(dateField([{d:'2026-11-10'},{d:'2026-11-11'}],'d',asOf).kind,'conflict');
assert.equal(dateField([{d:'2026-11-12'}],'d',asOf,true).kind,'future');
const mapped=mapTable({columns:[{roles:{EventName:true}},{roles:{ChangePlannedImplementation:true}},{roles:{EventPlannedCompletion:true}}],rows:[['EVENT',new Date('2026-11-10T12:34:56Z'),new Date('2026-11-11T03:15:00Z')]]});
assert.equal(dateField(mapped.rows,'ChangePlannedImplementation',asOf).label,'10 Nov 2026');
assert.equal(dateField(mapped.rows,'EventPlannedCompletion',asOf).label,'11 Nov 2026');
const planning=(field,value)=>dateField([{[field]:value}],field,asOf);
for(const field of ['ChangePlannedImplementation','EventPlannedCompletion']){
 assert.equal(planning(field,'30/09/2026 00:00:00').label,'30 Sep 2026');
 assert.equal(planning(field,'16/11/2026 00:00:00').label,'16 Nov 2026');
 assert.equal(planning(field,'8/9/2026').label,'08 Sep 2026','verified source slash dates use day/month order');
 assert.equal(planning(field,'11/12/2026 23:59:59.123').label,'11 Dec 2026');
 assert.equal(planning(field,'29/02/2024 12:34').label,'29 Feb 2024');
 assert.equal(planning(field,'2026-11-16').label,'16 Nov 2026');
 assert.equal(planning(field,'16 Nov 2026').label,'16 Nov 2026');
 for(const value of ['31/02/2026','29/02/2026','01/13/2026','00/11/2026','01/01/0000','30/09/2026 25:00:00','30/09/2026 12:60:00','30/09/2026 12:30:60','30/09/2026 arbitrary',2026,46336,Date.UTC(2026,10,16)])assert.equal(planning(field,value).kind,'invalid',String(value));
 assert.equal(planning(field,'01/01/2101').label,'Outside 1900–2100');
 assert.equal(dateField([{[field]:'16/11/2026 00:00:00'},{[field]:'2026-11-16'}],field,asOf).kind,'dated','equivalent ISO and verified slash planning dates are not a conflict');
}
for(const field of ['LatestDispatch','ActualSubmission','LatestApproval','ChangeResponseDue'])assert.equal(dateField([{[field]:'8/9/2026'}],field,asOf).kind,'invalid','new slash format is limited to the two planning fields');
const pair=planningDates(planning('ChangePlannedImplementation',''),planning('EventPlannedCompletion','8/9/2026 00:00:00'));
assert.equal(pair.field,'EventPlannedCompletion');assert.equal(pair.value,Date.UTC(2026,8,8));assert.deepEqual(pair.items[1].values,['08 Sep 2026']);
assert.equal(parsePlanningDate('8/9/2026'),Date.UTC(2026,8,8));
console.log('PASS date input diagnostics: source-verified planning day/month dates, strict calendar/time validation, unchanged other date fields, preserved raw values, range errors and native Power BI Date mapping.');
