const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const vega = require('./vega.js');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline.json'), 'utf8'));
const day = 86400000;
const date = value => Date.parse(value + 'T00:00:00Z');
const base = {
  AppID: 'APP-DEMO', ROID: 'RO-DEMO', SubID: 'SUB-DEMO',
  AppStatus: 'Active', ROStatus: 'In Progress', SubStatus: 'In Progress',
  Manufacturer: 'North', Country: 'Example country', Product: 'Example product',
  SubCreated: date('2026-01-01'), ROCreated: date('2026-01-01'), AppCreated: date('2026-01-01'),
  ActualDispatch: date('2026-01-15'), ActualSubmission: date('2026-02-01'),
  PredictionDate: date('2026-05-02'), PredictionLow: date('2026-04-02'), PredictionHigh: date('2026-06-01'),
  PredictionN: 21, PredictionMedian: 90, PredictionCountry: 'Example country', PredictionStatus: 'estimated',
  PredictionAnchorDate: date('2026-02-01'), PredictionAnchorField: 'ActualSubmission',
  PredictionAnchorLabel: 'Actual submission', PredictionFromPlan: false
};

async function create(rows, signals = {}) {
  const view = new vega.View(vega.parse(spec), { renderer: 'none' });
  view.change('dataset', vega.changeset().insert(rows.map(row => ({ ...row }))));
  for (const [key, value] of Object.entries(signals)) view.signal(key, value);
  await view.runAsync();
  return view;
}

