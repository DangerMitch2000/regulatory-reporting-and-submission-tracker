const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const ctx={Date,dispatchModule:require('./dispatch-required.js')};vm.createContext(ctx);vm.runInContext(fs.readFileSync('roadmap-2026.logic.js','utf8').replace(/^import .*\r?\n/gm,'').replaceAll('export ','')+';this.api={summarize,parseDay,mapTable,selectStatusReview,roles,dateRoles};',ctx);const {summarize,parseDay,mapTable,selectStatusReview,roles,dateRoles}=ctx.api,today=Date.UTC(2026,8,24);
// Requirement evidence is resolved once per whole submission before local filters.
const requirementRows=[
 {SubID:'F-past',DispatchRequired:false,LatestDispatch:'2026-03-01',ActualSubmission:'2026-04-01',BusinessUnit:'ID',Site:'North'},
 {SubID:'F-actual',DispatchRequired:' FALSE ',ActualDispatch:'2026-02-01',BusinessUnit:'ID',Site:'North'},
 {SubID:'F-future',DispatchRequired:false,LatestDispatch:'2026-12-01',BusinessUnit:'ID',Site:'North'},
 {SubID:'F-undated',DispatchRequired:false,ActualSubmission:'2026-04-01',ActualApproval:'2026-05-01',BusinessUnit:'ID',Site:'North'},
 {SubID:'F-unknown-year',DispatchRequired:false,BusinessUnit:'ID'},
 {SubID:'F-other-year',DispatchRequired:false,ActualSubmission:'2025-04-01',BusinessUnit:'ID'},
 {SubID:'F-other-plan-year',DispatchRequired:false,LatestDispatch:'2027-04-01',ActualSubmission:'2026-04-01',BusinessUnit:'ID'},
 {SubID:'T',DispatchRequired:true,LatestDispatch:'2026-03-01',BusinessUnit:'ID'},
 {SubID:'B',DispatchRequired:null,LatestDispatch:'2026-03-01',BusinessUnit:'ID'},
 {SubID:'Conflict',DispatchRequired:false,LatestDispatch:'2026-03-01',BusinessUnit:'ID'},
 {SubID:'Conflict',DispatchRequired:true,LatestDispatch:'2026-03-01',BusinessUnit:'Other'},
 {SubID:'Invalid',DispatchRequired:'No',LatestDispatch:'2026-03-01',BusinessUnit:'ID'},
 {SubID:'F-past',DispatchRequired:null,LatestDispatch:'2026-03-01',ActualSubmission:'2026-04-01',BusinessUnit:'Other'}
];
const requirements=summarize(requirementRows,today,true,'ID'),withoutInference=summarize(requirementRows,today,false,'ID');
assert.deepEqual(Array.from(requirements.totals),[0,0,4,0,3]);
assert.deepEqual(Array.from(requirements.totals),Array.from(withoutInference.totals));
assert.equal(requirements.total,7);assert.equal(requirements.missing.length,0);assert.equal(requirements.undatedInferred.length,0);
assert.deepEqual(Array.from(requirements.notRequiredOutside),['F-undated']);
assert.equal(requirements.notRequiredOutsideRecords[0].month,null);assert.equal(requirements.notRequiredOutsideRecords[0].outsideChart,true);
assert.equal(requirements.records.find(r=>r.id==='F-actual').actualDay,Date.UTC(2026,1,1),'False preserves recorded actual dispatch evidence');
assert.equal(requirements.records.find(r=>r.id==='F-past').dispatchRequired.value,false,'blank joins never override explicit False');
assert.equal(requirements.records.find(r=>r.id==='Conflict').dispatchRequired.kind,'conflict','BU must not hide conflicting requirement evidence');
assert.equal(selectStatusReview(requirements,{scope:'missing-dispatch'}).total,4);
assert.equal(selectStatusReview(requirements,{scope:'not-required'}).total,3);
assert.equal(selectStatusReview(requirements,{scope:'not-required-outside'}).total,1);
assert.equal(summarize(requirementRows,today,true,'ID',{dispatchRequired:'false'}).total,3);
assert.equal(summarize(requirementRows,today,true,'ID',{dispatchRequired:'false'}).notRequiredOutside.length,1);
assert.equal(summarize(requirementRows,today,true,'ID',{dispatchRequired:'true'}).total,1);
assert.equal(summarize(requirementRows,today,true,'ID',{dispatchRequired:'blank'}).total,1);
assert.equal(summarize(requirementRows,today,true,'ID',{dispatchRequired:'review'}).total,2);
const oldMapping=summarize(requirementRows,today,true,'ID',{mappedRoles:roles.filter(role=>role!=='DispatchRequired')});
assert.equal(oldMapping.totals[4],0);assert.equal(oldMapping.missing.length,1);assert.equal(oldMapping.records[0].dispatchRequired.kind,'unmapped');
assert.equal(mapTable({columns:[{roles:{SubID:true}},{roles:{DispatchRequired:true}}],rows:[['x',false]]}).rows[0].DispatchRequired,false);
assert.equal(summarize(Array.from({length:30000},(_,i)=>({SubID:'S'+i%1000,DispatchRequired:false,LatestDispatch:'2026-03-01'})),today).totals[4],1000);
console.log('PASS: DispatchRequired whole-ID resolution, optional mapping, five-way classification, outside-chart false records, preserved actual evidence, strict filters and 30k duplicate rows.');
const rows=[
{SubID:'A',ActualDispatch:'2026-01-02',ActualApproval:'2026-02-01',BusinessUnit:'ID',Site:'North'},
{SubID:'B',LatestDispatch:'2026-12-01',ActualSubmission:'2026-08-01',BusinessUnit:'ID',Site:'North'},
{SubID:'C',OriginalDispatch:'2026-03-01',ActualApproval:'2026-04-01',BusinessUnit:'CMI',Site:'South'},
{SubID:'D',ActualSubmission:'2026-01-01',ActualApproval:'2026-02-01',BusinessUnit:'ID'},
{SubID:'E',ActualSubmission:'2025-01-01',BusinessUnit:'TOX'},
{SubID:'F',LatestDispatch:'2026-10-01',BusinessUnit:'CMI',Site:'South'},
{SubID:'G',LatestDispatch:'2026-11-01',ActualApproval:'2027-01-01',Site:'West'},
{SubID:'H',ActualDispatch:'2026-05-01',BusinessUnit:'ID',Site:'North'},
{SubID:'H',ActualDispatch:'2026-05-01',BusinessUnit:'CSP',Site:'South'},
{SubID:'I',LatestDispatch:'bad',ActualSubmission:'2026-06-01',BusinessUnit:'CMI'},
{SubID:'J',ActualDispatch:'2026-04-01',BusinessUnit:'TOX'},
{SubID:'J',ActualDispatch:'2026-05-01',BusinessUnit:'TOX'}];
function run(inferred=false,unit='*'){return summarize(rows,today,inferred,unit);}
let a=run(),b=run(true);assert.equal(a.total,6);assert.equal(b.total,6);assert.deepEqual(Array.from(a.totals),[2,3,1,0,0]);assert.deepEqual(Array.from(b.totals),[2,1,0,3,0]);assert.equal(b.months[11][3],1);assert.equal(b.months[7][3],0);assert.equal(b.months[10][3],1);assert.equal(b.months[0][0],1);assert.equal(b.missing.length,2);assert.deepEqual(Array.from(a.missing),Array.from(b.missing));assert.equal(b.undatedInferred.length,3);assert.equal(b.excluded.length,2);assert.equal(b.sites.reduce((n,s)=>n+s.total,0),b.total);assert.equal(b.ambiguousSites.length,1);assert.equal(b.sites.find(s=>s.key==='ambiguous').total,1);
let id=run(true,'ID');assert.equal(id.total,3);assert.equal(id.totals[3],1);assert.equal(id.missing.length,1);assert.equal(id.excluded.length,0);assert.equal(id.ambiguousSites.length,1);assert.equal(id.sites.reduce((n,s)=>n+s.total,0),3);assert.equal(run(true,null).total,1);assert.equal(run(true,'CSP').total,1);assert.equal(run(true,'unknown').total,0);assert.equal(run(true,'CMI').missing.length,1);
const future=summarize([{SubID:'X',LatestDispatch:'2027-01-01'}],Date.UTC(2027,0,1));assert.equal(future.year,2027);assert.equal(future.total,1);assert.equal(future.average,1/12);
assert.equal(parseDay('2026-02-30').kind,'invalid');assert.equal(parseDay('01/02/2026').kind,'invalid');assert.equal(parseDay('2026-01-01T23:00:00-08:00').day,Date.UTC(2026,0,1));assert.equal(parseDay(0).kind,'invalid');assert.equal(mapTable({}).missing,true);
const conflicting=[{SubID:'X',LatestDispatch:'2026-01-01',ActualSubmission:'2026-02-01'},{SubID:'X',LatestDispatch:'2026-03-01',ActualSubmission:'2026-02-01'}];assert.equal(summarize(conflicting,today,true).total,0);assert.equal(summarize(conflicting,today,true).excluded.length,1);
const big=Array.from({length:30000},(_,i)=>({SubID:'S'+i%1000,LatestDispatch:'2026-12-01',BusinessUnit:i%2?'ID':'CMI'}));assert.equal(summarize(big,today).total,1000);
console.log('PASS: inference partition/precedence/evidence/future plans, undated scope, current-year cleanup OR, business-unit membership filtering, duplicates and 30k rows, site reconciliation and ambiguity, calendar parsing, conflicts and dynamic year.');

