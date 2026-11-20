const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {boot}=require('./prepare-tests.cjs'),{runSuite}=require('./browser-test.cjs');

(async()=>{
  const {chromium}=require('./powerbi/node_modules/@playwright/test');
  const metadata=JSON.parse(fs.readFileSync(path.join(__dirname,'powerbi','pbiviz.json'),'utf8'));
  const guid=metadata.visual.guid;
  const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'package-check','resources',guid+'.pbiviz.json'),'utf8'));
  assert.equal(pkg.visual.guid,guid);assert.equal(pkg.visual.version,'1.1.0.0');
  assert.deepEqual(pkg.capabilities.privileges,[]);
  const {ROLES}=await import('./logic.mjs'),{sample,sixSiteSample}=await import('./demo.mjs');
  assert.deepEqual([...pkg.capabilities.dataRoles.map(role=>role.name)].sort(),[...ROLES].sort());
  const harness=`const ROLES=${JSON.stringify(ROLES)};const sample=()=>${JSON.stringify(sample())};const sixSiteSample=()=>${JSON.stringify(sixSiteSample())};const Visual=function(options){return window.powerbi.visuals.plugins[${JSON.stringify(guid)}].create(options)};${boot()}`;
  const html='<!doctype html><html lang="en"><meta charset="utf-8"><title>WHO packaged runtime</title><style>body{margin:0;background:#171d23}#host{width:1440px;height:820px}#second{width:900px;height:650px}'+pkg.content.css+'</style><div id="host"></div><div id="second"></div><script>window.powerbi={};</script><script src="/package.js"></script><script>'+harness.replaceAll('</script','<\\/script')+'</script></html>';
  const server=http.createServer((req,res)=>{if(req.url==='/package.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end(pkg.content.js);if(req.url==='/')return res.writeHead(200,{'Content-Type':'text/html'}).end(html);res.writeHead(404).end()});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {browser=await chromium.launch({headless:true,channel:process.env.WHO_BROWSER_CHANNEL||undefined});const page=await browser.newPage({viewport:{width:1440,height:900},timezoneId:'Europe/Dublin'});await runSuite(page,'http://127.0.0.1:'+server.address().port+'/',{label:'package'});}
  finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
