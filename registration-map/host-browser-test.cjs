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

async function businessUnitStartupChecks(page) {
  const base = fixtures()[0][0];
  const rows = [base, {...base, CatalogNumber: '002'},
    {...base, RegistrationID: 'START-CMI', BusinessUnit: 'CMI'},
    {...base, RegistrationID: 'START-CORE', BusinessUnit: 'CoreLab'},
    {...base, RegistrationID: 'START-CONDITIONAL', RegistrationState: 'Conditionally Approved'},
    {...base, RegistrationID: 'START-PLANNED', RegistrationState: 'Planned'}];
  const nonID = rows.filter(row => row.BusinessUnit !== 'ID');
  await page.evaluate(() => coverageHarness.create('startup'));
  const root = page.locator('#startup'), units = root.locator('details[data-filter="units"]');
  const send = (data, options = {}) => page.evaluate(({data, options}) => coverageHarness.send('startup', data, options), {data, options});
  const snapshot = () => page.evaluate(() => coverageHarness.snapshot('startup'));
  async function assertUnits(expected, count, label) {
    const current = await snapshot();
    assert.deepEqual(current.state.filters.units, expected, label);
    assert.equal(current.metrics[1], count, label);
  }
  async function chooseUnit(value) {
    if (!await units.evaluate(node => node.open)) await units.locator('summary').click();
    await units.getByRole('button', {name: 'All business units', exact: true}).click();
    if (value) await units.getByRole('checkbox', {name: value, exact: true}).check();
    await units.locator('summary').click();
  }
  await send([], {noDataView: true});
  await assertUnits(['ID'], 0, 'A new empty instance retains the ID startup choice');
  await send([], {omit: ['BusinessUnit'], segment: true});
  await assertUnits(['ID'], 0, 'An empty partial delivery without a unit mapping retains ID');
  await send(nonID, {segment: true});
  await assertUnits(['ID'], 0, 'A mapped partial batch without ID stays restricted to ID');
  await send(nonID);
  await assertUnits(['ID'], 0, 'A completed mapped delivery without ID does not silently switch to All');
  assert.equal(await units.locator('summary').textContent(), 'Business units · ID');
  assert.equal(await root.getByRole('button', {name: 'Business units: ID ×', exact: true}).count(), 1);
  await units.locator('summary').click();
  assert.equal(await units.getByRole('checkbox', {name: 'ID', exact: true}).isChecked(), true, 'Selected ID stays available when absent from source values');
  assert.equal(await units.getByRole('checkbox', {name: 'CMI', exact: true}).isChecked(), false);
  await units.locator('summary').click();
  await send(rows, {append: true});
  await assertUnits(['ID'], 2, 'Mixed accumulated data counts distinct Approved/Conditionally Approved ID registrations');
  assert.deepEqual((await snapshot()).state.filters.states, ['Approved', 'Conditionally Approved']);
  await send(rows);
  await send([], {type: 4, width: 760, height: 700});
  await assertUnits(['ID'], 2, 'The startup ID choice survives refresh and resize');

  await chooseUnit('CMI');
  await assertUnits(['CMI'], 1, 'Users can choose another business unit');
  await send([base]);
  await assertUnits(['CMI'], 0, 'A selected other unit survives a refresh without matching values');
  await units.locator('summary').click();
  assert.equal(await units.getByRole('checkbox', {name: 'CMI', exact: true}).isChecked(), true);
  await units.locator('summary').click();
  await send(rows);
  await send([], {type: 4});
  await assertUnits(['CMI'], 1, 'Explicit other-unit choice survives refresh and resize');
  await chooseUnit(null);
  await send([], {noDataView: true});
  await send(rows);
  await send([], {type: 4});
  await assertUnits([], 4, 'Explicit All survives an empty delivery, refresh and resize');

  await chooseUnit('CoreLab');
  await root.getByRole('button', {name: 'Registration state: Approved, Conditionally Approved ×', exact: true}).click();
  await root.getByRole('button', {name: 'Reset filters', exact: true}).click();
  await assertUnits([], 4, 'Reset clears the unit restriction');
  assert.deepEqual((await snapshot()).state.filters.states, ['Approved', 'Conditionally Approved'], 'Reset retains the established approved-state defaults');
  await send(rows);
  await assertUnits([], 4, 'Reset choice survives refresh');

  await page.evaluate(() => coverageHarness.create('unmapped-startup'));
  await page.evaluate(rows => coverageHarness.send('unmapped-startup', rows, {omit: ['BusinessUnit']}), rows);
  const unmapped = await page.evaluate(() => coverageHarness.snapshot('unmapped-startup'));
  assert.deepEqual(unmapped.state.filters.units, [], 'A populated table without BusinessUnit mapping falls back to All');
  assert.equal(unmapped.metrics[1], 4, 'Unmapped unit data remains accessible');
  await page.evaluate(rows => coverageHarness.send('unmapped-startup', rows), rows);
  assert.deepEqual((await page.evaluate(() => coverageHarness.snapshot('unmapped-startup'))).state.filters.units, [], 'Later mapped data does not overwrite the All fallback');
  await page.evaluate(async () => {for (const id of ['startup', 'unmapped-startup']) {const r = coverageHarness.instances[id]; r.visual.destroy(); await r.visual.queue; r.element.remove();}});
}