// Statuses are optional source evidence, separate from all dispatch date rules.
const plain=value=>JSON.parse(JSON.stringify(value));
const mapped=mapTable({columns:[{roles:{SubID:true}},{roles:{LatestDispatch:true}},{roles:{SubStatus:true}},{roles:{ROStatus:true}}],rows:[['STATUS','2026-03-01','Completed','Health Authority Approved']]});
assert.deepEqual(plain(mapped.mappedRoles),['SubID','LatestDispatch','SubStatus','ROStatus']);
assert.equal(mapped.rows[0].SubStatus,'Completed');assert.equal(mapped.rows[0].ROStatus,'Health Authority Approved');
assert.throws(()=>mapTable({columns:[{roles:{SubStatus:true}},{roles:{SubStatus:true}}]}),/Map only one column to SubStatus/);
assert.equal(dateRoles.includes('SubStatus'),false);assert.equal(dateRoles.includes('ROStatus'),false);
let completed=summarize(mapped.rows,today,true,'*',{mappedRoles:mapped.mappedRoles});
assert.equal(completed.total,1);assert.equal(completed.issues.length,0);assert.equal(completed.records[0].category,2,'completed without dispatch evidence stays Unconfirmed');
assert.equal(completed.totals[0],0);assert.equal(completed.totals[3],0);assert.equal(completed.records[0].actualDay,null);assert.equal(completed.records[0].evidence.length,0);
assert.equal(completed.records[0].subStatus.label,'Completed');assert.equal(completed.records[0].roStatus.label,'Health Authority Approved');

