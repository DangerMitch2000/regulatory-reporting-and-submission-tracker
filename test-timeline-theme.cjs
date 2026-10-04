const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vega = require('./vega.js');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline.json'), 'utf8'));
const date = value => Date.parse(value + 'T00:00:00Z');
const canonicalColors = spec.signals.find(signal => signal.name === 'stateColours').value;
const states = ['Planned', 'In Progress', 'Sent to Health Authority', 'HA Received', 'Completed', 'Health Authority Approved', 'Deferred', 'Rejected', 'Inactive'];
const rows = states.map((state, index) => ({
  AppID: 'APP-THEME', ROID: 'RO-THEME', SubID: 'SUB-' + index,
  AppStatus: 'Active', ROStatus: 'Health Authority Approved', SubStatus: state,
  Country: 'Example country', Manufacturer: 'Example site', Product: 'Example product',
  AppCreated: date('2026-01-01'), ROCreated: date('2026-01-02'), SubCreated: date('2026-01-03'),
  OriginalDispatch: date('2026-01-15'), LatestDispatch: date('2026-01-16'), ActualDispatch: date('2026-01-17'),
  OriginalSubmission: date('2026-02-01'), LatestSubmission: date('2026-02-02'), ActualSubmission: date('2026-02-03'),
  OriginalApproval: date('2026-05-01'), LatestApproval: date('2026-06-01'),
  ActualApproval: state === 'Completed' ? date('2026-05-03') : null,
  RegistrationStart: date('2026-06-01'), RegistrationEnd: date('2027-06-01'),
  PredictionDate: date('2026-05-20'), PredictionLow: date('2026-04-01'), PredictionHigh: date('2026-07-01'),
  PredictionStatus: state === 'Completed' ? 'benchmark' : 'estimated',
  PredictionN: 20, PredictionMedian: 106, PredictionCountry: 'Example country',
  PredictionAnchorDate: date('2026-02-03'), PredictionAnchorLabel: 'Actual submission', PredictionFromPlan: false
}));

