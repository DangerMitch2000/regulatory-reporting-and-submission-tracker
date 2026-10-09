import assert from 'node:assert/strict';
import {summarize, mapTable, ROLES, REQUIRED, IDENTIFIER_FIELDS} from './submissions.logic.mjs';

const now = new Date(2026, 9, 9, 12);
const base = {Site:'ABO', BusinessUnit:'ID', PlannedSubmission:'2026-10-02', ActualSubmission:null,
  SubStatus:'In Progress', ROStatus:'In Progress', AppStatus:'Active', DispatchRequired:'Yes',
  PlannedDispatch:'2026-10-01', ActualDispatch:null};
const row = (SubID, patch = {}) => ({...base, SubID, ...patch});
const monthly = result => result.buckets.flatMap(site => site.months.flatMap(month => month.rows));
const get = (result, id) => monthly(result).find(record => record.id === id);
const pairs = record => record.relatedRecords.map(pair => JSON.stringify([pair.roId, pair.appId])).sort();
const assertPairs = (record, expected) => assert.deepEqual(pairs(record), expected.map(pair => JSON.stringify(pair)).sort());
const withoutIdentifiers = source => source.map(({ROID, AppID, ...rest}) => rest);
const counting = result => ({totals:result.totals, checks:result.checks, scopedRecords:result.scopedRecords,
  overdue:[result.overdue.count,result.overdue.internal,result.overdue.authority,result.overdue.unclassified],
  backlog:result.backlog.count, completion:result.completion,
  ids:monthly(result).map(record => [record.id,record.status,Boolean(record.overdue)]).sort()});

assert.deepEqual(IDENTIFIER_FIELDS, [{role:'ROID',label:'RO ID'},{role:'AppID',label:'Application ID'}]);
assert.deepEqual(ROLES.slice(-2), ['ROID','AppID']);
assert.deepEqual(REQUIRED, ['SubID','Site','PlannedSubmission','ActualSubmission']);

// A known Submission ID remains the count grain even when several submissions
// share a parent, and optional parent fields must not affect filing evidence.
const source = [
  row('S-1',{ROID:'RO-1',AppID:'APP-1'}),
  row('S-1',{ROID:'RO-1',AppID:'APP-1'}),
  row('S-2',{ROID:'RO-1',AppID:'APP-1',SubStatus:'Completed'}),
  row('S-3',{ROID:'RO-1',AppID:'APP-1',RegistrationID:'REG-1',RegistrationStatus:'Approved'}),
  row('S-4',{ROID:'RO-1',AppID:'APP-1',RegistrationID:'REG-2',RegistrationStatus:'Planned'}),
  row('',{ROID:'RO-1',AppID:'APP-1'}),
  row('',{ROID:'RO-1',AppID:'APP-1'}),
  row(null,{ROID:'RO-2',AppID:'APP-2',RegistrationID:'REG-ORPHAN',RegistrationStatus:'Approved'}),
  row('  ',{ROID:'RO-3',AppID:''})
];
const result = summarize(source,{now});
assert.deepEqual(result.totals,{planned:4,inProcess:2,submitted:2,review:0,overdue:2});
assert.equal(result.overdue.count,2);
assert.equal(result.checks.missingIds,4);
assert.equal(result.coverage.missingIds.length,4);
assert.deepEqual(counting(result),counting(summarize(withoutIdentifiers(source),{now})));
for (const record of monthly(result)) {
  assert.deepEqual(record.relatedIds,{ROID:['RO-1'],AppID:['APP-1']});
  assertPairs(record,[['RO-1','APP-1']]);
}
assert.equal(get(result,'S-1').status,'In process');
assert.equal(get(result,'S-4').status,'In process');
for (const record of result.coverage.missingIds) {
  assert.equal(record.id,'');
  assert.equal(record.status,'Not counted');
}
const [blank1,blank2,blank3,blank4] = result.coverage.missingIds;
assert.notEqual(blank1,blank2,'Identical delivered blank-ID rows remain separate entries');
assert.deepEqual(blank1.relatedIds,{ROID:['RO-1'],AppID:['APP-1']});
assert.deepEqual(blank2.relatedIds,blank1.relatedIds);
assert.equal(blank1.registration.records.length,0);
assert.equal(blank3.registration.qualifying.length,1);
assert.deepEqual(blank3.relatedIds,{ROID:['RO-2'],AppID:['APP-2']});
assert.deepEqual(blank4.relatedIds,{ROID:['RO-3'],AppID:[]});
assertPairs(blank4,[['RO-3','']]);

