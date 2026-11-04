// Registration coverage is resolved per registration before interactive filters.
// Source rows remain the evidence for product/site/business-unit associations.
export const FIELD_NAMES = Object.freeze([
  'RegistrationID', 'RegistrationCountry', 'RegistrationState', 'RegistrationStart',
  'RegistrationEnd', 'RegistrationNumber', 'Product', 'ProductID', 'Manufacturer',
  'RegistrationManufacturingSite', 'BusinessUnit', 'Country', 'AppID', 'ROID',
  'SubID', 'CatalogNumber', 'RegistrationURL', 'RegistrationHolder'
]);
export const roles = FIELD_NAMES;
export const names = Object.freeze({
  RegistrationID: 'Registration ID', RegistrationCountry: 'Registration country',
  RegistrationState: 'Registration state', RegistrationStart: 'Registration start',
  RegistrationEnd: 'Registration end', RegistrationNumber: 'Registration number',
  Product: 'Product', ProductID: 'Product ID', Manufacturer: 'Legal manufacturer',
  RegistrationManufacturingSite: 'Registration manufacturing site', BusinessUnit: 'Business unit',
  Country: 'Country (fallback)', AppID: 'Application ID', ROID: 'Regulatory objective ID',
  SubID: 'Submission ID', CatalogNumber: 'Catalog number', RegistrationURL: 'Registration URL',
  RegistrationHolder: 'Registration holder'
});
export const DEFAULT_STATE = Object.freeze({
  states: Object.freeze(['Approved', 'Conditionally Approved']), products: Object.freeze([]),
  sites: Object.freeze([]), units: Object.freeze([]), countries: Object.freeze([]),
  expiry: 'all', search: ''
});
export const STATE_NAMES = Object.freeze(['Approved', 'Conditionally Approved', 'Expired',
  'Planned', 'Rejected', 'Withdrawn', 'Canceled', 'Not recorded', 'Conflicting values']);
const DAY = 86400000;
const MONTHS = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const text = value => value == null ? '' : String(value).trim();
const unique = values => [...new Set(values)];
const compare = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;
const sorted = values => unique(values.filter(Boolean)).sort(compare);
const norm = value => text(value).normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();
const countryKey = value => /^\d{1,3}$/.test(text(value)) ? text(value).padStart(3, '0') : norm(value);
const rawDate = value => value instanceof Date
  ? Number.isFinite(value.valueOf()) ? value.toISOString() : 'Invalid Date'
  : text(value);

export function mapTable(table) {
  const columns = table?.columns || [], indexes = new Map();
  for (const field of FIELD_NAMES) {
    const matches = columns.flatMap((column, index) => column?.roles?.[field] ? [index] : []);
    if (matches.length > 1) throw new Error('Map only one column to ' + names[field] + '.');
    if (matches.length) indexes.set(field, matches[0]);
  }
  const mapped = [...indexes.keys()], missing = [];
  if (!indexes.has('RegistrationID')) missing.push('Registration ID');
  if (!indexes.has('RegistrationState')) missing.push('Registration state');
  if (!indexes.has('RegistrationCountry') && !indexes.has('Country')) {
    missing.push('Registration country (or Country as fallback)');
  }
  const rows = (table?.rows || []).map(values => Object.fromEntries(FIELD_NAMES.map(field =>
    [field, indexes.has(field) ? values[indexes.get(field)] ?? null : null])));
  return { rows, mapped, mappedFields: mapped, missing };
}