function sceneItems(node) {
  return [node, ...(node.items || []).flatMap(sceneItems)];
}
function namedItems(view, name) {
  return sceneItems(view.scenegraph().root).filter(item => item.mark?.name === name);
}
function snapshot(view) {
  return JSON.parse(JSON.stringify({
    signals: Object.fromEntries(['range', 'xlo', 'xhi', 'selectedKey', 'stateColours', 'scrollTop', 'mode', 'compareLevel', 'showRegistrationEnd'].map(name => [name, view.signal(name)])),
    data: Object.fromEntries(['dataset', 'sub', 'apps', 'ros', 'pageRows', 'milestones', 'predictions', 'predictionPoints', 'pinned', 'expanded'].map(name => [name, view.data(name)]))
  }));
}
function luminance(hex) {
  if (hex.length === 4) hex = '#' + hex.slice(1).split('').map(part => part + part).join('');
  const channels = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const lumA = luminance(a), lumB = luminance(b);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

// All mark colours must be reactive, including hover encodings and text that
// previously inherited a fixed config fill. Canonical data keys stay unchanged.
function auditMarks(marks) {
  for (const mark of marks) {
    for (const encoding of Object.values(mark.encode || {})) {
      for (const property of ['fill', 'stroke']) {
        const value = encoding[property];
        if (!value) continue;
        assert.ok(value.signal, `${mark.name || mark.type} ${property} must react to the theme`);
        assert.doesNotMatch(value.signal, /#[0-9a-f]{3,8}/i);
      }
    }
    if (mark.type === 'text') assert.ok(mark.encode.update.fill, `${mark.name || 'text'} needs an explicit themed fill`);
    if (mark.marks) auditMarks(mark.marks);
  }
}

(async () => {
  auditMarks(spec.marks);
  const view = new vega.View(vega.parse(spec), { renderer: 'none' });
  view.change('dataset', vega.changeset().insert(rows.map(row => ({ ...row }))));
  view.signal('denebContainer', { width: 1280, height: 960 });
  view.signal('mode', 'Compare').signal('nowDate', date('2026-04-15')).signal('showRegistrationEnd', true);
  await view.runAsync();
  assert.equal(view.signal('themeMode'), 'dark');
  assert.equal(view.background(), '#14181f');
  const selectedKey = view.data('pageRows')[1].key;
  view.signal('selectedKey', selectedKey).signal('range', [date('2026-01-01'), date('2027-08-01')]);
  view.change('pinned', vega.changeset().insert({ pinKey: selectedKey }));
  await view.runAsync();
  const before = snapshot(view);
  assert.equal(view.data('sub').length, 9);
  assert.equal(view.data('predictionPoints').length, 9);
  const darkSVG = await view.toSVG();
  assert.match(darkSVG, /fill="#14181f"/);
  assert.match(darkSVG, /fill="#dbe3ef"/);
  for (const item of namedItems(view, 'ownState')) assert.equal(item.fill, view.signal('themeStateColors')[item.datum.StateColor]);
  const darkSelected = namedItems(view, 'rowBg').find(item => item.datum.key === selectedKey);
  assert.equal(darkSelected.fill, '#344460');

  view.signal('themeMode', 'light');
  await view.runAsync();
  assert.deepEqual(snapshot(view), before, 'Theme change must preserve all data and user state');
  assert.equal(view.background(), '#ffffff');
  const palette = view.signal('themePalette');
  const stateColors = view.signal('themeStateColors');
  assert.deepEqual(view.signal('stateColours'), canonicalColors);
  assert.equal(namedItems(view, 'rowBg').find(item => item.datum.key === selectedKey).fill, '#dceaff');
  assert.equal(namedItems(view, 'rowBg').find(item => item.datum.key === selectedKey).stroke, '#7950b4');
  for (const item of namedItems(view, 'ownState')) {
    assert.equal(item.fill, stateColors[item.datum.StateColor]);
    for (const background of [palette.background, palette.rowSelected, palette.rowApplication, palette.rowObjective]) {
      assert.ok(contrast(item.fill, background) >= 4.5, `Readable light state label ${item.fill} on ${background}`);
    }
  }
  assert.ok(contrast(palette.text, palette.rowSelected) >= 4.5);
  assert.ok(contrast(palette.mutedText, palette.rowSelected) >= 4.5);
  for (const item of namedItems(view, 'milestone')) {
    assert.equal(item.stroke, stateColors[item.datum.StateColor]);
    if (item.datum.track === 0 || item.datum.kind === 4) assert.equal(item.fill, '#ffffff');
  }
  for (const item of namedItems(view, 'predictionApproval')) assert.equal(item.stroke, palette.prediction);
  for (const item of namedItems(view, 'predictionRange')) assert.equal(item.fill, palette.prediction);
  assert.equal(namedItems(view, 'todayBadge')[0].fill, palette.todayBackground);
  const lightSVG = await view.toSVG();
  assert.match(lightSVG, /fill="#ffffff"/);
  assert.match(lightSVG, /fill="#172b43"/);
  assert.doesNotMatch(lightSVG, /(?:fill|stroke)="#(?:14181f|dbe3ef|252d39|222b38|171e28|1b232e)"/);
  assert.equal((lightSVG.match(/aria-roledescription="symbol mark"/g) || []).length, (darkSVG.match(/aria-roledescription="symbol mark"/g) || []).length);

  // Filtering remains keyed by the canonical colours. Changing themes after
  // choosing one state cannot add or remove records or reset the current view.
  view.signal('stateColours', ['#70b85c']);
  await view.runAsync();
  assert.equal(view.data('pageRows').length, 1);
  assert.equal(view.data('pageRows')[0].State, 'Completed');
  const filtered = snapshot(view);
  view.signal('themeMode', 'dark');
  await view.runAsync();
  assert.deepEqual(snapshot(view), filtered);
  assert.equal(namedItems(view, 'ownState')[0].fill, view.signal('themeStateColors')['#70b85c']);

  // Hierarchy bars and expanded children use the same theme without rebuilding.
  view.signal('mode', 'Hierarchy').signal('stateColours', canonicalColors.slice());
  await view.runAsync();
  const appKey = view.data('apps')[0].key, roKey = view.data('ros')[0].key;
  view.change('expanded', vega.changeset().insert([{ key: appKey }, { key: roKey }]));
  await view.runAsync();
  assert.ok(namedItems(view, 'parentBar').length >= 2);
  const hierarchy = snapshot(view);
  view.signal('themeMode', 'light');
  await view.runAsync();
  assert.deepEqual(snapshot(view), hierarchy);
  for (const item of namedItems(view, 'parentBar')) {
    assert.equal(item.fill, stateColors[item.datum.StateColor]);
    assert.equal(item.stroke, stateColors[item.datum.StateColor]);
  }
  view.finalize();
  console.log('PASS: light/dark Vega rendering, label contrast, prediction/registration/Today marks, canonical state filters, unchanged counts, selected record, pins, hierarchy and zoom.');
})().catch(error => { console.error(error); process.exitCode = 1; });
