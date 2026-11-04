'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { performance } = require('node:perf_hooks');
const { dependency } = require('./test-tools.cjs');
const { chromium, expect } = dependency('@playwright/test');
const geography = require('./geography.json');

const fixture = changes => ({
  RegistrationID: 'REG-A', RegistrationCountry: 'Ireland', RegistrationState: 'Approved',
  RegistrationStart: '2020-01-01', RegistrationEnd: '2035-12-31',
  RegistrationNumber: 'NUMBER-001', Product: 'Alpha', ProductID: 'PA',
  Manufacturer: 'Site A', RegistrationManufacturingSite: 'Factory A', BusinessUnit: 'Unit 1',
  CatalogNumber: 'CAT-001', AppID: 'APP-001', ROID: 'RO-001', SubID: 'SUB-001',
  RegistrationHolder: 'Example holder', RegistrationURL: 'https://example.com/registration/REG-A',
  ...changes
});
const fixtures = [
  fixture(), fixture({CatalogNumber:'CAT-002'}),
  fixture({RegistrationID:'REG-B', RegistrationState:'Conditionally Approved', Product:'Beta', Manufacturer:'Site B'}),
  fixture({RegistrationID:'REG-C', RegistrationCountry:'France', Manufacturer:'Site B', BusinessUnit:'Unit 2'}),
  fixture({RegistrationID:'REG-CROSS', RegistrationCountry:'Germany'}),
  fixture({RegistrationID:'REG-CROSS', RegistrationCountry:'Germany', Product:'Beta', Manufacturer:'Site B', BusinessUnit:'Unit 2'}),
  fixture({RegistrationID:'REG-INVALID-URL', RegistrationURL:'javascript:alert(1)'}),
  fixture({RegistrationID:'REG-CONFLICT-URL', RegistrationURL:'https://example.com/a'}),
  fixture({RegistrationID:'REG-CONFLICT-URL', RegistrationURL:'https://example.com/b'}),
  fixture({RegistrationID:'REG-INVALID-DATE', RegistrationStart:'2026-02-30', RegistrationEnd:'not-a-date'}),
  fixture({RegistrationID:'REG-CONFLICT-DATE', RegistrationEnd:'2030-01-01'}),
  fixture({RegistrationID:'REG-CONFLICT-DATE', RegistrationEnd:'2031-01-01'}),
  fixture({RegistrationID:'REG-SENTINEL', RegistrationEnd:'9000-12-31'}),
  fixture({RegistrationID:'REG-NOEND', RegistrationEnd:''}),
  fixture({RegistrationID:'REG-FALLBACK', RegistrationCountry:'', Country:'Malta'}),
  fixture({RegistrationID:'REG-UNMAPPED', RegistrationCountry:'Not a country', Country:'Ireland'}),
  fixture({RegistrationID:'REG-WITHDRAWN', RegistrationState:'Withdrawn'}),
  fixture({RegistrationID:'REG-STATE-CONFLICT', RegistrationState:'Approved'}),
  fixture({RegistrationID:'REG-STATE-CONFLICT', RegistrationState:'Withdrawn', Product:'Beta'}),
  fixture({RegistrationID:'', RegistrationCountry:'Singapore', AppID:'APP-MISSING-ID'})
];

