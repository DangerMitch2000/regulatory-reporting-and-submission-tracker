import assert from 'node:assert/strict';
import {DEFAULT_SITES, SCARBOROUGH_SITE, normalizeSites, normalizeSavedSites, siteKey, summarize} from './submissions.logic.mjs';

const legacy = ['ABO', 'ADJ', 'ADK', 'AJG', 'ARDG', 'SCR'];
assert.deepEqual(DEFAULT_SITES, [...legacy.slice(0, 5), 'Abbott Diagnostics Scarborough, Inc.']);
assert.deepEqual(normalizeSites(), DEFAULT_SITES, 'new visuals and reset use the full manufacturer value');
assert.deepEqual(normalizeSavedSites(legacy), DEFAULT_SITES, 'the old main-six saved preset upgrades');
assert.deepEqual(normalizeSavedSites([' scr ', 'ardg', 'AJG', 'ADK', 'ADJ', ' abo ']), [SCARBOROUGH_SITE, 'ardg', 'AJG', 'ADK', 'ADJ', 'abo'], 'migration ignores case/outer whitespace and preserves the selected order');
assert.deepEqual(normalizeSavedSites(DEFAULT_SITES), DEFAULT_SITES, 'the new preset is stable');
assert.deepEqual(normalizeSavedSites([]), [], 'an intentionally empty selection stays empty');
assert.deepEqual(normalizeSavedSites(['SCR']), ['SCR'], 'a custom raw-code selection stays literal');
assert.deepEqual(normalizeSavedSites(['SCR', 'OTHER']), ['SCR', 'OTHER']);
assert.deepEqual(normalizeSavedSites([...legacy.slice(0, 4), 'OTHER', 'SCR']), [...legacy.slice(0, 4), 'OTHER', 'SCR'], 'a different six-site choice is not a preset');
assert.deepEqual(normalizeSavedSites([...legacy, 'OTHER']), legacy, 'extra custom values do not accidentally identify an old preset after truncation');
assert.deepEqual(normalizeSites(legacy), legacy, 'ordinary selection normalization must not silently alias SCR');
assert.notEqual(siteKey('SCR'), siteKey(SCARBOROUGH_SITE));

const now = new Date(2026, 10, 18, 12);
const row = (SubID, Site, patch = {}) => ({SubID, Site, BusinessUnit:'ID', PlannedSubmission:'2026-11-01', ActualSubmission:null, DispatchRequired:'No', ...patch});
const rows = [row('FULL-OPEN', SCARBOROUGH_SITE), row('FULL-SUBMITTED', SCARBOROUGH_SITE, {ActualSubmission:'2026-11-02'}), row('RAW-CODE', 'SCR'), row('OTHER', 'ABO')];
const result = summarize(rows.flatMap(value => [value, value, value]), {now});
assert.equal(result.totals.planned, 3);
assert.equal(result.yearSummary.totals.planned, 3);
assert.equal(result.totals.submitted, 1);
assert.equal(result.checks.outsideSites, 1);
assert.deepEqual(result.coverage.outsideSites.map(record => record.id), ['RAW-CODE']);
const scarborough = result.buckets.find(bucket => bucket.site === SCARBOROUGH_SITE);
assert.deepEqual(scarborough.months.flatMap(month => month.rows.map(record => record.id)).sort(), ['FULL-OPEN', 'FULL-SUBMITTED']);
assert.equal(summarize(rows, {now, sites:['SCR']}).totals.planned, 1, 'the code remains directly selectable when delivered');
assert.equal(summarize(rows, {now, sites:[SCARBOROUGH_SITE]}).totals.planned, 2);
assert.equal(summarize([row('CONFLICT', SCARBOROUGH_SITE), row('CONFLICT', 'SCR')], {now}).checks.multipleSites, 1, 'different source names on one submission remain a site conflict');

console.log('PASS: Scarborough full-name defaults, targeted old-preset migration, preserved custom selections, literal site matching, duplicate-safe counts and site conflicts.');
