import assert from 'node:assert/strict';
import {summarize,attentionFor} from './submissions.logic.mjs';
const now=new Date(2026,9,9,12),base={Site:'ABO',PlannedSubmission:'2026-10-20',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'Yes',PlannedDispatch:'2026-10-05',ActualDispatch:null};
const row=(SubID,patch={})=>({...base,SubID,...patch});
const source=[row('INTERNAL'),row('AUTHORITY',{PlannedSubmission:'2026-10-05',ActualDispatch:'2026-10-04'}),row('NOT-REQUIRED',{DispatchRequired:'No',PlannedSubmission:'2026-10-05'}),
row('HOLD',{ROStatus:'On Hold By Health Authority'}),row('INACTIVE',{AppStatus:'Inactive'}),row('CANCELLED',{SubStatus:'Cancelled'}),row('REJECTED',{SubStatus:'Rejected'}),row('RO-REJECTED',{ROStatus:'Rejected'}),
row('APPROVED',{ROStatus:'Health Authority Approved'}),row('COMPLETE',{SubStatus:'Completed'}),row('NEXT',{PlannedDispatch:'2026-10-15'}),row('NEXT-AUTHORITY',{ActualDispatch:'2026-10-05'}),row('UNKNOWN',{DispatchRequired:null}),
row('BAD-ACTUAL',{ActualSubmission:'bad',SubStatus:'Completed'}),row('FUTURE-ACTUAL',{ActualSubmission:'2026-10-30'}),row('BAD-PLAN',{PlannedSubmission:'bad'}),row('MISSING-PLAN',{PlannedSubmission:null,DispatchRequired:'No'}),
row('DISPATCH-CONFLICT',{ActualDispatch:'2026-10-01'}),row('DISPATCH-CONFLICT',{ActualDispatch:'2026-10-02'}),row('REQUIRED-CONFLICT'),row('REQUIRED-CONFLICT',{DispatchRequired:'No'}),
row('SITE-CONFLICT'),row('SITE-CONFLICT',{Site:'ADJ'}),row('OUTSIDE',{Site:'OTHER'}),row('LATER',{PlannedSubmission:'2026-12-20'}),row('')];
const r=summarize(source,{now}),records=new Map([...r.buckets.flatMap(b=>b.months.flatMap(m=>m.rows)),...r.issues,...r.coverage.outsideSites,...r.coverage.outsideMonths].map(r=>[r.id,r]));
const evidence=id=>attentionFor(records.get(id));
assert.equal(evidence('INTERNAL').key,'internal');assert.match(evidence('INTERNAL').reason,/05 Oct 2026/);
assert.equal(evidence('AUTHORITY').key,'authority');assert.match(evidence('AUTHORITY').reason,/Actual dispatch: 04 Oct 2026/);
assert.equal(evidence('NOT-REQUIRED').key,'authority');assert.match(evidence('NOT-REQUIRED').reason,/not required/);
assert.equal(evidence('HOLD').key,'hold');assert.match(evidence('HOLD').reason,/On Hold By Health Authority/);
assert.equal(evidence('INACTIVE').key,'status');assert.match(evidence('INACTIVE').reason,/Application state: Inactive/);
assert.equal(evidence('CANCELLED').key,'status');assert.equal(evidence('REJECTED').key,'rejection');assert.equal(evidence('RO-REJECTED').key,'rejection');
assert.equal(evidence('COMPLETE').key,'complete');assert.match(evidence('COMPLETE').reason,/Completed/);assert.equal(evidence('APPROVED').key,'complete');
assert.equal(evidence('NEXT').tone,'info');assert.equal(evidence('NEXT-AUTHORITY').tone,'info');assert.equal(evidence('UNKNOWN').key,'dispatchReview');
assert.equal(evidence('BAD-ACTUAL').key,'data');assert.equal(records.get('BAD-ACTUAL').status,'Submitted'); // The highlighted data issue must not undo valid filing evidence.
for(const id of ['FUTURE-ACTUAL','BAD-PLAN','MISSING-PLAN','SITE-CONFLICT'])assert.equal(evidence(id).key,'data',id);
for(const id of ['DISPATCH-CONFLICT','REQUIRED-CONFLICT'])assert.equal(evidence(id).key,'dispatchReview',id);
assert.equal(r.coverage.outsideSites.length,r.checks.outsideSites);assert.equal(r.coverage.outsideMonths.length,r.checks.outsideMonths);assert.equal(r.coverage.missingIds.length,r.checks.missingIds);
assert.equal(attentionFor(r.coverage.missingIds[0]).title,'Submission ID missing');assert.equal(r.coverage.missingIds[0].id,'');
const before=JSON.stringify({totals:r.totals,backlog:r.backlog,overdue:r.overdue});for(const record of records.values())attentionFor(record);assert.equal(JSON.stringify({totals:r.totals,backlog:r.backlog,overdue:r.overdue}),before);
assert.deepEqual(summarize(source,{now,stateFilters:{SubStatus:[]}}).coverage,{outsideSites:[],outsideMonths:[],missingIds:[]});
console.log('PASS: evidence-based issue/action highlights, dispatch vs authority delays, recorded hold/inactive/rejection states, data conflicts, missing IDs and unchanged counts.');
