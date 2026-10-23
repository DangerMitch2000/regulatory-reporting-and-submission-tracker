const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vega = require('./vega-test-setup.cjs');

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline.json'), 'utf8'));
const day = 86400000;
const epoch = Date.UTC(2026, 0, 1);
const at = days => epoch + days * day;
const categories = [
  { source: 'spans', mark: 'parentBar', parent: true },
  { source: 'segments', mark: 'connector' },
  { source: 'preparationWindows', mark: 'preparationRange' },
  { source: 'predictions', mark: 'predictionRange' },
  { source: 'surveyWindows', mark: 'surveyRange' }
];

function items(node) { return [node, ...(node.items || []).flatMap(items)]; }
function marks(view, name) { return items(view.scenegraph().root).filter(item => item.mark?.name === name); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

function fixture(start, end, changes = {}) {
  return {
    AppID: 'APP-CONTINUATION', ROID: 'RO-CONTINUATION', SubID: 'SUB-CONTINUATION',
    AppStatus: 'Active', ROStatus: 'In Progress', SubStatus: 'In Progress',
    Country: 'Example country', Manufacturer: 'Example site', Product: 'Example product',
    AppCreated: at(-60), ROCreated: at(-50), SubCreated: at(-40),
    OriginalDispatch: start, OriginalSubmission: end,
    LMPrepStart: start, LMPrepEnd: end, LMPrepStatus: 'estimated',
    LMPrepLabel: '2 months', LMPrepAnchor: 'Latest planned dispatch',
    PredictionLow: start, PredictionHigh: end, PredictionDate: (start + end) / 2,
    PredictionStatus: 'estimated', PredictionN: 20, PredictionMedian: 60,
    PredictionCountry: 'Example country', PredictionAnchorDate: start,
    PredictionAnchorLabel: 'Latest planned submission', PredictionFromPlan: true,
    ...changes
  };
}

async function create(row, parent = false, options = {}) {
  const view = new vega.View(vega.parse(spec), { renderer: 'none' });
  view.signal('denebContainer', { width: 1280, height: 960 });
  view.signal('mode', 'Compare').signal('compareLevel', parent ? 0 : 2);
  view.signal('nowDate', at(50));
  view.change('dataset', vega.changeset().insert([{ ...row }]));
  await view.runAsync();
  if (!parent && options.survey !== false) {
    view.change('surveyRows', vega.changeset().insert({
      key: view.data('sub')[0].key, start: row.PredictionLow, end: row.PredictionHigh,
      duration: '2–3 months', change: 'CHANGE-CONTINUATION', country: 'Example country',
      anchorLabel: 'Actual submission', source: 'Change Impact Assessment Tool — SharePoint'
    }));
    await view.runAsync();
  }
  return view;
}

function assertArrows(view, category, expected, label) {
  const data = view.data(category.source + 'Continuations');
  assert.deepEqual(data.map(row => row.continuationSide).sort(), expected.slice().sort(), `${label}: ${category.source} sides`);
  const arrows = marks(view, category.mark + 'Continuation');
  assert.equal(arrows.length, expected.length, `${label}: ${category.mark} arrow count`);
  const originals = marks(view, category.mark);
  const left = view.signal('left') + 3;
  const right = view.signal('width') - 22;
  for (const arrow of arrows) {
    assert.ok(arrow.path && !/NaN|Infinity|undefined/.test(arrow.path), `${label}: valid path`);
    assert.ok(Number.isFinite(arrow.bounds.x1) && Number.isFinite(arrow.bounds.x2), `${label}: finite bounds`);
    assert.ok(arrow.bounds.x1 >= left - 0.01, `${label}: arrow starts inside chart (${arrow.bounds.x1} >= ${left})`);
    assert.ok(arrow.bounds.x2 <= right + 0.01, `${label}: arrow ends inside chart (${arrow.bounds.x2} <= ${right})`);
    const original = originals.find(item => item.datum.key === arrow.datum.key &&
      (category.source !== 'segments' || item.datum.a === arrow.datum.a));
    assert.ok(original, `${label}: every arrow belongs to a rendered bar`);
    for (const [key, value] of Object.entries(original.tooltip || {})) {
      assert.deepEqual(arrow.tooltip?.[key], value, `${label}: tooltip preserves ${key}`);
    }
    const expectedColor = original.stroke || original.fill;
    assert.ok(arrow.fill === expectedColor || arrow.stroke === expectedColor, `${label}: arrow retains bar colour`);
  }
}

function stable(view) {
  return plain({
    source: view.data('dataset'), fit: view.signal('fitRange'), extent: view.data('extent'),
    selectedKey: view.signal('selectedKey'), expanded: view.data('expanded'), pinned: view.data('pinned'),
    sub: view.data('sub').map(({ SubID, AppID, ROID, OriginalDispatch, OriginalSubmission, ActualDispatch, ActualSubmission }) =>
      ({ SubID, AppID, ROID, OriginalDispatch, OriginalSubmission, ActualDispatch, ActualSubmission }))
  });
}

(async () => {
  const cases = [
    ['inside', 20, 80, []],
    ['left', -20, 80, ['left']],
    ['right', 20, 120, ['right']],
    ['both', -20, 120, ['left', 'right']],
    ['wholly before', -40, -20, []],
    ['wholly after', 120, 140, []],
    ['exact boundaries', 0, 100, []],
    ['ends exactly at left', -20, 0, ['left']],
    ['starts exactly at right', 100, 120, ['right']],
    ['zero duration inside', 50, 50, []],
    ['zero duration at left', 0, 0, []],
    ['zero duration outside', -20, -20, []]
  ];
  for (const [label, start, end, expected] of cases) {
    for (const parent of [false, true]) {
      const view = await create(fixture(at(start), at(end)), parent);
      try {
        const before = stable(view);
        view.signal('range', [at(0), at(100)]);
        await view.runAsync();
        for (const category of categories.filter(item => !!item.parent === parent)) assertArrows(view, category, expected, label);
        assert.deepEqual(stable(view), before, `${label}: clipping changes neither source records nor fitted dates`);
        await view.toSVG();
      } finally { view.finalize(); }
    }
  }

  // Real Vega changes, rather than static expression inspection, cover arrows
  // appearing/disappearing as the same viewport pans and zooms.
  for (const parent of [false, true]) {
    const view = await create(fixture(at(-20), at(120)), parent);
    try {
      view.signal('selectedKey', view.data('pageRows')[0].key);
      const before = stable(view);
      for (const [lo, hi, expected] of [
        [0, 100, ['left', 'right']], [-40, 140, []], [-40, 100, ['right']],
        [0, 140, ['left']], [130, 160, []], [-50, -30, []]
      ]) {
        view.signal('range', [at(lo), at(hi)]);
        await view.runAsync();
        for (const category of categories.filter(item => !!item.parent === parent)) assertArrows(view, category, expected, 'pan/zoom');
        assert.deepEqual(stable(view), before, 'Pan and zoom preserve fit, selection and source dates');
      }
      view.signal('range', [at(0), at(100)]);
      await view.runAsync();
      const darkColors = categories.filter(item => !!item.parent === parent).map(item =>
        marks(view, item.mark + 'Continuation').map(mark => mark.fill || mark.stroke));
      view.signal('themeMode', 'light');
      await view.runAsync();
      for (const category of categories.filter(item => !!item.parent === parent)) assertArrows(view, category, ['left', 'right'], 'light theme');
      const lightColors = categories.filter(item => !!item.parent === parent).map(item =>
        marks(view, item.mark + 'Continuation').map(mark => mark.fill || mark.stroke));
      assert.notDeepEqual(lightColors, darkColors, 'Continuation colours respond to the light theme');
      assert.deepEqual(stable(view), before, 'Theme preserves dates, fit and selection');
      for (const width of [760, 1560]) {
        view.signal('denebContainer', { width, height: 720 });
        await view.runAsync();
        for (const category of categories.filter(item => !!item.parent === parent)) assertArrows(view, category, ['left', 'right'], `width ${width}`);
      }
      view.signal('range', null);
      await view.runAsync();
      for (const category of categories.filter(item => !!item.parent === parent)) assertArrows(view, category, [], 'Fit all');
    } finally { view.finalize(); }
  }

  // Elapsed comparisons must compare transformed durations, not calendar timestamps.
  const elapsed = await create(fixture(at(0), at(120), { ActualDispatch: at(0), ActualSubmission: at(120) }));
  try {
    elapsed.signal('axisMode', 'Elapsed days');
    await elapsed.runAsync();
    const before = stable(elapsed);
    for (const [lo, hi, sides] of [[20, 100, ['left', 'right']], [0, 120, []], [-20, 100, ['right']], [20, 140, ['left']], [140, 160, []]]) {
      elapsed.signal('range', [lo * day, hi * day]);
      await elapsed.runAsync();
      // Original and actual tracks each contain one eligible interval.
      assertArrows(elapsed, categories[1], [...sides, ...sides], 'elapsed');
      for (const category of categories.slice(2)) assertArrows(elapsed, category, [], 'elapsed excludes estimates');
      assert.deepEqual(stable(elapsed), before, 'Elapsed clipping preserves dates and fitted durations');
    }
  } finally { elapsed.finalize(); }

  // Missing dates must be withheld before subtracting ActualDispatch. Otherwise
  // null becomes zero and creates a false interval starting near the Unix epoch,
  // with a convincing but incorrect continuation arrow at the viewport edge.
  const endpointTracks = {
    OriginalDispatch: 0, OriginalSubmission: 0,
    LatestDispatch: 1, LatestSubmission: 1,
    ActualDispatch: 2, ActualSubmission: 2
  };
  for (const [field, affectedTrack] of Object.entries(endpointTracks)) {
    for (const value of [null, '', 'not a date']) {
      const row = fixture(at(0), at(120), {
        LatestDispatch: at(0), LatestSubmission: at(120),
        ActualDispatch: at(0), ActualSubmission: at(120), [field]: value
      });
      const view = await create(row, false, { survey: false });
      try {
        view.signal('axisMode', 'Elapsed days');
        await view.runAsync();
        view.signal('range', [20 * day, 100 * day]);
        await view.runAsync();
        const expectedTracks = field === 'ActualDispatch' ? [] : [0, 1, 2].filter(track => track !== affectedTrack);
        assertArrows(view, categories[1], expectedTracks.flatMap(() => ['left', 'right']), `${field}=${value}`);
        assert.deepEqual([...new Set(view.data('segments').map(segment => segment.track))].sort(), expectedTracks,
          `${field}=${value}: invalid or missing endpoint cannot create a segment`);
        for (const segment of view.data('segments')) {
          assert.ok(Number.isFinite(segment[segment.a]) && Number.isFinite(segment[segment.b]),
            `${field}=${value}: source endpoints remain valid`);
          assert.equal(segment.d1, segment[segment.a] - segment.ActualDispatch);
          assert.equal(segment.d2, segment[segment.b] - segment.ActualDispatch);
        }
        assert.equal(view.data('dataset')[0][field], value, 'Validation preserves the raw source value');
      } finally { view.finalize(); }
    }
  }

  // The original/latest/actual tracks remain separate; same-position arrows are
  // still attached to their own original source segment, tooltip and track.
  const tracks = await create(fixture(at(-20), at(120), {
    LatestDispatch: at(-20), LatestSubmission: at(120), ActualDispatch: at(-20), ActualSubmission: at(120)
  }));
  try {
    tracks.signal('range', [at(0), at(100)]);
    await tracks.runAsync();
    assertArrows(tracks, categories[1], ['left', 'right', 'left', 'right', 'left', 'right'], 'all tracks');
    assert.deepEqual([...new Set(tracks.data('segmentsContinuations').map(row => row.track))].sort(), [0, 1, 2]);
    assert.equal(tracks.data('milestones').length, 0, 'Offscreen milestone dates are not moved to arrow locations');
  } finally { tracks.finalize(); }

  console.log('PASS: continuation arrows for all five bar types, every viewport edge, original/latest/actual tracks, elapsed comparison, real Vega SVG, themes, resize, pan/zoom and unchanged source dates/Fit all.');
})().catch(error => { console.error(error); process.exitCode = 1; });
