'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { analyze, parseDate, DAY } = require('./predictions.js');
const now = '2026-09-27';
const iso = n => new Date(n).toISOString().slice(0, 10);
function completed(id, days = 100, country = 'France', submitted = '2025-01-01') {
  return { SubID: id, Country: country, ActualSubmission: submitted, ActualApproval: iso(Date.parse(submitted) + days * DAY), OriginalApproval: null, LatestApproval: null };
}
const history = Array.from({ length: 12 }, (_, i) => completed('H' + i, 90 + i * 2));
const pending = { SubID: 'P1', Country: ' France ', ActualSubmission: '2026-09-01', ActualApproval: null, OriginalApproval: null, LatestApproval: null };
let result = analyze([...history, pending], { now });
let p = result.bySubID.get('P1');
assert.equal(p.status, 'estimated');
assert.equal(p.medianDays, 101);
assert.equal(p.sampleCount, 12);
assert.equal(p.excludedCount, 1);
assert.equal(iso(p.predictedDate), '2026-12-11');
assert.equal(iso(p.rangeStart), '2026-12-05');
assert.equal(iso(p.rangeEnd), '2026-12-17');
assert.equal(p.overdue, false);
assert.equal(result.summary.completed, 12);
assert.equal(result.byCountry.size, 1);

// Membership joins must not increase the historical sample or create additional estimates.
result = analyze([...history.flatMap(r => [r, { ...r, Product: 'Other product', Country: 'FRANCE' }]), pending, { ...pending, Country: null }], { now });
assert.equal(result.bySubID.get('P1').sampleCount, 12);
assert.equal(result.summary.distinctSubmissions, 13);
assert.equal(result.summary.estimated, 1);

// No plan or actual approval may be overwritten, even if a populated input is corrupt.
for (const [field, value, status] of [
  ['OriginalApproval', '2027-01-01', 'planned'], ['LatestApproval', '2027-01-01', 'planned'],
  ['OriginalApproval', 'not a date', 'unavailable'], ['LatestApproval', 'not a date', 'unavailable'],
  ['ActualApproval', '2026-09-20', 'completed'], ['ActualApproval', 'nonsense', 'unavailable'],
  ['ActualApproval', '9999-01-01', 'unavailable']
]) {
  p = analyze([...history, { ...pending, [field]: value }], { now }).bySubID.get('P1');
  assert.equal(p.status, status, field + ': ' + value);
  assert.equal(p.predictedDate, null);
}
p = analyze([...history, pending, { ...pending, OriginalApproval: '2026-10-01' }, { ...pending, OriginalApproval: '2026-11-01' }], { now }).bySubID.get('P1');
assert.ok(p.reasonCodes.includes('original_approval_conflicting'));

const bad = [
  { ...completed('OLD'), ActualSubmission: '1960-01-01' },
  { ...completed('FUTURE'), ActualApproval: '9999-01-01' },
  { ...completed('REVERSE'), ActualSubmission: '2025-12-01' },
  { ...completed('BROKEN'), ActualApproval: '2025-02-30' },
  { ...completed('MISSING'), ActualSubmission: null },
  { ...completed('FUTURESUB'), ActualSubmission: '2027-01-01', ActualApproval: '2027-02-01' },
  { ...completed('INVALID'), ActualSubmission: '03/04/2025' },
  completed('CONFLICT', 110), completed('CONFLICT', 115),
  { ...completed('DATEANDERROR'), ActualSubmission: 'bad' }, completed('DATEANDERROR'),
  completed('MULTI', 100, 'France'), completed('MULTI', 100, 'Germany'),
  completed('NONE', 100, null), completed('JOINED', 100, 'France;Germany'),
  { ...completed('BLANKID'), SubID: '' }
];
result = analyze([...history, ...bad, pending], { now });
assert.equal(result.bySubID.get('P1').sampleCount, 12);
assert.equal(result.summary.missingIDRows, 1);
assert.equal(result.bySubID.get('MULTI').historyIncluded, false);
assert.equal(result.bySubID.get('JOINED').historyIncluded, false);
assert.ok(result.bySubID.get('CONFLICT').historyExclusionCodes.includes('actual_approval_conflicting'));
assert.ok(result.bySubID.get('DATEANDERROR').historyExclusionCodes.includes('actual_submission_invalid'));
assert.ok(result.bySubID.get('OLD').historyExclusionCodes.includes('actual_submission_before_2020'));
assert.ok(result.bySubID.get('FUTURE').historyExclusionCodes.includes('actual_approval_future'));
assert.equal(result.bySubID.get('P1').excludedCount, 10);
assert.equal(result.bySubID.get('P1').exclusions.find(x => x.code === 'actual_approval_missing').count, 1);

