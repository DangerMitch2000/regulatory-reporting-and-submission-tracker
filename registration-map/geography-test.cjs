'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const file = path.join(__dirname, 'geography.json');
const bytes = fs.readFileSync(file);
const map = JSON.parse(bytes);
const countries = map.countries;
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
assert.equal(map.width, 1000);
assert.equal(map.height, 520);
assert.equal(countries.length, 241, 'All pinned source features except Antarctica must survive');
assert(bytes.length < 1_000_000, 'Geography must remain a compact offline asset');
assert.equal(map.source.revision, '9380cca83db5f9aef52d5e762765100745f84b27');
assert.equal(map.source.sha256, '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb');
assert(map.source.url.includes(map.source.revision), 'Source must use an immutable revision');
assert.equal(map.source.license, 'Public domain');

const ids = new Set(), names = new Set(), codeOwners = new Map(), nameOwners = new Map();
let pathPoints = 0;
for (const country of countries) {
  const context = `${country.name} (${country.id})`;
  assert.match(country.id, /^(\d{3}|NE-[A-Z]{3})$/, context);
  assert(!ids.has(country.id), `Duplicate ID ${context}`);
  ids.add(country.id);
  assert.equal(typeof country.name, 'string');
  assert(country.name.trim().length > 0);
  assert(!names.has(country.name), `Duplicate display name ${context}`);
  names.add(country.name);
  assert.match(country.iso2, /^([A-Z]{2})?$/, context);
  assert.match(country.iso3, /^([A-Z]{3})?$/, context);
  for (const code of [country.iso2, country.iso3].filter(Boolean)) {
    assert(!codeOwners.has(code), `Ambiguous code ${code}: ${context} / ${codeOwners.get(code)}`);
    codeOwners.set(code, country.id);
  }
  assert(Array.isArray(country.aliases), context);
  for (const label of [country.name, country.iso2, country.iso3, ...country.aliases].filter(Boolean)) {
    assert.equal(typeof label, 'string');
    const key = normalize(label);
    assert(key, context);
    assert(!nameOwners.has(key) || nameOwners.get(key) === country.id, `Ambiguous alias ${label}: ${context}`);
    nameOwners.set(key, country.id);
  }
  for (const coordinate of ['cx', 'cy']) assert(Number.isFinite(country[coordinate]), `${context} ${coordinate}`);
  assert(country.cx >= 0 && country.cx <= map.width, `Anchor outside viewBox: ${context}`);
  assert(country.cy >= 0 && country.cy <= map.height, `Anchor outside viewBox: ${context}`);
  assert.match(country.path, /^M[\d.,MLZ-]+Z$/, `Empty or invalid path: ${context}`);
  const coordinates = [...country.path.matchAll(/[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
  assert(coordinates.length >= 3, `No polygon coordinates: ${context}`);
  pathPoints += coordinates.length;
  const rebuilt = coordinates.map(match => match[0]).join('');
  assert.equal(rebuilt, country.path.replaceAll('Z', ''), `Unparsed SVG path command: ${context}`);
  for (const match of coordinates) {
    const [x, y] = [+match[1], +match[2]];
    assert(Number.isFinite(x) && Number.isFinite(y), `Nonfinite polygon: ${context}`);
    assert(x >= 0 && x <= map.width && y >= 0 && y <= map.height, `Polygon outside viewBox: ${context}`);
    assert(/^\d+(?:\.\d)?$/.test(match[1]) && /^\d+(?:\.\d)?$/.test(match[2]), `Path precision regression: ${context}`);
  }
}

const byCode = code => countries.find(country => country.iso2 === code);
for (const code of ['SG', 'MT', 'BH', 'AD', 'MC', 'SM', 'VA', 'LI', 'NR', 'TV', 'MV', 'MH', 'PW', 'KI', 'SC', 'MU', 'BB', 'LC', 'GD', 'KN', 'HK', 'MO']) {
  const country = byCode(code);
  assert(country, `Small country/territory missing: ${code}`);
  assert(country.path && Number.isFinite(country.cx) && Number.isFinite(country.cy), `No small-country hit target: ${code}`);
}
assert.equal(byCode('BH').id, '048', 'Leading zeros in ISO numeric identifiers must survive');
assert.equal(byCode('AU').id, '036');
assert.equal(byCode('FR').iso3, 'FRA', 'France uses source ISO_A3_EH fallback');
assert.equal(byCode('NO').iso3, 'NOR', 'Norway uses source ISO_A3_EH fallback');
assert.equal(byCode('XK').id, 'NE-KOS', 'Do not fabricate Kosovo ISO numeric value');
assert.equal(byCode('XK').iso3, '', 'Do not mislabel a non-ISO code as ISO alpha-3');
assert.equal(byCode('TW').iso3, 'TWN');
assert.notEqual(byCode('TW').id, byCode('CN').id);
assert.notEqual(byCode('HK').id, byCode('CN').id);
assert.notEqual(byCode('KP').id, byCode('KR').id);
assert.notEqual(byCode('CD').id, byCode('CG').id);
for (const alias of ['congo', 'korea', 'virginislands']) assert(!nameOwners.has(alias), `Ambiguous generic name must not resolve: ${alias}`);
for (const id of ['NE-IOA', 'NE-ATC']) {
  const territory = countries.find(country => country.id === id);
  assert(territory);
  assert.equal(territory.iso2, '');
  assert.equal(territory.iso3, '');
}
assert(!countries.some(country => country.name === 'Antarctica'));
assert(pathPoints > 20_000, 'Coastline detail should survive simplification');

// The downloaded input is a build cache, never a runtime asset. If present, verify
// provenance and preserve the exact feature inventory against the pinned source.
const cache = path.resolve(__dirname, '../output/registration-map-geography/ne_50m_admin_0_countries.geojson');
if (fs.existsSync(cache)) {
  const sourceBytes = fs.readFileSync(cache);
  assert.equal(createHash('sha256').update(sourceBytes).digest('hex'), map.source.sha256);
  const source = JSON.parse(sourceBytes);
  assert.equal(source.features.length - 1, countries.length);
  for (const feature of source.features.filter(feature => feature.properties.ADM0_A3 !== 'ATA')) {
    const p = feature.properties;
    const name = p.NAME_EN || p.NAME_LONG || p.ADMIN;
    assert(names.has(name), `Source map feature silently lost: ${name}`);
  }
}
console.log(`Geography checks passed: ${countries.length} features, ${pathPoints} path points, ${bytes.length} bytes; source and small-country identities verified.`);
