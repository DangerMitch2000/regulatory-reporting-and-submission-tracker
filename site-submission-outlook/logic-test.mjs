import assert from 'node:assert/strict';
import {calendar, parseDay, mapTable, summarize, DEFAULT_SITES, ROLES, normalizeSites, normalizeStateFilters, formatStates} from './submissions.logic.mjs';
const now = new Date(2026, 9, 7, 12), base = {Site: 'ABO', PlannedSubmission: '2026-10-15', ActualSubmission: null, BusinessUnit: 'ID'};
const row = (id, patch = {}) => ({...base, SubID: id, ...patch});
const data = [row('A'), row('A'), row('B', {ActualSubmission: '2026-09-20'}), row('C', {PlannedSubmission: '2026-11-03', ActualSubmission: '2026-10-01'}),
  row('D', {PlannedSubmission: '2026-11-05'}), row('E', {PlannedSubmission: '2026-09-30', ActualSubmission: '2026-10-05'}),
  row('F', {PlannedSubmission: '2026-10-01'}), row('G', {Site: 'OTHER'}), row('H', {Site: null}),
  row('I', {Site: 'ABO'}), row('I', {Site: 'ADK'}), row('', {}), row('J', {ActualSubmission: '2026-10-20'}),
  row('K', {ActualSubmission: '2026-10-02'}), row('K', {ActualSubmission: '2026-10-03'}),
  row('L', {PlannedSubmission: null}), row('M', {PlannedSubmission: '07/10/2026'}), row('N'), row('N', {PlannedSubmission: '2026-11-15'}),
  row('O', {ActualSubmission: 'bad'}), row('P', {Site: 'adj', BusinessUnit: 'CMI', ActualSubmission: '2026-10-07'})];
const r = summarize(data, {now});
assert.deepEqual(r.totals, {planned: 9, inProcess: 3, submitted: 3, review: 3, overdue: 1});
assert.equal(r.buckets.length, 6); assert.equal(r.buckets[1].site, 'ADJ'); assert.equal(r.buckets[1].months[0].submitted, 1);
assert.deepEqual(r.buckets[0].months.map(m => [m.planned, m.inProcess, m.submitted, m.review]), [[6,2,1,3],[2,1,1,0]]);
assert.equal(r.checks.multipleSites, 1); assert.equal(r.checks.unassignedSite, 1); assert.equal(r.checks.outsideSites, 1);
assert.equal(r.checks.missingIds, 1); assert.equal(r.checks.missingPlan, 1); assert.equal(r.checks.planIssues, 2); assert.equal(r.checks.outsideMonths, 1);
assert.equal(summarize(data, {now, unit: 'CMI'}).totals.planned, 1);
assert.equal(summarize(data, {now, sites: []}).totals.planned, 0);
assert.equal(summarize([row('T'), row('T', {BusinessUnit: 'CMI', PlannedSubmission: '2026-11-02'})], {now, unit: 'ID'}).checks.planIssues, 1);
assert.equal(summarize([row('T'), row('T', {ActualSubmission: '2026-10-06'})], {now}).totals.submitted, 1);
assert.equal(summarize([row('T', {Site: '  abo '})], {now}).totals.planned, 1);
assert.equal(summarize([row('T', {Site: 'ABON'})], {now}).totals.planned, 0);
assert.deepEqual(calendar(new Date(2026, 11, 31)).months.map(m => m.key), ['2026-12', '2027-01']);
assert.deepEqual(calendar(new Date(2027, 0, 1)).months.map(m => m.key), ['2027-01', '2027-02']);
assert.equal(summarize([row('T', {PlannedSubmission: '2026-11-01'})], {now: new Date(2026, 10, 1)}).totals.overdue, 0);
assert.equal(summarize([row('T', {PlannedSubmission: '2026-10-31'})], {now: new Date(2026, 10, 1)}).totals.planned, 0);
assert.equal(parseDay('2026-02-29').kind, 'invalid'); assert.equal(parseDay('2028-02-29').kind, 'date');
assert.equal(parseDay('2026-13-01').kind, 'invalid'); assert.equal(parseDay('2026-10-01Tgarbage').kind, 'invalid');
assert.equal(parseDay('2026-10-01T23:45:00-05:00').day, Date.UTC(2026,9,1));
assert.equal(parseDay(new Date('2026-10-01T00:00:00Z')).day, Date.UTC(2026,9,1));
assert.deepEqual(normalizeSites(['ABO','abo','ADJ','ADK','AJG','ARDG','SCR','OTHER']), DEFAULT_SITES);
const columns = ROLES.map(k => ({roles: {[k]: true}}));
assert.deepEqual(mapTable({columns, rows: [['A','ABO','2026-10-01',null,'ID']]}).missing, []);
assert.equal(mapTable({columns: columns.slice(0,4), rows: []}).unitMapped, false);
assert.deepEqual(mapTable({columns: columns.slice(0,3), rows: []}).missing, ['ActualSubmission']);
assert.throws(() => mapTable({columns: [...columns, columns[0]], rows: []}), /only one/);
const old = (id, patch = {}) => row(id, {PlannedSubmission:'2026-09-30', ...patch});
const historical = [old('OLD', {PlannedSubmission:'2024-01-01'}), old('SEP'), old('SEP'),
  old('CMI', {Site:'ADJ',BusinessUnit:'CMI'}), row('OCT-BOUNDARY',{PlannedSubmission:'2026-10-01'}), row('NOV',{PlannedSubmission:'2026-11-01'}),
  old('LATE-SUBMITTED', {ActualSubmission:'2026-10-05'}), old('ALREADY-SUBMITTED',{ActualSubmission:'2026-09-20'}),
  old('BLANK-AND-RECORDED'), old('BLANK-AND-RECORDED',{ActualSubmission:'2026-10-01'}),
  old('FUTURE-ACTUAL',{ActualSubmission:'2026-10-20'}), old('BAD-ACTUAL',{ActualSubmission:'bad'}),
  old('CONFLICT-ACTUAL',{ActualSubmission:'2026-09-25'}), old('CONFLICT-ACTUAL',{ActualSubmission:'2026-09-26'}),
  old('CONFLICT-PLAN'), row('CONFLICT-PLAN'), old('MISSING-PLAN',{PlannedSubmission:null}), old('BAD-PLAN',{PlannedSubmission:'bad'}),
  old('MULTISITE'), old('MULTISITE',{Site:'ADK'}), old('OUTSIDE',{Site:'OTHER'}), old('NOSITE',{Site:null}), old(''),
  old('FUTURE-PLAN',{PlannedSubmission:'2026-12-01'})];