const statusRows=[
 {SubID:'Completed',LatestDispatch:'2026-03-01',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'South',BusinessUnit:'ID'},
 {SubID:'RO-only',LatestDispatch:'2026-03-01',SubStatus:'Planned',ROStatus:'Health Authority Approved',Site:'North',BusinessUnit:'ID'},
 {SubID:'Variants',LatestDispatch:'2026-03-01',SubStatus:'  In   Progress ',ROStatus:'Planned',Site:'North',BusinessUnit:'ID'},
 {SubID:'Variants',LatestDispatch:'2026-03-01',SubStatus:'in progress',ROStatus:'  PLANNED ',Site:'North',BusinessUnit:'CMI'},
 {SubID:'Variants',LatestDispatch:'2026-03-01',SubStatus:' ',ROStatus:null,Site:'North',BusinessUnit:'CMI'},
 {SubID:'Conflict',LatestDispatch:'2026-03-01',SubStatus:'Planned',ROStatus:'Planned',Site:'South',BusinessUnit:'ID'},
 {SubID:'Conflict',LatestDispatch:'2026-03-01',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'South',BusinessUnit:'CMI'},
 {SubID:'Blank',LatestDispatch:'2026-03-01',SubStatus:'\t ',ROStatus:null,Site:'North',BusinessUnit:'ID'},
 {SubID:'Unknown',LatestDispatch:'2026-03-01',SubStatus:'Internal / Custom \"Review\"',ROStatus:'Waiting: local office',Site:'South',BusinessUnit:'ID'},
 {SubID:'Future-plan',LatestDispatch:'2026-12-01',SubStatus:'Planned',ROStatus:'In Progress',Site:'South',BusinessUnit:'ID'},
 {SubID:'Evidence',LatestDispatch:'2026-03-01',ActualSubmission:'2026-03-01',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'North',BusinessUnit:'ID'},
 {SubID:'Dispatched',ActualDispatch:'2026-02-01',LatestDispatch:'2026-01-29',OriginalDispatch:'2026-01-15',SubStatus:'Completed',ROStatus:'Completed',Site:'North',BusinessUnit:'ID'},
 {SubID:'Missing',ActualSubmission:'2026-05-01',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'South',BusinessUnit:'ID'},
 {SubID:'Missing-bad-plan',LatestDispatch:'invalid',ActualApproval:'2026-05-01',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'North',BusinessUnit:'ID'},
 {SubID:'Missing-other-year',ActualSubmission:'2025-05-01',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'South',BusinessUnit:'ID'},
 {SubID:'Other-year',LatestDispatch:'2027-03-01',SubStatus:'Planned',ROStatus:'Planned',Site:'South',BusinessUnit:'ID'},
 {SubID:'Unknown-year',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'South',BusinessUnit:'ID'},
 {SubID:'Bad-date',LatestDispatch:'invalid',SubStatus:'Completed',ROStatus:'Health Authority Approved',Site:'South',BusinessUnit:'ID'}
];
const summary=summarize(statusRows,today,true,'ID');
assert.equal(summary.total,9);assert.deepEqual(plain(summary.totals),[1,1,6,1,0]);
const record=id=>summary.records.find(r=>r.id===id);
assert.equal(record('RO-only').category,2);assert.equal(record('RO-only').subStatus.label,'Planned','RO approval does not complete its child submission');
assert.equal(record('Variants').subStatus.kind,'value');assert.equal(record('Variants').subStatus.label,'In Progress');assert.deepEqual(plain(record('Variants').subStatus.values),['In Progress']);
assert.equal(record('Variants').subStatus.key,'value:"in progress"');
assert.equal(record('Conflict').subStatus.kind,'conflict');assert.deepEqual(plain(record('Conflict').subStatus.values),['Completed','Planned']);
assert.equal(record('Conflict').roStatus.kind,'conflict','all BU associations remain visible for status conflicts');
assert.equal(record('Blank').subStatus.kind,'blank');assert.equal(record('Unknown').subStatus.kind,'value');
assert.equal(record('Evidence').category,3);assert.equal(record('Future-plan').category,1);
assert.equal(record('Dispatched').plannedDay,null,'legacy chart plan shape remains unchanged');
assert.equal(record('Dispatched').reviewPlannedDay,Date.UTC(2026,0,29),'worklist preserves a recorded plan even after dispatch');
assert.equal(record('Dispatched').planState,'date');assert.deepEqual(plain(record('Dispatched').dateValues.OriginalDispatch),['2026-01-15']);
assert.deepEqual(plain(summary.missing),['Missing','Missing-bad-plan']);assert.equal(summary.missingRecords.length,summary.missing.length);
assert.equal(summary.missingRecords[0].category,null);assert.equal(summary.missingRecords[0].actualDay,null);assert.equal(summary.missingRecords[0].plannedDay,null);
assert.equal(summary.missingRecords[0].evidence[0].day,Date.UTC(2026,4,1));assert.equal(summary.missingRecords[0].subStatus.label,'Completed');
assert.equal(summary.missingRecords[1].planState,'issue');assert.deepEqual(plain(summary.missingRecords[1].dateValues.LatestDispatch),['invalid']);

