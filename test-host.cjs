// Compatibility entrypoint: the former fake DOM checks are now covered by the
// shared browser suite against the actual Visual class. Generate and bundle
// the verify harness first; see roadmap-2026.README.md.
const path=require('path'),{execFileSync}=require('child_process');
execFileSync(process.execPath,[path.join(__dirname,'roadmap-browser-run.cjs')],{cwd:__dirname,stdio:'inherit',env:process.env});