const h=summarize(historical,{now});
assert.equal(h.backlog.count,3);assert.equal(h.backlog.cutoff,Date.UTC(2026,9,1));
assert.deepEqual(h.backlog.rows.map(r=>r.id),['OLD','CMI','SEP']);assert.ok(h.backlog.rows.every(r=>r.overdue&&r.actual.kind==='blank'));
assert.deepEqual(h.buckets.map(s=>s.backlog.count),[2,1,0,0,0,0]);assert.equal(h.totals.planned,2);assert.equal(h.totals.inProcess,2);
assert.ok(h.backlog.rows.every(r=>!h.buckets.some(s=>s.months.some(m=>m.rows.some(a=>a.id===r.id)))));
assert.equal(summarize(historical,{now,unit:'CMI'}).backlog.count,1);assert.equal(summarize(historical,{now,sites:['ADJ']}).backlog.count,1);
assert.equal(summarize(historical,{now,sites:[]}).backlog.count,0);
assert.equal(summarize([old('U'),old('U',{BusinessUnit:'CMI',ActualSubmission:'2026-10-01'})],{now,unit:'ID'}).backlog.count,0);
assert.equal(summarize([old('SITE'),old('SITE',{Site:'OTHER'})],{now,sites:['ABO']}).backlog.count,0);
assert.ok(h.issues.some(r=>r.id==='FUTURE-ACTUAL'));assert.ok(h.issues.some(r=>r.id==='BAD-ACTUAL'));
assert.ok(h.issues.some(r=>r.id==='CONFLICT-ACTUAL'));assert.ok(h.issues.some(r=>r.id==='CONFLICT-PLAN'));
const carry=[old('SEP'),row('OCT',{PlannedSubmission:'2026-10-01'}),row('NOV',{PlannedSubmission:'2026-11-01'})];
assert.equal(summarize(carry,{now}).backlog.count,1);assert.equal(summarize(carry,{now:new Date(2026,10,1)}).backlog.count,2);
assert.equal(summarize([old('DEC',{PlannedSubmission:'2026-12-31'})],{now:new Date(2027,0,1)}).backlog.count,1);
assert.equal(summarize([old('SEP',{ActualSubmission:'2026-10-07'})],{now}).backlog.count,0);
assert.equal(summarize([],{now}).backlog.count,0);
const lifecycle = [
  row('CANCELLED',{SubStatus:'Cancelled',ROStatus:'Archived',AppStatus:'Inactive'}),
  row('CANCELLED',{SubStatus:'Cancelled',ROStatus:'Archived',AppStatus:'Inactive'}),
  row('ACTIVE',{SubStatus:'In Progress',ROStatus:'Planned',AppStatus:'Active'}),
  old('WITHDRAWN',{SubStatus:'Withdrawn',ROStatus:'Archived',AppStatus:'Inactive'}),
  row('CUSTOM',{SubStatus:'My custom state',ROStatus:'In Progress',AppStatus:'Active',ActualSubmission:'2026-10-01',PlannedSubmission:'2026-11-01'}),
  old('BLANK',{SubStatus:null,ROStatus:null,AppStatus:null})
];
const scope=stateFilters=>summarize(lifecycle,{now,stateFilters});
assert.equal(scope().totals.planned,3);assert.equal(scope().totals.submitted,1);assert.equal(scope().backlog.count,2);
assert.deepEqual(scope().stateChoices.SubStatus,['Cancelled','In Progress','My custom state','','Withdrawn']);
assert.equal(scope({SubStatus:['Cancelled']}).totals.inProcess,1);
assert.equal(scope({SubStatus:['Cancelled']}).totals.submitted,0);
assert.equal(scope({SubStatus:['Cancelled','Withdrawn']}).backlog.count,1);
assert.equal(scope({SubStatus:['Cancelled','Withdrawn'],ROStatus:['Archived'],AppStatus:['Inactive']}).totals.planned,1);
assert.equal(scope({SubStatus:['Cancelled','Withdrawn'],AppStatus:['Active']}).scopedRecords,0);
assert.equal(scope({ROStatus:['Archived']}).backlog.count,1);
assert.equal(scope({AppStatus:['Inactive']}).scopedRecords,2);
assert.equal(scope({SubStatus:['']}).backlog.count,1);
assert.equal(scope({SubStatus:[]}).scopedRecords,0);
assert.equal(scope({SubStatus:null}).scopedRecords,5);
assert.equal(scope({SubStatus:['My custom state']}).totals.submitted,1);
assert.deepEqual(normalizeStateFilters({SubStatus:[' Cancelled ','Cancelled',null,3],AppStatus:'bad'}),{SubStatus:['Cancelled'],ROStatus:null,AppStatus:null});
const statesMapped=mapTable({columns,rows:[['X','ABO','2026-10-01',null,'ID','Cancelled','Archived','Inactive']]});
assert.deepEqual(statesMapped.stateMapped,{SubStatus:true,ROStatus:true,AppStatus:true});
assert.equal(statesMapped.rows[0].SubStatus,'Cancelled');
const unmapped=mapTable({columns:columns.slice(0,4),rows:[['X','ABO','2026-10-01',null]]});
assert.deepEqual(unmapped.stateMapped,{SubStatus:false,ROStatus:false,AppStatus:false});
assert.equal(summarize(unmapped.rows,{now,stateMapped:unmapped.stateMapped,stateFilters:{SubStatus:[]}}).totals.planned,1);
assert.equal(formatStates(null),'Not mapped');assert.equal(formatStates(['']),'Not recorded');
assert.equal(formatStates(['Archived','Planned']),'Multiple: Archived / Planned');
const split=[row('SPLIT',{SubStatus:'Cancelled',AppStatus:'Active',BusinessUnit:'ID'}),row('SPLIT',{SubStatus:'Planned',AppStatus:'Inactive',BusinessUnit:'CMI'})];
assert.equal(summarize(split,{now,stateFilters:{SubStatus:['Cancelled'],AppStatus:['Inactive']}}).scopedRecords,0);
assert.equal(summarize(split,{now,unit:'CMI',stateFilters:{SubStatus:['Cancelled']}}).scopedRecords,0);
assert.equal(summarize(split,{now,unit:'ID',stateFilters:{SubStatus:['Cancelled']}}).totals.planned,1);
assert.deepEqual(summarize(split,{now,stateFilters:{SubStatus:['Cancelled']}}).buckets[0].months[0].rows[0].states.SubStatus,['Cancelled','Planned']);
const evidence=[old('EVIDENCE',{SubStatus:'Planned'}),old('EVIDENCE',{SubStatus:'Completed',ActualSubmission:'2026-10-01'})];
assert.equal(summarize(evidence,{now,stateFilters:{SubStatus:['Planned']}}).backlog.count,0);
assert.equal(summarize(evidence.map(r=>({...r,PlannedSubmission:'2026-10-01'})),{now,stateFilters:{SubStatus:['Planned']}}).totals.submitted,1);
const closureRows=[
  old('CLOSED-SUB',{SubStatus:'Completed',ROStatus:'In Progress'}),
  old('CLOSED-RO',{SubStatus:'In Progress',ROStatus:'Health Authority Approved'}),
  old('CLOSED-BOTH',{SubStatus:'Completed',ROStatus:'Health Authority Approved'}),
  old('CLOSED-BOTH',{SubStatus:'Completed',ROStatus:'Health Authority Approved'}),
  old('CLOSED-CASE',{SubStatus:'  cOmPlEtEd  '}),
  old('CLOSED-SPACING',{ROStatus:' health   AUTHORITY approved '}),
  old('OPEN',{SubStatus:'In Progress',ROStatus:'In Progress'}),
  old('CONDITIONAL',{ROStatus:'Conditionally Approved'}),
  old('RO-COMPLETED',{ROStatus:'Completed'}),
  old('WRONG-FIELD',{SubStatus:'Health Authority Approved',AppStatus:'Completed'}),
  old('BLANK-STATES',{SubStatus:null,ROStatus:null}),
  old('CHECK-ACTUAL',{SubStatus:'Completed',ActualSubmission:'bad'}),
  row('MONTH-COMPLETED',{SubStatus:'Completed'}),
  row('MONTH-APPROVED',{ROStatus:'Health Authority Approved'})
];
const closure=summarize(closureRows,{now});
assert.deepEqual(closure.backlog.rows.map(r=>r.id),['BLANK-STATES','CONDITIONAL','OPEN','RO-COMPLETED','WRONG-FIELD']);
assert.equal(closure.backlog.count,5);assert.equal(closure.buckets[0].backlog.count,5);
assert.equal(closure.totals.planned,2);assert.equal(closure.totals.inProcess,1);assert.equal(closure.totals.submitted,1);
assert.ok(closure.issues.some(r=>r.id==='CHECK-ACTUAL'));
assert.equal(summarize(closureRows,{now,stateFilters:{SubStatus:['Completed']}}).backlog.count,0);
const statusEvidence=[old('DUPLICATE',{SubStatus:'In Progress',ROStatus:'In Progress',BusinessUnit:'ID'}),old('DUPLICATE',{SubStatus:'Completed',ROStatus:'In Progress',BusinessUnit:'CMI'})];
assert.equal(summarize(statusEvidence,{now,unit:'ID',stateFilters:{SubStatus:['In Progress']}}).backlog.count,0);
assert.equal(summarize(statusEvidence.map(r=>({...r,SubStatus:'In Progress',ROStatus:r.BusinessUnit==='CMI'?'Health Authority Approved':'In Progress'})),{now,unit:'ID',stateFilters:{ROStatus:['In Progress']}}).backlog.count,0);
const optionalClosure=[old('SUB-ONLY',{SubStatus:'Completed'}),old('RO-ONLY',{ROStatus:'Health Authority Approved'})];
assert.equal(summarize(optionalClosure,{now,stateMapped:{SubStatus:false,ROStatus:false}}).backlog.count,2);
assert.equal(summarize(optionalClosure,{now,stateMapped:{SubStatus:true,ROStatus:false}}).backlog.count,1);
assert.equal(summarize(optionalClosure,{now,stateMapped:{SubStatus:false,ROStatus:true}}).backlog.count,1);
assert.equal(summarize(optionalClosure,{now}).backlog.count,0);
assert.equal(summarize([old('UPDATE',{SubStatus:'In Progress'})],{now}).backlog.count,1);
assert.equal(summarize([old('UPDATE',{SubStatus:'Completed'})],{now}).backlog.count,0);
const completedPlan=summarize([
  row('NO-DATE',{SubStatus:'Completed',PlannedSubmission:'2026-10-01'}),
  row('NO-DATE',{SubStatus:'Completed',PlannedSubmission:'2026-10-01'}),
  row('CASE',{SubStatus:' completed ',PlannedSubmission:'2026-11-01'}),
  row('VALID',{SubStatus:'In Progress',ActualSubmission:'2026-10-01'}),
  row('APPROVED-ONLY',{SubStatus:'In Progress',ROStatus:'Health Authority Approved'}),
  row('BAD-DATE',{SubStatus:'Completed',ActualSubmission:'invalid'}),
  row('FUTURE-DATE',{SubStatus:'Completed',ActualSubmission:'2026-12-01'}),
  row('CONFLICT-DATE',{SubStatus:'Completed',ActualSubmission:'2026-10-01'}),
  row('CONFLICT-DATE',{SubStatus:'Completed',ActualSubmission:'2026-10-02'})
],{now});
assert.deepEqual(completedPlan.totals,{planned:7,inProcess:1,submitted:6,review:0,overdue:0});
assert.equal(completedPlan.completion,86);assert.equal(completedPlan.checks.actualIssues,3);assert.equal(completedPlan.issues.length,3);
assert.equal(completedPlan.buckets[0].months[0].rows.find(r=>r.id==='NO-DATE').actual.kind,'blank');
assert.equal(completedPlan.buckets[0].months[0].rows.find(r=>r.id==='NO-DATE').submittedByState,true);
assert.equal(summarize([row('OPTIONAL',{SubStatus:'Completed'})],{now,stateMapped:{SubStatus:false}}).totals.submitted,0);
assert.equal(summarize(statusEvidence.map(r=>({...r,PlannedSubmission:'2026-10-01'})),{now,unit:'ID',stateFilters:{SubStatus:['In Progress']}}).totals.submitted,1);
assert.equal(summarize([row('CONFLICT',{SubStatus:'Planned'}),row('CONFLICT',{SubStatus:'Cancelled',Site:'ADK'})],{now,stateFilters:{SubStatus:['Planned']}}).checks.multipleSites,1);
assert.equal(summarize([row('CONFLICT',{SubStatus:'Planned'}),row('CONFLICT',{SubStatus:'Cancelled',PlannedSubmission:'2026-11-01'})],{now,stateFilters:{SubStatus:['Planned']}}).checks.planIssues,1);
assert.equal(summarize([row('ISSUE',{SubStatus:'Cancelled',ActualSubmission:'bad'}),row('ISSUE2',{SubStatus:'Planned',ActualSubmission:'bad'}),row('',{SubStatus:'Cancelled'})],{now,stateFilters:{SubStatus:['Cancelled']}}).issueCount,2);
const big = Array.from({length:10000}, (_,i) => row('PERF-'+i, {Site: DEFAULT_SITES[i%6], ActualSubmission: i%2 ? null : '2026-10-01', PlannedSubmission: i%3 ? '2026-10-15' : '2026-11-15', SubStatus:i%2?'Cancelled':'Completed',ROStatus:i%3?'In Progress':'Archived',AppStatus:i%4?'Active':'Inactive'}));
const start = performance.now(), stress = summarize(big.flatMap(r => [r,r,r]), {now});
const ms = performance.now() - start;
assert.equal(stress.totals.planned, 10000); assert.equal(stress.totals.submitted,5000); assert.equal(stress.totals.inProcess,5000);
assert.ok(ms < 5000, `30k-row calculation unexpectedly slow: ${ms}ms`);
const backlogStart=performance.now(),backlogStress=summarize(big.flatMap(r=>Array(3).fill({...r,PlannedSubmission:'2026-09-30'})),{now});
assert.equal(backlogStress.backlog.count,5000);assert.equal(backlogStress.totals.planned,0);assert.equal(backlogStress.checks.outsideMonths,5000);
assert.ok(performance.now()-backlogStart<5000);
assert.equal(summarize(big.flatMap(r=>[r,r,r]),{now,stateFilters:{SubStatus:['Cancelled']}}).totals.inProcess,5000);
console.log(`PASS: all three independent lifecycle states, exact/blank/unmapped states, duplicate evidence, combined state/BU filters, monthly/backlog totals, date/site conflicts, year rollover and 10,000 distinct submissions in ${Math.round(ms)}ms.`);