let review=selectStatusReview(summary);
assert.equal(review.total,6);assert.equal(review.scopeTotal,6);assert.equal(review.submissionStatuses.reduce((n,s)=>n+s.count,0),6);assert.equal(review.roStatuses.reduce((n,s)=>n+s.count,0),6);
assert.deepEqual(plain(review.records.map(r=>r.id)),['Blank','RO-only','Variants','Completed','Conflict','Unknown']);
const completeKey=record('Completed').subStatus.key;
review=selectStatusReview(summary,{subStatus:completeKey});
assert.equal(review.total,1);assert.equal(review.scopeTotal,6);assert.equal(review.submissionStatuses.length,6,'facet choices survive filtering');
assert.equal(review.counts.submissionStatuses[0].count,1);assert.equal(review.counts.roStatuses[0].count,1);
assert.equal(selectStatusReview(summary,{subStatus:'blank'}).records[0].id,'Blank');
assert.equal(selectStatusReview(summary,{subStatus:'conflict',roStatus:'conflict'}).records[0].id,'Conflict');
assert.equal(selectStatusReview(summary,{query:'Internal / Custom "Review"'}).records[0].id,'Unknown');
assert.equal(selectStatusReview(summary,{query:'health authority approved',subStatus:'conflict'}).records[0].id,'Conflict','search includes each conflicting raw status');
assert.equal(selectStatusReview(summary,{query:'in   progress'}).records[0].id,'Variants');
assert.equal(selectStatusReview(summary,{site:'site:North'}).total,3);
assert.equal(selectStatusReview(summary,{site:'site:North',subStatus:completeKey}).total,0);
assert.equal(selectStatusReview(summary,{scope:'inferred'}).total,1);
assert.equal(selectStatusReview(summary,{scope:'missing-dispatch'}).total,8);
assert.equal(selectStatusReview(summary,{scope:'missing-dates'}).total,2);
assert.equal(selectStatusReview(summary,{scope:'missing-dates',site:'site:North'}).records[0].id,'Missing-bad-plan');
assert.equal(selectStatusReview(summary,{scope:'all'}).total,summary.total);
assert.equal(selectStatusReview(summary,{scope:'unknown scope'}).total,6);
assert.equal(selectStatusReview(summary,{scope:'all'}).roStatuses.find(s=>s.key===record('Completed').roStatus.key).count,3,'RO facet counts submissions, not distinct statuses or RO IDs');
assert.equal(selectStatusReview(summarize(statusRows,today,false,'ID'),{scope:'inferred'}).total,0,'inferred scope follows the chart toggle');