/** Parse calendar dates without allowing JavaScript's silent rollover. */
export function parseDate(value) {
  const raw = rawDate(value);
  if (!raw) return { kind: 'missing', value: null, raw, year: null };
  // ISO date and ISO timestamp columns are supported. Localized ambiguous dates
  // and numeric Excel serials require conversion in the source model.
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) return { kind: 'invalid', value: null, raw, year: null };
  const year = +match[1], month = +match[2], day = +match[3];
  const stamp = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  const date = new Date(stamp), zone = match[8];
  const validTime = !match[4] || (+match[4] < 24 && +match[5] < 60 && +(match[6] || 0) < 60);
  const validZone = !zone || zone === 'Z' || (+zone.slice(1, 3) < 14 && +zone.slice(-2) < 60) ||
    (+zone.slice(1, 3) === 14 && +zone.slice(-2) === 0);
  if (!Number.isFinite(stamp) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day || !validTime || !validZone) {
    return { kind: 'invalid', value: null, raw, year };
  }
  return { kind: 'dated', value: stamp, raw, year };
}

function dateEvidence(rows, field, isEnd = false) {
  const parsed = rows.map(row => parseDate(row[field])), present = parsed.filter(item => item.kind !== 'missing');
  const rawValues = sorted(present.map(item => item.raw));
  const dates = unique(present.filter(item => item.kind === 'dated').map(item => item.value));
  const invalid = present.some(item => item.kind === 'invalid'), conflicting = dates.length > 1;
  const sentinel = !invalid && !conflicting && dates.length === 1 && new Date(dates[0]).getUTCFullYear() > 2100;
  const kind = invalid ? 'invalid' : conflicting ? 'conflict' : !dates.length ? 'missing' : sentinel ? 'sentinel' : 'dated';
  const value = kind === 'dated' ? dates[0] : null;
  const date = value == null ? null : new Date(value);
  const label = kind === 'dated' ? String(date.getUTCDate()).padStart(2, '0') + ' ' + MONTHS[date.getUTCMonth()] + ' ' + String(date.getUTCFullYear()).padStart(4, '0')
    : kind === 'missing' ? (isEnd ? 'No expiry recorded' : 'Not recorded')
    : kind === 'sentinel' ? (isEnd ? 'Beyond 2100 — excluded from expiry calculations' : 'Beyond 2100 — excluded from date calculations')
    : kind === 'conflict' ? 'Conflicting dates' : 'Invalid date';
  return { kind, value, rawValues, label, partial: present.length > 0 && present.length < rows.length };
}

function canonicalState(value) {
  const normalized = norm(value);
  if (!normalized) return '';
  if (normalized === 'cancelled') return 'Canceled';
  return STATE_NAMES.find(state => norm(state) === normalized) || text(value);
}

function countryIndex(countries) {
  const index = new Map();
  for (const country of countries) {
    for (const value of [country.id, country.name, country.iso2, country.iso3, ...(country.aliases || [])]) {
      const key = countryKey(value);
      if (!key || ['-99', '-1'].includes(key)) continue;
      if (!index.has(key)) index.set(key, new Set());
      index.get(key).add(String(country.id));
    }
  }
  return index;
}

function resolveCountry(row, index, byId) {
  const primary = text(row.RegistrationCountry), fallback = text(row.Country);
  const raw = primary || fallback, ids = index.get(countryKey(raw));
  const id = ids?.size === 1 ? [...ids][0] : null;
  return { raw, id, name: id ? byId.get(id)?.name || id : '',
    source: primary ? 'RegistrationCountry' : fallback ? 'Country' : '',
    status: !raw ? 'missing' : id ? 'mapped' : ids?.size > 1 ? 'ambiguous' : 'unmapped' };
}

