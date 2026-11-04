/* Runs the real production Visual, mapping, registration logic, geography and UI. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {dependency} = require('./test-tools.cjs');
const artifacts = path.join(__dirname, '.test-artifacts', 'host');

function installHarness(roles) {
  const instances = {};
  window.coverageHarness = {
    instances,
    create(id, options = {}) {
      const element = document.createElement('section'); element.id = id; document.body.appendChild(element);
      const record = {element, calls: [], events: [], launches: [], exports: [], accept: true, exportStatus: 0};
      const host = {
        colorPalette: {isHighContrast: false},
        eventService: {renderingStarted: () => record.events.push('start'), renderingFinished: () => record.events.push('finish'), renderingFailed: (_o, message) => record.events.push('failed: ' + message)},
        fetchMoreData(aggregate) {record.calls.push({aggregate, ...window.coverageHarness.snapshot(id)}); return record.accept;},
        launchUrl: url => record.launches.push(url),
        downloadService: {exportStatus: async () => record.exportStatus, exportVisualsContent: async (...args) => {record.exports.push(args); return true;}}
      };
      record.host = host; instances[id] = record;
      record.visual = window.coverageFactory({element, host});
      return true;
    },
    async send(id, rows, options = {}) {
      const r = instances[id], type = options.type || 2, selectedRoles = roles.filter(role => !(options.omit || []).includes(role));
      r.visual.update({type, operationKind: options.append ? 1 : 0, viewport: {width: options.width || 1200, height: options.height || 760},
        dataViews: options.noDataView ? [] : [{metadata: options.segment ? {segment: {}} : {}, table: {columns: selectedRoles.map(role => ({displayName: role, roles: {[role]: true}})), rows: rows.map(row => selectedRoles.map(role => row[role] ?? null))}}]});
      await r.visual.queue;
    },
    snapshot(id) {
      const r = instances[id], root = r.element.querySelector('.registration-map-host'), notice = root?.querySelector('.host-notice');
      return {text: r.element.textContent, metrics: [...r.element.querySelectorAll('.map-metrics button strong')].map(node => Number(node.textContent.replaceAll(',', ''))), svg: r.element.querySelectorAll('svg').length, notice: notice?.textContent, noticeHidden: notice?.hidden, busy: root?.getAttribute('aria-busy'), state: r.visual?.app?.getState?.() || null};
    }
  };
}

const fixtures = () => {
  const first = {RegistrationID: 'HOST-REG-1', RegistrationCountry: 'Ireland', RegistrationState: 'Approved', RegistrationStart: '2025-01-01', RegistrationEnd: '2027-01-01', RegistrationNumber: 'IE-001', Product: 'Alpha diagnostic device', ProductID: 'PRODUCT-1', Manufacturer: 'ABO', BusinessUnit: 'ID', RegistrationURL: 'https://example.com/registration/one', CatalogNumber: '001'};
  const second = {...first, RegistrationID: 'HOST-REG-2', RegistrationCountry: 'Germany', RegistrationNumber: 'DE-002', Product: 'Beta diagnostic device', ProductID: 'PRODUCT-2', Manufacturer: 'ADJ', BusinessUnit: 'CMI'};
  const third = {...first, RegistrationID: 'HOST-REG-3', RegistrationCountry: 'France', RegistrationNumber: 'FR-003', Product: 'Gamma diagnostic device', ProductID: 'PRODUCT-3', Manufacturer: 'ADK'};
  return [[first], [first, {...first, CatalogNumber: '002'}, second], [first, {...first, CatalogNumber: '002'}, second, third, {...first}]];
};

async function run({packaged} = {}) {
  const {roles} = await import('./logic.mjs');
  fs.mkdirSync(artifacts, {recursive: true});
  let script, css;
  if (packaged) {
    script = 'window.powerbi={};\n' + packaged.content.js + '\nwindow.coverageFactory = options => window.powerbi.visuals.plugins[' + JSON.stringify(packaged.visual.guid) + '].create(options);\n';
    css = packaged.content.css;
  } else {
    await dependency('esbuild').build({absWorkingDir: __dirname, tsconfigRaw: {compilerOptions: {target: 'ES2022'}}, stdin: {contents: `import {Visual} from './powerbi/src/visual.ts'; window.coverageFactory = options => new Visual(options);`, resolveDir: __dirname, sourcefile: 'host-harness.ts', loader: 'ts'}, bundle: true, outfile: path.join(artifacts, 'harness.js'), loader: {'.less': 'css'}, format: 'iife', platform: 'browser'});
    script = fs.readFileSync(path.join(artifacts, 'harness.js'), 'utf8');
    css = fs.readFileSync(path.join(artifacts, 'harness.css'), 'utf8');
  }
  script += '\n(' + installHarness.toString() + ')(' + JSON.stringify(roles) + ');';
  const html = '<!doctype html><html><meta charset="utf-8"><title>Actual Power BI Registration Coverage Map host verification</title><style>body{margin:0;font-family:Segoe UI,sans-serif}section{margin:0}'+css+'</style><script src="/harness.js"></script></html>';
  const server = http.createServer((req, res) => {if (req.url === '/harness.js') res.writeHead(200, {'Content-Type': 'text/javascript'}).end(script); else if (req.url === '/') res.writeHead(200, {'Content-Type': 'text/html'}).end(html); else res.writeHead(404).end();});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const {chromium} = dependency('@playwright/test'); let browser;
  try {
    const channel = process.env.MAP_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
    browser = await chromium.launch({headless: true, ...(channel ? {channel} : {})});
    const page = await browser.newPage({viewport: {width: 1280, height: 900}, timezoneId: 'Europe/Dublin'});
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {if (!request.url().startsWith('http://127.0.0.1:')) external.push(request.url());});
    await page.clock.setFixedTime(new Date('2026-11-04T12:00:00Z'));
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.evaluate(() => coverageHarness.create('first'));
    const batches = fixtures();
    for (let i = 0; i < batches.length; i++) {
      await page.evaluate(async ({rows, segment, append}) => coverageHarness.send('first', rows, {segment, append}), {rows: batches[i], segment: i < 2, append: i > 0});
      const result = await page.evaluate(() => ({snapshot: coverageHarness.snapshot('first'), calls: coverageHarness.instances.first.calls}));
      assert.ok(result.snapshot.svg > 0, 'The real offline SVG map renders');
      assert.equal(result.snapshot.metrics[1], i + 1, 'Accumulated tables retain each distinct registration exactly once');
      assert.equal(result.calls.length, Math.min(i + 1, 2));
      if (i < 2) {
        assert.match(result.snapshot.notice, /Counts reflect loaded rows only/); assert.equal(result.snapshot.busy, 'true');
        assert.equal(result.calls[i].aggregate, true); assert.ok(result.calls[i].svg > 0, 'Map renders before fetching another batch');
        assert.equal(result.calls[i].metrics[1], i + 1, 'The next host request observes the current distinct-registration total');
        assert.match(result.calls[i].notice, /rows received/);
        await page.evaluate(() => coverageHarness.send('first', [], {type: 4, segment: true, width: 980, height: 700}));
        assert.equal(await page.evaluate(() => coverageHarness.instances.first.calls.length), i + 1, 'Resize never fetches or drops the batch');
      } else {assert.equal(result.snapshot.noticeHidden, true); assert.equal(result.snapshot.busy, 'false');}
    }
    assert.deepEqual(await page.evaluate(() => coverageHarness.instances.first.launches), [], 'Source URLs never launch automatically');
    assert.deepEqual(await page.evaluate(() => coverageHarness.instances.first.exports), [], 'Export requires an explicit action');
    const first = page.locator('#first');
    await first.getByRole('searchbox', {name: 'Search registrations'}).fill('Beta');
    await page.waitForFunction(() => coverageHarness.instances.first.visual.app.getState().filters.search === 'Beta');
    await first.locator('details[data-filter="products"] summary').click();
    await first.getByRole('checkbox', {name: 'Beta diagnostic device', exact: true}).check();
    await first.locator('details[data-filter="products"] summary').click();
    await first.locator('.map-country[data-country="276"]').focus();
    await page.keyboard.press('Enter');
    await first.getByRole('button', {name: 'Zoom in', exact: true}).click();
    await first.getByRole('combobox', {name: 'Theme', exact: true}).selectOption('light');
    const selected = await page.evaluate(() => coverageHarness.instances.first.visual.app.getState());
    assert.equal(selected.selectedCountry, '276'); assert.equal(selected.filters.search, 'Beta'); assert.equal(selected.filters.products.length, 1); assert.ok(selected.zoom > 1);
    await page.evaluate(() => coverageHarness.send('first', [], {type: 4, width: 760, height: 700}));
    assert.deepEqual(await page.evaluate(() => coverageHarness.instances.first.visual.app.getState()), selected, 'Resize preserves product/search/country/zoom selections');
    await page.evaluate(rows => coverageHarness.send('first', rows), batches[2]);
    assert.deepEqual(await page.evaluate(() => coverageHarness.instances.first.visual.app.getState()), selected, 'Data updates preserve product/search/country/zoom selections');
    assert.equal(await first.locator('.registration-map').getAttribute('data-theme'), 'light');
    assert.equal(await first.locator('.map-metrics button strong').nth(1).textContent(), '1');
    await first.getByRole('button', {name: 'Reset filters', exact: true}).click();
    await first.getByRole('button', {name: 'Registrations', exact: true}).click();
    await page.evaluate(() => {window.hostCopied = []; Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => window.hostCopied.push(text)}});});
    await first.getByRole('button', {name: 'Copy IDs', exact: true}).click();
    assert.equal(await page.evaluate(() => window.hostCopied[0]), 'HOST-REG-1\nHOST-REG-2\nHOST-REG-3');
    await page.evaluate(() => {Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => {throw Error('Denied');}}});});
    await first.getByRole('button', {name: 'Copy IDs', exact: true}).click();
    await first.getByRole('textbox', {name: 'Copyable content'}).waitFor();
    assert.equal(await first.getByRole('textbox', {name: 'Copyable content'}).inputValue(), 'HOST-REG-1\nHOST-REG-2\nHOST-REG-3');
    assert.equal(await first.getByRole('textbox', {name: 'Copyable content'}).getAttribute('readonly'), '');
    await first.locator('.map-copy-fallback').getByRole('button', {name: 'Close', exact: true}).click();
    await page.evaluate(() => {coverageHarness.instances.first.exportStatus = 1;});
    await first.getByRole('button', {name: 'CSV', exact: true}).click();
    await first.getByRole('textbox', {name: 'Copyable content'}).waitFor();
    assert.match(await first.getByRole('textbox', {name: 'Copyable content'}).inputValue(), /HOST-REG-1/);
    assert.equal(await page.evaluate(() => coverageHarness.instances.first.exports.length), 0, 'Denied ExportContent uses a manual fallback');
    await first.locator('.map-copy-fallback').getByRole('button', {name: 'Close', exact: true}).click();
    await page.evaluate(() => {coverageHarness.instances.first.exportStatus = 0;});
    await first.getByRole('button', {name: 'CSV', exact: true}).click();
    await page.waitForFunction(() => coverageHarness.instances.first.exports.length === 1);
    assert.match(await page.evaluate(() => coverageHarness.instances.first.exports[0][0]), /HOST-REG-3/);
    await first.getByRole('button', {name: 'HOST-REG-1', exact: true}).click();
    await first.getByRole('button', {name: 'Open in platform ↗', exact: true}).click();
    assert.deepEqual(await page.evaluate(() => coverageHarness.instances.first.launches), ['https://example.com/registration/one']);
    await page.evaluate(() => {coverageHarness.instances.first.host.colorPalette = {isHighContrast: true, foreground: {value: '#ffffff'}, background: {value: '#000000'}, foregroundSelected: {value: '#ffff00'}, hyperlink: {value: '#00ffff'}};});
    await page.evaluate(() => coverageHarness.send('first', [], {type: 4}));
    assert.equal(await first.locator('.map-high-contrast').count(), 1);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#first .map-country[data-country="372"]')).fill === 'rgb(255, 255, 255)');
    assert.equal(await first.locator('.map-country[data-country="372"]').evaluate(node => getComputedStyle(node).fill), 'rgb(255, 255, 255)');
    await page.evaluate(() => {coverageHarness.instances.first.host.colorPalette = {isHighContrast: false};});
    await page.evaluate(() => coverageHarness.send('first', [], {type: 4}));
    await page.screenshot({path: path.join(artifacts, packaged ? 'packaged-host.png' : 'actual-host.png'), fullPage: true});
    await page.evaluate(() => {coverageHarness.instances.first.accept = false;});
    await page.evaluate(rows => coverageHarness.send('first', rows, {segment: true}), batches[0]);
    assert.match(await page.locator('#first .host-notice').textContent(), /limited the delivered rows/);
    await page.evaluate(() => coverageHarness.create('second'));
    await page.evaluate(rows => coverageHarness.send('second', rows), batches[1]);
    await page.evaluate(async () => {coverageHarness.instances.first.visual.destroy(); await coverageHarness.instances.first.visual.queue;});
    assert.equal(await page.locator('#first .registration-map-host').count(), 0);
    assert.equal(await page.locator('#second svg').count() > 0, true, 'Destroying one instance preserves its sibling');
    await page.evaluate(() => coverageHarness.send('second', []));
    assert.equal(await page.locator('#second .host-notice').isHidden(), true, 'Empty filtered table clears loading state');
    await page.evaluate(() => coverageHarness.send('second', [], {noDataView: true}));
    assert.match(await page.locator('#second .host-notice').textContent(), /Add fields/);
    assert.deepEqual(errors, []); assert.deepEqual(external, [], 'The visual makes zero external runtime requests');
    const events = await page.evaluate(() => Object.values(coverageHarness.instances).flatMap(r => r.events));
    assert.equal(events.some(event => event.startsWith('failed:')), false, events.join('\n'));
    console.log(`PASS ${packaged ? 'packaged' : 'actual'} Visual browser host: offline SVG, distinct accumulated batches, render-before-fetch, resize/data selection preservation, denied/allowed copy/export, explicit URL launch, high contrast, notices, two instances, destroy and empty data.`);
  } finally {await browser?.close(); await new Promise(resolve => server.close(resolve));}
}
module.exports = {run, fixtures};
if (require.main === module) run().catch(error => {console.error(error); process.exitCode = 1;});
