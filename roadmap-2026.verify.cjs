const fs=require('fs');
fs.writeFileSync('roadmap-2026/test.cjs',fs.readFileSync('test-next.cjs','utf8').replace("readFileSync('roadmap-2026.logic.js'","readFileSync('src/roadmap-2026.logic.js'").replaceAll("require('./dispatch-required.js')","require('./src/dispatch-required.js')"));
require('./test-next.cjs');require('./test-render.cjs');require('./prepare-preview.cjs');
console.log('Browser harness generated, not executed by this command.');