// Preserve only actual source-row parent pairs, including one-sided links.
// In particular, never manufacture RO-2 / APP-1 by crossing the two ID lists.
const joined = [
  row('JOIN',{ROID:' RO-1 ',AppID:' APP-1 '}),
  row('JOIN',{ROID:'RO-2',AppID:'APP-2'}),
  row('JOIN',{ROID:'RO-1',AppID:'APP-1'}),
  row('JOIN',{ROID:'RO-3',AppID:null}),
  row('JOIN',{ROID:null,AppID:'APP-3'}),
  row('JOIN',{ROID:null,AppID:null})
];
const joinedRecord = get(summarize(joined,{now}),'JOIN');
assert.deepEqual([...joinedRecord.relatedIds.ROID].sort(),['RO-1','RO-2','RO-3']);
assert.deepEqual([...joinedRecord.relatedIds.AppID].sort(),['APP-1','APP-2','APP-3']);
assertPairs(joinedRecord,[['RO-1','APP-1'],['RO-2','APP-2'],['RO-3',''],['','APP-3']]);
assert.equal(summarize(joined,{now}).totals.planned,1);

// Filters select known submissions but cannot conceal their other delivered
// parent links or borrow approval from another submission with the same parents.
const filteredSource = [
  row('FILTER',{ROID:'RO-A',AppID:'APP-A'}),
  row('FILTER',{ROID:'RO-B',AppID:'APP-B',BusinessUnit:'CMI',SubStatus:'Inactive',
    RegistrationID:'REG-B',RegistrationStatus:'Approved'}),
  row('KEEP-SEPARATE',{ROID:'RO-B',AppID:'APP-B'}),
  row('',{ROID:'RO-VISIBLE',AppID:'APP-VISIBLE'}),
  row('',{ROID:'RO-HIDDEN',AppID:'APP-HIDDEN',BusinessUnit:'CMI',SubStatus:'Inactive'})
];
const filtered = summarize(filteredSource,{now,unit:'ID',stateFilters:{SubStatus:['In Progress']}});
assert.equal(filtered.totals.planned,2);
assert.equal(filtered.totals.submitted,1);
assert.equal(get(filtered,'FILTER').status,'Submitted');
assert.equal(get(filtered,'KEEP-SEPARATE').status,'In process');
assertPairs(get(filtered,'FILTER'),[['RO-A','APP-A'],['RO-B','APP-B']]);
assert.equal(filtered.coverage.missingIds.length,1);
assertPairs(filtered.coverage.missingIds[0],[['RO-VISIBLE','APP-VISIBLE']]);
assert.deepEqual(counting(filtered),counting(summarize(withoutIdentifiers(filteredSource),{now,unit:'ID',stateFilters:{SubStatus:['In Progress']}})));
const splitEvidence = summarize([
  row('NO-BORROW',{ROID:'RO-X',AppID:'APP-X',RegistrationID:'REG-X',RegistrationStatus:'Planned'}),
  row('NO-BORROW',{ROID:'RO-Y',AppID:'APP-Y',RegistrationID:'',RegistrationStatus:'Approved'})
],{now});
assert.equal(splitEvidence.totals.submitted,0);
assertPairs(get(splitEvidence,'NO-BORROW'),[['RO-X','APP-X'],['RO-Y','APP-Y']]);

// Explicit mappings distinguish Not mapped from a mapped field with no value.
for (const omitted of [[],['ROID'],['AppID'],['ROID','AppID']]) {
  const roles = ROLES.filter(role => !omitted.includes(role));
  const input = row('MAP',{ROID:'RO-MAP',AppID:'APP-MAP'});
  const mapped = mapTable({columns:roles.map(role => ({roles:{[role]:true}})),rows:[roles.map(role => input[role]??null)]});
  assert.deepEqual(mapped.missing,[]);
  assert.deepEqual(mapped.identifierMapped,{ROID:!omitted.includes('ROID'),AppID:!omitted.includes('AppID')});
  const record = get(summarize(mapped.rows,{now,identifierMapped:mapped.identifierMapped}),'MAP');
  assert.deepEqual(record.relatedIds,{ROID:omitted.includes('ROID')?null:['RO-MAP'],AppID:omitted.includes('AppID')?null:['APP-MAP']});
  assertPairs(record,omitted.length===2?[]:[[omitted.includes('ROID')?'':'RO-MAP',omitted.includes('AppID')?'':'APP-MAP']]);
}
const allColumns = ROLES.map(role => ({roles:{[role]:true}}));
const mappedBlank = mapTable({columns:allColumns,rows:[ROLES.map(role => row('',{ROID:'RO-ONLY',AppID:'APP-ONLY'})[role]??null)]});
assert.deepEqual(mappedBlank.missing,[]);
assert.equal(summarize(mappedBlank.rows,{now,identifierMapped:mappedBlank.identifierMapped}).coverage.missingIds.length,1);
assert.deepEqual(mapTable({columns:allColumns.filter(column => !column.roles.SubID),rows:[]}).missing,['SubID']);
assert.throws(() => mapTable({columns:[...allColumns,{roles:{ROID:true}}],rows:[]}),/Map only one column to ROID/);
assert.deepEqual(get(summarize([row('UNMAPPED')],{now}),'UNMAPPED').relatedIds,{ROID:null,AppID:null});
assert.deepEqual(get(summarize([row('BLANK',{ROID:' ',AppID:null})],{now}),'BLANK').relatedIds,{ROID:[],AppID:[]});
assert.deepEqual(get(summarize([row('EXPLICIT',{ROID:'RO-IGNORED',AppID:'APP-USED'})],{now,identifierMapped:{ROID:false,AppID:true}}),'EXPLICIT').relatedIds,{ROID:null,AppID:['APP-USED']});

