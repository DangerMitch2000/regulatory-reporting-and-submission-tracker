const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');

async function runSuite(page,url,{screenshots=false,label='source'}={}) {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await page.goto(url);await page.waitForSelector('body[data-ready=true]');
  const main=page.locator('#host'),card=(metric,year)=>main.locator(`[data-testid="metric-card"][data-metric="${metric}"][data-year="${year}"]`);
  const counts=async(subs,approvals)=>{
    for(const [i,year] of [2025,2026].entries())for(const [metric,values] of [['submissions',subs],['approvals',approvals]])assert.equal(Number((await card(metric,year).locator('.who-card-value').textContent()).replaceAll(',','')),values[i],`${label}: ${year} ${metric}`);
  };
  const reset=async()=>{await page.evaluate(()=>testApi.reset());await counts([32,46],[20,34]);};
  const screenshot=async(name)=>{if(screenshots)await page.screenshot({path:path.join(__dirname,'verify',name+'.png'),fullPage:false});};
  assert.equal(await main.locator('.who-dark').count(),1);
  assert.equal(await main.getByTestId('filter-unit').inputValue(),'ID');
  assert.equal(await main.getByTestId('filter-older-year').inputValue(),'2025');
  assert.equal(await main.getByTestId('filter-newer-year').inputValue(),'2026');
  assert.equal(await main.getByTestId('filter-region').inputValue(),'@who');
  await counts([32,46],[20,34]);
  for(const metric of ['submissions','approvals'])assert.equal(await main.getByTestId('chart-'+metric).getByTestId('chart-group').count(),3);
  assert.match(await main.locator('.who-scope').textContent(),/3\s+of\s+6/);
  const scar=main.getByTestId('chart-approvals').getByTestId('chart-group').filter({hasText:'Abbott Diagnostics Scarborough, Inc.'});
  assert.equal(await scar.count(),1);assert.match(await scar.locator('[data-year="2025"]').getAttribute('aria-label'),/Approvals: 0/);
  assert.equal(await scar.locator('.who-group-label').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'full Scarborough name fits without horizontal clipping');
  await screenshot('dark-three-sites');
  await main.getByRole('button',{name:'Use light theme'}).click();await screenshot('light-three-sites');
  assert.equal(await main.locator('.who-light').count(),1);
  await main.getByRole('button',{name:'Use dark theme'}).click();

  await main.getByTestId('filter-sites').click();
  for(const name of ['ABO','ADJ','ADK','AJG','ARDG','Abbott Diagnostics Scarborough, Inc.'])assert.equal(await main.getByRole('checkbox',{name,exact:true}).isChecked(),true);
  await main.getByRole('checkbox',{name:'ADK',exact:true}).uncheck();await counts([14,20],[7,13]);
  await main.getByTestId('filter-sites').click();
  await reset();
  await main.getByTestId('filter-region').selectOption('*');await counts([34,46],[22,34]);
  await main.getByRole('group',{name:'Group charts by'}).getByRole('button',{name:'Commercial region',exact:true}).click();
  assert.equal(await main.getByTestId('chart-submissions').getByTestId('chart-group').count(),3);
  assert.match(await main.getByTestId('chart-submissions').textContent(),/Not recorded/);
  await main.getByTestId('filter-region').selectOption('');await counts([1,0],[1,0]);
  assert.match(await main.getByTestId('chart-submissions').textContent(),/Not recorded/);
  await main.getByTestId('filter-region').selectOption('@who');await counts([32,46],[20,34]);
  assert.equal(await main.getByTestId('chart-submissions').getByTestId('chart-group').count(),1);
  await main.getByRole('group',{name:'Group charts by'}).getByRole('button',{name:'Site',exact:true}).click();
  assert.equal(await main.getByTestId('chart-submissions').getByTestId('chart-group').count(),3);

  await card('submissions',2026).click();
  const detail=main.getByTestId('details');
  assert.match(await detail.locator('.who-paging').textContent(),/1–20 of 46 records/);
  assert.equal(await detail.locator('tbody tr[data-record-id]').count(),20);
  await detail.getByRole('button',{name:'Next',exact:true}).click();assert.match(await detail.locator('.who-paging').textContent(),/21–40 of 46/);
  await detail.getByRole('button',{name:'Next',exact:true}).click();assert.match(await detail.locator('.who-paging').textContent(),/41–46 of 46/);
  assert.equal(await detail.getByRole('button',{name:'Next',exact:true}).isDisabled(),true);
  await page.evaluate(()=>{window.copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copied.push(text)}})});
  await detail.getByRole('button',{name:'Copy IDs',exact:true}).click();
  assert.equal(await page.evaluate(()=>new Set(copied.at(-1).split('\n')).size),46,'copy covers all selected records, not just the current page');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await detail.getByRole('button',{name:'Copy IDs',exact:true}).click();
  assert.equal(await detail.getByRole('textbox',{name:'IDs to copy'}).evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd).split('\n').length),46);
  await detail.getByRole('searchbox',{name:'Search details'}).fill('DEMO-SUB-ADK-2026-001');
  assert.equal(await detail.locator('tbody tr[data-record-id]').count(),1);
  await detail.getByRole('button',{name:'Open DEMO-SUB-ADK-2026-001 in platform'}).click();
  assert.match(await page.evaluate(()=>testApi.launches.at(-1)),/^https:\/\/example\.com\/fictional\/submissions\//);
  await detail.getByRole('button',{name:'Close details'}).click();
  await scar.locator('[data-year="2025"]').focus();await page.keyboard.press('Enter');
  assert.match(await detail.textContent(),/0 records/);await detail.getByRole('button',{name:'Close details'}).click();

  await page.evaluate(()=>testApi.reset(testApi.sixSiteSample()));
  assert.equal(await main.getByTestId('chart-submissions').getByTestId('chart-group').count(),6);await screenshot('dark-six-sites');
  await page.evaluate(()=>testApi.reset());
  await main.getByRole('button',{name:'Use screenshot layout'}).click();
  assert.equal(await main.locator('.who-capture').count(),1);assert.equal(await main.getByTestId('filter-unit').count(),0);
  await page.evaluate(()=>{testApi.resize(700,700);testApi.send()});
  assert.equal(await main.locator('.who-capture').count(),1,'resize and refresh preserve screenshot selection');
  await main.locator('.who-activity').focus();await page.keyboard.press('Escape');
  assert.equal(await main.locator('.who-capture').count(),0);
  assert.equal(await main.getByTestId('filter-unit').inputValue(),'ID');
  const panels=await main.locator('.who-chart-panel').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width})));
  assert.ok(panels[1].y>panels[0].y && Math.abs(panels[1].x-panels[0].x)<2,'narrow charts stack instead of squeezing labels');
  assert.equal(await main.locator('.who-activity').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  await page.setViewportSize({width:700,height:700});await screenshot('compact-three-sites');
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>testApi.resize(1440,820));

  // Dates, identity and assignment: status-only records never create historical milestones.
  await page.evaluate(()=>{
    const base={Site:'ABO',BusinessUnit:'ID',CommercialRegion:'WHO',AsOfDate:'2026-11-18'};
    const rows=[
      {...base,SubID:'CROSS-YEAR',ROID:'RO-CROSS-YEAR',ActualSubmission:'2025-03-04',ActualApproval:'2026-04-05'},
      {...base,SubID:'OLDER-SUB',ROID:'RO-OLDER-SUB',ActualSubmission:'2024-12-05',ActualApproval:'2026-05-06'},
      {...base,SubID:'FUTURE',ROID:'RO-FUTURE',ActualSubmission:'2026-12-01',ActualApproval:'2026-12-02'},
      {...base,SubID:'STATE-ONLY',ROID:'RO-STATE-ONLY',SubStatus:'Approved'},
      {...base,SubID:'BAD-DATE',ROID:'RO-BAD-DATE',ActualSubmission:'31/02/2026'},
      {...base,SubID:'NO-SITE',ROID:'RO-NO-SITE',Site:'',ActualSubmission:'2026-02-03'},
      {...base,SubID:'NO-REGION',ROID:'RO-NO-REGION',CommercialRegion:'',ActualSubmission:'2026-02-03'},
      {...base,SubID:'JOIN-1',ROID:'RO-SHARED',ActualSubmission:'2026-03-01',ActualApproval:'2026-06-07',Product:'<img src=x onerror="window.injected=true">',SubmissionURL:'javascript:alert(1)'},
      {...base,SubID:'JOIN-2',ROID:'RO-SHARED',ActualSubmission:'2026-03-02',ActualApproval:'2026-06-07',Product:'<script>bad()</script>',SubmissionURL:'data:text/html,unsafe'}
    ];testApi.reset(rows.flatMap(row=>[row,{...row},{...row}]));
  });
  await counts([1,3],[0,3]);
  assert.match(await main.getByTestId('chart-submissions').textContent(),/Unassigned site/);
  await card('submissions',2026).click();assert.equal(await detail.locator('tbody tr[data-record-id]').count(),3);
  assert.equal(await detail.locator('img,script').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.equal(await detail.getByRole('button',{name:/Open JOIN/}).count(),0);
  assert.match(await detail.textContent(),/<img src=x/);
  await detail.getByRole('button',{name:'Close details'}).click();
  await card('approvals',2026).click();
  assert.deepEqual((await detail.locator('.who-record-id').allTextContents()).sort(),['RO-CROSS-YEAR','RO-OLDER-SUB','RO-SHARED'],'approval Details list distinct ROs even when child submissions have different dates');
  await detail.getByRole('button',{name:'Close details'}).click();
  await main.getByTestId('data-checks').click();assert.match(await detail.textContent(),/NO-REGION/);assert.match(await detail.textContent(),/NO-SITE/);
  const blankEvidence=detail.locator('tr[data-record-id="NO-REGION"]').filter({hasText:'unclassifiedRegion'}).getByTestId('source-evidence');
  await blankEvidence.getByText('Source evidence',{exact:true}).click();
  assert.match(await blankEvidence.textContent(),/Raw commercial region: \(blank\)/);
  assert.match(await blankEvidence.textContent(),/3 delivered join rows/);
  const invalidEvidence=detail.locator('tr[data-record-id="BAD-DATE"]').getByTestId('source-evidence').first();
  await invalidEvidence.getByText('Source evidence',{exact:true}).click();
  assert.match(await invalidEvidence.textContent(),/ActualSubmission/);assert.match(await invalidEvidence.textContent(),/31\/02\/2026/);
  await detail.getByRole('button',{name:'Close details'}).click();

  await page.evaluate(()=>testApi.reset(testApi.sample(),{omit:['CommercialRegion']}));
  assert.match(await main.getByTestId('notices').textContent(),/Commercial.?region|CommercialRegion/i);
  assert.equal(await main.getByTestId('chart-bar').count(),0,'missing WHO classification does not count all countries');
  await page.evaluate(()=>testApi.reset(testApi.sample(),{omit:['ROID']}));
  assert.equal(await card('approvals',2026).isDisabled(),true);assert.equal(await card('submissions',2026).isDisabled(),false);
  await page.evaluate(()=>testApi.reset(testApi.sample(),{omit:['ActualSubmission']}));
  assert.equal(await card('submissions',2026).isDisabled(),true);assert.equal(await card('approvals',2026).isDisabled(),false);
  await page.evaluate(()=>testApi.reset([{SubID:'CUSTOM-REGION',ROID:'RO-CUSTOM-REGION',Site:'ADK',BusinessUnit:'ID',CommercialRegion:'WHO regional programme',ActualSubmission:'2026-03-01',ActualApproval:'2026-04-01',AsOfDate:'2026-11-18'}]));
  await counts([0,0],[0,0]);
  await main.getByTestId('filter-region').selectOption('WHO regional programme');
  await counts([0,1],[0,1]);

  await page.evaluate(()=>{testApi.setAllowFetch(true);testApi.fetchRequests.length=0;testApi.reset(testApi.sample().filter(r=>r.Site==='ABO'),{partial:true})});
  assert.match(await main.getByTestId('notices').textContent(),/partial/i);
  const request=await page.evaluate(()=>testApi.fetchRequests.at(-1));assert.equal(request.aggregate,true);assert.match(request.text,/Submissions/);assert.match(request.text,/14/,'first batch is rendered before fetching more');
  await page.evaluate(()=>testApi.send(testApi.sample(),{append:true}));await counts([32,46],[20,34]);
  assert.equal(await main.getByTestId('notices').count(),0);
  await page.evaluate(()=>{testApi.setAllowFetch(false);testApi.send(testApi.sample(),{partial:true})});assert.match(await main.getByTestId('notices').textContent(),/partial/i);
  await reset();

  await page.evaluate(()=>{window.oldPreferences={unit:'CMI',theme:'light',whoValue:'*',groupBy:'region',years:[2025,2026]};testApi.reset(testApi.sample(),{preferences:window.oldPreferences})});
  assert.equal(await main.getByTestId('filter-unit').inputValue(),'CMI');assert.equal(await main.getByTestId('filter-region').inputValue(),'*');assert.equal(await main.locator('.who-light').count(),1);
  await main.getByTestId('filter-region').selectOption('@who');
  assert.equal(await page.evaluate(()=>JSON.parse(testApi.persisted.at(-1).merge[0].properties.state).whoValue),'@who');
  await page.evaluate(()=>testApi.send(testApi.sample(),{preferences:window.oldPreferences}));
  assert.equal(await main.getByTestId('filter-region').inputValue(),'@who','delayed metadata echo must not reverse the latest filter selection');
  await page.evaluate(()=>testApi.send());assert.equal(await main.getByTestId('filter-unit').inputValue(),'CMI');
  await reset();await page.evaluate(()=>testApi.second());
  const second=page.locator('#second');assert.equal(await second.getByTestId('chart-submissions').getByTestId('chart-group').count(),1);
  await main.getByTestId('filter-unit').selectOption('CMI');assert.equal(await second.getByTestId('filter-unit').inputValue(),'ID');
  await reset();await page.evaluate(()=>{testApi.host.colorPalette.isHighContrast=true;testApi.resize(1440,820)});
  assert.equal(await main.locator('.who-high-contrast').count(),1);
  assert.equal(await main.locator('.who-activity').evaluate(e=>getComputedStyle(e).getPropertyValue('--who-text').trim()),'#ffffff');
  await page.evaluate(()=>{testApi.host.colorPalette.isHighContrast=false;testApi.resize(1440,820)});

  const elapsed=await page.evaluate(()=>{
    const sites=['ABO','ADJ','ADK','AJG','ARDG','Abbott Diagnostics Scarborough, Inc.'];
    const rows=Array.from({length:10000},(_,i)=>({SubID:'LOAD-SUB-'+i,ROID:'LOAD-RO-'+i,Site:sites[i%6],CommercialRegion:'WHO',BusinessUnit:'ID',ActualSubmission:i%2?'2025-04-01':'2026-04-01',ActualApproval:i%3?'2026-05-01':null,AsOfDate:'2026-11-18'}));
    const started=performance.now();testApi.reset(rows.flatMap(row=>[row,{...row},{...row}]));return performance.now()-started;
  });
  await counts([5000,5000],[0,6666]);
  console.log(`${label}: 30,000 joined rows / 10,000 distinct submissions rendered in ${Math.round(elapsed)} ms`);
  assert.deepEqual(await page.evaluate(()=>testApi.errors),[]);assert.deepEqual(errors,[]);
  await reset();console.log(`${label}: WHO interaction, mapping, dates, filters, pagination, accessibility and lifecycle checks passed.`);
}

async function main() {
  const {chromium}=require('./powerbi/node_modules/@playwright/test');
  const root=__dirname,server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'}).end(data)});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {
    browser=await chromium.launch({headless:true,channel:process.env.WHO_BROWSER_CHANNEL||undefined});
    const page=await browser.newPage({viewport:{width:1440,height:900},timezoneId:'Europe/Dublin'});
    const base='http://127.0.0.1:'+server.address().port;
    await runSuite(page,base+'/verify/harness.html',{screenshots:true});
    await page.goto(base+'/preview.html');
    await page.getByText('Preview · fictional data',{exact:true}).waitFor();
    assert.equal(await page.getByTestId('chart-submissions').getByTestId('chart-group').count(),3);
    await page.screenshot({path:path.join(root,'verify','preview-dark.png'),fullPage:true});
    await page.getByRole('button',{name:'Six active sites',exact:true}).click();
    assert.equal(await page.getByTestId('chart-submissions').getByTestId('chart-group').count(),6);
    await page.getByRole('button',{name:'Three active sites / reset',exact:true}).click();
    assert.equal(await page.getByTestId('chart-submissions').getByTestId('chart-group').count(),3);
  }
  finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={runSuite};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
