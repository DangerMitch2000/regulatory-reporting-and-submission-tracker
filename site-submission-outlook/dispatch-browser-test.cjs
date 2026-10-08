const {chromium}=require('./powerbi/node_modules/@playwright/test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const checkDispatch=require('./dispatch-browser-check.cjs');
(async()=>{
 const root=__dirname,server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try {
   browser=await chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL?{channel:process.env.TRACKER_BROWSER_CHANNEL}:{})});
   const page=await browser.newPage({viewport:{width:1490,height:1100},timezoneId:'Europe/Dublin'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));await page.goto('http://127.0.0.1:'+server.address().port+'/verify/harness.html');
   await page.waitForSelector('body[data-ready=true]');const main=page.locator('#host');await checkDispatch(page,main);
   await page.evaluate(()=>{testApi.resize(760,800);testApi.send(testApi.sample())});
   for(const theme of ['dark','light']) {
     await main.getByRole('combobox',{name:'Theme'}).selectOption(theme);await main.getByRole('button',{name:'Screenshot mode'}).click();
     assert.equal(await main.locator('.ssOverdueHit').count(),4);
     const outside=await main.locator('svg').evaluate(svg=>{const b=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].filter(n=>{const r=n.getBBox();return r.x<0||r.x+r.width>b.width+1||r.y+r.height>b.height+1}).map(n=>n.textContent)});assert.deepEqual(outside,[]);
     await main.locator('svg').screenshot({path:path.join(root,`dispatch-compact-${theme}.png`)});await main.locator('.siteSubmissions').focus();await page.keyboard.press('Escape');
   }
   await page.evaluate(()=>testApi.resize(1440,900));await main.locator('svg').screenshot({path:path.join(root,'dispatch-wide.png')});
   assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>testApi.errors),[]);
   console.log('PASS: dispatch mappings, separate overdue actions, correct dates, refresh transitions, 63-ID copy across pages, site/stage/search/status filters, keyboard, and wide/compact/dark/light bounds.');
 } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