(async () => {
  // Joined product rows must carry one estimate and an unchanged sample count.
  let view = await create([base, { ...base, Product: 'Second product' }], { mode: 'Compare' });
  assert.equal(view.data('sub').length, 1);
  assert.equal(view.data('predictionPoints').length, 1);
  assert.equal(view.data('predictions')[0].PredictionN, 21);
  assert.equal(view.data('predictions')[0].PredictionCountry, 'Example country');
  assert.equal(view.data('sub')[0].end, base.ActualSubmission);
  assert.equal(view.data('apps')[0].end, base.ActualSubmission);
  assert.equal(view.data('ros')[0].end, base.ActualSubmission);
  assert.equal(view.data('sub')[0].ApprovalDays, null);
  assert.equal(view.data('extent')[0].hi, base.PredictionHigh);
  assert.ok(view.signal('xhi') > base.PredictionHigh);
  // Rendering is a real Vega runtime pass, including the extra shapes and tooltip expressions.
  const svg = await view.toSVG();
  assert.match(svg, /predictionApproval/);
  assert.match(svg, /predictionRange/);
  assert.doesNotMatch(svg, /Regulatory Tracker · 1\.5/);
  // Parent comparison must keep measured dates, not roll estimates into summary bars.
  view.signal('compareLevel', 0);
  await view.runAsync();
  assert.equal(view.data('predictionPoints').length, 0);
  assert.equal(view.data('extent')[0].hi, base.ActualSubmission);
  // Elapsed comparison remains based on actual dates only.
  view.signal('compareLevel', 2).signal('axisMode', 'Elapsed days');
  await view.runAsync();
  assert.equal(view.data('predictionPoints').length, 0);
  assert.equal(view.data('predictions').length, 0);
  assert.equal(view.data('extent')[0].hi, base.ActualSubmission - base.ActualDispatch);
  view.finalize();

  // Historical estimates coexist with both approval plans. Neither plan is
  // rewritten, its original/latest milestone remains, and only the axis extends.
  const planned = { ...base, OriginalApproval: date('2026-03-15'), LatestApproval: date('2026-04-15') };
  view = await create([planned, { ...planned, Product: 'Second product' }], { mode: 'Compare' });
  assert.equal(view.data('predictionPoints').length, 1);
  assert.equal(view.data('predictions').length, 1);
  assert.equal(view.data('sub')[0].OriginalApproval, planned.OriginalApproval);
  assert.equal(view.data('sub')[0].LatestApproval, planned.LatestApproval);
  assert.equal(view.data('sub')[0].ActualApproval, null);
  assert.equal(view.data('sub')[0].end, planned.LatestApproval);
  assert.equal(view.data('apps')[0].end, planned.LatestApproval);
  assert.equal(view.data('ros')[0].end, planned.LatestApproval);
  assert.equal(view.data('sub')[0].ApprovalDays, null);
  assert.equal(view.data('extent')[0].hi, base.PredictionHigh);
  const planMarkers = view.data('milestones').filter(row => ['OriginalApproval', 'LatestApproval'].includes(row.milestone));
  assert.equal(planMarkers.length, 2);
  assert.equal(planMarkers.find(row => row.milestone === 'OriginalApproval').date, planned.OriginalApproval);
  assert.equal(planMarkers.find(row => row.milestone === 'OriginalApproval').track, 0);
  assert.equal(planMarkers.find(row => row.milestone === 'LatestApproval').date, planned.LatestApproval);
  assert.equal(planMarkers.find(row => row.milestone === 'LatestApproval').track, 1);
  const allTips = node => [...(node.tooltip ? [node.tooltip] : []), ...(node.items || []).flatMap(allTips)];
  const predictionTips = allTips(view.scenegraph().root).filter(tip => tip['Predicted approval']);
  assert.equal(predictionTips.length, 2);
  for (const tip of predictionTips) {
    assert.equal(tip['Predicted approval'], '02 May 2026');
    assert.equal(tip['Historical range'], '02 Apr 2026 – 01 Jun 2026');
    assert.equal(tip['Original planned approval'], '15 Mar 2026');
    assert.equal(tip['Latest planned approval'], '15 Apr 2026');
    assert.equal(tip['Qualifying completed submissions'], 21);
    assert.equal(tip.Anchor, 'Actual submission');
    assert.equal(tip['Anchor date'], '01 Feb 2026');
    assert.equal(tip.Basis, 'Estimate from actual submission date');
    assert.match(tip.Meaning, /not a planned date or guarantee/);
  }
  assert.ok(allTips(view.scenegraph().root).some(tip => tip.Milestone === 'OriginalApproval' && tip.Date === '15 Mar 2026'));
  assert.ok(allTips(view.scenegraph().root).some(tip => tip.Milestone === 'LatestApproval' && tip.Date === '15 Apr 2026'));
  await view.toSVG();
  view.finalize();

  // Future planned submissions can carry engine-generated conditional forecasts.
  // No actual submission or actual processing time is manufactured for the plot.
  for (const anchorField of ['OriginalSubmission', 'LatestSubmission']) {
    const anchorLabel = anchorField === 'OriginalSubmission' ? 'Original planned submission' : 'Latest planned submission';
    const anchorDate = date(anchorField === 'LatestSubmission' ? '2027-06-01' : '2027-05-01');
    const future = {
      ...base, ActualDispatch: null, ActualSubmission: null, ActualApproval: null,
      OriginalSubmission: date('2027-05-01'),
      LatestSubmission: anchorField === 'LatestSubmission' ? date('2027-06-01') : null,
      PredictionAnchorDate: anchorDate,
      PredictionAnchorField: anchorField, PredictionAnchorLabel: anchorLabel, PredictionFromPlan: true,
      PredictionDate: anchorDate + 90 * day, PredictionLow: anchorDate + 60 * day, PredictionHigh: anchorDate + 120 * day
    };
    const sourceEnd = future[anchorField];
    view = await create([future, { ...future, Product: 'Second product' }], { mode: 'Compare', nowDate: date('2026-09-28') });
    const row = view.data('sub')[0];
    assert.equal(view.data('predictionPoints').length, 1);
    assert.equal(view.data('predictions').length, 1);
    assert.equal(row.PredictionAnchorDate, sourceEnd);
    assert.equal(row.PredictionAnchorField, anchorField);
    assert.equal(row.PredictionAnchorLabel, anchorLabel);
    assert.equal(row.PredictionFromPlan, true);
    assert.equal(row.ActualSubmission, null);
    assert.equal(row.ActualDispatch, null);
    assert.equal(row.ActualApproval, null);
    assert.equal(row.DispatchDays, null);
    assert.equal(row.ApprovalDays, null);
    assert.equal(row.OpenAge, '');
    assert.equal(row.start, future.OriginalSubmission);
    assert.equal(row.end, sourceEnd);
    assert.equal(view.data('apps')[0].end, sourceEnd);
    assert.equal(view.data('ros')[0].end, sourceEnd);
    assert.equal(view.data('extent')[0].lo, future.OriginalSubmission);
    assert.equal(view.data('extent')[0].hi, future.PredictionHigh);
    assert.ok(view.signal('xhi') > future.PredictionHigh);
    assert.equal(view.data('milestones').filter(row => row.milestone.startsWith('Actual')).length, 0);
    assert.equal(view.data('milestones').find(row => row.milestone === anchorField).date, sourceEnd);
    assert.equal(view.data('dataset')[0].ActualSubmission, null);
    assert.equal(view.data('dataset')[0][anchorField], sourceEnd);
    const tips = allTips(view.scenegraph().root).filter(tip => tip['Predicted approval']);
    assert.equal(tips.length, 2);
    for (const tip of tips) {
      assert.equal(tip['Predicted approval'], anchorField === 'LatestSubmission' ? '30 Aug 2027' : '30 Jul 2027');
      assert.equal(tip.Anchor, anchorLabel);
      assert.equal(tip['Anchor date'], anchorField === 'LatestSubmission' ? '01 Jun 2027' : '01 May 2027');
      assert.equal(tip.Basis, 'Forecast based on planned submission');
      assert.equal(tip.Timing, 'Forecast assumes the planned submission date is met');
      assert.match(tip.Meaning, /Conditional on the planned submission date/);
    }
    await view.toSVG();
    view.signal('axisMode', 'Elapsed days');
    await view.runAsync();
    assert.equal(view.data('predictionPoints').length, 0);
    assert.equal(view.data('milestones').length, 0);
    assert.equal(view.data('sub')[0].ActualSubmission, null);
    view.finalize();
  }

  // Completed submissions get only an explicitly qualified benchmark. The
  // actual approval remains a filled marker, while its benchmark is hollow.
  const completed = { ...planned, SubStatus: 'Completed', ActualApproval: date('2026-04-20'), PredictionStatus: 'benchmark' };
  view = await create([completed], { mode: 'Compare', nowDate: date('2026-09-27') });
  assert.equal(view.data('predictionPoints').length, 1);
  assert.equal(view.data('sub')[0].ActualApproval, completed.ActualApproval);
  assert.equal(view.data('sub')[0].ApprovalDays, 78);
  assert.equal(view.data('sub')[0].end, completed.ActualApproval);
  assert.equal(view.data('apps')[0].end, completed.ActualApproval);
  assert.equal(view.data('ros')[0].end, completed.ActualApproval);
  assert.equal(view.data('extent')[0].hi, base.PredictionHigh);
  const completedMarkers = view.data('milestones').filter(row => /Approval$/.test(row.milestone));
  assert.equal(completedMarkers.length, 3, 'Original, latest and actual approval markers remain');
  assert.equal(completedMarkers.find(row => row.milestone === 'ActualApproval').date, completed.ActualApproval);
  const benchmarkTips = allTips(view.scenegraph().root).filter(tip => tip['Historical approval benchmark']);
  assert.equal(benchmarkTips.length, 2);
  for (const tip of benchmarkTips) {
    assert.equal(tip['Historical approval benchmark'], '02 May 2026');
    assert.equal(tip['Actual approval'], '20 Apr 2026');
    assert.match(tip.Meaning, /other completed submissions, not a future forecast/);
    assert.doesNotMatch(tip.Timing, /pending|overdue|passed|unrecorded/i);
    assert.equal(tip['Predicted approval'], undefined);
  }
  await view.toSVG();
  view.finalize();

  // Coincident actual and benchmark dates do not erase the actual marker.
  view = await create([{ ...completed, ActualApproval: base.PredictionDate }], { mode: 'Compare' });
  const marks = node => [...(node.mark ? [node] : []), ...(node.items || []).flatMap(marks)];
  const point = marks(view.scenegraph().root).find(mark => mark.mark.name === 'predictionApproval');
  const actual = marks(view.scenegraph().root).find(mark => mark.mark.name === 'milestone' && mark.datum.milestone === 'ActualApproval');
  assert.equal(point.x, actual.x);
  assert.equal(point.y, actual.y);
  assert.equal(point.fillOpacity, 0);
  assert.equal(actual.shape, 'square');
  assert.equal(point.shape, 'diamond');
  view.finalize();

  // Raw completed state alone never creates a benchmark; its source actual date
  // must be present, valid and unambiguous as well as engine-qualified.
  for (const change of [
    { ActualApproval: null },
    { ActualApproval: 'not a date' },
    { PredictionStatus: 'estimated' },
    { PredictionStatus: 'unavailable' }
  ]) {
    view = await create([{ ...completed, ...change }], { mode: 'Compare' });
    assert.equal(view.data('predictionPoints').length, 0, JSON.stringify(change));
    view.finalize();
  }
  view = await create([
    completed,
    { ...completed, ActualApproval: date('2026-04-21'), Product: 'Second product' }
  ], { mode: 'Compare' });
  assert.equal(view.data('sub')[0].ActualApproval, null);
  assert.equal(view.data('predictionPoints').length, 0);
  view.finalize();

  // Single plans and invalid/conflicting plan inputs do not gate an independently
  // qualified engine estimate. Existing plan validation still withholds bad marks.
  for (const change of [
    { OriginalApproval: date('2026-07-01') },
    { LatestApproval: date('2026-07-01') },
    { LatestApproval: 'not a date' }
  ]) {
    view = await create([{ ...base, ...change }], { mode: 'Compare' });
    assert.equal(view.data('predictionPoints').length, 1, JSON.stringify(change));
    if (change.LatestApproval === 'not a date') {
      assert.equal(view.data('sub')[0].LatestApprovalBad, 1);
      assert.equal(view.data('sub')[0].LatestApproval, null);
    }
    view.finalize();
  }
  view = await create([
    { ...base, LatestApproval: date('2026-03-01') },
    { ...base, LatestApproval: date('2026-04-01'), Product: 'Second product' }
  ], { mode: 'Compare' });
  assert.equal(view.data('predictionPoints').length, 1);
  assert.equal(view.data('sub')[0].LatestApproval, null);
  assert.notEqual(view.data('sub')[0].LatestApprovalMin, view.data('sub')[0].LatestApprovalMax);
  view.finalize();

  // Collapsed hierarchy still fits the estimate, but only expanded submission rows draw it.
  view = await create([base]);
  assert.equal(view.data('predictionPoints').length, 0);
  assert.equal(view.data('extent')[0].hi, base.PredictionHigh);
  view.change('expanded', vega.changeset().insert([
    { key: view.data('apps')[0].key }, { key: view.data('ros')[0].key }
  ]));
  await view.runAsync();
  assert.equal(view.data('predictionPoints').length, 1);
  // A partly visible band is retained even if its median marker is outside the viewport.
  view.signal('range', [base.PredictionLow - day, base.PredictionDate - day]);
  await view.runAsync();
  assert.equal(view.data('predictions').length, 1);
  assert.equal(view.data('predictionPoints').length, 0);
  view.finalize();

  // Registration expiry continues to affect fit only when explicitly enabled.
  view = await create([{ ...base, RegistrationEnd: date('2035-01-01') }], { mode: 'Compare' });
  assert.equal(view.data('extent')[0].hi, base.PredictionHigh);
  view.signal('showRegistrationEnd', true);
  await view.runAsync();
  assert.equal(view.data('extent')[0].hi, date('2035-01-01'));
  view.finalize();

  // Registration expiry has a separate sanity bound: all of 2100 is allowed.
  // This does not apply the prediction history's 2020-through-today cutoff.
  for (const expiry of [
    date('2035-01-01'), '2040-12-31', new Date('2040-12-31T00:00:00Z'),
    '2100-12-31', Date.parse('2100-12-31T23:59:59.999Z')
  ]) {
    view = await create([{ ...base, RegistrationEnd: expiry }], { mode: 'Compare', showRegistrationEnd: true });
    const expected = typeof expiry === 'number' ? expiry : new Date(expiry).getTime();
    assert.equal(view.data('sub')[0].RegistrationEnd, expected);
    assert.equal(view.data('sub')[0].RegistrationEndBad, 0);
    assert.equal(view.data('extent')[0].hi, expected);
    assert.equal(view.data('milestones').filter(row => row.milestone === 'RegistrationEnd').length, 1);
    view.finalize();
  }

  for (const expiry of [
    '2101-01-01', '9999-12-31', '99999-01-01', date('9999-12-31'),
    Date.UTC(99999, 0, 1), new Date(Date.UTC(99999, 0, 1)), Infinity, 'not a date'
  ]) {
    view = await create([{ ...base, RegistrationEnd: expiry }], { mode: 'Compare' });
    assert.equal(view.data('sub')[0].RegistrationEnd, null);
    assert.equal(view.data('sub')[0].RegistrationEndBad, 1);
    assert.equal(view.data('dataset')[0].RegistrationEnd, expiry, 'Source expiry is never clamped or rewritten');
    view.signal('showRegistrationEnd', true);
    await view.runAsync();
    assert.equal(view.data('extent')[0].hi, base.PredictionHigh);
    assert.equal(view.data('milestones').filter(row => row.milestone === 'RegistrationEnd').length, 0);
    assert.ok(view.signal('xhi') < Date.UTC(2101, 0, 1));
    view.signal('selectedKey', view.data('sub')[0].key).signal('detailTab', 'Issues');
    await view.runAsync();
    assert.match(view.data('issueRows').find(row => row.issueField === 'RegistrationEnd').text, /after 2100.*withheld/);
    // Elapsed comparison is also protected from an enormous expiry duration.
    view.signal('axisMode', 'Elapsed days');
    await view.runAsync();
    assert.equal(view.data('extent')[0].hi, base.ActualSubmission - base.ActualDispatch);
    view.finalize();
  }

  // A valid membership date cannot override a bad duplicate. Distinct valid
  // expiries are withheld as a conflict, while a blank duplicate is permitted.
  for (const [otherExpiry, badCount, expected] of [
    ['9999-12-31', 1, null], ['2035-01-01', 0, null], [null, 0, date('2040-12-31')]
  ]) {
    view = await create([
      { ...base, RegistrationEnd: '2040-12-31' },
      { ...base, Product: 'Second product', RegistrationEnd: otherExpiry }
    ], { mode: 'Compare', showRegistrationEnd: true });
    assert.equal(view.data('sub').length, 1);
    assert.equal(view.data('sub')[0].RegistrationEndBad, badCount);
    assert.equal(view.data('sub')[0].RegistrationEnd, expected);
    assert.equal(view.data('extent')[0].hi, expected === null ? base.PredictionHigh : expected);
    view.finalize();
  }

  // Ineligible or corrupt input cannot accidentally paint an approval estimate.
  for (const change of [
    { PredictionStatus: 'insufficient' },
    { PredictionDate: null },
    { PredictionDate: '2026-05-02' },
    { PredictionLow: Infinity },
    { PredictionLow: base.PredictionHigh + day },
    { PredictionN: 0 },
    { ActualApproval: date('2026-07-01') },
    { ActualApproval: 'not a date' }
  ]) {
    view = await create([{ ...base, ...change }], { mode: 'Compare' });
    assert.equal(view.data('predictionPoints').length, 0, JSON.stringify(change));
    view.finalize();
  }
  // Date-only estimates due today stay current throughout that UTC day.
  view=await create([base],{mode:'Compare'});
  view.signal('nowDate',base.PredictionDate+18*60*60*1000);await view.runAsync();
  const collect=(node)=>[...(node.tooltip?[node.tooltip]:[]),...(node.items||[]).flatMap(collect)];
  const tips=collect(view.scenegraph().root).filter(t=>t['Predicted approval']);
  assert.ok(tips.length>0);
  assert.ok(tips.every(t=>t.Timing==='Estimate from actual submission date'));
  view.finalize();

  // Past estimates are shown as historical estimates rather than silently moved to today.
  view = await create([base], { mode: 'Compare', nowDate: date('2026-09-27') });
  assert.equal(view.data('predictionPoints')[0].PredictionDate, base.PredictionDate);
  view.signal('stateColours', []);
  await view.runAsync();
  assert.equal(view.data('predictions').length, 0);
  view.finalize();
  console.log('PASS: Vega planned-submission forecasts, actual-based estimates and completed benchmarks alongside intact source markers, anchor/status-aware tooltips, deduplication, eligibility, fitting, hierarchy, elapsed isolation, clipping, past estimates and bounded expiry toggle.');
})().catch(error => { console.error(error); process.exitCode = 1; });
