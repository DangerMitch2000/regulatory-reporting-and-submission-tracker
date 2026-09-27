'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { analyze, worklist, parseDate, DATE_FIELDS } = require('./quality.js');
const now = '2026-09-28';
const base = { SubID: 'SUB-A', AppID: 'APP-A', ROID: 'RO-A', Manufacturer: 'North', BusinessUnit: 'ID', Country: 'France', SubStatus: 'In Progress' };
const run = (rows, options = {}) => analyze(rows, { now, ...options });
const byRule = (result, rule) => result.issues.filter(issue => issue.rule === rule);

// There is no general history cutoff and no blanket warning about optional blanks.
let result = run([{ ...base, ...Object.fromEntries(DATE_FIELDS.map(field => [field, null])) }]);
assert.equal(result.issues.length, 0);
assert.equal(result.affectedSubmissions, 0);
assert.equal(run([{ ...base, ActualApproval: '1960-01-01', RegistrationEnd: '2040-12-31' }]).issues.length, 0);
assert.equal(run([{ ...base, RegistrationEnd: '2100-12-31T23:59:59Z' }]).issues.length, 0);
assert.equal(run([{ ...base, RegistrationEnd: '2100-12-31T23:59:59-12:00' }]).issues[0].rule, 'registration_end_after_2100', 'Expiry bound matches the UTC timestamp guard in the timeline');
assert.equal(run([{ ...base, RegistrationEnd: '2100-12-31T23:30:00-02:00' }]).issues[0].rule, 'registration_end_after_2100');
assert.equal(run([{ ...base, RegistrationEnd: '2101-01-01T00:00:00+14:00' }]).issues.length, 0);

// Explicit mapping differentiates an absent role from a mapped blank value.
result = run([{ SubID: 'SUB-A', AppID: null, ROID: null, Country: null, Manufacturer: null }]);
assert.equal(result.issues.length, 4);
assert.equal(result.affectedSubmissions, 1);
assert.deepEqual(result.categoryCounts, { error: 0, review: 0, missing: 4 });
assert.equal(run([{ SubID: 'SUB-A' }]).issues.length, 0);
assert.equal(run([{ ...base, AppID: null, Country: null, Manufacturer: null }], { mappedFields: ['SubID'] }).issues.length, 0);
assert.equal(run([{ SubID: 'SUB-A' }], { mappedFields: new Set(['SubID', 'Country']) }).issues[0].field, 'Country');
result = run([{ ...base, AppID: null }, base, { ...base, Country: null, Manufacturer: null }]);
assert.equal(result.issues.length, 1);
assert.match(result.issues[0].reason, /some membership rows/);
assert.deepEqual(result.issues[0].appIDs, ['APP-A']);

// The worklist is one issue per submission, field and rule, across product joins
// and multiple site/BU memberships. It retains all site memberships for filtering.
const bad = { ...base, LatestApproval: 'nonsense', RegistrationEnd: '9999-12-31' };
result = run([bad, { ...bad, Product: 'Second', Manufacturer: 'South', BusinessUnit: 'CMI', ROID: 'RO-B', AppID: 'APP-B' }, { ...bad, Product: 'Third' }]);
assert.equal(result.issues.length, 2);
assert.equal(result.affectedSubmissions, 1);
assert.deepEqual(result.issues[0].sites, ['North', 'South']);
assert.deepEqual(result.issues[0].businessUnits, ['CMI', 'ID']);
assert.deepEqual(result.issues[0].roIDs, ['RO-A', 'RO-B']);
assert.deepEqual(result.issues[0].appIDs, ['APP-A', 'APP-B']);
assert.equal(worklist(result, { site: 'south', businessUnits: ['id'] }).length, 2);
assert.equal(worklist(result, { site: 'West' }).length, 0);
assert.equal(worklist(result, { query: '9999' }).length, 1);
assert.equal(worklist(result, { category: 'review' }).length, 0);
assert.deepEqual(byRule(result, 'registration_end_after_2100')[0].sourceValues, ['9999-12-31']);

for (const value of ['2101-01-01', '9999-01-01', Date.UTC(99999, 0, 1), new Date(Date.UTC(99999, 0, 1))]) {
  result = run([{ ...base, RegistrationEnd: value }]);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].rule, 'registration_end_after_2100');
  assert.equal(result.issues[0].category, 'error');
}
assert.equal(run([{ ...base, RegistrationEnd: '99999-01-01' }]).issues[0].rule, 'invalid_date');

