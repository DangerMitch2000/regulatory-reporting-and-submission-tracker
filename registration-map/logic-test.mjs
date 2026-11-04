import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { FIELD_NAMES, roles, names, mapTable, parseDate, analyze, derive, toCsv, csvEscape, safeURL } from './logic.mjs';

const countries = [
  { id: '250', name: 'France', iso2: 'FR', iso3: 'FRA', aliases: ['French Republic'] },
  { id: '276', name: 'Germany', iso2: 'DE', iso3: 'DEU' },
  { id: '826', name: 'United Kingdom', iso2: 'GB', iso3: 'GBR', aliases: ['UK', 'Great Britain'] },
  { id: '840', name: 'United States of America', iso2: 'US', iso3: 'USA', aliases: ['United States'] }
];
const now = '2026-11-04';
const row = (changes = {}) => ({ RegistrationID: 'REG-1', RegistrationCountry: 'France',
  RegistrationState: 'Approved', RegistrationStart: '2020-01-01', RegistrationEnd: '2030-12-31',
  Product: 'Product A', ProductID: 'PA', Manufacturer: 'Legal A',
  RegistrationManufacturingSite: 'Factory A', BusinessUnit: 'Unit A', CatalogNumber: '00101',
  AppID: 'APP-1', ROID: 'RO-1', SubID: 'SUB-1', ...changes });
const model = rows => analyze(rows, { countries, now });
const view = (rows, state = {}) => derive(model(rows), state);

test('Power BI mapping retains exact fields and requires identifier plus country role', () => {
  assert.equal(FIELD_NAMES.length, 18);
  assert.equal(roles, FIELD_NAMES);
  assert.equal(names.Manufacturer, 'Legal manufacturer');
  const mapped = mapTable({ columns: [{ roles: { RegistrationID: true } }, { roles: { Country: true } }], rows: [['R1', 'France']] });
  assert.deepEqual(mapped.missing, ['Registration state']);
  assert.deepEqual(mapped.mappedFields, ['RegistrationID', 'Country']);
  assert.equal(mapped.rows[0].RegistrationID, 'R1');
  assert.equal(mapped.rows[0].RegistrationState, null);
  assert.equal(view(mapped.rows).kpis.registrations, 0, 'Unmapped state must not become Approved');
  assert.equal(mapTable({ columns: [], rows: [[]] }).missing.length, 3);
  assert.throws(() => mapTable({ columns: [{ roles: { Product: true } }, { roles: { Product: true } }] }), /one column/);
});

test('Duplicate memberships never inflate registration counts or lose catalog codes', () => {
  const rows = [row(), row(), row({ Product: 'Product B', ProductID: 'PB', CatalogNumber: '00102' })];
  const result = view(rows);
  assert.equal(result.kpis.registrations, 1);
  assert.equal(result.kpis.products, 2);
  assert.equal(result.countries.find(item => item.id === '250').count, 1);
  assert.deepEqual(result.records[0].catalogNumbers, ['00101', '00102']);
  assert.equal(result.records[0].catalogAssociations.length, 2);
  assert.equal(result.records[0].rows.length, 3, 'All source evidence remains available');
});

test('State conflicts remain visible after filtering to one product', () => {
  const m = model([row(), row({ Product: 'Product B', RegistrationState: 'Expired' })]);
  const result = derive(m, { products: ['Product A'] });
  assert.equal(result.kpis.registrations, 0);
  assert.equal(result.review.length, 1);
  assert.equal(result.review[0].state, 'Conflicting values');
  assert.deepEqual(result.review[0].states, ['Approved', 'Expired']);
  const all = derive(m, { products: ['Product A'], states: [] });
  assert.equal(all.kpis.registrations, 1);
  assert.equal(all.records[0].approved, false);
});

test('Missing and unknown states do not imply approval; partial blanks are flagged', () => {
  const m = model([row({ RegistrationID: 'BLANK', RegistrationState: '' }),
    row({ RegistrationID: 'UNKNOWN', RegistrationState: 'Pending confirmation' }),
    row({ RegistrationID: 'PARTIAL' }), row({ RegistrationID: 'PARTIAL', RegistrationState: null }),
    row({ RegistrationID: 'CONDITIONAL', RegistrationState: ' conditionally approved ' })]);
  assert.deepEqual(derive(m).records.map(item => item.id), ['CONDITIONAL', 'PARTIAL']);
  assert.equal(m.records.find(item => item.id === 'PARTIAL').state, 'Approved');
  assert(m.records.find(item => item.id === 'PARTIAL').issues.some(value => /missing on some/.test(value)));
  assert.equal(m.records.find(item => item.id === 'BLANK').state, 'Not recorded');
  assert.equal(m.records.find(item => item.id === 'UNKNOWN').approved, false);
});

