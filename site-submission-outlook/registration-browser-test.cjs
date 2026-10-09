const {chromium}=require('./powerbi/node_modules/@playwright/test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=__dirname,server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try {
   browser=await chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL?{channel:process.env.TRACKER_BROWSER_CHANNEL}:{})});
   const page=await browser.newPage({viewport:{width:1490,height:1100},timezoneId:'Europe/Dublin'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));await page.goto('http://127.0.0.1:'+server.address().port+'/verify/harness.html');await page.waitForSelector('body[data-ready=true]');
   const scope=page.locator('#host');
   await require('./registration-browser-check.cjs')(page,scope);
   await scope.locator('.ssMetricHit[data-scope=plan][data-metric=submitted]').click();
   await scope.locator('.ssTableWrap').evaluate(node=>node.scrollLeft=node.scrollWidth);
   await scope.locator('.ssDetails').screenshot({path:path.join(__dirname,'registration-details-light.png')});
   await scope.getByRole('button',{name:'Close details',exact:true}).click();
   await page.evaluate(()=>testApi.resize(760,800));await scope.getByRole('combobox',{name:'Theme',exact:true}).selectOption('dark');
   await require('./registration-browser-check.cjs')(page,scope,{compact:true});
   assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>testApi.errors),[]);
   console.log('PASS: registration completion evidence, all seven states, exact IDs, copying, primary/secondary countries, duplicate registrations, optional mappings, refresh and compact/dark layout.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

