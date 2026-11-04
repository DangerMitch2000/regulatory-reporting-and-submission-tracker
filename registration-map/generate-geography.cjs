/* Build-time only. Runtime imports geography.json and needs no network or d3. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const REVISION = '9380cca83db5f9aef52d5e762765100745f84b27';
const SOURCE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${REVISION}/geojson/ne_50m_admin_0_countries.geojson`;
const SOURCE_SHA256 = '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb';
const CACHE = path.resolve(__dirname, '../output/registration-map-geography/ne_50m_admin_0_countries.geojson');
const OUTPUT = path.join(__dirname, 'geography.json');
const WIDTH = 1000;
const HEIGHT = 520;
const SIMPLIFY_TOLERANCE = 0.12;
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const round = value => Math.round(value * 10) / 10;

function segmentDistanceSquared(point, first, last) {
  let x = first[0], y = first[1];
  const dx = last[0] - x, dy = last[1] - y;
  if (dx || dy) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = last[0]; y = last[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

// Douglas-Peucker on projected rings, capped at 0.12 viewBox units of deviation.
// All input rings survive, including tiny islands. This does not create geography.
function simplifyLine(points) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maximum = SIMPLIFY_TOLERANCE ** 2, chosen = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = segmentDistanceSquared(points[i], points[start], points[end]);
      if (distance > maximum) { maximum = distance; chosen = i; }
    }
    if (chosen !== -1) {
      keep[chosen] = 1;
      if (chosen - start > 1) stack.push([start, chosen]);
      if (end - chosen > 1) stack.push([chosen, end]);
    }
  }
  const result = points.filter((_, index) => keep[index]);
  return result.length >= 4 ? result : points;
}

function simplifyPath(svgPath) {
  return svgPath.split('Z').filter(Boolean).map(ring => {
    const points = [...ring.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match => [+match[1], +match[2]]);
    if (!points.length) throw new Error('Unexpected SVG path syntax');
    // The closed ring's repeated endpoint makes simplification independent of closing line.
    const closed = [...points, points[0]];
    const simplified = simplifyLine(closed).slice(0, -1).map(point => point.map(round));
    const deduplicated = simplified.filter((point, i) => !i || point[0] !== simplified[i - 1][0] || point[1] !== simplified[i - 1][1]);
    const output = deduplicated.length >= 3 ? deduplicated : points.map(point => point.map(round));
    return output.map((point, i) => `${i ? 'L' : 'M'}${point.join(',')}`).join('') + 'Z';
  }).join('');
}

async function main() {
  let bytes;
  if (!process.argv.includes('--download')) {
    try { bytes = await fs.readFile(CACHE); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!bytes) {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(CACHE), { recursive: true });
    await fs.writeFile(CACHE, bytes);
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== SOURCE_SHA256) throw new Error(`Source hash mismatch: ${hash}`);
  const d3Path = require.resolve('d3-geo', { paths: [path.resolve(__dirname, '../powerbi-visual')] });
  const { geoNaturalEarth1, geoPath } = await import(pathToFileURL(d3Path).href);
  const source = JSON.parse(bytes);
  const features = source.features.filter(feature => feature.properties.ADM0_A3 !== 'ATA');
  const collection = { type: 'FeatureCollection', features };
  const projection = geoNaturalEarth1().fitExtent([[14, 14], [986, 506]], collection);
  const projectPath = geoPath(projection).digits(4);
  const unsupportedCodes = new Set(['IOA', 'ATC']);
  const valid = (value, expression) => expression.test(String(value)) ? String(value) : '';
  const blockedAliases = new Set(['congo', 'korea', 'virginislands']);
  const countries = features.map(feature => {
    const p = feature.properties;
    // These two source features share Australia's ISO values but are separate geometry.
    // Keep them selectable by unique source identity, without stealing Australia's codes.
    const shared = unsupportedCodes.has(p.ADM0_A3);
    const iso2 = shared ? '' : valid(p.ISO_A2, /^[A-Z]{2}$/) || valid(p.ISO_A2_EH, /^[A-Z]{2}$/);
    const iso3 = shared ? '' : valid(p.ISO_A3, /^[A-Z]{3}$/) || valid(p.ISO_A3_EH, /^[A-Z]{3}$/);
    const numeric = shared ? '' : valid(p.ISO_N3, /^\d{3}$/) || valid(p.ISO_N3_EH, /^\d{3}$/);
    const name = p.NAME_EN || p.NAME_LONG || p.ADMIN;
    const aliases = [...new Set(['NAME', 'NAME_LONG', 'ADMIN', 'FORMAL_EN', 'NAME_CIAWF', 'NAME_ALT']
      .flatMap(field => typeof p[field] === 'string' ? p[field].split('|') : [])
      .map(value => value.trim()).filter(value => value && value !== '-99' && normalize(value) !== normalize(name) && !blockedAliases.has(normalize(value))))];
    // Natural Earth label anchors stay on the relevant main island/land mass, unlike
    // geometric centroids for archipelagos or countries crossing the antimeridian.
    const anchor = projection([Number(p.LABEL_X), Number(p.LABEL_Y)]);
    return {
      id: numeric || `NE-${p.ADM0_A3}`, name, iso2, iso3, aliases,
      path: simplifyPath(projectPath(feature)), cx: round(anchor[0]), cy: round(anchor[1])
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  // Remove any alias shared with another feature's name, code, or alias. Never guess.
  const owners = new Map();
  for (const country of countries) {
    for (const value of [country.name, country.iso2, country.iso3, ...country.aliases].filter(Boolean)) {
      const key = normalize(value);
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(country.id);
    }
  }
  for (const country of countries) country.aliases = country.aliases.filter(alias => owners.get(normalize(alias)).size === 1);
  const output = {
    width: WIDTH, height: HEIGHT,
    source: {
      name: 'Natural Earth 1:50m Admin 0 Countries', version: '5.1.1', url: SOURCE_URL,
      revision: REVISION, sha256: SOURCE_SHA256, license: 'Public domain',
      licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
      projection: 'Natural Earth I', simplificationTolerance: SIMPLIFY_TOLERANCE,
      coordinateDecimals: 1, excluded: ['Antarctica']
    }, countries
  };
  const serialized = JSON.stringify(output) + '\n';
  await fs.writeFile(OUTPUT, serialized);
  console.log(`Wrote ${countries.length} map features; ${Buffer.byteLength(serialized)} bytes; ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