// Invalid fields and conflicting dates are independently reported, never resolved
// by silently choosing the minimum or by trusting a good duplicate over a bad one.
result = run([
  { ...base, ActualSubmission: '2026-02-30', LatestApproval: '2026-08-01' },
  { ...base, ActualSubmission: '2026-02-01', LatestApproval: '2026-08-02' },
  { ...base, ActualSubmission: '2026-02-30', LatestApproval: '2026-08-01' }
]);
assert.equal(byRule(result, 'invalid_date').length, 1);
assert.equal(byRule(result, 'conflicting_dates').length, 1);
assert.deepEqual(byRule(result, 'conflicting_dates')[0].sourceValues, ['2026-08-01', '2026-08-02']);
assert.equal(byRule(result, 'overdue_plan_without_actual').length, 0);
assert.equal(run([{ ...base, ActualDispatch: Infinity }]).issues[0].rule, 'invalid_date');
assert.equal(run([{ ...base, AppCreated: 'not a date' }]).issues[0].field, 'AppCreated');
assert.equal(run([{ ...base, ActualSubmission: '2026-01-01' }, { ...base, ActualSubmission: '2026-01-01T12:00:00Z' }]).issues.length, 0, 'Times on the same source calendar date do not conflict');

result = run([{ ...base, ActualDispatch: '2026-06-03', ActualSubmission: '2026-06-02', ActualApproval: '2026-06-01', RegistrationStart: '2026-06-01', RegistrationEnd: '2026-05-31' }]);
assert.equal(byRule(result, 'reversed_dates').length, 3);
assert.ok(result.issues.every(issue => issue.relatedValues.length === 1));
assert.ok(result.issues.every(issue => issue.category === 'error'));
assert.equal(run([{ ...base, ActualDispatch: '2026-06-01', ActualSubmission: '2026-06-01', ActualApproval: '2026-06-01' }]).issues.length, 0);

// Future actual dates need human review, not assumptions about completed events.
result = run([{ ...base, ActualDispatch: '2026-09-29', OriginalSubmission: '2027-01-01', RegistrationStart: '2030-01-01' }]);
assert.equal(result.issues.length, 1);
assert.equal(result.issues[0].rule, 'future_actual_date');
assert.equal(result.issues[0].category, 'review');
assert.equal(run([{ ...base, ActualDispatch: now + 'T23:59:00Z' }]).issues.length, 0, 'Same-day actual timestamps do not become future dates');
assert.equal(run([{ ...base, ActualDispatch: '2026-09-28T23:30:00-02:00' }]).issues[0].rule, 'future_actual_date', 'An explicit offset may place the actual event on the next UTC day');
assert.equal(run([{ ...base, ActualDispatch: '2026-09-29T00:30:00+02:00' }]).issues.length, 0, 'A next-calendar-day timestamp may still be today in UTC');
assert.equal(run([
  { ...base, ActualDispatch: '2026-09-27T23:30:00-02:00' },
  { ...base, ActualDispatch: '2026-09-28T01:30:00Z' }
]).issues.length, 0, 'Equivalent timezone timestamps must not create conflicting dates');
assert.equal(run([{ ...base, ActualDispatch: '2026-09-02T00:30:00+02:00', ActualSubmission: '2026-09-01T23:30:00Z' }]).issues.length, 0, 'UTC-normalized dates must not create a false reversal');

// Overdue latest-plan checks fall back only when the latest field is truly blank.
const overdue = { ...base, OriginalApproval: '2026-08-01', LatestApproval: '2026-09-01', ActualApproval: null };
result = run([overdue]);
assert.equal(result.issues.length, 1);
assert.equal(result.issues[0].field, 'LatestApproval');
assert.equal(result.issues[0].overdueDays, 27);
assert.equal(run([{ ...overdue, LatestApproval: ' ' }]).issues[0].field, 'OriginalApproval');
assert.equal(run([{ ...overdue, LatestApproval: 'invalid' }]).issues.length, 1);
assert.equal(run([{ ...overdue, LatestApproval: 'invalid' }]).issues[0].rule, 'invalid_date');
assert.equal(run([{ ...overdue, LatestApproval: now }]).issues.length, 0);
assert.equal(run([{ ...overdue, LatestApproval: '2026-09-28T00:30:00+02:00' }]).issues[0].overdueDays, 1, 'Overdue plans use the same UTC date shown on the timeline');
assert.equal(run([{ ...overdue, ActualApproval: '2026-09-20' }]).issues.length, 0);
assert.equal(run([{ ...overdue, ActualApproval: 'invalid' }]).issues[0].rule, 'invalid_date');
assert.equal(run([overdue], { mappedFields: ['SubID', 'LatestApproval', 'OriginalApproval'] }).issues.length, 0, 'An unmapped actual cannot be assumed missing');
assert.equal(run([overdue], { mappedFields: ['SubID', 'OriginalApproval', 'ActualApproval'] }).issues[0].field, 'OriginalApproval');
for (const SubStatus of ['Inactive', 'Withdrawn', 'Rejected', 'Archived', 'Cancelled']) {
  assert.equal(run([{ ...overdue, SubStatus }]).issues.length, 0, SubStatus);
}
assert.equal(run([overdue, { ...overdue, SubStatus: 'Inactive' }]).issues.length, 0, 'Conflicting terminal state conservatively suppresses overdue prompts');
result = run([{ ...overdue, SubStatus: 'Completed' }]);
assert.equal(result.issues.length, 1);
assert.equal(result.issues[0].rule, 'completed_without_approval');
assert.equal(result.issues[0].category, 'review');
assert.match(result.issues[0].suggestion, /requires approval/);
assert.equal(run([{ ...base, SubStatus: 'Completed' }]).issues.length, 0, 'No completed approval warning when approval is unmapped');

