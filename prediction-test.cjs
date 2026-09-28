'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { analyze, resolveSubmissionDates, parseDate, DAY } = require('./predictions.js');
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
assert.equal(result.summary.benchmark, 12);
assert.equal(p.selfExcluded, false);
assert.equal(result.byCountry.size, 1);
assert.equal(p.anchorDate, Date.parse('2026-09-01'));
assert.equal(p.anchorField, 'ActualSubmission');
assert.equal(p.anchorLabel, 'Actual submission');
assert.equal(p.forecastFromPlan, false);

// Resolve once per submission over all memberships. The same priority drives
// filtering and pending estimates: actual, then latest plan, then original plan.
const submissionPlans = { ...pending, ActualSubmission: null, LatestSubmission: '2027-01-10', OriginalSubmission: '2026-12-01' };
let anchor = resolveSubmissionDates([submissionPlans]).get('P1');
assert.deepEqual(anchor, { date: Date.parse('2027-01-10'), field: 'LatestSubmission', label: 'Latest planned submission', state: 'valid', reason: 'Using latest planned submission.' });
p = analyze([...history, submissionPlans], { now }).bySubID.get('P1');
assert.equal(p.status, 'estimated');
assert.equal(p.anchorDate, anchor.date);
assert.equal(p.anchorField, 'LatestSubmission');
assert.equal(p.forecastFromPlan, true);
assert.equal(p.actualSubmission, null);
assert.equal(iso(p.predictedDate), '2027-04-21');
assert.equal(p.overdue, false);
assert.equal(p.sampleCount, 12);
assert.equal(p.historyIncluded, false, 'A planned submission does not enter actual processing-time history');
assert.match(p.reason, /latest planned submission/);
assert.equal(analyze([...history.slice(0, 9), submissionPlans], { now }).bySubID.get('P1').status, 'insufficient');
assert.equal(analyze([...history.slice(0, 10), submissionPlans], { now }).bySubID.get('P1').status, 'estimated');

anchor = resolveSubmissionDates([{ ...submissionPlans, ActualSubmission: '2026-09-01', LatestSubmission: 'bad plan' }]).get('P1');
assert.equal(anchor.field, 'ActualSubmission');
assert.equal(anchor.date, Date.parse('2026-09-01'));
p = analyze([...history, { ...submissionPlans, ActualSubmission: '2026-09-01', LatestSubmission: 'bad plan' }], { now }).bySubID.get('P1');
assert.equal(p.status, 'estimated');
assert.equal(p.forecastFromPlan, false);

anchor = resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: ' ' }]).get('P1');
assert.equal(anchor.field, 'OriginalSubmission');
p = analyze([...history, { ...submissionPlans, LatestSubmission: null }], { now }).bySubID.get('P1');
assert.equal(p.status, 'estimated');
assert.equal(p.anchorField, 'OriginalSubmission');
assert.equal(p.anchorDate, Date.parse('2026-12-01'));
assert.equal(p.forecastFromPlan, true);

// A populated bad higher-priority value must never silently fall through.
for (const [field, value, expectedState] of [
  ['ActualSubmission', 'invalid', 'invalid'],
  ['ActualSubmission', '9999-01-01', 'invalid'],
  ['ActualSubmission', '2026-02-30', 'invalid'],
  ['LatestSubmission', 'invalid', 'invalid'],
  ['LatestSubmission', '9999-01-01', 'invalid']
]) {
  const record = { ...submissionPlans, [field]: value };
  anchor = resolveSubmissionDates([record]).get('P1');
  assert.equal(anchor.state, expectedState);
  assert.equal(anchor.field, field);
  assert.equal(anchor.date, null);
  p = analyze([...history, record], { now }).bySubID.get('P1');
  assert.equal(p.status, 'unavailable');
  assert.equal(p.predictedDate, null);
}
for (const field of ['ActualSubmission', 'LatestSubmission', 'OriginalSubmission']) {
  const originalOnly = { ...submissionPlans, LatestSubmission: null };
  const record = field === 'OriginalSubmission' ? originalOnly : submissionPlans;
  const joined = [{ ...record, [field]: '2026-07-01' }, { ...record, [field]: '2026-08-01' }];
  anchor = resolveSubmissionDates(joined).get('P1');
  assert.equal(anchor.state, 'conflicting');
  assert.equal(anchor.field, field);
  assert.equal(analyze([...history, ...joined], { now }).bySubID.get('P1').status, 'unavailable');
}
p = analyze([...history, { ...submissionPlans, ActualSubmission: '2027-01-01' }], { now }).bySubID.get('P1');
assert.equal(p.status, 'unavailable');
assert.equal(p.anchorField, 'ActualSubmission');
assert.ok(p.reasonCodes.includes('actual_submission_future'));
assert.equal(resolveSubmissionDates([{ ...submissionPlans, ActualSubmission: '2027-01-01' }]).get('P1').date, Date.parse('2027-01-01'), 'Filtering may show a future actual-date record, but forecasting must withhold it');