test('Filters are conjunctive on original membership rows, with OR within each dimension', () => {
  const m = model([row(), row({ Product: 'Product B', Manufacturer: 'Legal B', RegistrationManufacturingSite: 'Factory B', BusinessUnit: 'Unit B' })]);
  assert.equal(derive(m, { products: ['Product A'], sites: ['Factory B'] }).kpis.registrations, 0);
  assert.equal(derive(m, { products: ['Product A'], units: ['Unit B'] }).kpis.registrations, 0);
  assert.equal(derive(m, { products: ['Product A'], sites: ['Legal A'], units: ['Unit A'] }).kpis.registrations, 1);
  assert.equal(derive(m, { products: ['Product A', 'Product B'], sites: ['Factory B'] }).kpis.registrations, 1);
  const selected = derive(m, { products: ['Product B'] });
  assert.equal(selected.kpis.products, 1);
  assert.equal(selected.kpis.sites, 2);
  assert.deepEqual(selected.records[0].products, ['Product A', 'Product B'], 'Details retain full memberships');
  assert.equal(selected.records[0].matchingRows.length, 1);
});

test('Legal and registration manufacturing sites filter together and remain separate in details', () => {
  const result = view([row(), row({ Manufacturer: 'Legal B', RegistrationManufacturingSite: 'Factory A' })], { sites: ['Factory A'] });
  assert.equal(result.kpis.registrations, 1);
  assert.deepEqual(result.records[0].legalSites, ['Legal A', 'Legal B']);
  assert.deepEqual(result.records[0].registrationSites, ['Factory A']);
  assert.deepEqual(result.options.sites, ['Factory A', 'Legal A', 'Legal B']);
  assert.equal(view([row({ Product: '', ProductID: 'PRODUCT-42' })], { products: ['PRODUCT-42'] }).kpis.products, 1);
});

test('Search stays on matching rows and searches exact identifiers, catalog codes and countries', () => {
  const m = model([row(), row({ Product: 'Product B', CatalogNumber: '00199', SubID: 'SUB-B' })]);
  assert.equal(derive(m, { products: ['Product A'], search: '00199' }).kpis.registrations, 0);
  assert.equal(derive(m, { search: 'sub-b' }).kpis.registrations, 1);
  assert.equal(derive(m, { search: 'france' }).kpis.registrations, 1);
  assert.equal(derive(m, { search: '00101' }).records[0].matchingRows.length, 1);
});

test('Country matching accepts explicit aliases and ISO codes, with no fuzzy joining', () => {
  for (const label of ['France', ' france ', 'FR', 'FRA', '250', 'French Republic']) {
    assert.deepEqual(model([row({ RegistrationCountry: label })]).records[0].countryIds, ['250']);
  }
  assert.deepEqual(model([row({ RegistrationCountry: 'UK' })]).records[0].countryIds, ['826']);
  for (const label of ['Frnace', 'France and Germany', 'European Union']) {
    const result = view([row({ RegistrationCountry: label })]);
    assert.equal(result.kpis.registrations, 1);
    assert.equal(result.kpis.mappedRegistrations, 0);
    assert.equal(result.kpis.unmappedRegistrations, 1);
    assert.equal(result.review.length, 1);
  }
});

test('Numeric country codes are padded independently of registration IDs', () => {
  const m = analyze([row({ RegistrationID: 76, RegistrationCountry: 76 }), row({ RegistrationID: '076', RegistrationCountry: '076' })],
    { countries: [{ id: '076', name: 'Brazil', iso2: 'BR', iso3: 'BRA' }], now });
  assert.equal(m.records.length, 2, 'Registration ID values must never receive country code normalization');
  for (const record of m.records) assert.deepEqual(record.countryIds, ['076']);
  assert.equal(derive(m).countries[0].count, 2);
  const unknown = analyze([row({ RegistrationCountry: 7, Country: 'Brazil' })],
    { countries: [{ id: '076', name: 'Brazil', iso2: 'BR', iso3: 'BRA' }], now });
  assert.equal(unknown.records[0].countryStatus, 'unmapped', 'Numeric codes cannot fall back or match by prefix');
});

test('Fallback Country applies only when RegistrationCountry is blank', () => {
  const fallback = model([row({ RegistrationCountry: ' ', Country: 'Germany' })]).records[0];
  assert.deepEqual(fallback.countryIds, ['276']);
  assert.equal(fallback.usesCountryFallback, true);
  const primary = model([row({ RegistrationCountry: 'France', Country: 'Germany' })]).records[0];
  assert.deepEqual(primary.countryIds, ['250']);
  const unknown = model([row({ RegistrationCountry: 'Unknown region', Country: 'Germany' })]).records[0];
  assert.deepEqual(unknown.countryIds, []);
  assert.equal(unknown.countryStatus, 'unmapped');
});

