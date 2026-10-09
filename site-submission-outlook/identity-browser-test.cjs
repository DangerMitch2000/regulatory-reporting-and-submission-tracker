const {chromium}=require('./powerbi/node_modules/@playwright/test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=__dirname,server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL?{channel:process.env.TRACKER_BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1490,height:1100},timezoneId:'Europe/Dublin'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));await page.goto('http://127.0.0.1:'+server.address().port+'/verify/harness.html');await page.waitForSelector('body[data-ready=true]');
  const scope=page.locator('#host');
  const baseline=await scope.locator('svg').getAttribute('aria-label');
  await require('./identity-browser-check.cjs')(page,scope);
  assert.equal(await scope.locator('svg').getAttribute('aria-label'),baseline,'helper restores the caller data and state');
  await page.evaluate(()=>testApi.resize(760,800));await scope.getByRole('combobox',{name:'Theme',exact:true}).selectOption('dark');
  await require('./identity-browser-check.cjs')(page,scope);
  assert.equal(await scope.locator('.siteSubmissions.dark').count(),1);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>testApi.errors),[]);
  console.log('PASS: related RO/application IDs, preserved pairs, 123 blank-submission source rows across pages, unchanged distinct counts, native and all-page copy, clipboard denial/unavailable fallback, search-before-copy, BU/state filters, optional mappings, refresh, and light/dark compact layout.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