// Blank higher-priority membership rows cannot mask a populated actual date.
anchor = resolveSubmissionDates([submissionPlans, { ...submissionPlans, ActualSubmission: '2026-09-01', Product: 'Joined membership' }]).get('P1');
assert.equal(anchor.field, 'ActualSubmission');
assert.equal(anchor.date, Date.parse('2026-09-01'));
assert.equal(resolveSubmissionDates([{ ...pending, SubID: '  SUB-DATE  ' }]).has('SUB-DATE'), true);

// Identity is trim-only, matching app/Vega lookups. Interior spaces and fullwidth
// characters must not merge genuinely distinct source submission IDs.
const identityRows = [
  { ...pending, SubID: 'SUB  1' },
  { ...pending, SubID: 'SUB 1', ActualSubmission: '2026-09-02' },
  { ...pending, SubID: ' ＳＵＢ-１ ', ActualSubmission: '2026-09-03' },
  { ...pending, SubID: 'SUB-1', ActualSubmission: '2026-09-04' },
  { ...pending, SubID: 123 },
  { ...pending, SubID: ' 123 ' },
  { ...pending, SubID: '   ' },
  { ...pending, SubID: null }
];
const identityAnchors = resolveSubmissionDates(identityRows);
assert.equal(identityAnchors.size, 5);
assert.equal(identityAnchors.get('SUB  1').date, Date.parse('2026-09-01'));
assert.equal(identityAnchors.get('SUB 1').date, Date.parse('2026-09-02'));
assert.equal(identityAnchors.get(identityRows[2].SubID.trim()).date, Date.parse('2026-09-03'));
assert.equal(identityAnchors.get('SUB-1').date, Date.parse('2026-09-04'));
assert.equal(identityAnchors.get('123').date, Date.parse('2026-09-01'));
result = analyze([...history, ...identityRows], { now });
assert.equal(result.summary.distinctSubmissions, 17);
assert.equal(result.summary.missingIDRows, 2);
for (const id of ['SUB  1', 'SUB 1', 'ＳＵＢ-１', 'SUB-1', '123']) {
  assert.equal(result.bySubID.get(id).status, 'estimated');
  assert.equal(result.bySubID.get(id).sampleCount, 12);
  assert.equal(result.bySubID.get(id).anchorDate, identityAnchors.get(id).date);
}
assert.equal(analyze([...history, { ...pending, Country: ' Ｆｒａｎｃｅ ' }], { now }).bySubID.get('P1').sampleCount, 12, 'Country normalization remains unchanged');

// Explicitly unmapped higher-priority fields are unknown, not known blanks.
const allMapped = ['SubID', 'Country', 'ActualApproval', 'ActualSubmission', 'LatestSubmission', 'OriginalSubmission'];
anchor = resolveSubmissionDates([submissionPlans], { mappedFields: allMapped.filter(field => field !== 'ActualSubmission') }).get('P1');
assert.equal(anchor.state, 'unmapped');
assert.equal(anchor.field, 'ActualSubmission');
anchor = resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: null }], { mappedFields: allMapped.filter(field => field !== 'LatestSubmission') }).get('P1');
assert.equal(anchor.state, 'unmapped');
assert.equal(anchor.field, 'LatestSubmission');
assert.equal(anchor.date, null);
anchor = resolveSubmissionDates([pending], { mappedFields: ['ActualSubmission'] }).get('P1');
assert.equal(anchor.state, 'valid', 'A valid actual date does not require lower-priority plan mappings');
assert.equal(anchor.field, 'ActualSubmission');
for (const unmapped of ['ActualSubmission', 'LatestSubmission', 'ActualApproval', 'Country']) {
  p = analyze([...history, submissionPlans], { now, mappedFields: allMapped.filter(field => field !== unmapped) }).bySubID.get('P1');
  assert.equal(p.status, 'unavailable', unmapped);
}
assert.equal(analyze([...history, submissionPlans], { now, mappedFields: new Set(allMapped) }).bySubID.get('P1').status, 'estimated');
anchor = resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: null, OriginalSubmission: null }], { mappedFields: allMapped.filter(field => field !== 'OriginalSubmission') }).get('P1');
assert.equal(anchor.state, 'unmapped');
assert.equal(anchor.field, 'OriginalSubmission');
anchor = resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: null, OriginalSubmission: null }]).get('P1');
assert.equal(anchor.state, 'missing');
assert.equal(anchor.field, null);

