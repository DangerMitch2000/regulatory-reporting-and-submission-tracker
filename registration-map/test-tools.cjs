const path = require('node:path');
// CI resolves only the generated project's pinned dependencies. Local development
// may reuse an adjacent project's already-installed identical toolchain.
const roots = [path.join(__dirname, 'powerbi'), __dirname, path.join(__dirname, '../powerbi-visual'), path.join(__dirname, '../../site-submissions-next/powerbi')];
function dependency(name) {
  try { return require(require.resolve(name, {paths: roots})); }
  catch (error) {
    // pnpm keeps the package verifier's JSZip dependency beside pbiviz itself.
    const toolRoot = path.dirname(require.resolve('powerbi-visuals-tools/package.json', {paths: roots}));
    try { return require(require.resolve(name, {paths: [toolRoot, ...roots]})); }
    catch { throw error; }
  }
}
module.exports = {dependency, roots};
