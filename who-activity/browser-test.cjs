const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');

async function runSuite(page,url,{screenshots=false,label='source'}={}) {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await page.goto(url);await page.waitForSelector('body[data-ready=true]').catch(error=>{throw new Error(`${error.message}\nPage errors: ${errors.join('\n')}`)});
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
  assert.equal(await detail.getByRole('columnheader',{name:/\bSource\b/}).count(),0);
  assert.equal(await detail.getByRole('columnheader',{name:/\bPlatform\b/}).count(),0);
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
  const recordLink=detail.getByRole('button',{name:'Open DEMO-SUB-ADK-2026-001 in platform'});
  assert.equal(await recordLink.textContent(),'DEMO-SUB-ADK-2026-001');
  await recordLink.click();
  assert.match(await page.evaluate(()=>testApi.launches.at(-1)),/^https:\/\/example\.com\/fictional\/submissions\//);
  await detail.getByRole('button',{name:'Close details'}).click();
  await scar.locator('[data-year="2025"]').focus();await page.keyboard.press('Enter');
  assert.match(await detail.textContent(),/0 records/);await detail.getByRole('button',{name:'Close details'}).click();
  await card('approvals',2026).click();
  await detail.getByRole('searchbox',{name:'Search details'}).fill('DEMO-RO-ADK-2026-001');
  const roLink=detail.getByRole('button',{name:'Open DEMO-RO-ADK-2026-001 in platform'});
  assert.equal(await roLink.textContent(),'DEMO-RO-ADK-2026-001');
  await roLink.focus();await page.keyboard.press('Enter');
  assert.match(await page.evaluate(()=>testApi.launches.at(-1)),/^https:\/\/example\.com\/fictional\/ros\//);
  await detail.getByRole('button',{name:'Close details'}).click();

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

  // Optional planning fields do not redefine the actual milestone history. Each
  // metric selects its own dates, deduplicates its own ID and retains provenance.
  await page.evaluate(()=>{
    const base={Site:'ABO',BusinessUnit:'ID',CommercialRegion:'WHO',AsOfDate:'2026-11-18',Country:'Ireland'};
    const rows=[
      {...base,SubID:'PLAN-A',ROID:'RO-PLAN-A',AppID:'APP-PLAN-A',AppStatus:'Archived',ROStatus:'Closed',SubStatus:'Completed',ActualSubmission:'2026-02-03',ActualApproval:'2026-04-05',OriginalSubmission:'2025-11-01',LatestSubmission:'2026-01-15',OriginalApproval:'2025-12-01',LatestApproval:'2026-03-01'},
      {...base,SubID:'PLAN-B',ROID:'RO-PLAN-B',AppID:'APP-PLAN-B',AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',ActualSubmission:null,ActualApproval:null,OriginalSubmission:'2026-12-01',LatestSubmission:'2026-12-20',OriginalApproval:'2026-12-05',LatestApproval:'2026-12-25',Country:'France'},
      {...base,SubID:'PLAN-C1',ROID:'RO-PLAN-C',AppID:'APP-PLAN-C',AppStatus:'Active',ROStatus:'Approved',SubStatus:'Completed',ActualSubmission:'2025-10-10',ActualApproval:'2026-02-02',OriginalSubmission:'2025-09-01',LatestSubmission:'2025-10-01',OriginalApproval:'2026-01-01',LatestApproval:'2026-02-01',Country:'France'},
      {...base,SubID:'PLAN-C2',ROID:'RO-PLAN-C',AppID:'APP-PLAN-C',AppStatus:'Active',ROStatus:'Approved',SubStatus:'Distributed',ActualSubmission:'2026-01-12',ActualApproval:'2026-02-02',OriginalSubmission:'2026-01-01',LatestSubmission:'2026-01-10',OriginalApproval:'2026-01-01',LatestApproval:'2026-02-01',Country:'France'},
      {...base,SubID:'PLAN-D',ROID:'RO-PLAN-D',AppID:'APP-PLAN-D',AppStatus:'',ROStatus:'',SubStatus:'',ActualSubmission:'2026-04-02',ActualApproval:'2026-05-03',OriginalSubmission:'31/02/2026',LatestSubmission:'2026-04-01',OriginalApproval:'31/02/2026',LatestApproval:'2026-05-01',Country:''},
      {...base,SubID:'PLAN-E',ROID:'RO-PLAN-E',AppID:'APP-PLAN-E',AppStatus:'Active',ROStatus:'Planned',SubStatus:'Planned',ActualSubmission:null,ActualApproval:null,OriginalSubmission:'2026-08-01',LatestSubmission:null,OriginalApproval:'2026-09-01',LatestApproval:null},
      {...base,SubID:'PLAN-F',ROID:'RO-PLAN-F',AppID:'APP-PLAN-F',AppStatus:'Active',ROStatus:'Pending',SubStatus:'Review',ActualSubmission:'2026-08-02',ActualApproval:'2026-10-02',OriginalSubmission:'2026-06-01',LatestSubmission:'2026-08-01',OriginalApproval:'2026-09-01',LatestApproval:'2026-10-01'}
    ];rows.push({...rows.at(-1),OriginalSubmission:'2026-07-01'});
    window.planningRows=rows.flatMap(row=>[row,{...row},{...row}]);testApi.reset(window.planningRows);
  });
  const basis=main.getByTestId('filter-date-basis');
  const statePicker=role=>main.getByTestId('filter-state-'+role);
  const setState=async(role,values)=>{
    const picker=statePicker(role);
    if(!await picker.isVisible())await main.locator('.who-more > summary').click();
    if(await picker.getAttribute('open')===null)await picker.locator('summary').click();
    await picker.getByRole('button',{name:values==='*'?'All':'Clear',exact:true}).click();
    if(values!=='*')for(const value of values)await picker.getByRole('checkbox',{name:({AppStatus:'Application',ROStatus:'RO',SubStatus:'Submission'}[role])+' state: '+(value||'Not recorded'),exact:true}).check();
    if(await picker.getAttribute('open')!==null)await picker.locator('summary').click();
  };
  assert.equal(await basis.inputValue(),'actual');
  await counts([1,4],[0,4]);
  await screenshot('planning-main');
  await card('submissions',2026).click();
  const plannedRow=detail.locator('tr[data-record-id="PLAN-A"]');
  assert.match(await plannedRow.getByTestId('record-dates').textContent(),/Initial[\s\S]*1 Nov 2025[\s\S]*LBE[\s\S]*15 Jan 2026[\s\S]*Actual[\s\S]*3 Feb 2026/);
  assert.match(await plannedRow.textContent(),/Archived/);assert.match(await plannedRow.textContent(),/Closed/);assert.match(await plannedRow.textContent(),/Completed/);
  assert.equal(await detail.getByRole('button',{name:'Sort by Country',exact:true}).count(),1);
  await screenshot('planning-details');
  await detail.getByRole('button',{name:'Close details'}).click();
  await card('approvals',2026).click();
  assert.match(await detail.locator('tr[data-record-id="RO-PLAN-A"]').getByTestId('record-dates').textContent(),/Initial[\s\S]*1 Dec 2025[\s\S]*LBE[\s\S]*1 Mar 2026[\s\S]*Actual[\s\S]*5 Apr 2026/);
  await detail.getByRole('button',{name:'Close details'}).click();
  await basis.selectOption('initial');await counts([2,3],[1,4]);
  await basis.selectOption('lbe');await counts([1,5],[0,5]);
  assert.match(await main.getByTestId('chart-submissions').textContent(),/LBE/i);
  await card('submissions',2026).click();
  assert.equal(await detail.locator('tr[data-record-id="PLAN-B"]').count(),1,'future LBE plans remain visible before their target date');
  assert.equal(await detail.locator('tr[data-record-id="PLAN-E"]').count(),0,'missing LBE is not replaced by initial plan');
  await detail.getByRole('button',{name:'Close details'}).click();
  await basis.selectOption('actual');await setState('AppStatus',['Archived']);await counts([0,1],[0,1]);
  await screenshot('planning-options');
  await main.getByRole('button',{name:'Use screenshot layout'}).click();
  assert.match(await main.textContent(),/Application state: Archived/,'screenshot layout discloses active state filters');
  await main.locator('.who-activity').focus();await page.keyboard.press('Escape');
  await setState('AppStatus',['']);await counts([0,1],[0,1]);
  await setState('AppStatus',['Active','Archived']);await counts([1,3],[0,3]);
  await setState('AppStatus','*');await setState('ROStatus',['Approved']);await setState('SubStatus',['Planned']);await counts([0,0],[0,0]);
  await setState('ROStatus','*');await setState('SubStatus',['Distributed']);await counts([0,1],[0,1]);
  await setState('SubStatus',['Completed']);await counts([1,1],[0,2]);
  await setState('SubStatus','*');await counts([1,4],[0,4]);
  const country=main.getByTestId('filter-country');
  await country.selectOption('France');await counts([1,1],[0,1]);
  assert.equal(await main.getByTestId('filter-region').inputValue(),'@who','Country does not replace the independent WHO classification filter');
  await setState('AppStatus',['Archived']);await counts([0,0],[0,0]);
  await setState('AppStatus','*');await country.selectOption('');await counts([0,1],[0,1]);
  await country.selectOption('*');await basis.selectOption('initial');await setState('AppStatus',['Archived']);await counts([1,0],[1,0]);
  await page.evaluate(()=>{window.planningPreferences=JSON.parse(testApi.persisted.at(-1).merge[0].properties.state);testApi.reset(window.planningRows,{preferences:window.planningPreferences});testApi.resize(700,700);testApi.send(window.planningRows)});
  assert.equal(await basis.inputValue(),'initial');await counts([1,0],[1,0]);
  assert.deepEqual(await page.evaluate(()=>window.planningPreferences.stateFilters.AppStatus),['Archived']);
  assert.equal(await main.locator('.who-activity').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'planning controls fit a compact visual');
  await page.setViewportSize({width:700,height:700});await screenshot('compact-planning');
  await card('submissions',2025).click();await screenshot('compact-planning-details');await detail.getByRole('button',{name:'Close details'}).click();
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>testApi.resize(1440,820));
  await setState('AppStatus','*');await basis.selectOption('lbe');await country.selectOption('France');
  await page.evaluate(()=>{testApi.resize(1000,700);testApi.send(window.planningRows)});
  assert.equal(await basis.inputValue(),'lbe');assert.equal(await country.inputValue(),'France');await counts([1,2],[0,2]);
  assert.equal(await page.evaluate(()=>JSON.parse(testApi.persisted.at(-1).merge[0].properties.state).country),'France');
  await page.evaluate(()=>testApi.reset(window.planningRows,{preferences:JSON.parse(testApi.persisted.at(-1).merge[0].properties.state)}));
  assert.equal(await basis.inputValue(),'lbe');assert.equal(await country.inputValue(),'France');await counts([1,2],[0,2]);
  await page.evaluate(()=>testApi.reset(window.planningRows,{omit:['LatestSubmission'],preferences:{dateBasis:'lbe'}}));
  assert.equal(await card('submissions',2026).isDisabled(),true);assert.equal(await card('approvals',2026).isDisabled(),false);
  await page.evaluate(()=>testApi.reset(testApi.sample(),{omit:['AppStatus','ROStatus','SubStatus','OriginalSubmission','LatestSubmission','OriginalApproval','LatestApproval','Country']}));
  await counts([32,46],[20,34]);
  assert.equal(await country.isDisabled(),true);
  await main.locator('.who-more > summary').click();
  for(const role of ['AppStatus','ROStatus','SubStatus'])assert.equal(await statePicker(role).locator('summary').getAttribute('aria-disabled'),'true');
  await basis.selectOption('initial');assert.equal(await card('submissions',2026).isDisabled(),true);assert.equal(await card('approvals',2026).isDisabled(),true);
  await page.evaluate(()=>testApi.resize(1440,820));

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
    const rows=Array.from({length:10000},(_,i)=>({SubID:'LOAD-SUB-'+i,ROID:'LOAD-RO-'+i,AppID:'LOAD-APP-'+i,Site:sites[i%6],CommercialRegion:'WHO',Country:i%2?'Ireland':'France',BusinessUnit:'ID',AppStatus:i%5?'Active':'Archived',ROStatus:i%3?'Approved':'Planned',SubStatus:'Completed',ActualSubmission:i%2?'2025-04-01':'2026-04-01',ActualApproval:i%3?'2026-05-01':null,OriginalSubmission:i%2?'2025-03-01':'2026-03-01',LatestSubmission:i%2?'2025-03-15':'2026-03-15',OriginalApproval:'2026-04-01',LatestApproval:'2026-04-15',AsOfDate:'2026-11-18'}));
    const started=performance.now();testApi.reset(rows.flatMap(row=>[row,{...row},{...row}]));return performance.now()-started;
  });
  await counts([5000,5000],[0,6666]);
  await basis.selectOption('lbe');await counts([5000,5000],[0,10000]);
  await country.selectOption('Ireland');await counts([5000,0],[0,5000]);
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
