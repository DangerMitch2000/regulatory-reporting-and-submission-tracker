const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const folders = ['change-dashboard', 'registration-map', 'regulatory-tracker', 'roadmap', 'ivdr-overview', 'key-submissions', 'site-regulatory-plan', 'site-submission-outlook'];
const readme = read('README.md');
assert.equal(readme.match(/^## .+$/m)?.[0], '## Table of visuals', 'Keep the visual table first');
const table = readme.match(/^\| Visual \| Download \| Demo \|\r?\n[\s\S]*?(?=\r?\n\r?\n)/m)?.[0];
assert(table, 'Visual download table is missing');
assert.equal(table.trim().split(/\r?\n/).length, folders.length + 2, 'Keep one entry for each visual');
for (const folder of folders) {
  assert(table.includes(`](${folder}/README.md)`), `Missing guide: ${folder}`);
  assert(fs.existsSync(path.join(root, folder, 'README.md')), `Missing folder guide: ${folder}`);
}
assert.equal((table.match(/releases\/download\//g) || []).length, 8, 'Keep the package links');
assert.equal((table.match(/github\.io\//g) || []).length, 8, 'Keep the demo links');

const guides = ['README.md', 'docs/README.md', 'docs/development.md', 'docs/history/pre-cleanup-readme.md', ...folders.map(folder => `${folder}/README.md`)];
let links = 0;
for (const file of guides) {
  for (const match of read(file).matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (/^(?:[a-z]+:|#)/i.test(target)) continue;
    const destination = decodeURIComponent(target.split('#')[0].split('?')[0]);
    if (!destination) continue;
    assert(fs.existsSync(path.resolve(root, path.dirname(file), destination)), `Broken relative link in ${file}: ${target}`);
    links++;
  }
}

const aliases = {
  'index.html': 'regulatory-tracker/index.html',
  'roadmap-preview.html': 'roadmap/roadmap-preview.html',
  'ivdr-preview.html': 'ivdr-overview/ivdr-preview.html',
  'key-preview.html': 'key-submissions/key-preview.html',
  'site-plan-preview.html': 'site-regulatory-plan/site-plan-preview.html'
};
for (const [alias, target] of Object.entries(aliases)) {
  const html = read(alias);
  assert(html.includes(target), `Missing redirect from ${alias}`);
  assert(html.includes('target.search=location.search') && html.includes('target.hash=location.hash'), `Preserve query/hash in ${alias}`);
  assert(fs.existsSync(path.join(root, target)), `Missing demo: ${target}`);
}
console.log(`Repository checks passed: ${folders.length} visual guides, ${links} relative links, ${Object.keys(aliases).length} legacy demo URLs.`);
