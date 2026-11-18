import assert from 'node:assert/strict';
import {summarize, mapTable, ROLES} from './submissions.logic.mjs';

const now = new Date(2026, 10, 18, 12);
const base = {Site:'ABO', BusinessUnit:'ID', Product:'Product A', CommercialRegion:'Europe', FallbackCountry:'Ireland', PlannedSubmission:'2026-01-01', ActualSubmission:null, SubStatus:'In Progress', ROStatus:'In Progress', AppStatus:'Active', DispatchRequired:'No', PlannedDispatch:null, ActualDispatch:null};
const row = (SubID, patch={}) => ({...base, SubID, ...patch});
const fixture = [
  row('JAN-OPEN'),
  row('SEP-SUBMITTED', {PlannedSubmission:'2026-09-01', ActualSubmission:'2026-10-01'}),
  row('OCT-STATE', {PlannedSubmission:'2026-10-01', ActualSubmission:'bad', SubStatus:'Completed'}),
  row('DEC-OPEN', {PlannedSubmission:'2026-12-01'}),
  row('DEC-INTERNAL', {PlannedSubmission:'2026-12-31', DispatchRequired:'Yes', PlannedDispatch:'2026-11-01'}),
  row('NOV-DUE', {PlannedSubmission:'2026-11-17'}),
  row('REG-APPROVED', {RegistrationID:'REG-A', RegistrationStatus:'Approved', ROID:'RO-REG', RegistrationCountry:'Ireland'}),
  row('RO-APPROVED', {ROStatus:'Health Authority Approved'}),
  row('REVIEW', {PlannedSubmission:'2026-04-01', ActualSubmission:'bad'}),
  row('OLD', {PlannedSubmission:'2025-12-31'}),
  row('NEXT-YEAR', {PlannedSubmission:'2027-01-01'}),
  row('MISSING-PLAN', {PlannedSubmission:null}),
  row('BAD-PLAN', {PlannedSubmission:'31/02/2026'}),
  row('CONFLICT-PLAN'), row('CONFLICT-PLAN', {PlannedSubmission:'2026-01-02'}),
  row('MULTISITE'), row('MULTISITE', {Site:'ADJ'}),
  row('OTHER-SITE', {Site:'OTHER'}),
  row('UNASSIGNED', {Site:null}),
  row('')
];
const result = summarize(fixture.flatMap(record => [record, record, record]), {now});
const annual = result.yearSummary;
assert.equal(annual.year, 2026);
assert.equal(annual.start, Date.UTC(2026, 0, 1));
assert.equal(annual.end, Date.UTC(2027, 0, 1));
assert.equal(annual.label, 'Calendar year 2026');
assert.deepEqual(annual.totals, {planned:9, inProcess:5, submitted:3, review:1, overdue:2});
assert.equal(annual.completion, 33);
assert.equal(annual.rows.length, new Set(annual.rows.map(record => record.id)).size, 'joined product/registration rows count each submission once');
assert.deepEqual(annual.rows.filter(record => record.overdue).map(record => record.id), ['JAN-OPEN', 'DEC-INTERNAL']);
assert.equal(annual.rows.find(record => record.id === 'DEC-INTERNAL').overdueStage, 'internal');
assert.equal(annual.rows.find(record => record.id === 'JAN-OPEN').overdueStage, 'authority');
assert.equal(annual.rows.find(record => record.id === 'NOV-DUE').overdue, false, 'a plan due yesterday is not yet overdue against yesterday');
assert.equal(annual.rows.find(record => record.id === 'RO-APPROVED').overdue, false);
assert.equal(annual.rows.find(record => record.id === 'REG-APPROVED').status, 'Submitted');
assert.equal(annual.rows.find(record => record.id === 'REVIEW').status, 'Check date');
assert.deepEqual(result.totals, {planned:4, inProcess:3, submitted:1, review:0, overdue:1});
assert.deepEqual(result.backlog.rows.map(record => record.id), ['OLD', 'JAN-OPEN'], 'annual inclusion does not remove existing backlog');
assert.deepEqual(result.coverage.outsideMonths.map(record => record.id).sort(), ['NEXT-YEAR','REG-APPROVED','REVIEW','RO-APPROVED','SEP-SUBMITTED'].sort(), 'annual inclusion does not change coverage groups');
const monthlyRows = result.buckets.flatMap(site => site.months.flatMap(month => month.rows));
for (const monthly of monthlyRows) assert.equal(annual.rows.find(record => record.id === monthly.id), monthly, 'monthly and annual details share the same classified record');

