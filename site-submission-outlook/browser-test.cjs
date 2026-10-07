const {chromium}=require('./powerbi/node_modules/@playwright/test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=__dirname,server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL?{channel:process.env.TRACKER_BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1480,height:1050},timezoneId:'Europe/Dublin'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
  await page.goto(url+'/verify/harness.html');await page.waitForSelector('body[data-ready=true]');
  const main=page.locator('#host');
  assert.equal(await main.locator('.ssHit').count(),12);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/151 planned, 126 in process, 25 submitted/);
  assert.match(await main.locator('svg').textContent(),/October & November 2026/);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/34 overdue backlog, planned before 01 Oct 2026/);
  assert.equal(await main.locator('.ssBacklogHit').count(),7);
  await main.locator('.ssBacklogHit[data-site=ABO]').click();assert.match(await main.locator('.ssDetails h3').textContent(),/ABO · Overdue backlog/);assert.match(await main.locator('.ssDetails').textContent(),/Showing 1–5 of 5/);
  assert.equal(await main.getByRole('combobox',{name:'Submission progress'}).count(),0);
  assert.match(await main.locator('tbody tr').first().textContent(),/01 Jul 2026|02 Jul 2026/);
  await main.getByRole('button',{name:'Close details'}).click();
  await main.locator('.ssBacklogHit[data-site="*"]').focus();await page.keyboard.press('Enter');assert.match(await main.locator('.ssDetails').textContent(),/Showing 1–34 of 34/);
  await main.getByRole('button',{name:'Close details'}).click();
  await main.locator('.ssHit[data-site=ABO]').first().click();
  assert.match(await main.locator('.ssDetails').textContent(),/Showing 1–16 of 16/);
  await main.getByRole('combobox',{name:'Submission progress'}).selectOption('Submitted');assert.equal(await main.locator('tbody tr').count(),7);
  await main.getByRole('textbox',{name:'Find submission'}).fill('DEMO-ABO-1-001');await main.getByRole('textbox',{name:'Find submission'}).press('Tab');assert.equal(await main.locator('tbody tr').count(),1);
  await main.getByRole('button',{name:'Close details'}).click();
  await main.locator('.ssHit[data-site=ADJ]').first().focus();await page.keyboard.press('Enter');assert.match(await main.locator('.ssDetails h3').textContent(),/ADJ/);
  await main.getByRole('button',{name:'Close details'}).click();
  await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('CMI');assert.ok(!/151 planned/.test(await main.locator('svg').getAttribute('aria-label')));
  assert.match(await main.locator('svg').getAttribute('aria-label'),/10 overdue backlog/);
  assert.match(await main.locator('svg').textContent(),/6 sites · CMI/);
  await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');
  await main.getByRole('combobox',{name:'Theme'}).selectOption('dark');assert.equal(await main.locator('.dark').count(),1);
  assert.ok(await page.evaluate(()=>testApi.persisted.length>=3));
  await page.evaluate(()=>testApi.resize(1440,800));await main.getByRole('button',{name:'Screenshot mode'}).click();
  assert.equal(await main.locator('.ssControls').isVisible(),false);await main.locator('.siteSubmissions').screenshot({path:path.join(root,'preview-dark.png')});
  await main.locator('.siteSubmissions').focus();await page.keyboard.press('Escape');
  await main.getByRole('combobox',{name:'Theme'}).selectOption('light');await main.getByRole('button',{name:'Screenshot mode'}).click();
  await main.locator('.siteSubmissions').screenshot({path:path.join(root,'preview-light.png')});
  await main.locator('.siteSubmissions').focus();await page.keyboard.press('Escape');
  await page.evaluate(()=>testApi.resize(760,720));await main.getByRole('button',{name:'Screenshot mode'}).click();
  await main.locator('.siteSubmissions').screenshot({path:path.join(root,'preview-compact.png')});
  const bounds=await main.locator('svg').evaluate(svg=>{const box=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].map(n=>({text:n.textContent,b:n.getBBox()})).filter(o=>o.b.x<0||o.b.x+o.b.width>box.width+1||o.b.y+o.b.height>box.height+1).map(o=>o.text)});assert.deepEqual(bounds,[]);
  await main.locator('.siteSubmissions').focus();await page.keyboard.press('Escape');
  await page.evaluate(()=>testApi.send([],{}));assert.match(await main.locator('svg').textContent(),/No planned submissions/);assert.equal(await main.locator('.ssHit').count(),12);assert.match(await main.locator('svg').getAttribute('aria-label'),/0 overdue backlog/);
  await page.evaluate(()=>testApi.send(testApi.sample(),{omit:['ActualSubmission']}));assert.match(await main.locator('.ssSetup').textContent(),/Actual submission date/);
  await page.evaluate(()=>testApi.send(testApi.sample(),{omit:['BusinessUnit']}));assert.equal(await main.getByRole('combobox',{name:'Business unit',exact:true}).isDisabled(),true);assert.match(await main.getByRole('combobox',{name:'Business unit',exact:true}).textContent(),/Map Business unit field/);
  await page.evaluate(()=>testApi.send(testApi.sample(),{partial:true}));assert.match(await main.locator('.ssNotice').textContent(),/Counts are partial/);
  await main.getByRole('button',{name:'Screenshot mode'}).click();assert.equal(await main.locator('.ssNotice').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>testApi.fetchRequests),[true]);
  await main.locator('.siteSubmissions').focus();await page.keyboard.press('Escape');
  await page.evaluate(()=>{testApi.setAllowFetch(true);testApi.send(testApi.sample().slice(0,10),{partial:true})});assert.match(await main.locator('.ssNotice').textContent(),/Loading more/);
  await page.evaluate(()=>testApi.send(testApi.sample()));assert.equal(await main.locator('.ssNotice').count(),0);assert.match(await main.locator('svg').getAttribute('aria-label'),/151 planned/);
  assert.equal(await main.getByRole('combobox',{name:'Business unit',exact:true}).isEnabled(),true);
  await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('ID');assert.match(await main.locator('svg').getAttribute('aria-label'),/24 overdue backlog/);
  await main.locator('.ssBacklogHit[data-site="*"]').click();assert.match(await main.locator('.ssDetails').textContent(),/Showing 1–24 of 24/);
  await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');assert.match(await main.locator('svg').getAttribute('aria-label'),/34 overdue backlog/);
  await page.evaluate(()=>testApi.send(testApi.sample(),{preferences:{sites:['ADJ','ABO'],theme:'dark',unit:'*'}}));assert.equal(await main.locator('.ssHit').count(),4);assert.equal(await main.locator('.dark').count(),1);
  await main.locator('.ssSites summary').click();await main.getByRole('checkbox',{name:'Include ADJ'}).uncheck();assert.equal(await main.locator('.ssHit').count(),2);
  await main.getByRole('button',{name:'Use main six sites'}).click();assert.equal(await main.locator('.ssHit').count(),12);await main.locator('.ssSites summary').click();
  await page.evaluate(()=>{testApi.send(testApi.sample());testApi.second()});assert.equal(await page.locator('#second .ssHit').count(),12);assert.match(await main.locator('svg').getAttribute('aria-label'),/151 planned/);
  await page.clock.setFixedTime(new Date('2026-12-15T12:00:00Z'));await page.evaluate(()=>testApi.send(testApi.sample()));assert.match(await main.locator('svg').textContent(),/December 2026 & January 2027/);
  await page.clock.setFixedTime(new Date('2027-01-01T12:00:00Z'));await page.evaluate(()=>testApi.send(testApi.sample()));assert.match(await main.locator('svg').textContent(),/January & February 2027/);
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
  await page.evaluate(()=>testApi.send([{SubID:'REVIEW',Site:'ABO',PlannedSubmission:'2026-10-03',ActualSubmission:'2026-10-30',BusinessUnit:'ID'}]));
  assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned, 0 in process, 0 submitted, 1 in Check date/);await main.getByRole('button',{name:'Data checks · 1'}).click();assert.match(await main.locator('.ssDetails').textContent(),/date is in the future/);
  const stressMs=await page.evaluate(()=>{testApi.resize(1440,800);const rows=Array.from({length:10000},(_,i)=>({SubID:'STRESS-'+String(i).padStart(5,'0'),Site:['ABO','ADJ','ADK','AJG','ARDG','SCR'][i%6],PlannedSubmission:i%3?'2026-10-10':'2026-11-10',ActualSubmission:i%2?null:'2026-10-01',BusinessUnit:'ID',SubStatus:i%2?'Cancelled':'Completed',ROStatus:i%3?'In Progress':'Archived',AppStatus:i%4?'Active':'Inactive'}));const start=performance.now();testApi.send(rows.flatMap(r=>[r,r,r]));return performance.now()-start});
  assert.match(await main.locator('svg').getAttribute('aria-label'),/10000 planned, 5000 in process, 5000 submitted/);assert.ok(stressMs<5000,`Stress render slow: ${stressMs}ms`);
  await main.locator('.ssHit[data-site=ADJ]').first().click();assert.equal(await main.locator('tbody tr').count(),50);await main.getByRole('button',{name:'Next',exact:true}).click();assert.match(await main.locator('.ssPager').textContent(),/Showing 51–100/);
  await main.getByRole('textbox',{name:'Find submission'}).fill('STRESS-00001');await main.getByRole('textbox',{name:'Find submission'}).press('Tab');assert.equal(await main.locator('tbody tr').count(),1);
  await page.evaluate(()=>testApi.send(Array.from({length:10000},(_,i)=>({SubID:'BACKLOG-'+String(i).padStart(5,'0'),Site:['ABO','ADJ','ADK','AJG','ARDG','SCR'][i%6],PlannedSubmission:'2026-09-30',ActualSubmission:i%2?null:'2026-10-01',BusinessUnit:'ID'})).flatMap(r=>[r,r,r])));
  assert.match(await main.locator('svg').getAttribute('aria-label'),/0 planned, 0 in process, 0 submitted/);assert.match(await main.locator('svg').getAttribute('aria-label'),/5000 overdue backlog/);
  await main.locator('.ssBacklogHit[data-site="*"]').click();assert.equal(await main.locator('tbody tr').count(),50);
  await main.getByRole('button',{name:'Next',exact:true}).click();assert.match(await main.locator('.ssPager').textContent(),/Showing 51–100 of 5000/);
  await main.getByRole('textbox',{name:'Find submission'}).fill('BACKLOG-00001');await main.getByRole('textbox',{name:'Find submission'}).press('Tab');assert.equal(await main.locator('tbody tr').count(),1);
  await page.evaluate(()=>testApi.send([{SubID:'BACKLOG-00001',Site:'ADJ',PlannedSubmission:'2026-09-30',ActualSubmission:'2026-10-07'}]));assert.match(await main.locator('svg').getAttribute('aria-label'),/0 overdue backlog/);assert.match(await main.locator('.ssDetails').textContent(),/No matching submissions/);
  await page.evaluate(()=>testApi.send([{SubID:'MONTH-MOVE',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null}]));assert.match(await main.locator('svg').getAttribute('aria-label'),/0 overdue backlog/);
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));await page.evaluate(()=>testApi.resize(1440,800));assert.match(await main.locator('svg').getAttribute('aria-label'),/1 overdue backlog, planned before 01 Nov 2026/);
  await page.evaluate(()=>testApi.send([{SubID:'BLANK-UNIT',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,BusinessUnit:null},{SubID:'NAMED-UNIT',Site:'ABO',PlannedSubmission:'2026-11-01',ActualSubmission:null,BusinessUnit:'ID'}]));
  await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('');assert.match(await main.locator('svg').getAttribute('aria-label'),/1 overdue backlog/);assert.match(await main.locator('svg').getAttribute('aria-label'),/0 planned/);assert.match(await main.locator('svg').textContent(),/6 sites · Not recorded/);
  await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
  const stateRows=[
    {SubID:'CANCELLED',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,BusinessUnit:'ID',SubStatus:'Cancelled',ROStatus:'Archived',AppStatus:'Inactive'},
    {SubID:'ACTIVE',Site:'ABO',PlannedSubmission:'2026-10-02',ActualSubmission:null,BusinessUnit:'CMI',SubStatus:'In Progress',ROStatus:'Planned',AppStatus:'Active'},
    {SubID:'WITHDRAWN',Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,BusinessUnit:'ID',SubStatus:'Withdrawn',ROStatus:'Archived',AppStatus:'Inactive'},
    {SubID:'CUSTOM',Site:'ABO',PlannedSubmission:'2026-11-01',ActualSubmission:'2026-10-01',BusinessUnit:'ID',SubStatus:'My custom state',ROStatus:'In Progress',AppStatus:'Active'},
    {SubID:'BLANK',Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,BusinessUnit:'ID',SubStatus:null,ROStatus:null,AppStatus:null}
  ];stateRows.push({...stateRows[0]});
  await page.evaluate(rows=>{testApi.resize(1440,800);testApi.send(rows,{preferences:{unit:'*',theme:'light',stateFilters:{}}})},stateRows);
  assert.equal(await main.locator('.ssStateFilter').count(),3);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/3 planned, 2 in process, 1 submitted/);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/2 overdue backlog/);
  const openState=async role=>{const menu=main.locator(`.ssStateFilter[data-role=${role}]`);if(await menu.getAttribute('open')===null)await menu.locator('summary').click();return menu;};
  const closeStates=async()=>{for(const role of ['SubStatus','ROStatus','AppStatus']){const menu=main.locator(`.ssStateFilter[data-role=${role}]`);if(await menu.count()&&await menu.getAttribute('open')!==null)await menu.locator('summary').click();}};
  await openState('SubStatus');await main.getByRole('button',{name:'Clear Submission state values',exact:true}).click();
  assert.match(await main.locator('svg').getAttribute('aria-label'),/0 planned/);
  await main.getByRole('checkbox',{name:'Include Cancelled in Submission state',exact:true}).check();
  await main.getByRole('checkbox',{name:'Include Withdrawn in Submission state',exact:true}).check();
  assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned, 1 in process, 0 submitted/);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/1 overdue backlog/);
  const saved=await page.evaluate(()=>JSON.parse(testApi.persisted.at(-1).merge[0].properties.state));assert.deepEqual(saved.stateFilters.SubStatus,['Cancelled','Withdrawn']);
  await closeStates();await main.locator('.ssHit[data-site=ABO]').first().click();
  assert.deepEqual(await main.locator('th').allTextContents(),['Submission ID','Site','Planned submission','Actual submission','Progress','Submission state','RO state','Application state']);
  assert.match(await main.locator('tbody tr').textContent(),/Cancelled.*Archived.*Inactive/);
  await main.getByRole('button',{name:'Close details'}).click();
  await openState('AppStatus');await main.getByRole('button',{name:'Clear Application state values',exact:true}).click();await main.getByRole('checkbox',{name:'Include Active in Application state',exact:true}).check();
  assert.match(await main.locator('svg').getAttribute('aria-label'),/0 planned/);assert.match(await main.locator('svg').getAttribute('aria-label'),/0 overdue backlog/);
  await main.getByRole('checkbox',{name:'Include Inactive in Application state',exact:true}).check();assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned/);
  await closeStates();await openState('ROStatus');await main.getByRole('button',{name:'Clear RO state values',exact:true}).click();await main.getByRole('checkbox',{name:'Include Archived in RO state',exact:true}).check();
  assert.match(await main.locator('svg').getAttribute('aria-label'),/1 overdue backlog/);
  await closeStates();await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('CMI');assert.match(await main.locator('svg').getAttribute('aria-label'),/0 planned/);
  await main.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');
  for(const theme of ['light','dark']){
    await main.getByRole('combobox',{name:'Theme'}).selectOption(theme);
    for(const width of [1440,760]){
      await page.evaluate(w=>testApi.resize(w,800),width);await main.getByRole('button',{name:'Screenshot mode'}).click();
      assert.equal(await main.locator('.ssStateControls').isVisible(),false);
      assert.match(await main.locator('[data-state-scope=true]').allTextContents().then(v=>v.join(' ')),/Submission state: Cancelled, Withdrawn.*RO state: Archived.*Application state: Active, Inactive/);
      assert.deepEqual(await main.locator('svg').evaluate(svg=>[...svg.querySelectorAll('text')].filter(t=>{const b=t.getBBox(),v=svg.viewBox.baseVal;return b.x<0||b.x+b.width>v.width+1||b.y+b.height>v.height+1}).map(t=>t.textContent)),[]);
      await main.locator('.siteSubmissions').focus();await page.keyboard.press('Escape');
    }
  }
  await page.evaluate(({rows,prefs})=>testApi.send(rows,{preferences:prefs}),{rows:stateRows,prefs:saved});
  assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned/);assert.match(await main.locator('.ssStateFilter[data-role=SubStatus] summary').textContent(),/2 selected/);
  await page.evaluate(rows=>testApi.send(rows,{omit:['SubStatus','ROStatus','AppStatus']}),stateRows);
  assert.equal(await main.locator('.ssStateFilter').count(),0);assert.equal(await main.locator('.ssStateControls button:disabled').count(),3);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/3 planned/);assert.match(await main.locator('svg').textContent(),/Submission state: Not mapped/);
  await page.evaluate(rows=>testApi.send(rows),stateRows);assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned/);
  await page.evaluate(rows=>testApi.send(rows,{preferences:{unit:'*',theme:'light',stateFilters:{SubStatus:['']}}}),stateRows);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/0 planned/);assert.match(await main.locator('svg').getAttribute('aria-label'),/1 overdue backlog/);
  await openState('SubStatus');assert.equal(await main.getByRole('checkbox',{name:'Include Not recorded in Submission state',exact:true}).isChecked(),true);
  await main.getByRole('button',{name:'All Submission state values',exact:true}).click();assert.match(await main.locator('svg').getAttribute('aria-label'),/3 planned/);
  await closeStates();await main.locator('.ssBacklogHit[data-site=ABO]').click();assert.match(await main.locator('.ssDetails').textContent(),/Withdrawn.*Archived.*Inactive/);assert.match(await main.locator('.ssDetails').textContent(),/Not recorded/);
  await main.getByRole('button',{name:'Close details'}).click();await main.getByRole('combobox',{name:'Theme'}).selectOption('dark');await openState('SubStatus');
  await main.locator('.siteSubmissions').screenshot({path:path.join(root,'states-controls-dark.png')});
  assert.deepEqual(await page.evaluate(()=>testApi.errors),[]);assert.deepEqual(errors,[]);
  const closedBacklogRows=[
    {SubID:'CLOSED-SUB',Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,SubStatus:'Completed',ROStatus:'In Progress'},
    {SubID:'CLOSED-RO',Site:'ADJ',PlannedSubmission:'2026-09-01',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'Health Authority Approved'},
    {SubID:'CLOSED-BOTH',Site:'ADK',PlannedSubmission:'2026-09-01',ActualSubmission:null,SubStatus:'Completed',ROStatus:'Health Authority Approved'},
    {SubID:'STILL-OPEN',Site:'ABO',PlannedSubmission:'2026-09-01',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress'},
    {SubID:'CURRENT-COMPLETED',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,SubStatus:'Completed',ROStatus:'In Progress'}
  ];
  await page.evaluate(rows=>testApi.send(rows,{preferences:{unit:'*',theme:'light',stateFilters:{SubStatus:null,ROStatus:null,AppStatus:null}}}),closedBacklogRows);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned, 0 in process, 1 submitted/);assert.match(await main.locator('svg').getAttribute('aria-label'),/1 overdue backlog/);
  assert.match(await main.locator('.ssBacklogHit[data-site=ADJ]').getAttribute('aria-label'),/0 overdue backlog/);
  await main.locator('.ssBacklogHit[data-site="*"]').click();assert.deepEqual(await main.locator('tbody tr td:first-child').allTextContents(),['STILL-OPEN']);assert.match(await main.locator('.ssDetails').textContent(),/either state is sufficient/);
  await main.getByRole('button',{name:'Close details'}).click();await main.locator('.ssHit[data-site=ABO]').first().click();assert.match(await main.locator('tbody tr').textContent(),/CURRENT-COMPLETED.*Submitted.*Completed state/);await main.getByRole('button',{name:'Close details'}).click();
  await page.evaluate(rows=>testApi.send(rows.map(r=>r.SubID==='STILL-OPEN'?{...r,ROStatus:'Health Authority Approved'}:r)),closedBacklogRows);
  assert.match(await main.locator('svg').getAttribute('aria-label'),/0 overdue backlog/);
  await page.evaluate(rows=>testApi.send(rows,{omit:['SubStatus']}),closedBacklogRows);assert.match(await main.locator('svg').getAttribute('aria-label'),/2 overdue backlog/);
  await page.evaluate(rows=>testApi.send(rows,{omit:['SubStatus','ROStatus']}),closedBacklogRows);assert.match(await main.locator('svg').getAttribute('aria-label'),/4 overdue backlog/);
  await page.evaluate(rows=>testApi.send([...rows,{...rows[3],SubStatus:'Completed'}]),closedBacklogRows);assert.match(await main.locator('svg').getAttribute('aria-label'),/0 overdue backlog/);
  await page.evaluate(()=>testApi.send([{SubID:'REFRESH',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,SubStatus:'In Progress'}]));assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned, 1 in process, 0 submitted/);
  await page.evaluate(()=>testApi.send([{SubID:'REFRESH',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:null,SubStatus:'Completed'}]));assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned, 0 in process, 1 submitted/);assert.match(await main.locator('svg').textContent(),/100% submitted/);
  await page.evaluate(()=>testApi.send([{SubID:'REVIEW-COMPLETED',Site:'ABO',PlannedSubmission:'2026-10-01',ActualSubmission:'invalid',SubStatus:'Completed'}]));assert.match(await main.locator('svg').getAttribute('aria-label'),/1 planned, 0 in process, 1 submitted, 0 in Check date/);
  await main.getByRole('button',{name:'Data checks · 1'}).click();assert.match(await main.locator('tbody').textContent(),/REVIEW-COMPLETED.*Invalid date/);await main.getByRole('button',{name:'Close details'}).click();
  for(const width of [760,1440]){
    await page.evaluate(w=>testApi.resize(w,800),width);await main.getByRole('button',{name:'Screenshot mode'}).click();assert.match(await main.locator('svg').textContent(),/1 data checks — review below/);
    assert.deepEqual(await main.locator('svg').evaluate(svg=>[...svg.querySelectorAll('text')].filter(t=>{const b=t.getBBox(),v=svg.viewBox.baseVal;return b.x<0||b.x+b.width>v.width+1||b.y+b.height>v.height+1}).map(t=>t.textContent)),[]);
    await main.locator('.siteSubmissions').focus();await page.keyboard.press('Escape');
  }
  assert.deepEqual(await page.evaluate(()=>testApi.errors),[]);assert.deepEqual(errors,[]);
  await page.goto(url+'/preview.html');await page.locator('svg').waitFor();assert.match(await page.locator('svg').textContent(),/ILLUSTRATIVE DATA/);assert.equal(await page.locator('.ssHit').count(),12);
  await page.getByRole('button',{name:'Data checks example'}).click();assert.match(await page.locator('svg').textContent(),/Check date/);
  assert.deepEqual(errors,[]);
  console.log(`PASS: actual Visual class, 12 columns/6 sites, separate backlog/site totals, late completion refresh, backlog pagination/search, month rollover, persisted selections, units, all three state filters, blank/custom states, optional mappings, dark/light/compact, keyboard, dates, partial delivery and 10,000 submissions / 30,000 rows in ${Math.round(stressMs)}ms.`);
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