async function productFamilyChecks(page, packaged) {
  const base = {RegistrationID:'FAMILY-IE',RegistrationCountry:'Ireland',RegistrationState:'Approved',RegistrationStart:'2020-01-01',RegistrationEnd:'2030-12-31',Product:'Alpha device',ProductFamily:'Immunoassay diagnostic family',Manufacturer:'ABO',BusinessUnit:'ID',CatalogNumber:'CAT-A'};
  const rows = [base,{...base}, {...base,CatalogNumber:'CAT-B'},
    {...base,Product:'Beta device',ProductFamily:'Molecular diagnostics extended product family',Manufacturer:'ADK'},
    {...base,Product:'Gamma device',ProductFamily:'Restricted other-unit family',BusinessUnit:'CMI'},
    {...base,ProductFamily:''},
    {...base,RegistrationID:'FAMILY-BLANK',Product:'Standalone product name',ProductFamily:null},
    {...base,RegistrationID:'FAMILY-FR',RegistrationCountry:'France',ProductFamily:'France-only family'}];
  await page.evaluate(() => coverageHarness.create('families'));
  const root = page.locator('#families');
  const send = (options = {}) => page.evaluate(({rows,options}) => coverageHarness.send('families',rows,options),{rows,options});
  const snapshot = () => page.evaluate(() => coverageHarness.snapshot('families'));
  const chooseIreland = async () => {await root.locator('.map-country[data-country="372"]').focus();await page.keyboard.press('Enter');assert.equal(await root.locator('.map-side-heading h2').textContent(),'Ireland');};
  const familyRow = id => root.locator('.map-record-table tbody tr').filter({has:page.getByRole('button',{name:id,exact:true})});
  const familyText = id => familyRow(id).locator('.map-product-families').textContent();
  async function assertFamilyLayout(label) {
    const sizes=await root.evaluate(element=>{
      const visual=element.querySelector('.registration-map'),side=element.querySelector('.map-side'),table=element.querySelector('.map-record-table');
      return {rootWidth:visual.clientWidth,rootScroll:visual.scrollWidth,sideWidth:side.clientWidth,sideScroll:side.scrollWidth,tableWidth:table.getBoundingClientRect().width};
    });
    assert(sizes.rootScroll<=sizes.rootWidth+1,label+': visual overflow '+JSON.stringify(sizes));
    assert(sizes.sideScroll<=sizes.sideWidth+1,label+': side overflow '+JSON.stringify(sizes));
    assert(sizes.tableWidth<=sizes.sideWidth+1,label+': table overflow '+JSON.stringify(sizes));
  }
  await send({width:1200,height:760});await chooseIreland();
  assert.equal((await snapshot()).metrics[1],3,'Product family joins do not inflate distinct registration totals');
  assert.deepEqual(await root.locator('.map-record-table th').allTextContents(),['Registration','Product families','State','End date']);
  assert.equal(await root.locator('.map-record-table tbody tr').count(),2,'Country selection excludes registrations from other countries');
  assert.equal(await familyText('FAMILY-IE'),'Immunoassay diagnostic family · Molecular diagnostics extended product family');
  assert.equal(await familyRow('FAMILY-IE').locator('.map-family-value').getAttribute('title'),'Immunoassay diagnostic family · Molecular diagnostics extended product family','Full family list remains available when visually clamped');
  assert.equal(await familyText('FAMILY-BLANK'),'Not recorded','Missing family is not inferred from the product name');
  assert.doesNotMatch(await root.locator('.map-record-table').textContent(),/Restricted other-unit|France-only/,'Country list families reflect country and business-unit scope');
  await assertFamilyLayout('Wide product family list');
  await page.screenshot({path:path.join(artifacts,packaged?'product-families-package-wide.png':'product-families-source-wide.png'),fullPage:true});
  await root.getByRole('button',{name:'FAMILY-IE',exact:true}).click();
  const detail=root.locator('.map-detail-field').filter({has:page.locator('span').filter({hasText:/^Product families$/})});
  assert.equal(await detail.locator('strong').textContent(),'Immunoassay diagnostic family · Molecular diagnostics extended product family','Details retains every scoped family');
  await root.getByRole('button',{name:'Back',exact:true}).click();
  await root.getByRole('button',{name:'CSV',exact:true}).click();
  const csv=await page.evaluate(()=>coverageHarness.instances.families.exports.at(-1)[0]);
  assert.match(csv.split(/\r?\n/)[0],/Product families/);assert.match(csv,/Immunoassay diagnostic family/);assert.match(csv,/Molecular diagnostics extended product family/);
  assert.doesNotMatch(csv,/France-only family|Restricted other-unit family/,'Country CSV excludes out-of-scope families');
  const productFilter=root.locator('details[data-filter="products"]');
  await productFilter.locator('summary').click();await productFilter.getByRole('checkbox',{name:'Alpha device',exact:true}).check();await productFilter.locator('summary').click();
  assert.equal(await familyText('FAMILY-IE'),'Immunoassay diagnostic family','Product filtering does not leak another product family');
  await root.getByRole('button',{name:'Products: 1 selected ×',exact:true}).click();
  await root.getByRole('searchbox',{name:'Search registrations',exact:true}).fill('Molecular diagnostics extended');
  await page.waitForFunction(()=>coverageHarness.instances.families.visual.app.getState().filters.search==='Molecular diagnostics extended');
  assert.equal((await snapshot()).metrics[1],1,'Search finds a family without requiring product-name match');
  assert.equal(await familyText('FAMILY-IE'),'Molecular diagnostics extended product family','Search keeps matching membership evidence');
  await root.getByRole('searchbox',{name:'Search registrations',exact:true}).fill('');
  await page.waitForFunction(()=>coverageHarness.instances.families.visual.app.getState().filters.search==='');
  await send({type:4,width:760,height:700});
  await assertFamilyLayout('Compact product family list');
  assert.equal(await familyText('FAMILY-IE'),'Immunoassay diagnostic family · Molecular diagnostics extended product family');
  await familyRow('FAMILY-IE').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifacts,packaged?'product-families-package-compact.png':'product-families-source-compact.png'),fullPage:true});
  await send({omit:['ProductFamily']});
  assert.equal((await snapshot()).metrics[1],3,'An old report without the optional field keeps its existing counts');
  assert.equal(await familyText('FAMILY-IE'),'Not recorded','An unmapped optional family field does not invent family data');
  assert.equal(await root.locator('.host-notice').isHidden(),true,'Missing optional family mapping is not a required-field warning');
  await send();
  assert.equal(await familyText('FAMILY-IE'),'Immunoassay diagnostic family · Molecular diagnostics extended product family','Adding the new mapping restores family data');
  await page.evaluate(async()=>{const r=coverageHarness.instances.families;r.visual.destroy();await r.visual.queue;r.element.remove();});
}

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
  const html = '<!doctype html><html><meta charset="utf-8"><title>Actual Power BI Registration Coverage Map host verification</title><style>body{margin:0;font-family:"Wallace Sans","Segoe UI",Arial,sans-serif}section{margin:0}'+css+'</style><script src="/harness.js"></script></html>';
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
    await businessUnitStartupChecks(page);
    await productFamilyChecks(page, packaged);
    await page.evaluate(() => coverageHarness.create('first'));
    const batches = fixtures();
    for (let i = 0; i < batches.length; i++) {
      await page.evaluate(async ({rows, segment, append}) => coverageHarness.send('first', rows, {segment, append}), {rows: batches[i], segment: i < 2, append: i > 0});
      if (i === 0) await page.locator('#first').getByRole('button', {name: 'Reset filters', exact: true}).click(); // Independent host lifecycle checks span all units.
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
    assert.deepEqual((await page.evaluate(() => coverageHarness.snapshot('second'))).state.filters.units, ['ID'], 'A second instance has its own ID startup choice');
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
    console.log(`PASS ${packaged ? 'packaged' : 'actual'} Visual browser host: product-family mapping/list/Details/search/CSV/compact layout, ID startup, mixed/empty/partial/missing-unit batches, explicit other/All and Reset persistence, unmapped fallback, offline SVG, distinct accumulated batches, render-before-fetch, resize/data selection preservation, denied/allowed copy/export, explicit URL launch, high contrast, notices, two instances, destroy and empty data.`);
  } finally {await browser?.close(); await new Promise(resolve => server.close(resolve));}
}
module.exports = {run, fixtures};
if (require.main === module) run().catch(error => {console.error(error); process.exitCode = 1;});