// Filtering retains real old business dates; the narrower 2020 rule only affects
// prediction eligibility. Future plans remain valid through the end of 2100.
for (const field of ['ActualSubmission', 'LatestSubmission', 'OriginalSubmission']) {
  const record = { ...submissionPlans, ActualSubmission: null, LatestSubmission: null, OriginalSubmission: null, [field]: '1960-01-01' };
  assert.equal(resolveSubmissionDates([record]).get('P1').date, Date.parse('1960-01-01'));
  assert.equal(analyze([...history, record], { now }).bySubID.get('P1').status, 'unavailable');
}
assert.equal(resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: '2100-12-31' }]).get('P1').state, 'valid');
assert.equal(analyze([...history, { ...submissionPlans, LatestSubmission: '2100-12-31' }], { now }).bySubID.get('P1').status, 'estimated');
assert.equal(resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: '2101-01-01' }]).get('P1').state, 'invalid');
assert.equal(resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: Date.UTC(99999, 0, 1) }]).get('P1').state, 'invalid');
assert.equal(resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: '2100-12-31T23:30:00-02:00' }]).get('P1').state, 'invalid');
assert.equal(resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: '2026-12-31T23:30:00-02:00' }]).get('P1').date, Date.UTC(2027, 0, 1));
assert.equal(resolveSubmissionDates([{ ...submissionPlans, LatestSubmission: '2026-02-30T00:00:00Z' }]).get('P1').state, 'invalid');

// Completed benchmarks and training never substitute a submission plan for a
// missing actual submission, even though filtering can still use that plan.
const missingActualCompleted = { ...submissionPlans, LatestSubmission: '2025-01-01', ActualApproval: '2025-04-01' };
result = analyze([...history, submissionPlans, { ...missingActualCompleted, SubID: 'DONE-WITHOUT-ACTUAL' }], { now });
assert.equal(result.summary.qualifyingHistory, 12);
assert.equal(result.byCountry.get('france').sampleCount, 12);
p = result.bySubID.get('DONE-WITHOUT-ACTUAL');
assert.equal(p.status, 'unavailable');
assert.equal(p.anchorField, 'ActualSubmission');
assert.equal(p.anchorDate, null);
assert.equal(p.forecastFromPlan, false);
assert.equal(p.historyIncluded, false);
assert.equal(p.selfExcluded, false);
assert.equal(resolveSubmissionDates([missingActualCompleted]).get('P1').field, 'LatestSubmission');

const plannedSource = Object.freeze([
  ...history.map(row => Object.freeze({ ...row })),
  Object.freeze({ ...submissionPlans, LatestSubmission: new Date('2027-01-10'), OriginalSubmission: '2026-12-01' })
]);
const plannedSnapshot = structuredClone(plannedSource);
resolveSubmissionDates(plannedSource);
analyze(plannedSource, { now, mappedFields: allMapped });
assert.deepEqual(plannedSource, plannedSnapshot, 'Resolver and plan-based estimates leave all received source values unchanged');

// Membership joins must not increase the historical sample or create additional estimates.
result = analyze([...history.flatMap(r => [r, { ...r, Product: 'Other product', Country: 'FRANCE' }]), pending, { ...pending, Country: null }], { now });
assert.equal(result.bySubID.get('P1').sampleCount, 12);
assert.equal(result.summary.distinctSubmissions, 13);
assert.equal(result.summary.estimated, 1);

