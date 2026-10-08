import assert from 'node:assert/strict';
import {summarize, mapTable, ROLES, DISPATCH_ROLES, resolveRequired} from './submissions.logic.mjs';
const now = new Date(2026,9,7,12);
const row = (id, patch={}) => ({SubID:id,Site:'ABO',BusinessUnit:'ID',PlannedSubmission:'2026-10-20',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'Yes',PlannedDispatch:'2026-10-05',ActualDispatch:null,...patch});
const data = [
 row('INTERNAL'),row('INTERNAL'),
 row('NEXT-MONTH',{PlannedSubmission:'2026-11-20'}),
 row('LATER-MONTH',{PlannedSubmission:'2026-12-20'}),
 row('NO-SUB-PLAN',{PlannedSubmission:null}),
 row('OLD-INTERNAL',{PlannedSubmission:'2026-09-20',PlannedDispatch:'2026-09-05'}),
 row('TODAY',{PlannedDispatch:'2026-10-07'}),
 row('LATER-DISPATCH',{PlannedDispatch:'2026-10-08'}),
 row('AUTHORITY',{PlannedSubmission:'2026-10-06',ActualDispatch:'2026-10-04'}),
 row('NOT-REQUIRED',{DispatchRequired:'No',PlannedSubmission:'2026-10-06'}),
 row('DISPATCHED-IN-TIME',{ActualDispatch:'2026-10-04'}),
 row('OLD-AUTHORITY',{DispatchRequired:false,PlannedSubmission:'2026-09-20',PlannedDispatch:null}),
 row('UNKNOWN',{DispatchRequired:null,PlannedDispatch:null,PlannedSubmission:'2026-10-06'}),
 row('MISSING-DISPATCH-PLAN',{PlannedDispatch:null,PlannedSubmission:'2026-10-06'}),
 row('BAD-DISPATCH-PLAN',{PlannedDispatch:'bad',PlannedSubmission:'2026-10-06'}),
 row('BAD-ACTUAL-DISPATCH',{ActualDispatch:'bad',PlannedSubmission:'2026-10-06'}),
 row('FUTURE-ACTUAL-DISPATCH',{ActualDispatch:'2026-10-08',PlannedSubmission:'2026-10-06'}),
 row('CONFLICT-REQUIRED',{PlannedSubmission:'2026-10-06'}),row('CONFLICT-REQUIRED',{DispatchRequired:'No',PlannedSubmission:'2026-10-06',BusinessUnit:'CMI'}),
 row('SUBMITTED',{ActualSubmission:'2026-10-06'}),
 ...['Completed','HA Received','Sent To Health Authority','Rejected'].map((SubStatus,i)=>row('STATE-'+i,{SubStatus})),
 row('APPROVED',{ROStatus:'Health Authority Approved'}),
 row('DISTRIBUTED',{SubStatus:'Distributed'}),
 row('CHECK-ACTUAL-SUB',{ActualSubmission:'bad'}),
 row('TODAY-ACTUAL-DISPATCH',{ActualDispatch:'2026-10-07',PlannedSubmission:'2026-10-07'}),
 row('SITE-AMBIGUOUS'),row('SITE-AMBIGUOUS',{Site:'ADJ'}),
 row('OUTSIDE',{Site:'OTHER'})
];
const result=summarize(data,{now});
assert.deepEqual([result.overdue.count,result.overdue.internal,result.overdue.authority,result.overdue.unclassified],[15,6,3,6]);
assert.deepEqual(result.overdue.rows.filter(r=>r.overdueStage==='internal').map(r=>r.id).sort(),['DISTRIBUTED','INTERNAL','LATER-MONTH','NEXT-MONTH','NO-SUB-PLAN','OLD-INTERNAL']);
assert.deepEqual(result.overdue.rows.filter(r=>r.overdueStage==='authority').map(r=>r.id).sort(),['AUTHORITY','NOT-REQUIRED','OLD-AUTHORITY']);
assert.equal(result.backlog.count,2);assert.equal(result.backlog.internal,1);assert.equal(result.backlog.authority,1);
assert.equal(new Set(result.overdue.rows.map(r=>r.id)).size,result.overdue.count);
assert.ok(result.overdue.rows.every(r=>r.overdueDate<Date.UTC(2026,9,7)));
assert.ok(result.issues.some(r=>r.id==='NO-SUB-PLAN'));
for(const id of ['BAD-DISPATCH-PLAN','MISSING-DISPATCH-PLAN','BAD-ACTUAL-DISPATCH','FUTURE-ACTUAL-DISPATCH','CONFLICT-REQUIRED']) assert.ok(result.issues.some(r=>r.id===id),id);
assert.equal(result.issues.length,new Set(result.issues.map(r=>r.id)).size);
assert.equal(summarize(data,{now,unit:'ID'}).overdue.rows.find(r=>r.id==='CONFLICT-REQUIRED').overdueStage,'unclassified');
assert.equal(summarize(data,{now,sites:['ADJ']}).overdue.count,0);
assert.equal(summarize(data,{now,stateFilters:{SubStatus:['Distributed']}}).overdue.internal,1);
assert.equal(summarize(data,{now,stateFilters:{AppStatus:[]}}).overdue.count,0);
// A recorded dispatch moves the same ID out of internal delay and into the authority
// queue. It is late there only if the submission plan has also passed.
const progress=row('MOVE',{PlannedSubmission:'2026-10-06'});
assert.equal(summarize([progress],{now}).overdue.internal,1);
const moved=summarize([progress,{...progress,ActualDispatch:'2026-10-06',BusinessUnit:'CMI'}],{now,unit:'ID'});
assert.equal(moved.overdue.internal,0);assert.equal(moved.overdue.authority,1);assert.equal(moved.overdue.count,1);
assert.equal(summarize([{...progress,ActualDispatch:'2026-10-06',PlannedSubmission:'2026-10-08'}],{now}).overdue.count,0);
assert.equal(summarize([progress,{...progress,SubStatus:'Completed',BusinessUnit:'CMI'}],{now,unit:'ID'}).overdue.count,0);
assert.equal(summarize([progress,{...progress,ROStatus:'Health Authority Approved',BusinessUnit:'CMI'}],{now,unit:'ID'}).overdue.count,0);
// Requirement parsing must not treat a blank/unknown flag as No.
for(const value of [true,1,'Yes',' TRUE ','required']) assert.equal(resolveRequired([null,value]).required,true);
for(const value of [false,0,'No',' FALSE ','not required']) assert.equal(resolveRequired(['',value]).required,false);
assert.equal(resolveRequired([null,'']).kind,'blank');assert.equal(resolveRequired(['maybe']).kind,'issue');
assert.equal(resolveRequired(['yes','no']).kind,'issue');assert.equal(resolveRequired([true],false).kind,'unmapped');
// Each optional role can be missing independently; unmapped Actual dispatch cannot
// be interpreted as a confirmed blank actual date.
for (const omit of [[],...DISPATCH_ROLES.map(role=>[role]),DISPATCH_ROLES]) {
 const roles=ROLES.filter(role=>!omit.includes(role)), source=[progress];
 const mapped=mapTable({columns:roles.map(role=>({roles:{[role]:true}})),rows:source.map(r=>roles.map(role=>r[role]??null))});
 assert.deepEqual(mapped.missing,[]);
 const r=summarize(mapped.rows,{now,stateMapped:mapped.stateMapped,dispatchMapped:mapped.dispatchMapped});
 assert.equal(r.overdue.count,1);
 assert.equal(r.overdue.internal,omit.length?0:1);
 assert.equal(r.overdue.unclassified,omit.length?1:0);
}
// Invalid or conflicting dispatch dates stay reviewable without preventing a valid
// submission date or filing state from establishing Submitted.
const conflicting=[row('C',{ActualDispatch:'2026-10-01',ActualSubmission:'2026-10-06'}),row('C',{ActualDispatch:'2026-10-02',ActualSubmission:'2026-10-06'})];
const resolved=summarize(conflicting,{now});assert.equal(resolved.totals.submitted,1);assert.equal(resolved.overdue.count,0);assert.match(resolved.issues[0].reason,/Conflicting dates: actual dispatch/);
const conflictingPlan=summarize([progress,{...progress,PlannedDispatch:'2026-10-04'}],{now});assert.equal(conflictingPlan.overdue.unclassified,1);assert.match(conflictingPlan.issues[0].reason,/Conflicting dates: planned dispatch/);
assert.equal(summarize([row('NOT-YET',{PlannedSubmission:'2026-09-20',PlannedDispatch:'2026-10-08'})],{now}).backlog.count,0);
assert.ok(summarize([row('ORDER',{PlannedSubmission:'2026-10-01',PlannedDispatch:'2026-10-08'})],{now}).issues.some(r=>/after planned submission/.test(r.reason)));
const dec=row('YEAR',{PlannedSubmission:'2027-02-01',PlannedDispatch:'2026-12-31'});
assert.equal(summarize([dec],{now:new Date(2026,11,31)}).overdue.count,0);assert.equal(summarize([dec],{now:new Date(2027,0,1)}).overdue.internal,1);
const load=Array.from({length:10000},(_,i)=>row('S-'+i,{DispatchRequired:i%2?'Yes':'No',PlannedSubmission:'2026-10-06'}));
const start=performance.now(),stress=summarize(load.flatMap(r=>[r,r,r]),{now});
assert.equal(stress.overdue.count,10000);assert.equal(stress.overdue.internal,5000);assert.equal(stress.overdue.authority,5000);assert.equal(stress.totals.inProcess,10000);
console.log(`PASS: dispatch versus submission due dates, exclusive overdue groups, all dates, optional mappings, invalid/conflicting evidence, filing/approval exclusions, duplicate/filter safety and 10,000 submissions (${Math.round(performance.now()-start)}ms).`);
