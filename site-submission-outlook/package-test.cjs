const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const {chromium}=require('./powerbi/node_modules/@playwright/test');
(async()=>{
 const guid='siteSubmissionOutlook8D94A67E43154927AC034613F8289C02';
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'package-check','resources',guid+'.pbiviz.json'),'utf8'));
 assert.equal(pkg.visual.version,'1.2.3.0'); assert.equal(pkg.visual.guid,guid);
 assert.deepEqual(pkg.capabilities.privileges,[]);
 const roles=pkg.capabilities.dataRoles.map(r=>r.name);
 assert.deepEqual(roles,['SubID','Site','PlannedSubmission','ActualSubmission','BusinessUnit','SubStatus','ROStatus','AppStatus']);
 const {sample}=await import('./demo.mjs');
 const boot=`window.errors=[];const host={eventService:{renderingStarted(){},renderingFinished(){document.body.dataset.ready='true'},renderingFailed(o,e){errors.push(e)}},persistProperties(){},fetchMoreData(){return false},colorPalette:{isHighContrast:false}};
 window.visual=window.powerbi.visuals.plugins[${JSON.stringify(guid)}].create({element:document.getElementById('host'),host});
 window.send=(rows,omit=[])=>{const roles=${JSON.stringify(roles)}.filter(r=>!omit.includes(r));visual.update({type:2,viewport:{width:1440,height:800},dataViews:[{metadata:{},table:{columns:roles.map(r=>({displayName:r,roles:{[r]:true}})),rows:rows.map(r=>roles.map(k=>r[k]??null))}}]})};`;
 const html='<!doctype html><html><meta charset="utf-8"><style>body{margin:0}'+pkg.content.css+'</style><div id="host"></div><script>window.powerbi={};</script><script src="/package.js"></script><script>'+boot+'</script></html>';
 const server=http.createServer((req,res)=>{
   const route=new URL(req.url,'http://localhost').pathname;
   if(route==='/package.js') return res.writeHead(200,{'Content-Type':'text/javascript'}).end(pkg.content.js);
   if(route==='/preview.html') return res.writeHead(200,{'Content-Type':'text/html'}).end(fs.readFileSync(path.join(__dirname,'preview.html')));
   if(route==='/') return res.writeHead(200,{'Content-Type':'text/html'}).end(html);
   res.writeHead(404).end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
   browser=await chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL?{channel:process.env.TRACKER_BROWSER_CHANNEL}:{})});
   const page=await browser.newPage({viewport:{width:1490,height:1050},timezoneId:'Europe/Dublin'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message)); await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
   const url='http://127.0.0.1:'+server.address().port;await page.goto(url);
   await page.evaluate(rows=>send(rows),sample(new Date('2026-10-07T12:00:00Z')));
   await page.waitForSelector('body[data-ready=true]'); assert.equal(await page.locator('.ssHit').count(),12);
   assert.match(await page.locator('svg').getAttribute('aria-label'),/151 planned, 126 in process, 25 submitted/);
   assert.match(await page.locator('svg').getAttribute('aria-label'),/34 overdue backlog/);
   await page.locator('.ssBacklogHit[data-site=ADK]').click();assert.match(await page.locator('.ssDetails').textContent(),/Showing 1–12 of 12/);
   await page.getByRole('button',{name:'Close details'}).click();
   await page.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('CMI');assert.match(await page.locator('svg').getAttribute('aria-label'),/10 overdue backlog/);
   await page.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');assert.match(await page.locator('svg').getAttribute('aria-label'),/34 overdue backlog/);
   await page.locator('.ssHit[data-site=ADJ]').first().click();assert.match(await page.locator('.ssDetails').textContent(),/Showing 1–10 of 10/);
   await page.evaluate(()=>{window.copiedIDs=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>copiedIDs.push(value)}})});
   const detailIDs=await page.locator('tbody tr td:first-child').allTextContents();await page.getByRole('button',{name:'Copy IDs',exact:true}).click();
   assert.equal(await page.evaluate(()=>copiedIDs.at(-1)),detailIDs.join('\n'));assert.match(await page.getByRole('status').textContent(),/Copied 10 submission IDs/);
   await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));await page.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.match(await page.getByRole('status').textContent(),/Press Ctrl\+C/);
   assert.equal(await page.getByRole('textbox',{name:'Submission IDs to copy'}).evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd)),detailIDs.join('\n'));
   await page.getByRole('button',{name:'Close details'}).click();
   const expected=(await import('./submissions.logic.mjs')).summarize(sample(new Date('2026-10-07T12:00:00Z')),{now:new Date('2026-10-07T12:00:00Z'),stateFilters:{SubStatus:['Cancelled']}});
   await page.locator('.ssStateFilter[data-role=SubStatus] summary').click();await page.getByRole('button',{name:'Clear Submission state values',exact:true}).click();await page.getByRole('checkbox',{name:'Include Cancelled in Submission state',exact:true}).check();
   assert.match(await page.locator('svg').getAttribute('aria-label'),new RegExp(`${expected.totals.planned} planned, ${expected.totals.inProcess} in process, 0 submitted`));
   assert.match(await page.locator('svg').getAttribute('aria-label'),new RegExp(`${expected.backlog.count} overdue backlog`));
   await page.getByRole('button',{name:'All Submission state values',exact:true}).click();await page.locator('.ssStateFilter[data-role=SubStatus] summary').click();
   assert.equal(await page.locator('.ssStateFilter').count(),3);
   await page.getByRole('combobox',{name:'Theme'}).selectOption('dark');assert.equal(await page.locator('.dark').count(),1);
   await page.evaluate(()=>send([
     {SubID:'COMPLETE',Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,SubStatus:'Completed'},
     {SubID:'APPROVED',Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,ROStatus:'Health Authority Approved'},
     {SubID:'OPEN',Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,SubStatus:'In Progress'},
     {SubID:'CURRENT',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,SubStatus:'Completed'}
   ]));
   assert.match(await page.locator('svg').getAttribute('aria-label'),/1 overdue backlog/);assert.match(await page.locator('svg').getAttribute('aria-label'),/1 planned, 0 in process, 1 submitted/);
   await page.locator('.ssBacklogHit[data-site="*"]').click();assert.deepEqual(await page.locator('tbody tr td:first-child').allTextContents(),['OPEN']);await page.getByRole('button',{name:'Close details'}).click();
   await page.evaluate(()=>send(['Completed','HA Received','Sent To Health Authority','Rejected','Distributed','Withdrawn'].flatMap((SubStatus,i)=>[
     {SubID:'CURRENT-'+i,Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,SubStatus},
     {SubID:'OLD-'+i,Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,SubStatus}
   ]).flatMap(r=>[r,r])));
   assert.match(await page.locator('svg').getAttribute('aria-label'),/6 planned, 2 in process, 4 submitted/);assert.match(await page.locator('svg').getAttribute('aria-label'),/2 overdue backlog/);
   await page.locator('.ssHit[data-site=ABO]').first().click();assert.match(await page.locator('tbody').textContent(),/Submitted · Rejected state/);assert.match(await page.locator('tbody').textContent(),/Submitted · Sent To Health Authority state/);await page.getByRole('button',{name:'Close details'}).click();
   await page.locator('.ssBacklogHit[data-site="*"]').click();assert.deepEqual(await page.locator('tbody tr td:first-child').allTextContents(),['OLD-4','OLD-5']);await page.getByRole('button',{name:'Close details'}).click();
   await page.evaluate(rows=>send(rows,['ActualSubmission']),sample(new Date('2026-10-07T12:00:00Z')));
   assert.match(await page.locator('.ssSetup').textContent(),/Actual submission date/);
   const elapsed=await page.evaluate(()=>{const rows=Array.from({length:10000},(_,i)=>({SubID:'S-'+i,Site:['ABO','ADJ','ADK','AJG','ARDG','SCR'][i%6],PlannedSubmission:i%3?'2026-10-05':'2026-11-05',ActualSubmission:i%2?null:'2026-10-03',SubStatus:i%2?'Cancelled':'Completed',ROStatus:i%3?'In Progress':'Archived',AppStatus:i%4?'Active':'Inactive'}));const start=performance.now();send(rows.flatMap(r=>[r,r,r]));return performance.now()-start;});
   assert.match(await page.locator('svg').getAttribute('aria-label'),/10000 planned, 5000 in process, 5000 submitted/);assert.ok(elapsed<5000);
   assert.deepEqual(await page.evaluate(()=>window.errors),[]);assert.deepEqual(errors,[]);
   await page.goto(url+'/preview.html');await page.locator('svg').waitFor();
   await page.getByRole('button',{name:'Screenshot mode'}).click();
   assert.match(await page.locator('svg').textContent(),/ILLUSTRATIVE DATA/);
   await page.locator('.siteSubmissions').screenshot({path:path.join(__dirname,'site-submission-outlook-preview.png')});
   assert.deepEqual(errors,[]);
   console.log(`PASS: actual packaged plugin loads, correct fields/version, no privileges, twelve columns, counts, ADJ details, theme, setup guard, 10,000 distinct submissions / 30,000 rows (${Math.round(elapsed)}ms); illustrative preview captured.`);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