// Historical estimates are independent of approval plans. Existing original and
// latest plans, including bad or conflicting inputs, are neither gates nor anchors.
const baselineEstimate = analyze([...history, pending], { now }).bySubID.get('P1');
for (const plans of [
  { OriginalApproval: '2027-01-01' }, { LatestApproval: '2027-02-01' },
  { OriginalApproval: '2027-01-01', LatestApproval: '2027-02-01' },
  { OriginalApproval: 'not a date' }, { LatestApproval: 'not a date' },
  { OriginalApproval: 'bad original', LatestApproval: 'bad latest' },
  { OriginalApproval: '9999-01-01', LatestApproval: '1960-01-01' },
  { OriginalApproval: new Date('2027-01-01'), LatestApproval: Date.parse('2027-02-01') }
]) {
  const inputs = [...history, { ...pending, ...plans }];
  const snapshot = structuredClone(inputs);
  inputs.forEach(Object.freeze);
  Object.freeze(inputs);
  p = analyze(inputs, { now }).bySubID.get('P1');
  assert.deepEqual(p, baselineEstimate, 'Plans must not alter independent historical estimates');
  assert.deepEqual(inputs, snapshot, 'Received source plans must never be replaced by a prediction');
}
p = analyze([...history, pending, { ...pending, OriginalApproval: '2026-10-01', LatestApproval: '2026-12-01' }, { ...pending, OriginalApproval: '2026-11-01', LatestApproval: 'bad' }], { now }).bySubID.get('P1');
assert.deepEqual(p, baselineEstimate, 'Conflicting source plans across membership rows must not suppress the estimate');

// Valid completed records receive a separate retrospective benchmark. Corrupt
// actual approvals still block either form of estimate.
for (const [field, value, status] of [
  ['ActualApproval', '2026-09-20', 'benchmark'], ['ActualApproval', 'nonsense', 'unavailable'],
  ['ActualApproval', '9999-01-01', 'unavailable']
]) {
  p = analyze([...history, { ...pending, OriginalApproval: 'bad plan', LatestApproval: '2027-01-01', [field]: value }], { now }).bySubID.get('P1');
  assert.equal(p.status, status, field + ': ' + value);
  assert.equal(p.predictedDate, status === 'benchmark' ? baselineEstimate.predictedDate : null);
  assert.equal(p.selfExcluded, status === 'benchmark');
  assert.equal(p.overdue, false);
}

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
assert.equal(analyze([...history.slice(0, 9), { ...pending, OriginalApproval: '2027-01-01', LatestApproval: 'bad plan' }], { now }).bySubID.get('P1').status, 'insufficient', 'A plan must not bypass the minimum reliable history requirement');
assert.equal(analyze([...history.slice(0, 10), { ...pending, OriginalApproval: '2027-01-01', LatestApproval: '2027-02-01' }], { now }).bySubID.get('P1').status, 'estimated');
assert.equal(analyze([...history, { ...pending, Country: 'Germany' }], { now }).bySubID.get('P1').status, 'insufficient');
assert.equal(analyze([{ ...completed('CUTOFF', 0, 'France', '2020-01-01') }], { now }).summary.qualifyingHistory, 1);
assert.equal(analyze([{ ...completed('TODAY', 0, 'France', now) }], { now }).summary.qualifyingHistory, 1);

// Completed targets require ten OTHER completed submissions. Their own measured
// duration is never allowed to support, bias or artificially qualify the benchmark.
const threshold = Array.from({ length: 11 }, (_, i) => completed('LOO-' + i, (i + 1) * 10));
result = analyze(threshold, { now });
p = result.bySubID.get('LOO-0');
assert.equal(p.status, 'benchmark');
assert.equal(p.sampleCount, 10);
assert.equal(p.selfExcluded, true);
assert.equal(p.selfExcludedCount, 1);
assert.equal(p.excludedCount, 1);
assert.equal(p.exclusions.find(x => x.code === 'self_excluded').count, 1);
assert.equal(p.historyIncluded, true, 'The target still belongs to the global country history');
assert.equal(p.medianDays, 65);
assert.equal(result.byCountry.get('france').medianDays, 60);
assert.equal(iso(p.predictedDate), '2025-03-07');
assert.equal(p.overdue, false, 'A retrospective benchmark is never an overdue estimate');
assert.match(p.reason, /completed record is excluded/);
assert.equal(result.bySubID.get('LOO-10').medianDays, 55);
assert.equal(result.summary.benchmark, 11);