test('Country conflicts cannot be hidden through product or country filters', () => {
  const m = model([row(), row({ RegistrationCountry: 'Germany', Product: 'Product B' })]);
  const result = derive(m, { products: ['Product A'], countries: ['250'] });
  assert.equal(result.kpis.registrations, 1);
  assert.equal(result.kpis.countries, 0);
  assert.equal(result.records[0].countryStatus, 'conflict');
  assert.equal(result.review.length, 1);
  assert.equal(result.countries.reduce((sum, country) => sum + country.count, 0), 0);
  assert.deepEqual(model([row(), row({ RegistrationCountry: 'FR' })]).records[0].countryIds, ['250']);
  assert.equal(model([row(), row({ RegistrationCountry: 'Unknown' })]).records[0].countryStatus, 'conflict');
});

test('Ambiguous aliases are not assigned to an arbitrary country', () => {
  const m = analyze([row({ RegistrationCountry: 'shared alias' })], { countries: [
    { id: 'A', name: 'Alpha', aliases: ['shared alias'] }, { id: 'B', name: 'Beta', aliases: ['shared alias'] }
  ], now });
  assert.deepEqual(m.records[0].countryIds, []);
  assert.equal(m.records[0].countryStatus, 'unmapped');
});

test('Missing identifiers are retained in review and excluded from registration totals', () => {
  const result = view([row({ RegistrationID: '' }), row({ RegistrationID: null }), row()]);
  assert.equal(result.kpis.registrations, 1);
  assert.equal(result.kpis.missingIDRows, 2);
  assert.equal(result.review.filter(item => item.missingID).length, 2);
  assert.equal(new Set(result.review.map(item => item.key)).size, 2);
  assert.equal(result.countries.find(item => item.id === '250').count, 1);
  assert.equal(view([row({ RegistrationID: '__proto__' }), row({ RegistrationID: 'constructor' })]).kpis.registrations, 2);
});

test('Strict calendar parsing rejects rollover, malformed timestamps and ambiguous local dates', () => {
  for (const value of ['2025-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-02', '2026-11-00',
    '2026-11-04junk', '04/11/2026', '2026-11-04T25:00:00Z', '2026-11-04T12:60:00Z', '2026-11-04T12:01:60Z',
    '2026-11-04T12:00:00+15:00', new Date('invalid'), 46330]) {
    assert.equal(parseDate(value).kind, 'invalid', String(value));
  }
  assert.equal(parseDate('2024-02-29').kind, 'dated');
  assert.equal(parseDate('1900-02-29').kind, 'invalid');
  assert.equal(parseDate('2000-02-29').kind, 'dated');
  assert.equal(parseDate('2026-11-04T12:30:59.123Z').value, Date.UTC(2026, 10, 4));
  assert.equal(parseDate(new Date('2026-11-04T12:30:00Z')).value, Date.UTC(2026, 10, 4));
  assert.equal(parseDate(null).kind, 'missing');
});

test('Dates beyond 2100 are excluded from expiry calculations, never perpetual approval', () => {
  for (const end of ['', null, '2101-01-01', '8900-12-31']) {
    const result = view([row({ RegistrationEnd: end })]);
    assert.equal(result.kpis.noEnd, 1);
    assert.equal(result.records[0].daysToExpiry, null);
    assert.match(result.records[0].endInfo.label, end ? /Beyond 2100 — excluded from expiry calculations/ : /No expiry recorded/);
    assert.doesNotMatch(result.records[0].endInfo.label, /perpetual/i);
  }
  assert.equal(model([row({ RegistrationEnd: '2100-12-31' })]).records[0].endKind, 'dated');
  assert.equal(view([row({ RegistrationState: 'Expired', RegistrationEnd: '8900-12-31' })]).kpis.registrations, 0);
  assert.equal(view([row({ RegistrationEnd: '9000-02-30' })]).kpis.noEnd, 0, 'Invalid sentinel dates cannot be silently accepted');
});

test('Display and CSV dates use fixed three-letter English months while source evidence stays unchanged', () => {
  const result = view([row({ RegistrationStart: '2026-09-01T14:30:00Z', RegistrationEnd: '2030-11-04' })]);
  assert.equal(result.records[0].startInfo.label, '01 Sep 2026');
  assert.equal(result.records[0].endInfo.label, '04 Nov 2030');
  assert.deepEqual(result.records[0].startInfo.rawValues, ['2026-09-01T14:30:00Z']);
  assert(toCsv(result.records).includes('"01 Sep 2026","04 Nov 2030"'));
});