for (const input of [
  { ...pending, Country: null }, { ...pending, Country: ['France', 'Germany'] },
  { ...pending, ActualSubmission: null }, { ...pending, ActualSubmission: '1960-01-01' },
  { ...pending, ActualSubmission: '2026-09-28' }, { ...pending, ActualSubmission: '9999-01-01' }
]) assert.equal(analyze([...history, input], { now }).bySubID.get('P1').status, 'unavailable');

assert.equal(analyze([...history.slice(0, 9), pending], { now }).bySubID.get('P1').status, 'insufficient');
assert.equal(analyze([...history.slice(0, 10), pending], { now }).bySubID.get('P1').status, 'estimated');
assert.equal(analyze([...history, { ...pending, Country: 'Germany' }], { now }).bySubID.get('P1').status, 'insufficient');
assert.equal(analyze([{ ...completed('CUTOFF', 0, 'France', '2020-01-01') }], { now }).summary.qualifyingHistory, 1);
assert.equal(analyze([{ ...completed('TODAY', 0, 'France', now) }], { now }).summary.qualifyingHistory, 1);

// An estimate due today is not yet overdue, even later in the same day.
const dueToday={...pending,ActualSubmission:iso(Date.parse(now)-101*DAY)};
assert.equal(analyze([...history,dueToday],{now:now+'T18:00:00Z'}).bySubID.get('P1').overdue,false);

// Long but valid approvals remain in the median while being separately flagged.
result = analyze([...history, completed('LONG', 1900, 'France', '2020-01-01'), { ...pending, ActualSubmission: '2025-01-01' }], { now });
p = result.bySubID.get('P1');
assert.equal(p.sampleCount, 13);
assert.equal(p.outlierCount, 1);
assert.equal(result.bySubID.get('LONG').longHistoryFlag, true);
assert.equal(p.medianDays, 102);
assert.equal(p.overdue, true);
assert.equal(iso(p.predictedDate), '2025-04-13');
assert.ok(p.predictedDate < Date.parse(now), 'Do not clamp a historical estimate into the future');

assert.equal(parseDate('2024-02-29').state, 'valid');
assert.equal(parseDate('2025-02-29').state, 'invalid');
assert.equal(parseDate('2026-09-01T25:00:00Z').state, 'invalid');
assert.equal(parseDate('2026-09-01T00:00:00.000Z').day, Date.parse('2026-09-01'));
assert.equal(parseDate(new Date('2026-09-01')).day, Date.parse('2026-09-01'));
assert.equal(parseDate(Date.parse('2026-09-01')).day, Date.parse('2026-09-01'));
assert.equal(parseDate('  ').state, 'blank');
assert.throws(() => analyze([], { now: 'broken' }), /current date/);
assert.throws(() => analyze([], { now, minSamples: 0 }), /sample size/);
assert.equal(analyze([], { now }).summary.estimated, 0);

// Browser distribution exposes the same standalone API without CommonJS.
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('./predictions.js'), 'utf8'), context);
assert.equal(typeof context.regulatoryPredictions.analyze, 'function');
assert.equal(context.regulatoryPredictions.analyze(JSON.parse(JSON.stringify([...history, pending])), { now }).bySubID.get('P1').sampleCount, 12);

// 30,000 membership rows collapse to 10,000 submissions; samples never count joins.
const large = Array.from({ length: 10000 }, (_, i) => completed('BIG' + i, 40 + i % 121, i % 2 ? 'France' : 'Germany'))
  .flatMap(r => [r, { ...r, Product: 'Second' }, { ...r, Product: 'Third' }]);
const start = performance.now();
result = analyze([...large, pending], { now });
assert.equal(result.summary.inputRows, 30001);
assert.equal(result.summary.distinctSubmissions, 10001);
assert.equal(result.bySubID.get('P1').sampleCount, 5000);
assert.equal(result.summary.qualifyingHistory, 10000);
console.log('Approval prediction checks passed, including 30,000 membership rows (' + Math.round(performance.now() - start) + ' ms).');