result = analyze(threshold.slice(0, 10), { now });
p = result.bySubID.get('LOO-0');
assert.equal(p.status, 'insufficient');
assert.equal(p.sampleCount, 9);
assert.equal(p.selfExcluded, true);
assert.equal(p.selfExcludedCount, 1);
assert.equal(p.predictedDate, null);
assert.ok(p.reasonCodes.includes('insufficient_benchmark_history'));
assert.equal(result.summary.benchmark, 0);
assert.equal(result.summary.insufficient, 10);
assert.equal(result.summary.qualifyingHistory, 10);
p = analyze([threshold[0]], { now }).bySubID.get('LOO-0');
assert.equal(p.sampleCount, 0);
assert.equal(p.medianDays, null);
assert.equal(p.rangeLowDays, null);
assert.equal(p.rangeHighDays, null);

// Compare the indexed implementation with an independent, explicit leave-one-out
// calculation, including equal durations, zeros and extreme valid long durations.
const durations = [0, 10, 10, 20, 31, 31, 50, 80, 90, 100, 105, 150, 600, 1900];
const validation = durations.map((days, i) => completed('CHECK-' + i, days, 'France', '2020-01-01'));
result = analyze(validation.flatMap(row => [row, { ...row, Product: 'Duplicate membership' }]), { now });
const percentile = (sorted, q) => {
  const position = (sorted.length - 1) * q, index = Math.floor(position), fraction = position - index;
  return sorted[index] + (sorted[Math.min(index + 1, sorted.length - 1)] - sorted[index]) * fraction;
};
for (let i = 0; i < durations.length; i++) {
  const others = durations.filter((_, index) => index !== i).sort((a, b) => a - b);
  const low = percentile(others, 0.25), high = percentile(others, 0.75), fence = high + 1.5 * (high - low);
  const estimate = result.bySubID.get('CHECK-' + i);
  assert.equal(estimate.status, 'benchmark');
  assert.equal(estimate.sampleCount, others.length);
  assert.equal(estimate.medianDays, percentile(others, 0.5));
  assert.equal(estimate.rangeLowDays, low);
  assert.equal(estimate.rangeHighDays, high);
  assert.equal(estimate.outlierCount, others.filter(days => days > fence).length);
}
const completedInputs = threshold.map((row, i) => Object.freeze({ ...row, OriginalApproval: i % 2 ? 'bad plan' : '2027-01-01', LatestApproval: '2028-01-01' }));
const completedSnapshot = structuredClone(completedInputs);
analyze(Object.freeze(completedInputs), { now });
assert.deepEqual(completedInputs, completedSnapshot, 'Benchmarks never alter actual or planned source values');

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
  .flatMap(r => [r, { ...r, Product: 'Second', OriginalApproval: '2025-12-31' }, { ...r, Product: 'Third', LatestApproval: 'bad plan' }]);
const start = performance.now();
result = analyze([...large, { ...pending, OriginalApproval: '2027-01-01', LatestApproval: '2027-02-01' }], { now });
assert.equal(result.summary.inputRows, 30001);
assert.equal(result.summary.distinctSubmissions, 10001);
assert.equal(result.bySubID.get('P1').sampleCount, 5000);
assert.equal(result.bySubID.get('P1').status, 'estimated');
assert.equal(result.summary.qualifyingHistory, 10000);
assert.equal(result.summary.benchmark, 10000);
assert.equal(result.bySubID.get('BIG0').sampleCount, 4999);
assert.equal(result.bySubID.get('BIG0').selfExcluded, true);
const largeAnchors = resolveSubmissionDates([...large, submissionPlans]);
assert.equal(largeAnchors.size, 10001);
assert.equal(largeAnchors.get('BIG0').field, 'ActualSubmission');
assert.equal(largeAnchors.get('P1').field, 'LatestSubmission');
console.log('Approval prediction checks passed, including 30,000 membership rows (' + Math.round(performance.now() - start) + ' ms).');
