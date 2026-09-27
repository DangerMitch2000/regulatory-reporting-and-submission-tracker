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
  PredictionN: 21, PredictionMedian: 90, PredictionCountry: 'Example country', PredictionStatus: 'estimated'
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

  // Ineligible or corrupt input cannot accidentally paint an approval estimate.
  for (const change of [
    { PredictionStatus: 'insufficient' },
    { PredictionDate: null },
    { PredictionDate: '2026-05-02' },
    { PredictionLow: Infinity },
    { PredictionLow: base.PredictionHigh + day },
    { PredictionN: 0 },
    { OriginalApproval: date('2026-07-01') },
    { LatestApproval: date('2026-07-01') },
    { ActualApproval: date('2026-07-01') },
    { LatestApproval: 'not a date' }
  ]) {
    view = await create([{ ...base, ...change }], { mode: 'Compare' });
    assert.equal(view.data('predictionPoints').length, 0, JSON.stringify(change));
    view.finalize();
  }
  // Past estimates are shown as historical estimates rather than silently moved to today.
  view = await create([base], { mode: 'Compare', nowDate: date('2026-09-27') });
  assert.equal(view.data('predictionPoints')[0].PredictionDate, base.PredictionDate);
  view.signal('stateColours', []);
  await view.runAsync();
  assert.equal(view.data('predictions').length, 0);
  view.finalize();
  console.log('PASS: Vega approval markers/ranges, deduplication, eligibility, fitting, hierarchy, elapsed isolation, clipping, past estimates and expiry toggle.');
})().catch(error => { console.error(error); process.exitCode = 1; });
