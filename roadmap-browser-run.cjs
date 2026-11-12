const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('./roadmap-2026/node_modules/@playwright/test');
const root=__dirname,dir=path.join(root,'roadmap-2026/verify'),packaged=process.argv.includes('--package');
const guid='roadmap2026C61A02B948134819AE7073D8B9E5F604';let pkg;
if(packaged){
 pkg=JSON.parse(fs.readFileSync(path.join(root,'package-check/resources',guid+'.pbiviz.json'),'utf8'));
 assert.equal(pkg.visual.version,'1.5.0.0');assert.equal(pkg.visual.guid,guid);assert.deepEqual(pkg.capabilities.privileges,[]);
 assert.deepEqual(pkg.capabilities.dataRoles.map(r=>r.name),['SubID','OriginalDispatch','LatestDispatch','ActualDispatch','ActualSubmission','ActualApproval','Site','BusinessUnit','SubStatus','ROStatus','DispatchRequired']);
}
const packagedHTML=()=>`<!doctype html><html><meta charset="utf-8"><style>body{margin:0}${pkg.content.css}</style><div id="host"></div><button id="resize">Narrow visual</button><button id="reset">Reset host data / width</button><button id="filter">Report filter test</button><button id="empty">Empty data test</button><button id="partial">Partial data test</button><script>window.powerbi={};</script><script src="/package.js"></script><script>window.__createRoadmap=o=>window.powerbi.visuals.plugins[${JSON.stringify(guid)}].create(o);</script><script src="/boot.js"></script></html>`;
(async()=>{
 const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://localhost').pathname;
 if(packaged&&route==='/package.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end(pkg.content.js);
 if(packaged&&route==='/index.html')return res.writeHead(200,{'Content-Type':'text/html'}).end(packagedHTML());
 const file=path.resolve(dir,'.'+route);if(!file.startsWith(dir+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'}).end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({headless:true,...(process.env.ROADMAP_BROWSER_CHANNEL?{channel:process.env.ROADMAP_BROWSER_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1500,height:1000},timezoneId:'Europe/Dublin'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
 const url='http://127.0.0.1:'+server.address().port+'/index.html';await page.goto(url);await page.waitForSelector('body[data-ready=true]');
 assert.equal(await page.getByRole('combobox',{name:'Business unit',exact:true}).inputValue(),'"ID"','Default business unit is ID');
 assert.equal(await page.getByRole('combobox',{name:'Theme',exact:true}).inputValue(),'dark','Default theme is Dark');
 await require('./roadmap-refresh-browser.cjs')({page,assert,path,dir,mode:packaged?'package':'source'});
 await page.goto(url);await page.waitForSelector('body[data-ready=true]');
 await page.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');
 await require('./roadmap-status.verify.cjs')({page,assert,path,dir});
 await require('./roadmap-dispatch.verify.cjs')({page,assert,path,dir});
 assert.deepEqual(await page.evaluate(()=>__roadmapTest.errors),[]);assert.deepEqual(errors,[]);
 await page.goto(url);await page.waitForSelector('body[data-ready=true]');
 await page.locator('.roadmap2026 header').evaluate(header=>{const label=document.createElement('span');label.textContent='ILLUSTRATIVE DATA';label.style.fontSize='12px';header.append(label);});
 await page.locator('.roadmap2026').screenshot({path:path.join(dir,'roadmap-preview'+(packaged?'-package':'')+'.png')});
 console.log('PASS: '+(packaged?'actual packaged':'source Visual')+' runtime, shared interaction regressions, statuses, requirement evidence, ID default and no browser errors.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