export function safeURL(value) {
  const raw = text(value);
  if (!/^https?:\/\//i.test(raw) || /[\u0000-\u0020\u007f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function memberships(rows) {
  const values = field => sorted(rows.map(row => text(row[field])));
  const legalSites = values('Manufacturer'), registrationSites = values('RegistrationManufacturingSite');
  const catalogGroups = new Map();
  for (const row of rows) {
    const product = text(row.Product) || text(row.ProductID), productId = text(row.ProductID), code = text(row.CatalogNumber);
    if (!code) continue;
    const key = JSON.stringify([product, productId, row._country?.raw || '', code]);
    if (!catalogGroups.has(key)) catalogGroups.set(key, { product, productId, country: row._country?.raw || '', code });
  }
  return { products: sorted(rows.map(row => text(row.Product) || text(row.ProductID))),
    productIds: values('ProductID'), legalSites, registrationSites,
    sites: sorted([...legalSites, ...registrationSites]), units: values('BusinessUnit'),
    registrationNumbers: values('RegistrationNumber'), holders: values('RegistrationHolder'),
    relatedAppIDs: values('AppID'), relatedROIDs: values('ROID'), relatedSubIDs: values('SubID'),
    appIds: values('AppID'), roIds: values('ROID'), subIds: values('SubID'),
    catalogNumbers: values('CatalogNumber'), catalogAssociations: [...catalogGroups.values()] };
}

function makeRecord(id, rows, now, missingKey = '') {
  const issues = [], states = sorted(rows.map(row => canonicalState(row.RegistrationState)));
  const state = states.length > 1 ? 'Conflicting values' : states[0] || 'Not recorded';
  if (!id) issues.push('Registration ID not recorded; excluded from registration totals.');
  if (states.length > 1) issues.push('Conflicting registration states across source rows.');
  if (!states.length || state === 'Not recorded') issues.push('Registration state not recorded; approval cannot be assumed.');
  else if (rows.some(row => !text(row.RegistrationState))) issues.push('Registration state is missing on some source rows.');
  if (states.some(value => !STATE_NAMES.includes(value))) issues.push('Unrecognized registration state.');
  const identities = unique(rows.map(row => row._country.id ? 'id:' + row._country.id : row._country.raw ? 'raw:' + norm(row._country.raw) : '').filter(Boolean));
  const resolvedIds = sorted(rows.map(row => row._country.id));
  const countryStatus = identities.length > 1 ? 'conflict' : !identities.length ? 'missing' : resolvedIds.length ? 'mapped' : 'unmapped';
  if (countryStatus === 'conflict') issues.push('Conflicting registration countries across source rows; map placement withheld.');
  if (countryStatus === 'unmapped') issues.push('Country is not in the map country catalog; map placement withheld.');
  if (countryStatus === 'missing') issues.push('Registration country and fallback Country are not recorded.');
  if (countryStatus === 'mapped' && rows.some(row => row._country.status === 'missing')) issues.push('Country is missing on some source rows.');
  const countryIds = countryStatus === 'mapped' ? resolvedIds : [];
  const countryNames = countryStatus === 'mapped' ? sorted(rows.map(row => row._country.name)) : [];
  const startInfo = dateEvidence(rows, 'RegistrationStart'), endInfo = dateEvidence(rows, 'RegistrationEnd', true);
  for (const [label, info] of [['Registration start', startInfo], ['Registration end', endInfo]]) {
    if (['invalid', 'conflict'].includes(info.kind)) issues.push(label + ': ' + info.label + '.');
    if (info.kind === 'sentinel') issues.push(label + ': source year beyond 2100; excluded from date-based calculations.');
    if (info.partial) issues.push(label + ' is missing on some source rows.');
  }
  const reversed = startInfo.value != null && endInfo.value != null && endInfo.value < startInfo.value;
  if (reversed) issues.push('Registration end precedes registration start.');
  const approved = state === 'Approved' || state === 'Conditionally Approved';
  const daysToExpiry = !reversed && endInfo.value != null ? Math.round((endInfo.value - now) / DAY) : null;
  const expiryStatus = reversed ? 'invalid' : endInfo.kind === 'dated' ? daysToExpiry < 0 ? 'expired' : daysToExpiry <= 90 ? 'next90' : 'later'
    : ['missing', 'sentinel'].includes(endInfo.kind) ? 'noend' : endInfo.kind;
  if (approved && daysToExpiry != null && daysToExpiry < 0) issues.push('Approved source state with a past end date; state retained for review.');
  if (approved && startInfo.value != null && startInfo.value > now) issues.push('Approved source state with a future start date; state retained for review.');
  const urls = sorted(rows.map(row => text(row.RegistrationURL))), validated = urls.map(safeURL), uniqueUrls = unique(validated.filter(Boolean));
  const url = urls.length && validated.every(Boolean) && uniqueUrls.length === 1 ? uniqueUrls[0] : null;
  if (urls.length && validated.some(value => !value)) issues.push('Invalid registration URL; source link withheld.');
  else if (uniqueUrls.length > 1) issues.push('Conflicting registration URLs; source link withheld.');
  return { id, key: id ? 'id:' + id : missingKey, missingID: !id, state, states, approved,
    conflicted: states.length > 1 || countryStatus === 'conflict', countryStatus, countryIds, countryNames,
    countryValues: sorted(rows.map(row => row._country.raw)), usesCountryFallback: rows.some(row => row._country.source === 'Country'),
    start: startInfo.value, end: endInfo.value, startInfo, endInfo, endKind: endInfo.kind,
    daysToExpiry, expiryStatus, reversed, url, urls, issues: unique(issues), rowCount: rows.length,
    ...memberships(rows), rows };
}

export function analyze(sourceRows, { countries = [], now = new Date() } = {}) {
  const parsedNow = parseDate(now instanceof Date || typeof now === 'string' ? now : new Date(now));
  if (parsedNow.kind !== 'dated') throw new Error('A valid current calendar date is required.');
  const today = parsedNow.value, catalog = countries.map(country => ({ ...country, id: String(country.id) }));
  const byCountry = new Map(catalog.map(country => [country.id, country])), index = countryIndex(catalog);
  const rows = (sourceRows || []).map((source, rowIndex) => ({ ...source, _rowIndex: rowIndex,
    _country: resolveCountry(source, index, byCountry) }));
  const groups = new Map(), missingRows = [];
  for (const row of rows) {
    const id = text(row.RegistrationID);
    if (!id) { missingRows.push(row); continue; }
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  const records = [...groups].map(([id, evidence]) => makeRecord(id, evidence, today)).sort((a, b) => compare(a.id, b.id));
  const missingIDRecords = missingRows.map(row => makeRecord('', [row], today, 'missing:' + row._rowIndex));
  const review = [...records.filter(record => record.issues.length), ...missingIDRecords];
  const members = memberships(rows);
  const presentCountryIds = new Set(rows.map(row => row._country.id).filter(Boolean));
  const options = { products: members.products, sites: members.sites, units: members.units,
    states: sorted([...STATE_NAMES, ...records.map(record => record.state)]),
    countries: catalog.filter(country => presentCountryIds.has(country.id)).map(({ id, name }) => ({ id, name })).sort((a, b) => compare(a.name, b.name)) };
  return { records, missingIDRecords, review, options, countries: catalog, now: today, rows,
    sourceRowCount: rows.length, missingIDRows: missingRows.length };
}

function selection(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value.map(String) : value ? [String(value)] : []);
}

export function derive(model, state = {}) {
  const filters = { ...DEFAULT_STATE, ...state }, states = selection(filters.states), products = selection(filters.products),
    sites = selection(filters.sites), units = selection(filters.units), countries = selection(filters.countries);
  const query = norm(filters.search);
  function matches(row) {
    const product = text(row.Product) || text(row.ProductID);
    if (products.size && !products.has(product)) return false;
    if (sites.size && !sites.has(text(row.Manufacturer)) && !sites.has(text(row.RegistrationManufacturingSite))) return false;
    if (units.size && !units.has(text(row.BusinessUnit))) return false;
    if (countries.size && !countries.has(row._country.id)) return false;
    if (query && !['RegistrationID', 'RegistrationNumber', 'Product', 'ProductID', 'CatalogNumber', 'AppID', 'ROID', 'SubID', 'RegistrationCountry', 'Country']
      .some(field => norm(row[field]).includes(query)) && !norm(row._country.name).includes(query)) return false;
    return true;
  }
  const expiryMatches = record => !filters.expiry || filters.expiry === 'all' || record.expiryStatus === filters.expiry;
  const project = record => {
    if (!expiryMatches(record)) return null;
    const matchingRows = record.rows.filter(matches);
    return matchingRows.length ? { ...record, matchingRows } : null;
  };
  const records = model.records.filter(record => !states.size || states.has(record.state)).map(project).filter(Boolean);
  // Review deliberately spans all registration states. Membership and expiry
  // filters still apply, and canonical conflicts cannot disappear through them.
  const review = model.review.map(project).filter(Boolean);
  const aggregates = new Map(model.countries.map(country => [country.id, { id: country.id, name: country.name,
    count: 0, approvedCount: 0, expiringCount: 0, expiredCount: 0, noEndCount: 0, registrationIds: [] }]));
  for (const record of records) for (const id of record.countryIds) {
    const aggregate = aggregates.get(id);
    if (!aggregate) continue;
    aggregate.count++; aggregate.registrationIds.push(record.id);
    if (record.approved) aggregate.approvedCount++;
    if (record.expiryStatus === 'next90') aggregate.expiringCount++;
    if (record.expiryStatus === 'expired') aggregate.expiredCount++;
    if (record.expiryStatus === 'noend') aggregate.noEndCount++;
  }
  const matchedRows = records.flatMap(record => record.matchingRows), visibleMembers = memberships(matchedRows);
  const countryValues = [...aggregates.values()];
  const mappedRegistrations = records.filter(record => record.countryIds.length > 0).length;
  const kpis = { registrations: records.length, mappedRegistrations, unmappedRegistrations: records.length - mappedRegistrations,
    countries: countryValues.filter(country => country.count > 0).length, products: visibleMembers.products.length,
    sites: visibleMembers.sites.length, units: visibleMembers.units.length,
    expiring: records.filter(record => record.expiryStatus === 'next90').length,
    expired: records.filter(record => record.expiryStatus === 'expired').length,
    noEnd: records.filter(record => record.expiryStatus === 'noend').length,
    review: review.length, missingIDRows: review.filter(record => record.missingID).reduce((sum, record) => sum + record.rowCount, 0) };
  return { records, countries: countryValues, kpis, review, options: model.options, matchedRows, state: filters };
}

export function csvEscape(value) {
  let cell = value == null ? '' : String(value);
  // CSV quoting alone does not prevent a spreadsheet from executing formulas.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = "'" + cell;
  return '"' + cell.replace(/"/g, '""') + '"';
}

export function toCsv(records) {
  const header = ['Registration ID', 'Registration number', 'Country', 'Country mapping', 'State', 'Products',
    'Product IDs', 'Legal manufacturers', 'Registration manufacturing sites', 'Business units',
    'Registration start', 'Registration end', 'Expiry status', 'Registration holders', 'Catalog numbers',
    'Product / catalog associations', 'Application IDs', 'Regulatory objective IDs', 'Submission IDs', 'Source URL', 'Review notes'];
  const join = values => values.join(' | ');
  const body = records.map(record => {
    const members = memberships(record.matchingRows || record.rows);
    return [record.id, join(members.registrationNumbers), join(record.countryNames.length ? record.countryNames : record.countryValues),
      record.countryStatus, record.state, join(members.products), join(members.productIds), join(members.legalSites),
      join(members.registrationSites), join(members.units), record.startInfo.label, record.endInfo.label,
      record.expiryStatus, join(members.holders), join(members.catalogNumbers),
      JSON.stringify(members.catalogAssociations), join(members.relatedAppIDs), join(members.relatedROIDs),
      join(members.relatedSubIDs), record.url || '', join(record.issues)];
  });
  return [header, ...body].map(row => row.map(csvEscape).join(',')).join('\r\n');
}