// Every Details route retains identifiers: allocated plan, backlog, all overdue,
// date/site checks and coverage outside the selected sites or month cohort.
const routed = summarize([
  row('MONTH',{ROID:'RO-MONTH',AppID:'APP-MONTH'}),
  row('BACKLOG',{ROID:'RO-BACKLOG',AppID:'APP-BACKLOG',PlannedSubmission:'2026-09-02'}),
  row('OUTSIDE-SITE',{ROID:'RO-OUTSIDE-SITE',AppID:'APP-OUTSIDE-SITE',Site:'OTHER'}),
  row('OUTSIDE-MONTH',{ROID:'RO-OUTSIDE-MONTH',AppID:'APP-OUTSIDE-MONTH',PlannedSubmission:'2026-12-02'}),
  row('MISSING-PLAN',{ROID:'RO-MISSING-PLAN',AppID:'APP-MISSING-PLAN',PlannedSubmission:null}),
  row('MULTI-SITE',{ROID:'RO-MULTI-SITE',AppID:'APP-MULTI-SITE'}),
  row('MULTI-SITE',{ROID:'RO-MULTI-SITE',AppID:'APP-MULTI-SITE',Site:'ADJ'})
],{now});
assert.ok(routed.backlog.rows.some(record => record.id==='BACKLOG'));
assert.ok(routed.coverage.outsideSites.some(record => record.id==='OUTSIDE-SITE'));
assert.ok(routed.coverage.outsideMonths.some(record => record.id==='OUTSIDE-MONTH'));
assert.ok(routed.issues.some(record => record.id==='MISSING-PLAN'));
assert.ok(routed.issues.some(record => record.id==='MULTI-SITE'));
for (const record of [...monthly(routed),...routed.backlog.rows,...routed.overdue.rows,...routed.issues,...routed.coverage.outsideSites,...routed.coverage.outsideMonths]) {
  assert.deepEqual(record.relatedIds,{ROID:['RO-'+record.id],AppID:['APP-'+record.id]});
  assertPairs(record,[['RO-'+record.id,'APP-'+record.id]]);
}

// Scale fixture has 10,000 distinct submissions, repeated joins and 1,000
// separate blank-ID rows. Duplicate parents cannot create quadratic matching.
const load = Array.from({length:10000},(_,i) => row('LOAD-'+i,{ROID:'RO-'+Math.floor(i/4),AppID:'APP-'+Math.floor(i/20),
  RegistrationID:i%2?'':'REG-'+i,RegistrationStatus:i%2?'':'Approved'}));
const blanks = Array.from({length:1000},(_,i) => row('',{ROID:'RO-'+Math.floor(i/2),AppID:'APP-'+Math.floor(i/10)}));
const start = performance.now();
const loaded = summarize([...load.flatMap(record => [record,record,record]),...blanks],{now});
const elapsed = performance.now()-start;
assert.equal(loaded.totals.planned,10000);
assert.equal(loaded.totals.submitted,5000);
assert.equal(loaded.overdue.count,5000);
assert.equal(loaded.checks.missingIds,1000);
assert.equal(loaded.coverage.missingIds.length,1000);
assert.ok(monthly(loaded).every(record => record.relatedRecords.length===1));
assert.ok(elapsed<5000,`31,000 delivered rows took ${Math.round(elapsed)}ms`);
console.log(`PASS: optional RO/application mappings, distinct submission counts, preserved blank-ID rows, parent pair integrity, filtering, coverage routes and 10,000 submissions plus 1,000 missing-ID rows (${Math.round(elapsed)}ms).`);
