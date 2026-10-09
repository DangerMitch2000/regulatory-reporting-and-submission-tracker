import assert from 'node:assert/strict';
import {summarize,mapTable,ROLES,REGISTRATION_ROLES,registrationEvidence,attentionFor} from './submissions.logic.mjs';
const now=new Date(2026,9,9,12),base={Site:'ABO',BusinessUnit:'ID',PlannedSubmission:'2026-10-02',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'Yes',PlannedDispatch:'2026-10-01',ActualDispatch:null};
const row=(SubID,patch={})=>({...base,SubID,...patch});
const linked=(id,state,patch={})=>row(id,{RegistrationID:'REG-'+id,RegistrationCountry:'Ireland',RegistrationStatus:state,RegistrationStart:'2026-10-01',RegistrationEnd:'2027-10-01',FallbackCountry:'France',...patch});
const states=['Approved','Conditionally Approved','Canceled','Expired','Planned','Rejected','Withdrawn'];
const source=states.map(state=>linked(state,state));
const r=summarize(source.flatMap(row=>[row,row,row]),{now});
assert.deepEqual(r.totals,{planned:7,inProcess:5,submitted:2,review:0,overdue:5});
assert.equal(r.overdue.count,5);assert.equal(r.overdue.internal,5);
const records=r.buckets[0].months[0].rows;
for(const record of records){assert.equal(record.registration.records.length,1);assert.equal(record.actual.kind,'blank');assert.deepEqual(record.country,{values:['Ireland'],source:'Registration country'});}
for(const state of states.slice(0,2)){const record=records.find(record=>record.id===state);assert.equal(record.submittedByRegistration,true);assert.equal(record.dispatchStage,'Submitted');assert.equal(attentionFor(record).key,'registration');}
assert.equal(summarize(source.map(row=>({...row,PlannedSubmission:'2026-09-02'})),{now}).backlog.count,5);
assert.equal(summarize([linked('NORMALIZED','  conditionally   approved  ')],{now}).totals.submitted,1);
for(const extra of [{RegistrationID:''},{RegistrationStatus:''},{RegistrationStatus:'Expired'},{RegistrationStatus:'Planned'}])assert.equal(summarize([linked('NO-PROOF','Approved',extra)],{now}).totals.submitted,0);
const noBorrow=[linked('SEPARATE','Planned'),linked('SEPARATE','Approved',{RegistrationID:''})];assert.equal(summarize(noBorrow,{now}).totals.submitted,0);
assert.equal(summarize([linked('EXPIRED','Expired',{ActualSubmission:'2026-10-03'})],{now}).totals.submitted,1);
assert.equal(summarize([linked('REJECTED','Rejected',{SubStatus:'Completed'})],{now}).totals.submitted,1);
const dates=[linked('INVALID','Approved',{RegistrationStart:'bad'}),linked('REVERSED','Approved',{RegistrationEnd:'2026-09-01'}),linked('FUTURE-EFFECTIVE','Approved',{RegistrationStart:'2026-12-01'}),linked('PAST-END','Approved',{RegistrationEnd:'2026-10-02'}),linked('BAD-ACTUAL','Approved',{ActualSubmission:'bad'})];
const d=summarize(dates,{now});assert.equal(d.totals.submitted,5);assert.equal(d.overdue.count,0);assert.equal(d.checks.registrationIssues,2);assert.equal(d.checks.actualIssues,1);assert.equal(d.issueCount,3);
assert.equal(attentionFor(d.buckets[0].months[0].rows.find(r=>r.id==='BAD-ACTUAL')).key,'data');
const multi=[linked('MULTI','Approved',{RegistrationID:'R1',RegistrationCountry:'Ireland'}),linked('MULTI','Planned',{RegistrationID:'R2',RegistrationCountry:'France'}),linked('MULTI','Approved',{RegistrationID:'R1',RegistrationCountry:'Ireland'})];
const m=summarize(multi,{now});assert.equal(m.totals.planned,1);assert.equal(m.totals.submitted,1);assert.equal(m.buckets[0].months[0].rows[0].registration.records.length,2);assert.deepEqual(m.buckets[0].months[0].rows[0].country.values,['France','Ireland']);
assert.equal(summarize([linked('FILTER','Planned'),linked('FILTER','Approved',{BusinessUnit:'CMI',SubStatus:'Inactive'})],{now,unit:'ID',stateFilters:{SubStatus:['In Progress']}}).totals.submitted,1);
const fallback=summarize([row('NO-REG',{FallbackCountry:'Germany'}),linked('EMPTY-PRIMARY','Planned',{RegistrationCountry:' ',FallbackCountry:'Spain'}),row('NONE')],{now});
assert.deepEqual(fallback.buckets[0].months[0].rows.find(r=>r.id==='NO-REG').country,{values:['Germany'],source:'Secondary country'});
assert.deepEqual(fallback.buckets[0].months[0].rows.find(r=>r.id==='EMPTY-PRIMARY').country,{values:['Spain'],source:'Secondary country'});
assert.deepEqual(fallback.buckets[0].months[0].rows.find(r=>r.id==='NONE').country.values,[]);assert.equal(fallback.totals.submitted,0);
for(const omit of [[],...REGISTRATION_ROLES.map(role=>[role]),REGISTRATION_ROLES,[...REGISTRATION_ROLES,'FallbackCountry']]){
 const roles=ROLES.filter(role=>!omit.includes(role));const mapped=mapTable({columns:roles.map(role=>({roles:{[role]:true}})),rows:[roles.map(role=>linked('MAP','Approved')[role]??null)]});
 assert.deepEqual(mapped.missing,[]);const summary=summarize(mapped.rows,{now,registrationMapped:mapped.registrationMapped,fallbackCountryMapped:mapped.fallbackCountryMapped});
 assert.equal(summary.totals.submitted,omit.includes('RegistrationID')||omit.includes('RegistrationStatus')?0:1);
}
assert.equal(registrationEvidence([{}]).records.length,0);
const unmapped=summarize([row('LEGACY')],{now});assert.equal(unmapped.registrationEnabled,false);assert.equal(unmapped.countryEnabled,false);assert.equal(unmapped.overdue.count,1);
const stress=Array.from({length:10000},(_,i)=>linked('LOAD-'+i,i%2?'Planned':'Approved'));
const start=performance.now(),s=summarize(stress.flatMap(row=>[row,row,row]),{now}),elapsed=performance.now()-start;assert.equal(s.totals.planned,10000);assert.equal(s.totals.submitted,5000);assert.equal(s.overdue.count,5000);assert.ok(elapsed<5000,elapsed);
console.log(`PASS: all seven registration states, linked-record evidence, no false ID/state joins, date checks, country fallback, duplicate registrations, filters, optional mappings and 10,000 submissions (${Math.round(elapsed)}ms).`);
