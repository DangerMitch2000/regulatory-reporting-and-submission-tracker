/* Lifecycle tests of the production Visual class, with only its UI boundary stubbed. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), {pathToFileURL} = require('node:url');
const {dependency} = require('./test-tools.cjs'), ts = dependency('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'visual.ts'), 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true}}).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => {let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve};};
const tick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  const {mapTable, safeURL} = await import(pathToFileURL(path.join(__dirname, 'logic.mjs')).href);
  function harness({accept = [true, true], mountGate, updateGate, renderError, exportStatus = 0, exportResult = true, copyError = false} = {}) {
    const events = [], requests = [], renders = [], sizes = [], maps = [], launches = [], exports = [], copies = [], nodes = [], themes = [];
    const element = () => {const node = {style: {}, attributes: {}, children: [], hidden: false, textContent: '', append(...children) {this.children.push(...children);}, appendChild(child) {this.children.push(child);}, setAttribute(key, value) {this.attributes[key] = value;}, remove() {this.removed = true;}}; nodes.push(node); return node;};
    let destroyed = 0, mounted = 0, callbacks;
    const app = {async resize(w, h) {sizes.push([w, h]);}, async update(rows, config) {if (updateGate) await updateGate.promise; if (renderError) {const error = renderError; renderError = null; throw error;} renders.push(plain({rows, config}));}, setHighContrast(theme) {themes.push(theme);}, destroy() {destroyed++;}};
    const host = {
      colorPalette: {isHighContrast: false},
      eventService: {renderingStarted: o => events.push(['start', o.id]), renderingFinished: o => events.push(['finish', o.id]), renderingFailed: (o, message) => events.push(['failed', o.id, message])},
      fetchMoreData(aggregate) {requests.push({aggregate, renderCount: renders.length, notice: visual.notice.textContent}); const next = accept.length ? accept.shift() : true; if (next instanceof Error) throw next; return next;},
      launchUrl: url => launches.push(url),
      downloadService: {exportStatus: async () => exportStatus, exportVisualsContent: async (...args) => {exports.push(args); return exportResult;}}
    };
    const module = {exports: {}};
    vm.runInNewContext(compiled, {
      exports: module.exports, require: name => name === './logic.mjs' ? {safeURL, mapTable: table => {maps.push(table); return mapTable(table);}} : name === './ui.mjs' ? {mount: async (_root, options) => {mounted++; callbacks = options; if (mountGate) await mountGate.promise; return app;}} : {},
      document: {createElement: element}, navigator: {clipboard: {writeText: async text => {if (copyError) throw Error('Denied'); copies.push(text);}}}, URL, console
    });
    const visual = new module.exports.Visual({host, element: element()});
    const update = (ids, {segment = false, type = 2, id = 'update', viewport = {width: 1000, height: 700}, columns} = {}) => {
      visual.update({id, type, viewport, dataViews: [{metadata: segment ? {segment: {}} : {}, table: {columns: columns || [{roles: {RegistrationID: true}}, {roles: {RegistrationCountry: true}}, {roles: {RegistrationState: true}}], rows: ids.map(value => [value, 'Ireland', 'Approved'])}}]});
      return visual.queue;
    };
    return {visual, update, host, app, events, requests, renders, sizes, maps, themes, launches, exports, copies, module: module.exports, get callbacks() {return callbacks;}, get mounted() {return mounted;}, get destroyed() {return destroyed;}};
  }
  for (const phase of ['mount', 'render']) {
    const gate = deferred(), h = harness(phase === 'mount' ? {mountGate: gate} : {updateGate: gate});
    h.update(['R1'], {segment: true}); await tick(); assert.equal(h.requests.length, 0);
    gate.resolve(); await h.visual.queue;
    assert.equal(h.requests[0].renderCount, 1, 'Partial rows render before fetch');
    assert.match(h.requests[0].notice, /loaded rows only/); assert.equal(h.requests[0].aggregate, true);
  }
  {
    const h = harness();
    for (let batch = 1; batch <= 3; batch++) {
      const ids = Array.from({length: batch * 2}, (_, i) => 'R' + i);
      await h.update(ids, {segment: batch < 3, id: 'batch' + batch});
      assert.deepEqual(h.renders.at(-1).rows.map(row => row.RegistrationID), ids, 'Accumulated tables replace, never concatenate');
      const requests = h.requests.length, maps = h.maps.length;
      await h.update(['IGNORED'], {type: 4, segment: true, id: 'resize', viewport: {width: 800, height: 550}});
      assert.equal(h.requests.length, requests); assert.equal(h.maps.length, maps);
      assert.equal(h.mounted, 1); assert.deepEqual(h.sizes.at(-1), [800, 550]);
    }
    assert.equal(h.requests.length, 2); assert.equal(h.visual.notice.hidden, true); assert.equal(h.visual.root.attributes['aria-busy'], 'false');
    assert.equal(h.events.filter(e => e[0] === 'start').length, h.events.filter(e => e[0] === 'finish').length);
    await h.update([]); assert.equal(h.renders.at(-1).rows.length, 0);
    h.visual.update({type: 2, viewport: {width: 1000, height: 700}, dataViews: []}); await h.visual.queue;
    assert.equal(h.renders.at(-1).rows.length, 0); assert.match(h.visual.notice.textContent, /Add fields/);
    assert.deepEqual(plain(h.visual.getFormattingModel()), {cards: []});
  }
  for (const refusal of [false, new Error('Unavailable')]) {
    const h = harness({accept: [refusal]}); await h.update(['R1'], {segment: true});
    assert.equal(h.renders.length, 1); assert.match(h.visual.notice.textContent, /limited the delivered rows/);
    await h.update(['IGNORED'], {type: 4, segment: true}); assert.equal(h.requests.length, 1);
  }
  for (const phase of ['mount', 'render']) {
    const gate = deferred(), h = harness(phase === 'mount' ? {mountGate: gate} : {updateGate: gate});
    h.update(['OLD'], {segment: true}); await tick(); h.update(['NEW']); gate.resolve(); await h.visual.queue;
    assert.equal(h.requests.length, 0, 'Superseded updates cannot fetch'); assert.deepEqual(h.renders.at(-1).rows.map(row => row.RegistrationID), ['NEW']); assert.equal(h.mounted, 1);
  }
  {
    const gate = deferred(), h = harness({updateGate: gate}); h.update(['OLD'], {segment: true}); await tick(); h.visual.destroy(); gate.resolve(); await h.visual.queue; await tick();
    assert.equal(h.requests.length, 0); assert.equal(h.destroyed, 1); assert.equal(h.visual.root.removed, true);
    h.visual.destroy(); await h.update(['IGNORED']); assert.equal(h.destroyed, 1);
  }
  for (const mode of ['mapping', 'render']) {
    const h = harness(mode === 'render' ? {renderError: Error('Render failed')} : {});
    await h.update(['R1'], {segment: true, columns: mode === 'mapping' ? [{roles: {RegistrationID: true}}, {roles: {RegistrationID: true}}] : undefined});
    assert.equal(h.events.at(-1)[0], 'failed'); assert.equal(h.requests.length, 0);
    await h.update(['RECOVERED']); assert.equal(h.renders.at(-1).rows[0].RegistrationID, 'RECOVERED');
  }
  {
    const a = harness(), b = harness(); await a.update(['A']); await b.update(['B']);
    a.visual.destroy(); await tick(); await b.update(['B2']);
    assert.equal(a.destroyed, 1); assert.equal(b.destroyed, 0); assert.equal(b.renders.at(-1).rows[0].RegistrationID, 'B2');
    b.host.colorPalette = {isHighContrast: true, foreground: {value: '#ffffff'}, background: {value: '#000000'}, foregroundSelected: {value: '#ffff00'}, hyperlink: {value: '#00ffff'}};
    await b.update(['B3']); assert.equal(b.renders.at(-1).config.highContrast.selected, '#ffff00');
    await b.update([], {type: 4}); assert.equal(b.themes.at(-1).background, '#000000');
  }
  for (const status of [0, 1, 2, 3]) {
    const h = harness({exportStatus: status}); await h.update(['R']);
    assert.equal(await h.callbacks.onExport('a,b', 'coverage.csv'), status === 0); assert.equal(h.exports.length, status === 0 ? 1 : 0);
    assert.equal(h.launches.length, 0); assert.equal(h.copies.length, 0, 'No automatic external actions');
    assert.equal(h.callbacks.onLaunchUrl('javascript:alert(1)'), false); assert.equal(h.callbacks.onLaunchUrl('file:///secret'), false);
    assert.equal(h.callbacks.onLaunchUrl('https://user:password@example.com/'), false); assert.equal(h.callbacks.onLaunchUrl('https://example.com/back\\slash'), false); assert.equal(h.callbacks.onLaunchUrl('https://example.com/new\nline'), false);
    assert.equal(h.callbacks.onLaunchUrl('https://example.com/registration'), true); assert.deepEqual(h.launches, ['https://example.com/registration']);
    assert.equal(await h.callbacks.onCopy('Coverage'), true); assert.deepEqual(h.copies, ['Coverage']);
  }
  {
    const h = harness({copyError: true, exportResult: false}); await h.update(['R']);
    assert.equal(await h.callbacks.onCopy('Fallback'), false); assert.equal(await h.callbacks.onExport('CSV', 'coverage.csv'), false);
    h.host.downloadService = {}; assert.equal(await h.callbacks.onExport('CSV', 'coverage.csv'), false);
  }
  console.log('PASS host: accumulated batches, render-before-fetch, resize, stale revisions, refusal, empty data, recovery, multiple instances, destroy, high contrast, explicit URL/copy and optional export.');
})().catch(error => {console.error(error); process.exitCode = 1;});
