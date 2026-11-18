const assert = require('node:assert/strict');

// The same user flow runs against the source Visual and the packaged plugin.
module.exports = async function checkSiteFilter(page, scope = page) {
  const originalTime = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
  // A custom six-site selection intentionally retains literal SCR. Only the
  // complete old main-six preset is migrated to the manufacturer's full name.
  const codes = ['ABO', 'ADJ', 'ADK', 'AJG', 'CUSTOM', 'SCR'];
  const manufacturer = 'Abbott Diagnostics Scarborough, Inc.';
  const roles = ['SubID', 'Site', 'PlannedSubmission', 'ActualSubmission', 'BusinessUnit', 'Product', 'CommercialRegion', 'FallbackCountry'];
  const row = (SubID, Site, patch = {}) => ({SubID, Site, PlannedSubmission: '2026-10-02', ActualSubmission: null, BusinessUnit: 'ID', Product: 'Product A', CommercialRegion: 'North', FallbackCountry: 'Ireland', ...patch});
  const rows = [
    ...codes.filter(code => code !== 'SCR').map(code => row(code + '-1', code)),
    row('ARDG-1', 'ARDG'),
    row('SCARBOROUGH-1', manufacturer), row('SCARBOROUGH-2', manufacturer),
    row('YEAR-JAN', 'ABO', {PlannedSubmission: '2026-01-02'}),
    row('YEAR-DEC', manufacturer, {PlannedSubmission: '2026-12-02'}),
    row('PREVIOUS-YEAR', 'ABO', {PlannedSubmission: '2025-12-31'}),
    row('NEXT-YEAR', manufacturer, {PlannedSubmission: '2027-01-01'}),
    row('LITERAL-1', '[Review] Annex'), row('OTHER-1', 'Other manufacturer', {BusinessUnit: 'CMI'})
  ];
  const prefs = sites => ({sites, unit: '*', product: '*', region: '*', country: '*', theme: 'dark', stateFilters: {}});
  const deliver = async (preferences, width = 1440, height = 800, deliveredRows = rows) => page.evaluate(({rows, roles, preferences, width, height}) => {
    const visual = window.visual || testApi.visual;
    visual.update({type: 2, viewport: {width, height}, dataViews: [{
      metadata: preferences ? {objects: {preferences: {state: JSON.stringify(preferences)}}} : {},
      table: {
        columns: roles.map(role => ({displayName: role === 'Site' ? 'Legal manufacturer name' : role, roles: {[role]: true}})),
        rows: rows.flatMap(row => [row, row]).map(row => roles.map(role => row[role] ?? null))
      }
    }]});
  }, {rows: deliveredRows, roles, preferences, width, height});
  const menu = scope.locator('.ssSites');
  const search = () => scope.getByRole('searchbox', {name: 'Search sites or manufacturers', exact: true});
  const checkbox = name => scope.getByRole('checkbox', {name: 'Include ' + name, exact: true});
  const open = async () => { if (await menu.getAttribute('open') === null) await menu.locator('summary').click(); };
  const planned = () => scope.locator('.ssMetricHit[data-scope=plan][data-metric=planned]');
  const closeDetails = async () => { const b = scope.getByRole('button', {name: 'Close details', exact: true}); if (await b.count()) await b.click(); };
  try {
    const reopened = await page.evaluate(({rows, roles, preferences}) => {
      const current = window.visual || testApi.visual, element = document.createElement('div');
      document.body.append(element);
      const failures = [], host = {eventService: {renderingStarted(){}, renderingFinished(){}, renderingFailed(o, e){failures.push(String(e));}}, colorPalette: {isHighContrast: false}, persistProperties(){}, fetchMoreData(){return false;}};
      const fresh = new current.constructor({element, host});
      try {
        fresh.update({type: 2, viewport: {width: 1440, height: 800}, dataViews: [{
          metadata: {objects: {preferences: {state: JSON.stringify(preferences)}}},
          table: {columns: roles.map(role => ({displayName: role, roles: {[role]: true}})), rows: rows.map(row => roles.map(role => row[role] ?? null))}
        }]});
        const root = element.querySelector('.siteSubmissions');
        return {failures, capture: root.classList.contains('capture'), controlsHeight: root.querySelector('.ssControls').offsetHeight,
          yearHeight: root.querySelector('.ssYearSummary').offsetHeight, scope: root.querySelector('.ssScopeSummary').textContent,
          sites: [...root.querySelectorAll('.ssHit')].map(hit => hit.dataset.site)};
      } finally { fresh.destroy(); element.remove(); }
    }, {rows, roles, preferences: {...prefs([manufacturer]), capture: false}});
    assert.deepEqual(reopened.failures, []);
    assert.equal(reopened.capture, true, 'a fresh visual with saved filters still starts in Screenshot mode');
    assert.equal(reopened.controlsHeight, 0);
    assert.ok(reopened.yearHeight > 0, 'calendar-year totals remain visible in Screenshot mode');
    assert.match(reopened.scope, /08 Oct 2026/, 'the yesterday as-of label remains available');
    assert.deepEqual(reopened.sites, Array(3).fill(manufacturer.toUpperCase()), 'saved site choices carry into the default Screenshot view');
    await deliver(prefs(codes));
    await open();
    assert.match(await scope.locator('.ssSiteSource').textContent(), /Legal manufacturer name/, 'the filter identifies the mapped column');
    assert.match(await checkbox('SCR').locator('xpath=..').textContent(), /No delivered rows/, 'a selected code absent from the source is identified');
    assert.match(await scope.locator('svg').getAttribute('aria-label'), /5 planned, 5 in process, 0 submitted/, 'full manufacturer names are not silently treated as SCR');
    assert.equal(await checkbox(manufacturer).isDisabled(), true, 'the six-site maximum is enforced before adding another site');

    const persistBefore = await page.evaluate(() => window.testApi?.persisted.length);
    await search().fill('sCaRbOrOuGh');
    assert.equal(await checkbox(manufacturer).isVisible(), true, 'search is case insensitive');
    assert.equal(await checkbox('Other manufacturer').isVisible(), false, 'unselected nonmatching source values are hidden');
    assert.equal(await checkbox('SCR').isVisible(), true, 'selected values remain available for removal while searching');
    assert.equal(await search().evaluate(input => document.activeElement === input), true, 'typing does not recreate the focused input');
    if (persistBefore !== undefined) assert.equal(await page.evaluate(() => testApi.persisted.length), persistBefore, 'search does not save report preferences on each keystroke');

    // SCR has no delivered value, so removing its saved selection also removes
    // the checkbox; Playwright's uncheck() would wait for a vanished control.
    await checkbox('SCR').click();
    assert.equal(await checkbox('SCR').count(), 0);
    assert.equal(await checkbox(manufacturer).isEnabled(), true);
    assert.equal(await search().inputValue(), 'sCaRbOrOuGh', 'search survives selecting or removing a site');
    await checkbox(manufacturer).focus();
    await page.keyboard.press('Space');
    assert.equal(await checkbox(manufacturer).isChecked(), true, 'a manufacturer can be selected with the keyboard');
    assert.equal(await scope.locator('.ssHit').count(), 18, 'replacement keeps six sites and three months');
    assert.match(await scope.locator('svg').getAttribute('aria-label'), /7 planned, 7 in process, 0 submitted/, 'duplicate source joins do not inflate selected-site totals');
    await scope.getByRole('button', {name: 'Close site filter', exact: true}).click();
    await planned().click();
    assert.deepEqual((await scope.locator('.ssRecordRow .ssSubmissionId').allTextContents()).sort(), ['ABO-1', 'ADJ-1', 'ADK-1', 'AJG-1', 'CUSTOM-1', 'SCARBOROUGH-1', 'SCARBOROUGH-2'].sort());
    await closeDetails();
    const annualPlanned = scope.locator('.ssYearMetricHit[data-metric=planned]');
    assert.match(await annualPlanned.getAttribute('aria-label'), /2026.*9/, 'calendar-year totals include off-window months');
    await annualPlanned.click();
    assert.deepEqual((await scope.locator('.ssRecordRow .ssSubmissionId').allTextContents()).sort(), ['ABO-1', 'ADJ-1', 'ADK-1', 'AJG-1', 'CUSTOM-1', 'SCARBOROUGH-1', 'SCARBOROUGH-2', 'YEAR-JAN', 'YEAR-DEC'].sort(), 'annual Details include distinct selected-site submissions from Jan through Dec only');
    await closeDetails();
    const annualOverdue = scope.locator('.ssYearMetricHit[data-metric=overdue]');
    const annualOverdueLabel = await annualOverdue.getAttribute('aria-label');
    assert.match(annualOverdueLabel, /Overdue in calendar-year plan.*8/, 'annual overdue has its own scope label and count');
    assert.doesNotMatch(annualOverdueLabel, /three.month/i);
    await annualOverdue.click();
    const annualOverdueHeading = await scope.locator('.ssDetails h3').textContent();
    assert.match(annualOverdueHeading, /Calendar year 2026.*Overdue in calendar-year plan/);
    assert.doesNotMatch(annualOverdueHeading, /three.month/i);
    assert.deepEqual((await scope.locator('.ssRecordRow .ssSubmissionId').allTextContents()).sort(), ['ABO-1', 'ADJ-1', 'ADK-1', 'AJG-1', 'CUSTOM-1', 'SCARBOROUGH-1', 'SCARBOROUGH-2', 'YEAR-JAN'].sort(), 'annual overdue includes earlier months but excludes future dates and other years');
    await closeDetails();

    await open();
    await search().fill('[Review]');
    assert.equal(await checkbox('[Review] Annex').isVisible(), true, 'search treats punctuation as literal text');
    assert.equal(await checkbox('[Review] Annex').isDisabled(), true, 'searching does not bypass the maximum');
    assert.equal(await checkbox('Other manufacturer').isVisible(), false);
    await scope.getByRole('button', {name: 'Clear sites', exact: true}).click();
    assert.equal(await scope.locator('.ssHit').count(), 0, 'clearing all sites remains empty rather than restoring the defaults');
    assert.match(await scope.locator('svg').textContent(), /Choose up to six sites/);
    await search().fill('scarborough');
    await checkbox(manufacturer).check();
    assert.equal(await scope.locator('.ssHit').count(), 3);
    assert.match(await scope.locator('svg').getAttribute('aria-label'), /2 planned, 2 in process, 0 submitted/);
    assert.match(await annualPlanned.getAttribute('aria-label'), /2026.*3/, 'annual totals follow the site selection');
    await scope.getByRole('button', {name: 'Close site filter', exact: true}).click();
    assert.equal(await menu.getAttribute('open'), null);

    const saved = await page.evaluate(() => {
      const entry = window.testApi?.persisted.at(-1);
      return entry ? JSON.parse(entry.merge[0].properties.state) : null;
    });
    if (saved) assert.deepEqual(saved.sites, [manufacturer], 'the actual full source value is saved without an SCR alias');
    await deliver(prefs([manufacturer]), 520);
    await open();
    assert.equal(await checkbox(manufacturer).isChecked(), true, 'the saved full source selection survives a data update');
    assert.match(await scope.locator('.ssSiteSource').textContent(), /Legal manufacturer name/);
    const bounds = await menu.locator('.ssSitePanel').evaluate(panel => {
      const popup = panel.getBoundingClientRect(), visual = panel.closest('.siteSubmissions').getBoundingClientRect();
      return {left: popup.left, right: popup.right, visualLeft: visual.left, visualRight: visual.right};
    });
    assert.ok(bounds.left >= bounds.visualLeft - 1 && bounds.right <= bounds.visualRight + 1, `site picker must fit the narrow visual: ${JSON.stringify(bounds)}`);
    assert.equal(await checkbox(manufacturer).isVisible(), true, 'long manufacturer names remain usable in the compact picker');
    await scope.getByRole('button', {name: 'Use main six sites', exact: true}).click();
    assert.equal(await scope.locator('.ssHit').count(), 18);
    assert.equal(await checkbox(manufacturer).isChecked(), true, 'reset includes the full Scarborough manufacturer');
    assert.equal(await checkbox('SCR').count(), 0, 'reset does not retain the obsolete absent code');
    assert.match(await scope.locator('svg').getAttribute('aria-label'), /7 planned, 7 in process, 0 submitted/);
    await scope.getByRole('button', {name: 'Close site filter', exact: true}).click();
    await deliver(prefs(['ABO', 'ADJ', 'ADK', 'AJG', 'ARDG', 'SCR']));
    await open();
    assert.equal(await checkbox(manufacturer).isChecked(), true, 'the old full main-six saved preset migrates to the actual source value');
    assert.equal(await checkbox('SCR').count(), 0);
    await scope.getByRole('button', {name: 'Close site filter', exact: true}).click();
    const defaultIds = ['ABO-1', 'ADJ-1', 'ADK-1', 'AJG-1', 'ARDG-1', 'SCARBOROUGH-1', 'SCARBOROUGH-2'];
    await planned().click();
    assert.deepEqual((await scope.locator('.ssRecordRow .ssSubmissionId').allTextContents()).sort(), defaultIds.sort(), 'the migrated default includes Scarborough rows and excludes the custom site');
    await closeDetails();
    assert.match(await annualPlanned.getAttribute('aria-label'), /2026.*9/);
    await annualPlanned.click();
    assert.deepEqual((await scope.locator('.ssRecordRow .ssSubmissionId').allTextContents()).sort(), [...defaultIds, 'YEAR-JAN', 'YEAR-DEC'].sort(), 'migration preserves distinct annual counts and includes the actual full-name source rows');
    await closeDetails();

    const defaults = ['ABO', 'ADJ', 'ADK', 'AJG', 'ARDG', manufacturer];
    await deliver(prefs(defaults), 760, 360, rows.map(row => ({...row, PlannedSubmission: '2025-12-01'})));
    const emptyGeometry = await scope.locator('svg').evaluate(svg => {
      const texts = [...svg.querySelectorAll('text')], message = texts.find(node => node.textContent === 'No planned submissions in these three months').getBBox();
      const monthTop = Math.min(...texts.filter(node => ['Sept', 'Oct', 'Nov'].includes(node.textContent)).map(node => node.getBBox().y));
      const gridLines = [...svg.querySelectorAll('line')].filter(line => line.getAttribute('y1') === line.getAttribute('y2') && Math.abs(+line.getAttribute('x2') - +line.getAttribute('x1')) > svg.viewBox.baseVal.width * .8);
      return {height: svg.viewBox.baseVal.height, messageTop: message.y, messageBottom: message.y + message.height, monthTop,
        baseline: Math.max(...gridLines.map(line => +line.getAttribute('y1'))), lineCount: svg.querySelector('.ssSiteLabel[data-site="ABBOTT DIAGNOSTICS SCARBOROUGH, INC."]').querySelectorAll('tspan').length};
    });
    assert.equal(emptyGeometry.height, 280, 'the regression exercises the shortest chart height');
    assert.equal(emptyGeometry.lineCount, 3, 'the full manufacturer occupies three lines in the narrow six-site chart');
    assert.ok(emptyGeometry.messageTop >= 0 && emptyGeometry.messageBottom < emptyGeometry.baseline && emptyGeometry.messageBottom < emptyGeometry.monthTop,
      `the no-plan message stays in the plot above the baseline and month labels: ${JSON.stringify(emptyGeometry)}`);
    for (const width of [760, 1440]) {
      await deliver(prefs(defaults), width);
      const label = scope.locator('.ssSiteLabel[data-site="ABBOTT DIAGNOSTICS SCARBOROUGH, INC."]');
      assert.equal(await label.count(), 1);
      assert.equal(await label.getAttribute('data-site'), manufacturer.toUpperCase());
      assert.equal(await label.getAttribute('aria-label'), manufacturer);
      assert.equal(await label.locator('title').textContent(), manufacturer, 'the tooltip retains the exact full source name');
      const lines = await label.locator('tspan').allTextContents();
      assert.equal(lines.join(' ').replace(/\s+/g, ' ').trim(), manufacturer, 'the displayed manufacturer is complete, without ellipsis');
      assert.ok(lines.length >= 1 && lines.length <= 3, `site name uses at most three lines at ${width}px`);
      const geometry = await label.evaluate(node => {
        const svg = node.closest('svg'), labels = [...svg.querySelectorAll('.ssSiteLabel')];
        const index = labels.indexOf(node), centre = +node.getAttribute('x');
        const previousCentre = +labels[index - 1].getAttribute('x'), laneWidth = centre - previousCentre;
        const box = node.getBBox();
        const backlog = [...svg.querySelectorAll('.ssBacklogHit')].find(n => n.dataset.site === node.dataset.site).getBBox();
        return {svgWidth: svg.viewBox.baseVal.width, left: box.x, right: box.x + box.width, bottom: box.y + box.height,
          laneLeft: centre - laneWidth / 2, laneRight: centre + laneWidth / 2, backlogTop: backlog.y};
      });
      assert.ok(geometry.svgWidth >= 1000, 'a narrow visual preserves the readable minimum SVG width');
      assert.ok(geometry.left >= geometry.laneLeft - 1 && geometry.right <= geometry.laneRight + 1, `full site name fits its lane at ${width}px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.bottom <= geometry.backlogTop - 2, `site name must not overlap the backlog at ${width}px: ${JSON.stringify(geometry)}`);
      if (width === 1440) await scope.locator('.ssStage').screenshot({path: require('node:path').join(__dirname, 'verify', 'scarborough-chart.png')});
    }
    console.log('PASS: site search, exact source selections, custom SCR preservation, full Scarborough defaults/reset/migration, saved-filter Screenshot startup, distinct monthly/yearly Details, compact empty plot and wrapped full-name layout at 760/1440px.');
  } finally {
    await page.clock.setFixedTime(new Date(originalTime));
    await page.evaluate(() => { const visual = window.visual || testApi.visual; visual.update({type: 4, viewport: {width: 1440, height: 800}}); });
  }
};
