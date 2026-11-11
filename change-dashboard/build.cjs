/* Reproducible, separate Change Dashboard Power BI project. */
const fs = require('node:fs'), path = require('node:path'), {pathToFileURL} = require('node:url');
const root = __dirname, out = path.join(root, 'powerbi');
const VERSION = '1.7.0', PACKAGE_VERSION = '1.7.0.0';
const GUID = 'changeDashboardF91D534685234516AE47CF62295ED804';
function write(name, value) {
  const file = path.join(out, name);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
}
async function build() {
  const descriptions=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'fields.json'),'utf8')).map(f=>[f.name,f.description]));
  const {roles, names, dates} = await import(pathToFileURL(path.join(root, 'logic.mjs')).href);
  if (new Set(roles).size !== roles.length) throw Error('Duplicate field roles');
  write('package.json', {
    name: 'change-dashboard', version: VERSION, private: true,
    scripts: {typecheck: 'tsc --noEmit', package: 'pbiviz package'},
    dependencies: {'powerbi-visuals-api': '5.11.0'},
    devDependencies: {'powerbi-visuals-tools': '7.2.1', typescript: '5.9.3', '@playwright/test': '1.55.1', esbuild: '0.25.10'}
  });
  write('pbiviz.json', {
    visual: {name: 'changeDashboard', displayName: 'Change Dashboard', guid: GUID,
      visualClassName: 'Visual', version: PACKAGE_VERSION,
      description: 'Change worklist with country assessment, dispatch, submission and approval evidence, scoped filters and data review.',
      supportUrl: 'https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/issues',
      gitHubUrl: 'https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker'},
    apiVersion: '5.11.0', author: {name: 'Dualta Mitchell', email: 'dualtamitchell@gmail.com'},
    assets: {icon: 'assets/icon.png'}, externalJS: null, style: 'style/visual.less', capabilities: 'capabilities.json', dependencies: null, stringResources: []
  });
  write('capabilities.json', {
    suppressDefaultTitle: true, privileges: [{name: 'ExportContent', essential: false}],
    dataRoles: roles.map(name => ({name, displayName: names[name] || name, kind: 'Grouping',
      description: dates.includes(name) ? 'Use a raw date column, not a date hierarchy. Do not summarize.' : descriptions[name] || 'Map the source column; no renaming is necessary. Do not summarize.'})),
    dataViewMappings: [{conditions: [Object.fromEntries(roles.map(name => [name, {max: 1}]))], table: {rows: {select: roles.map(role => ({for: {in: role}})), dataReductionAlgorithm: {window: {count: 30000}}}}}],
    objects: {}, supportsHighlight: false, supportsKeyboardFocus: true, supportsEmptyDataView: true, sorting: {default: {}}
  });
  write('tsconfig.json', {compilerOptions: {allowJs: true, checkJs: false, allowSyntheticDefaultImports: true, esModuleInterop: true, resolveJsonModule: true, target: 'es2022', module: 'esnext', moduleResolution: 'node', sourceMap: true, outDir: './.tmp/build', declaration: false, skipLibCheck: true, lib: ['es2022', 'dom']}, files: ['src/visual.ts']});
  for (const name of ['logic.mjs', 'table-tools.mjs', 'relationships.mjs', 'relationship-view.mjs', 'ui.mjs', 'fields.json', 'visual.ts']) write('src/' + name, fs.readFileSync(path.join(root, name)));
  for (const file of fs.readdirSync(path.join(root, 'tracker'))) write('src/tracker/' + file, fs.readFileSync(path.join(root, 'tracker', file)));
  write('style/visual.less', fs.readFileSync(path.join(root, 'styles.css')));
  for (const name of ['README.md', 'RELEASE-NOTES.md', 'THIRD-PARTY-NOTICES.md']) if (fs.existsSync(path.join(root, name))) write(name, fs.readFileSync(path.join(root, name)));
  // A tiny deterministic RGBA dashboard icon, requiring no external asset service.
  const zlib = require('node:zlib');
  const crc = data => {let value = 0xffffffff; for (const byte of data) {value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);} return (value ^ 0xffffffff) >>> 0;};
  const chunk = (type, data) => {const kind = Buffer.from(type), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([kind, data]))); return Buffer.concat([size, kind, data, checksum]);};
  const header = Buffer.alloc(13); header.writeUInt32BE(20); header.writeUInt32BE(20, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc(20 * 81);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const inside = x > 1 && x < 18 && y > 1 && y < 18;
    const land = inside && ((y > 3 && y < 7 && (x < 9 || x > 10)) || (y > 9 && y < 12) || (y > 13 && y < 16));
    pixels.set(land ? [32, 161, 146, 255] : inside ? [29, 57, 89, 255] : [255, 255, 255, 0], y * 81 + 1 + x * 4);
  }
  write('assets/icon.png', Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]));
  console.log(`Generated Change Dashboard ${VERSION} / ${PACKAGE_VERSION}; existing tracker field roles, separate GUID ${GUID}.`);
}
build().catch(error => { console.error(error); process.exitCode = 1; });