result = run([{ ...base, SubID: '' }, { ...base, SubID: null }, { ...base, SubID: '  ' }, { ...base, LatestApproval: 'bad' }]);
assert.equal(result.excludedRows, 3);
assert.equal(result.distinctSubmissions, 1);
assert.equal(result.issues.length, 1);

// Results and stable IDs do not depend on product row order. Engine and worklist
// leave input rows, native Date objects, and result order untouched.
const rows = [
  { ...base, SubID: 'SUB-B', Manufacturer: 'South', BusinessUnit: 'CMI', ActualDispatch: 'bad' },
  { ...base, AppID: null, LatestApproval: '2026-08-01', ActualApproval: null },
  { ...base, LatestApproval: '2026-08-02', ActualApproval: null },
  { ...base, SubID: 'SUB-C', Manufacturer: null, ActualDispatch: new Date('2027-01-01') }
];
const original = structuredClone(rows);
result = run(rows);
assert.deepEqual(rows, original);
assert.deepEqual(run([...rows].reverse()), result);
assert.deepEqual(run([...rows, ...rows]).issues, result.issues);
const snapshot = structuredClone(result);
assert.equal(worklist(result, { site: '' }).length, 2);
assert.equal(worklist(result, { businessUnits: new Set(['CMI']) }).length, 1);
assert.ok(worklist(result, { query: 'APP-A' }).length > 0);
assert.deepEqual(result, snapshot);
const dateIssue = result.issues.find(issue => issue.rule === 'future_actual_date');
dateIssue.sourceValues[0].setUTCFullYear(2030);
assert.equal(rows[3].ActualDispatch.getUTCFullYear(), 2027);

assert.equal(parseDate('2024-02-29').state, 'valid');
assert.equal(parseDate('2025-02-29').state, 'invalid');
assert.equal(parseDate('2025-02-29T23:30:00-02:00').state, 'invalid', 'Offset normalization must not make an impossible calendar day valid');
assert.equal(parseDate('2026-02-30T00:00:00Z').state, 'invalid');
assert.equal(parseDate('2026-04-31T00:30:00+14:00').state, 'invalid');
assert.equal(parseDate('2100-12-31T23:30:00-02:00').day, Date.UTC(2101, 0, 1));
assert.equal(parseDate('2101-01-01T00:30:00+02:00').day, Date.UTC(2100, 11, 31));
assert.equal(parseDate('2026-09-28').day, Date.UTC(2026, 8, 28));
assert.equal(parseDate('2026-09-28T00:30:00').day, Date.UTC(2026, 8, 28), 'Unzoned calendar dates retain their calendar day');
assert.equal(parseDate('2026-01-01T25:00:00Z').state, 'invalid');
assert.equal(parseDate('02/03/2026').state, 'invalid');
assert.equal(parseDate(0).state, 'valid');
assert.throws(() => run([], { now: 'invalid' }), /current date/);
assert.equal(run([]).issues.length, 0);

const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('./quality.js'), 'utf8'), sandbox);
assert.equal(typeof sandbox.regulatoryQuality.analyze, 'function');
assert.equal(sandbox.regulatoryQuality.analyze([{ ...base, ActualDispatch: 'bad' }], { now }).issues.length, 1);

const many = Array.from({ length: 10000 }, (_, index) => ({
  ...base, SubID: 'SUB-' + index, Manufacturer: index % 2 ? 'South' : 'North',
  ActualApproval: index % 10 === 0 ? 'bad' : '2026-01-01'
})).flatMap(row => [row, { ...row, Product: 'Second product' }, { ...row, Product: 'Third product' }]);
const started = performance.now();
result = run(many);
assert.equal(result.inputRows, 30000);
assert.equal(result.distinctSubmissions, 10000);
assert.equal(result.issues.length, 1000);
assert.equal(result.affectedSubmissions, 1000);
assert.equal(new Set(result.issues.map(issue => issue.id)).size, 1000);
assert.equal(worklist(result, { site: 'North' }).length, 1000);
console.log('Data Quality checks passed, including 30,000 membership rows (' + Math.round(performance.now() - started) + ' ms).');
