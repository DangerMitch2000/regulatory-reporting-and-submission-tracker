const {chromium}=require('./powerbi/node_modules/@playwright/test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=__dirname,server=http.createServer((req,res)=>{
  if(req.url==='/sandbox.html')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><iframe title="Restricted visual" sandbox="allow-scripts" src="/verify/harness.html" style="width:1440px;height:1000px;border:0"></iframe>');
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL?{channel:process.env.TRACKER_BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1490,height:1050},timezoneId:'Europe/Dublin'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
  const url='http://127.0.0.1:'+server.address().port;await page.goto(url+'/verify/harness.html');await page.waitForSelector('body[data-ready=true]');
  const rows=[...Array.from({length:123},(_,i)=>({SubID:'COPY-'+String(i).padStart(4,'0'),Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,BusinessUnit:i%3?'ID':'CMI',SubStatus:i%2?'In Progress':'Completed'})),
    ...Array.from({length:60},(_,i)=>({SubID:'OLD-'+String(i).padStart(4,'0'),Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,BusinessUnit:'ID',SubStatus:'In Progress'})),
    {SubID:'DATE-CHECK',Site:'ABO',PlannedSubmission:null,ActualSubmission:null,BusinessUnit:'ID',SubStatus:'In Progress'}];
  await page.evaluate(rows=>{
   testApi.send(rows.flatMap(r=>[r,r]),{preferences:{unit:'*',theme:'light',stateFilters:{}}});
   window.copyWrites=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>copyWrites.push(value)}});
   document.body.style.userSelect='none';window.nativeCopies=[];
   // Capture synthetic test data at the native copy event without changing the user's clipboard.
   document.addEventListener('copy',event=>{const input=document.activeElement;nativeCopies.push(input?.tagName==='TEXTAREA'?input.value.slice(input.selectionStart,input.selectionEnd):window.getSelection().toString());event.preventDefault()});
  },rows);
  const main=page.locator('#host');await main.locator('.ssHit[data-site=ABO]').first().click();
  const firstID=main.locator('td.ssSubmissionId').first();await firstID.click();assert.equal(await page.evaluate(()=>window.getSelection().toString()),'COPY-0000');
  await page.keyboard.press('Control+c');assert.equal(await page.evaluate(()=>nativeCopies.at(-1)),'COPY-0000');
  await main.getByRole('button',{name:'Next',exact:true}).click();assert.equal(await main.locator('tbody tr').count(),50);
  await main.getByRole('button',{name:'Copy IDs',exact:true}).click();
  const all=rows.filter(r=>r.SubID.startsWith('COPY-')).map(r=>r.SubID).join('\n');
  assert.equal(await main.getByRole('textbox',{name:'Submission IDs to copy'}).inputValue(),all);assert.equal(await page.evaluate(()=>copyWrites.at(-1)),all);
  assert.match(await main.getByRole('status').textContent(),/Copied 123 submission IDs/);
  assert.equal(await main.getByRole('textbox',{name:'Submission IDs to copy'}).evaluate(e=>e.readOnly),true);
  await main.getByRole('button',{name:'Hide ID list'}).click();assert.equal(await main.locator('.ssCopyPanel').isVisible(),false);
  await main.getByRole('combobox',{name:'Submission progress'}).selectOption('Submitted');await main.getByRole('button',{name:'Copy IDs',exact:true}).click();
  assert.equal((await page.evaluate(()=>copyWrites.at(-1))).split('\n').length,62);
  await main.getByRole('textbox',{name:'Find submission',exact:true}).fill('COPY-0002');await main.getByRole('button',{name:'Copy IDs',exact:true}).click();
  assert.equal(await page.evaluate(()=>copyWrites.at(-1)),'COPY-0002');assert.equal(await main.locator('tbody tr').count(),1);
  await main.getByRole('textbox',{name:'Find submission',exact:true}).fill('No such ID');await main.getByRole('textbox',{name:'Find submission',exact:true}).press('Tab');
  assert.equal(await main.getByRole('button',{name:'Copy IDs',exact:true}).isDisabled(),true);
  await main.getByRole('button',{name:'Close details'}).click();await main.locator('.ssBacklogHit[data-site="*"]').click();await main.getByRole('button',{name:'Copy IDs',exact:true}).click();
  assert.equal((await page.evaluate(()=>copyWrites.at(-1))).split('\n').length,60);
  await main.getByRole('button',{name:'Close details'}).click();await main.getByRole('button',{name:'Data checks · 1'}).click();await main.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.equal(await page.evaluate(()=>copyWrites.at(-1)),'DATE-CHECK');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('Blocked','NotAllowedError')}}}));
  await main.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.match(await main.getByRole('status').textContent(),/Press Ctrl\+C/);assert.doesNotMatch(await main.getByRole('status').textContent(),/Copied/);
  const selected=await main.getByRole('textbox',{name:'Submission IDs to copy'}).evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd));assert.equal(selected,'DATE-CHECK');
  await page.keyboard.press('Control+c');assert.equal(await page.evaluate(()=>nativeCopies.at(-1)),'DATE-CHECK');
  await main.getByRole('combobox',{name:'Theme'}).selectOption('dark');await main.getByRole('button',{name:'Data checks · 1'}).click();await main.getByRole('button',{name:'Copy IDs',exact:true}).click();
  await main.locator('.ssDetails').screenshot({path:path.join(root,'copy-details-dark.png')});
  await main.getByRole('combobox',{name:'Theme'}).selectOption('light');await main.locator('.ssHit[data-site=ABO]').first().click();await main.getByRole('button',{name:'Copy IDs',exact:true}).click();
  await main.locator('.ssDetails').screenshot({path:path.join(root,'copy-details-light.png')});
  assert.deepEqual(errors,[]);
  await page.goto(url+'/sandbox.html');const frame=page.frameLocator('iframe');await frame.locator('body[data-ready=true]').waitFor();
  const sandbox=page.frames().find(f=>f.url().includes('/verify/harness.html'));
  await sandbox.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});window.nativeCopies=[];document.addEventListener('copy',e=>{const t=document.activeElement;nativeCopies.push(t.tagName==='TEXTAREA'?t.value.slice(t.selectionStart,t.selectionEnd):window.getSelection().toString());e.preventDefault()})});
  await frame.locator('.ssHit[data-site=ABO]').first().click();await frame.getByRole('button',{name:'Copy IDs',exact:true}).click();
  const text=await frame.getByRole('textbox',{name:'Submission IDs to copy'}).inputValue();assert.equal(text.split('\n').length,16);assert.match(await frame.getByRole('status').textContent(),/Press Ctrl\+C/);
  await page.keyboard.press('Control+c');assert.equal(await sandbox.evaluate(()=>nativeCopies.at(-1)),text);
  await frame.getByRole('textbox',{name:'Submission IDs to copy'}).click();await frame.getByRole('button',{name:'Select all IDs'}).click();assert.equal(await frame.getByRole('textbox',{name:'Submission IDs to copy'}).evaluate(e=>e.selectionEnd-e.selectionStart),text.length);
  assert.deepEqual(errors,[]);console.log('PASS: single-ID selection and native copy, all-page unique IDs, search/progress filters, backlog/checks, blank lists, clipboard success/denial/unavailable, read-only fallback, dark/light, and restricted sandbox keyboard copying.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