// Explicit mapping absence differs from a mapped column with blank records.
const withoutStatus=summarize(statusRows,today,true,'ID',{mappedRoles:roles.filter(r=>!['SubStatus','ROStatus'].includes(r))});
assert.equal(withoutStatus.records[0].subStatus.kind,'unmapped');assert.equal(withoutStatus.records[0].roStatus.kind,'unmapped');
assert.equal(selectStatusReview(withoutStatus,{subStatus:'unmapped'}).total,6);assert.equal(selectStatusReview(withoutStatus,{subStatus:'blank'}).total,0);
assert.deepEqual(plain(withoutStatus.months),plain(summary.months));assert.deepEqual(plain(withoutStatus.totals),plain(summary.totals));assert.deepEqual(plain(withoutStatus.missing),plain(summary.missing));
const strange=summarize([{SubID:'special',LatestDispatch:'2026-01-01',SubStatus:'Not recorded',ROStatus:'Field not mapped'}],today);
assert.notEqual(strange.records[0].subStatus.key,'blank');assert.notEqual(strange.records[0].roStatus.key,'unmapped');

// Membership joins cannot erase conflicting dates or create extra status counts.
const crossUnit=[{SubID:'cross',BusinessUnit:'ID',LatestDispatch:'2026-01-01',SubStatus:'Completed'},{SubID:'cross',BusinessUnit:'CMI',LatestDispatch:'2026-02-01',SubStatus:'Planned'}];
const conflictDate=summarize(crossUnit,today,true,'ID');assert.equal(conflictDate.total,0);assert.equal(conflictDate.excluded.length,1);assert.equal(selectStatusReview(conflictDate,{scope:'all'}).total,0);
const largeStatuses=Array.from({length:30000},(_,i)=>({SubID:'R'+i%1000,LatestDispatch:'2026-01-01',BusinessUnit:i<1000?'ID':'CMI',Site:i%2?'North':'South',SubStatus:i>=29000&&i%3===0?'Planned':i%2?' completed ':'Completed',ROStatus:'Health Authority Approved'}));
const largeSummary=summarize(largeStatuses,today,true,'ID'),largeReview=selectStatusReview(largeSummary);
assert.equal(largeSummary.total,1000);assert.equal(largeSummary.totals[2],1000);assert.equal(largeReview.total,1000);
assert.equal(largeReview.submissionStatuses.reduce((n,s)=>n+s.count,0),1000);assert.equal(largeReview.roStatuses.reduce((n,s)=>n+s.count,0),1000);
assert.equal(largeReview.submissionStatuses.find(s=>s.kind==='conflict').count,333);assert.equal(largeReview.roStatuses[0].count,1000);
assert.equal(selectStatusReview(largeSummary,{site:'site:North'}).total,500);
assert.deepEqual(plain(selectStatusReview(summarize([...statusRows].reverse(),today,true,'ID'))),plain(selectStatusReview(summary)),'status resolution and review ordering are deterministic across source order');
console.log('PASS: optional status mappings, blank/unmapped/conflicting values, case/whitespace normalization, unknown labels, status-safe dispatch categories, retained BU evidence, distinct-submission status facets, review scopes/filters/search, current-year missing-date records, deterministic ordering, and 30k status join reconciliation.');