// Calendar year follows the current viewer date even when yesterday is in the prior year.
const boundaryRows = [row('OLD-END', {PlannedSubmission:'2026-12-31'}), row('NEW-START', {PlannedSubmission:'2027-01-01'}), row('NEW-END', {PlannedSubmission:'2027-12-31'}), row('AFTER', {PlannedSubmission:'2028-01-01'})];
const january = summarize(boundaryRows, {now:new Date(2027, 0, 1, 12)});
assert.equal(january.asOf, Date.UTC(2026, 11, 31));
assert.equal(january.yearSummary.year, 2027);
assert.deepEqual(january.yearSummary.rows.map(record => record.id), ['NEW-START','NEW-END']);
assert.deepEqual(january.buckets[0].months.flatMap(month => month.rows.map(record => record.id)), ['OLD-END','NEW-START']);
assert.equal(january.yearSummary.totals.overdue, 0);

// Every top-level scope applies to annual records, without filtering away conflicting joined evidence.
const scopes = [
  ['unit', 'ID', {BusinessUnit:'CMI'}],
  ['product', 'Product A', {Product:'Product B'}],
  ['region', 'Europe', {CommercialRegion:'Asia'}],
  ['country', 'Ireland', {FallbackCountry:'France'}],
  ['sites', ['ABO'], {Site:'ADJ'}],
  ['stateFilters', {SubStatus:['In Progress']}, {SubStatus:'Completed'}]
];
for (const [key, value, excludedPatch] of scopes) {
  const scoped = summarize([row('INCLUDED'), row('EXCLUDED', excludedPatch)], {now, [key]:value});
  assert.deepEqual(scoped.yearSummary.rows.map(record => record.id), ['INCLUDED'], `${key} filters the calendar year`);
}
const joinedConflict = summarize([row('CONFLICT'),row('CONFLICT',{Product:'Product B', Site:'ADJ'})], {now, product:'Product A', sites:['ABO']});
assert.equal(joinedConflict.yearSummary.totals.planned, 0);
assert.equal(joinedConflict.checks.multipleSites, 1, 'a site/product filter must not hide conflicting site evidence');
const countryPreference = summarize([row('REG-COUNTRY',{RegistrationID:'R',RegistrationCountry:'France'})], {now,country:'Ireland'});
assert.equal(countryPreference.yearSummary.totals.planned, 0, 'registration country still takes precedence over secondary country');
assert.deepEqual(summarize(fixture, {now, sites:[]}).yearSummary.totals, {planned:0,inProcess:0,submitted:0,review:0,overdue:0});
assert.equal(summarize([], {now}).yearSummary.completion, 0);

const sourceColumns = ROLES.map(role => ({roles:{[role]:true}, displayName:role === 'Site' ? ' Manufacturer name ' : role}));
assert.equal(mapTable({columns:sourceColumns,rows:[]}).siteFieldLabel, 'Manufacturer name');
sourceColumns[1] = {roles:{Site:true}, queryName:'Manufacturers.name__v'};
assert.equal(mapTable({columns:sourceColumns,rows:[]}).siteFieldLabel, 'Manufacturers.name__v');
assert.equal(mapTable({columns:[{roles:{Site:true}}],rows:[]}).siteFieldLabel, 'Site (legal manufacturer)');
console.log('PASS: calendar-year boundaries, all-month cohorts, distinct counts, shared completion/dispatch rules, filters, invalid records, coverage preservation and site source labels.');