test('Expiry boundaries use calendar days, include today and 90 days, and retain source approval states', () => {
  const ends = ['2026-11-03', '2026-11-04', '2027-02-02', '2027-02-03'];
  const m = model(ends.map((end, i) => row({ RegistrationID: 'R' + i, RegistrationEnd: end })));
  const result = derive(m);
  assert.equal(result.kpis.registrations, 4);
  assert.equal(result.kpis.expired, 1);
  assert.equal(result.kpis.expiring, 2);
  assert.equal(derive(m, { expiry: 'next90' }).kpis.registrations, 2);
  assert.equal(derive(m, { expiry: 'expired' }).kpis.registrations, 1);
  assert.equal(result.records[0].state, 'Approved');
  assert(result.records[0].issues.some(issue => /past end date/.test(issue)));
});

test('Conflicting and reversed dates are review issues with no invented expiry calculation', () => {
  const m = model([row(), row({ RegistrationEnd: '2031-01-01', Product: 'Product B' })]);
  const selected = derive(m, { products: ['Product A'] }).records[0];
  assert.equal(selected.end, null);
  assert.equal(selected.endKind, 'conflict');
  assert.equal(selected.state, 'Approved');
  const reversed = view([row({ RegistrationStart: '2030-01-01', RegistrationEnd: '2029-12-31' })]);
  assert.equal(reversed.records[0].daysToExpiry, null);
  assert.equal(reversed.records[0].expiryStatus, 'invalid');
  assert(reversed.review[0].issues.some(issue => /precedes/.test(issue)));
  assert.equal(reversed.kpis.registrations, 1, 'Source state is classification, independent of date validation');
});

test('Only unique valid HTTP(S) links are available, even after membership filtering', () => {
  const first = 'https://example.test/registration/1';
  assert.equal(view([row({ RegistrationURL: first })]).records[0].url, first);
  const m = model([row({ RegistrationURL: first }), row({ RegistrationURL: 'https://example.test/other', Product: 'Product B' })]);
  assert.equal(derive(m, { products: ['Product A'] }).records[0].url, null);
  assert(derive(m).review[0].issues.some(issue => /Conflicting registration URLs/.test(issue)));
  for (const link of ['javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.test', 'https://example.test/hello world', 'https://example.test\\bad']) {
    assert.equal(safeURL(link), null);
    assert.equal(view([row({ RegistrationURL: link })]).records[0].url, null);
  }
});

test('CSV prevents formula execution and retains filtered product/catalog associations', () => {
  for (const value of ['=2+2', '+SUM(A1:A3)', '-1+2', '@malicious', '   =value', '\t=calc', '\rhello', '\nhello']) {
    assert(csvEscape(value).startsWith('"\''), value);
  }
  assert.equal(csvEscape('00101'), '"00101"');
  assert.equal(csvEscape('a,"b"\nc'), '"a,""b""\nc"');
  const result = view([row(), row({ Product: 'Product B', CatalogNumber: '00999' })], { products: ['Product A'] });
  const csv = toCsv(result.records);
  assert(csv.startsWith('"Registration ID","Registration number"'));
  assert(csv.includes('00101'));
  assert(!csv.includes('00999'));
  assert(!csv.includes('Product B'));
  assert(csv.includes('""product"":""Product A""'));
});

test('Analysis does not mutate input; model filters can be reapplied without stale results', () => {
  const source = Object.freeze([Object.freeze(row()), Object.freeze(row({ RegistrationID: 'R2', RegistrationCountry: 'Germany', Product: 'Product B' }))]);
  const m = model(source);
  assert.equal(Object.hasOwn(source[0], '_country'), false);
  assert.equal(derive(m, { products: ['Product B'] }).kpis.registrations, 1);
  assert.equal(derive(m).kpis.registrations, 2);
  assert.equal(derive(m, { countries: ['250'] }).countries.find(item => item.id === '276').count, 0);
  assert.equal(derive(m).countries.find(item => item.id === '276').count, 1);
});

test('13,000-row memberships keep exact counts and filter pairs within a practical budget', () => {
  const source = Array.from({ length: 13000 }, (_, i) => row({ RegistrationID: 'REG-' + Math.floor(i / 10),
    RegistrationCountry: i % 20 < 10 ? 'France' : 'Germany', Product: 'Product ' + (i % 10),
    Manufacturer: 'Legal ' + (i % 10), RegistrationManufacturingSite: 'Factory ' + (i % 10),
    CatalogNumber: 'CAT-' + i }));
  const started = performance.now(), m = model(source), result = derive(m);
  assert.equal(result.kpis.registrations, 1300);
  assert.equal(result.kpis.countries, 2);
  assert.equal(result.countries.find(item => item.id === '250').count, 650);
  assert.equal(result.countries.find(item => item.id === '276').count, 650);
  assert.equal(derive(m, { products: ['Product 2'], sites: ['Factory 3'] }).kpis.registrations, 0);
  assert.equal(derive(m, { products: ['Product 2'], sites: ['Factory 2'] }).kpis.registrations, 1300);
  assert(performance.now() - started < 10000, 'Analysis and repeated filters should complete within 10 seconds');
});