async function main() {
  const {analyze, derive, toCsv} = await import(pathToFileURL(path.join(__dirname, 'logic.mjs')).href);
  if (!fs.existsSync(path.join(__dirname, 'preview.html'))) throw new Error('Run node prepare-preview.cjs before browser-test.cjs');
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const file = path.resolve(__dirname, '.' + (pathname === '/' ? '/preview.html' : pathname));
    if (!file.startsWith(__dirname + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); response.end('Not found'); return;
    }
    response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.json') ? 'application/json' : 'text/plain');
    response.end(fs.readFileSync(file));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const configuredChannel = process.env.MAP_BROWSER_CHANNEL || process.env.TRACKER_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const channel = configuredChannel === 'chromium' ? undefined : configuredChannel;
  const artifactDirectory = path.join(__dirname, '.test-artifacts');
  fs.mkdirSync(artifactDirectory, {recursive:true});
  let browser;
  const errors = [], externalRequests = [], checks = [];
  try {
    browser = await chromium.launch({headless:true, ...(channel ? {channel} : {})});
    const context = await browser.newContext({viewport:{width:1536,height:900}, acceptDownloads:true});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.stack || String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (!url.startsWith(origin + '/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
        externalRequests.push(url); await route.abort(); return;
      }
      await route.continue();
    });
    await page.goto(origin + '/preview.html', {waitUntil:'networkidle'});
    await page.waitForFunction(() => !!window.__registrationMap);
    const initial = await page.evaluate(() => ({rows:window.__mapRows, now:window.__mapNow.toISOString()}));
    const modelFor = rows => analyze(rows, {countries:geography.countries, now:initial.now});
    let currentRows = initial.rows;

    async function expectedResult() {
      const state = await page.evaluate(() => window.__registrationMap.getState());
      return derive(modelFor(currentRows), state.filters);
    }
    async function assertMetricsAndMap(label) {
      const expected = await expectedResult();
      const observed = await page.locator('.map-metric strong').allTextContents();
      assert.deepEqual(observed.map(value => +value.replaceAll(',', '')),
        [expected.kpis.countries, expected.kpis.registrations, expected.kpis.expiring, expected.kpis.review], label);
      await expect(page.locator('.map-country')).toHaveCount(241);
      const aria = await page.locator('.map-country').evaluateAll(nodes => nodes.map(node => [node.dataset.country, node.getAttribute('aria-label')]));
      for (const [id, labelText] of aria) {
        const count = expected.countries.find(country => String(country.id) === id).count;
        assert(labelText.endsWith(`: ${count.toLocaleString('en-GB')} matching registrations`), `${label}: wrong map count ${id}`);
      }
      checks.push(label);
      return expected;
    }
    async function selectFilter(key, label) {
      const details = page.locator(`details[data-filter="${key}"]`);
      if (!await details.evaluate(node => node.open)) await details.locator('summary').click();
      await details.getByRole('checkbox', {name:label, exact:true}).check();
      await details.locator('summary').click();
    }
    async function reset() {
      await page.getByRole('button', {name:'Reset filters',exact:true}).click();
      await expect(page.locator('.map-side-heading h2')).toHaveText('Country coverage');
    }
    async function registrations() {
      await page.locator('.map-metric').nth(1).click();
      await expect(page.locator('.map-side-heading h2')).toHaveText('Registrations');
    }
    async function openRecord(id) {
      await registrations();
      await page.locator('.map-record-table').getByRole('button', {name:id,exact:true}).click();
      await expect(page.locator('.map-record-id')).toHaveText(id);
    }
    async function resize(width, height) {
      await page.setViewportSize({width,height});
      await page.evaluate(() => {
        const host = document.getElementById('map-demo');
        window.__registrationMap.resize(host.clientWidth,host.clientHeight);
      });
      await page.waitForTimeout(80);
    }
    async function assertLayout(label) {
      const layout = await page.evaluate(() => {
        const root = document.querySelector('.registration-map'), side = document.querySelector('.map-side'), map = document.querySelector('.map-world');
        const rect = map.getBoundingClientRect(), sideRect = side.getBoundingClientRect();
        return {width:innerWidth, documentWidth:document.documentElement.scrollWidth, rootWidth:root.clientWidth,
          rootScrollWidth:root.scrollWidth, sideWidth:side.clientWidth, sideScrollWidth:side.scrollWidth,
          mapWidth:rect.width,mapHeight:rect.height,sideHeight:sideRect.height};
      });
      assert(layout.documentWidth <= layout.width + 1, `${label}: document horizontal overflow ${JSON.stringify(layout)}`);
      assert(layout.rootScrollWidth <= layout.rootWidth + 1, `${label}: visual horizontal overflow ${JSON.stringify(layout)}`);
      assert(layout.sideScrollWidth <= layout.sideWidth + 1, `${label}: detail horizontal overflow ${JSON.stringify(layout)}`);
      assert(layout.mapWidth >= 300 && layout.mapHeight >= 190, `${label}: unusable map ${JSON.stringify(layout)}`);
      assert(layout.sideHeight >= 200, `${label}: unusable detail panel ${JSON.stringify(layout)}`);
      checks.push(label);
    }
    async function assertExport(records, message) {
      const csv = toCsv(records);
      assert.equal(await page.evaluate(() => window.__exportedCSV), csv, message);
      // HTML textarea values normalize CRLF; validate original service bytes above.
      assert.equal(await page.getByRole('textbox',{name:'Copyable content',exact:true}).inputValue(), csv.replaceAll('\r\n','\n'), message);
    }

    await assertMetricsAndMap('Demo distinct registrations and all 241 country counts');
    await page.locator('.map-country[data-country="372"]').click();
    await expect(page.locator('.map-side-heading h2')).toHaveText('Ireland');
    assert.equal((await page.evaluate(() => window.__registrationMap.getState())).selectedCountry, '372');
    const demoExpected = await expectedResult();
    const ireland = demoExpected.records.filter(record => record.countryIds.includes('372'));
    assert(ireland.length > 0);
    await expect(page.locator('.map-record-table tbody tr')).toHaveCount(ireland.length);
    await page.locator('.map-record-table').getByRole('button', {name:ireland[0].id,exact:true}).click();
    await expect(page.locator('.map-record-id')).toHaveText(ireland[0].id);
    await expect(page.locator('.map-side')).toContainText('Products & catalog numbers');
    await assertLayout('1536 × 900 country and registration detail layout');
    await page.screenshot({path:path.join(artifactDirectory, 'preview-dark.png')});
    await page.getByRole('combobox', {name:'Theme',exact:true}).selectOption('light');
    await expect(page.locator('.registration-map')).toHaveAttribute('data-theme','light');
    await resize(1280,850);
    await assertLayout('1280 × 850 light registration detail layout');
    await page.screenshot({path:path.join(artifactDirectory, 'preview-light.png')});
    await page.getByRole('combobox', {name:'Theme',exact:true}).selectOption('dark');
    await resize(760,700);
    await expect(page.locator('.registration-map')).toHaveClass(/map-narrow/);
    await assertLayout('760 × 700 stacked map and detail layout');
    await page.locator('.map-record-id').scrollIntoViewIfNeeded();
    await expect(page.locator('.map-record-id')).toBeInViewport();
    await page.locator('.map-main').evaluate(node => {node.scrollTop = 0;});
    await page.locator('.registration-map').evaluate(node => {node.scrollTop = 0;});
    await page.screenshot({path:path.join(artifactDirectory, 'preview-compact.png')});
    await resize(1536,900);
    await reset();

    // Remount through the real UI entrypoint with deterministic fixtures and denied
    // host copy/export services so the accessible manual fallback is exercised.
    await page.evaluate(({rows,now}) => {
      window.__registrationMap.destroy();
      window.__launchedUrls = [];
      const host = document.getElementById('map-demo');
      const app = window.__mountMap(host, {
        onCopy:async() => false, onExport:async csv => {window.__exportedCSV = csv; return false;},
        onLaunchUrl:url => window.__launchedUrls.push(url)
      });
      window.__registrationMap = app;
      window.__sendMapRows = data => app.update(data,{now});
      app.update(rows,{now}); app.resize(host.clientWidth,host.clientHeight);
    }, {rows:fixtures,now:initial.now});
    currentRows = fixtures;
    await assertMetricsAndMap('Fixture deduplication, review and country placement');
    await selectFilter('products','Alpha');
    await selectFilter('sites','Site B');
    await selectFilter('units','Unit 2');
    const conjunctive = await assertMetricsAndMap('Product/site/business-unit conjunction uses one source membership');
    assert.deepEqual(conjunctive.records.map(record => record.id), ['REG-C']);
    await registrations();
    await expect(page.locator('.map-record-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.map-record-table')).toContainText('REG-C');
    await page.getByRole('button', {name:'Sites: 1 selected ×',exact:true}).click();
    assert.deepEqual((await page.evaluate(() => window.__registrationMap.getState())).filters.sites, []);
    await assertMetricsAndMap('Filter chip clear');
    await reset();
    assert.deepEqual((await page.evaluate(() => window.__registrationMap.getState())).filters.products, []);
    await assertMetricsAndMap('Reset restores approved states and clears memberships');
    await page.getByRole('button',{name:'Registration state: Approved, Conditionally Approved ×',exact:true}).click();
    const allStates = await assertMetricsAndMap('State chip clear exposes withdrawn and conflicted states');
    assert(allStates.records.some(record => record.id === 'REG-WITHDRAWN'));
    assert(allStates.records.some(record => record.id === 'REG-STATE-CONFLICT'));
    await reset();
    await page.getByRole('combobox',{name:'Expiry',exact:true}).selectOption('noend');
    const noEnd = await assertMetricsAndMap('Missing and beyond-2100 expiry filter');
    assert.deepEqual(noEnd.records.map(record => record.id).sort(),['REG-NOEND','REG-SENTINEL']);
    await reset();

    await page.getByRole('searchbox', {name:'Search registrations',exact:true}).fill('CAT-002');
    await expect(page.locator('.map-metric').nth(1).locator('strong')).toHaveText('1');
    await assertMetricsAndMap('Search matches source catalog membership without duplicating a registration');
    await reset();
    await openRecord('REG-A');
    await expect(page.locator('.map-side')).toContainText('CAT-001 · CAT-002');
    await page.getByRole('button', {name:'Copy ID',exact:true}).click();
    await expect(page.getByRole('textbox', {name:'Copyable content',exact:true})).toHaveValue('REG-A');
    await expect(page.getByRole('textbox', {name:'Copyable content',exact:true})).toBeFocused();
    await page.locator('.map-copy-fallback').getByRole('button', {name:'Close',exact:true}).click();
    await page.getByRole('button', {name:'Open in platform ↗',exact:true}).click();
    assert.deepEqual(await page.evaluate(() => window.__launchedUrls), ['https://example.com/registration/REG-A']);
    for (const id of ['REG-INVALID-URL','REG-CONFLICT-URL']) {
      await openRecord(id);
      await expect(page.getByRole('button', {name:'Open in platform ↗',exact:true})).toHaveCount(0);
      await expect(page.locator('.map-side')).toContainText('source link withheld');
    }
    await openRecord('REG-INVALID-DATE');
    await expect(page.locator('.map-detail-field').filter({hasText:'Start date'})).toContainText('Invalid date');
    await expect(page.locator('.map-detail-field').filter({hasText:'End date'})).toContainText('Invalid date');
    await page.getByText('Original date values',{exact:true}).click();
    await expect(page.locator('.map-side')).toContainText('2026-02-30');
    await openRecord('REG-CONFLICT-DATE');
    await expect(page.locator('.map-detail-field').filter({hasText:'End date'})).toContainText('Conflicting dates');
    await openRecord('REG-SENTINEL');
    await expect(page.locator('.map-detail-field').filter({hasText:'End date'})).toContainText('Beyond 2100 — excluded from expiry calculations');
    await openRecord('REG-NOEND');
    await expect(page.locator('.map-detail-field').filter({hasText:'End date'})).toContainText('No expiry recorded');
    await page.locator('.map-metric').nth(3).click();
    await expect(page.locator('.map-side-heading h2')).toHaveText('Needs review');
    await page.locator('.map-record-table').getByRole('button',{name:'Missing ID',exact:true}).click();
    await expect(page.locator('.map-record-id')).toHaveText('Registration ID missing');
    await expect(page.locator('.map-side')).toContainText('excluded from registration totals');
    await expect(page.getByRole('button', {name:'Copy ID',exact:true})).toHaveCount(0);
    checks.push('Safe/canonical URLs, invalid/conflicting/open-ended dates, missing-ID review and manual copy');

    await reset();
    await page.locator('.map-country[data-country="372"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.map-side-heading h2')).toHaveText('Ireland');
    const singapore = page.locator('.map-country-dot[data-country="702"]');
    await expect(singapore).toHaveCount(1);
    await singapore.focus(); await page.keyboard.press('Space');
    await expect(page.locator('.map-side-heading h2')).toHaveText('Singapore');
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    assert.equal((await page.evaluate(() => window.__registrationMap.getState())).zoom,1.4);
    const transformBefore = await page.locator('.map-world > g').getAttribute('transform');
    const mapBox = await page.locator('.map-world').boundingBox();
    await page.mouse.move(mapBox.x + 40, mapBox.y + mapBox.height / 2);
    await page.mouse.down(); await page.mouse.move(mapBox.x + 130,mapBox.y + mapBox.height / 2 + 30,{steps:8}); await page.mouse.up();
    assert.notEqual(await page.locator('.map-world > g').getAttribute('transform'),transformBefore,'Dragging pans the map');
    assert.equal((await page.evaluate(() => window.__registrationMap.getState())).selectedCountry,'702','Dragging must not select an incidental country');
    await page.getByRole('button',{name:'World',exact:true}).click();
    await expect(page.locator('.map-world > g')).toHaveAttribute('transform','translate(0 0) scale(1)');
    await page.locator('.map-country[data-country="372"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.map-side-heading h2')).toHaveText('Ireland');
    checks.push('Keyboard country activation, tiny-country target, zoom, pan and World reset');

    await page.evaluate(() => window.__registrationMap.setHighContrast({foreground:'#ffff00',background:'#000000'}));
    await expect(page.locator('.registration-map')).toHaveClass(/map-high-contrast/);
    assert.equal(await page.locator('.registration-map').evaluate(node => getComputedStyle(node).backgroundColor),'rgb(0, 0, 0)');
    await expect.poll(() => page.locator('.map-country[data-country="372"]').evaluate(node => getComputedStyle(node).fill)).toBe('rgb(255, 255, 0)');
    await expect.poll(() => page.locator('.map-country[data-country="392"]').evaluate(node => getComputedStyle(node).fill)).toBe('rgb(0, 0, 0)');
    assert.equal(await page.locator('.map-legend-item i').first().evaluate(node => getComputedStyle(node).backgroundColor),'rgb(0, 0, 0)','Zero-count legend must match high-contrast geography');
    await page.evaluate(() => window.__registrationMap.setHighContrast(null));
    await expect(page.locator('.registration-map')).not.toHaveClass(/map-high-contrast/);
    checks.push('High-contrast map and legend use the host palette');

    const exportRows = Array.from({length:65},(_,index) => fixture({
      RegistrationID:'EXPORT-'+String(index+1).padStart(3,'0'), Product:'Export product',
      RegistrationCountry:index < 45 ? 'Ireland' : 'France', CatalogNumber:'CAT-EXPORT-'+index
    })).concat(Array.from({length:7},(_,index) => fixture({RegistrationID:'EXCLUDED-'+index,Product:'Other product'})));
    currentRows = exportRows;
    await page.evaluate(rows => window.__sendMapRows(rows),exportRows);
    await reset(); await selectFilter('products','Export product'); await registrations();
    await expect(page.locator('.map-record-table tbody tr')).toHaveCount(40);
    const exportExpected = await expectedResult();
    assert.equal(exportExpected.records.length,65);
    await page.getByRole('button',{name:'Copy IDs',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Copyable content',exact:true})).toHaveValue(exportExpected.records.map(record => record.id).join('\n'));
    await page.locator('.map-copy-fallback').getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'CSV',exact:true}).click();
    await assertExport(exportExpected.records,'CSV must contain exactly the filtered registration records');
    await page.locator('.map-copy-fallback').getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await expect(page.locator('.map-record-table tbody tr')).toHaveCount(25);
    await page.getByRole('button',{name:'CSV',exact:true}).click();
    await assertExport(exportExpected.records,'CSV scope must be all filtered records, independent of pagination');
    await page.locator('.map-copy-fallback').getByRole('button',{name:'Close',exact:true}).click();
    await page.locator('.map-country[data-country="250"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.map-record-table tbody tr')).toHaveCount(20);
    await page.getByRole('button',{name:'CSV',exact:true}).click();
    await assertExport(exportExpected.records.filter(record => record.countryIds.includes('250')),'CSV respects selected-country scope');
    await page.locator('.map-copy-fallback').getByRole('button',{name:'Close',exact:true}).click();
    checks.push('Copy/CSV preserve exactly 65 filtered records across pages and respect selected-country scope');

    const bigRows = Array.from({length:10_000},(_,index) => fixture({
      RegistrationID:'LOAD-'+String(index+1).padStart(5,'0'), Product:'Load product '+index%4,
      RegistrationCountry:['Ireland','France','Singapore','United States'][index%4]
    }));
    await reset();
    const started = performance.now();
    await page.evaluate(rows => window.__sendMapRows(rows),bigRows);
    await expect(page.locator('.map-metric').nth(1).locator('strong')).toHaveText('10,000');
    const renderMilliseconds = Math.round(performance.now()-started);
    assert(renderMilliseconds < 30_000, `10k-record render exceeded generous 30s bound: ${renderMilliseconds}ms`);
    await registrations();
    await expect(page.locator('.map-record-table tbody tr')).toHaveCount(40);
    await assertLayout('10,000 registrations retain bounded table DOM and usable layout');
    assert.deepEqual(externalRequests,[],'Preview must make no external network requests');
    assert.deepEqual(errors,[],'Preview must have no JavaScript or console errors');
    console.log(JSON.stringify({passed:true,checks,features:241,render10000Milliseconds:renderMilliseconds,
      externalRequests:externalRequests.length,javascriptErrors:errors.length,
      screenshots:['preview-dark.png','preview-light.png','preview-compact.png']},null,2));
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
