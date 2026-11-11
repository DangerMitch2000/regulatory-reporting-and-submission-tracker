const assert=require('node:assert/strict');

// Run unchanged against the source Visual class and the shipped PBIVIZ runtime.
module.exports=async function checkV16(page,scope=page){
 const originalTime=await page.evaluate(()=>Date.now());
 await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
 const base={Site:'ABO',BusinessUnit:'ID',Product:'Product A',CommercialRegion:'North',FallbackCountry:'France',PlannedSubmission:'2026-10-01',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'No',ROID:'RO-A',AppID:'APP-A'};
 const row=(SubID,patch={})=>({...base,SubID,...patch});
 const approval={RegistrationID:'REG-A',RegistrationStatus:'Approved',RegistrationCountry:'Ireland',RegistrationStart:'01/09/2026 00:00:00',RegistrationEnd:'2036-09-01'};
 const rows=[
  row('PREV-OPEN',{PlannedSubmission:'01/09/2026 00:00:00'}),
  row('CURRENT-OPEN'),
  row('NEXT-INTERNAL',{PlannedSubmission:'2026-11-01',DispatchRequired:'Yes',PlannedDispatch:'05/10/2026 00:00:00'}),
  row('ACTUAL',{...approval,RegistrationID:'REG-ACTUAL',PlannedSubmission:'2026-10-02',ActualSubmission:'08/10/2026 00:00:00',SubStatus:'Completed'}),
  row('STATE',{...approval,RegistrationID:'REG-STATE',PlannedSubmission:'2026-10-03',SubStatus:'Completed'}),
  row('REG',{...approval,PlannedSubmission:'2026-10-04'}),
  row('TODAY-ACTUAL',{PlannedSubmission:'2026-10-05',ActualSubmission:'2026-10-09'}),
  row('DUE-YESTERDAY',{PlannedSubmission:'08/10/2026 00:00:00'}),
  row('DUE-TODAY',{PlannedSubmission:'2026-10-09'}),
  row('BACKLOG',{PlannedSubmission:'2026-08-31'}),
  row('LATER-INTERNAL',{PlannedSubmission:'2026-12-01',DispatchRequired:'Yes',PlannedDispatch:'2026-10-05'})
 ];
 const send=(data,omit=[])=>page.evaluate(({data,omit})=>window.send?window.send(data.flatMap(r=>[r,r]),omit):testApi.send(data.flatMap(r=>[r,r]),{omit}),{data,omit});
 const close=async()=>{const button=scope.getByRole('button',{name:'Close details',exact:true});if(await button.count())await button.click();};
 const resetFilters=async()=>{
  await close();
  for(const label of ['Business unit','Product','Commercial region','Country']){const control=scope.getByRole('combobox',{name:label,exact:true});if(await control.isEnabled())await control.selectOption('*');}
  const state=scope.locator('.ssStateFilter[data-role=SubStatus]');await state.locator('summary').click();await scope.getByRole('button',{name:'All Submission state values',exact:true}).click();await state.locator('summary').click();
 };
 const metric=name=>scope.locator(`.ssMetricHit[data-scope=plan][data-metric=${name}]`);
 const ids=()=>scope.locator('.ssRecordRow .ssSubmissionId').allTextContents();
 const expectIds=async(expected)=>assert.deepEqual((await ids()).sort(),expected.slice().sort());
 const mainRow=id=>scope.locator('.ssRecordRow').filter({has:page.locator('.ssSubmissionId').filter({hasText:new RegExp('^'+id+'$')})});
 const expand=async(id)=>{const button=mainRow(id).locator('.ssExpandRecord');if(await button.getAttribute('aria-expanded')!=='true')await button.click();return scope.locator('.ssRecordDetail').filter({hasText:id});};
 await send(rows);await resetFilters();
 assert.equal(await scope.locator('.ssHit').count(),18,'six sites each show previous/current/next month');
 assert.deepEqual([...new Set(await scope.locator('.ssHit').evaluateAll(nodes=>nodes.map(n=>n.dataset.month)))],['2026-09','2026-10','2026-11']);
 assert.match(await scope.locator('svg').getAttribute('aria-label'),/9 planned, 5 in process, 3 submitted, 1 check date/);
 assert.match(await scope.locator('.siteSubmissions').textContent(),/08 Oct 2026/,'as-of text uses yesterday');
 assert.equal(await scope.locator('.ssCountHelp').getAttribute('open'),null,'long counting rules are collapsed initially');
 await metric('planned').click();await expectIds(rows.slice(0,9).map(r=>r.SubID));await close();
 await scope.locator('.ssHit[data-site=ABO][data-month="2026-09"]').click();await expectIds(['PREV-OPEN']);await close();
 await scope.locator('.ssBacklogHit[data-site="*"]').click();await expectIds(['BACKLOG']);await close();
 await metric('overdue').click();await expectIds(['PREV-OPEN','CURRENT-OPEN','NEXT-INTERNAL']);
 assert.deepEqual(await ids(),['NEXT-INTERNAL','CURRENT-OPEN','PREV-OPEN'],'most recently overdue appears first');
 assert.deepEqual(await scope.locator('.ssRecordRow [data-column=days]').allTextContents(),['3','7','37']);
 await scope.getByRole('combobox',{name:'Details order',exact:true}).selectOption('due:asc');assert.deepEqual(await ids(),['PREV-OPEN','CURRENT-OPEN','NEXT-INTERNAL']);await close();
 await scope.locator('.ssOverdueHit[data-group=all]').click();await expectIds(['PREV-OPEN','CURRENT-OPEN','NEXT-INTERNAL','BACKLOG','LATER-INTERNAL']);await close();
 // Actual submission today is after the agreed reference date; due yesterday
 // is not overdue yet. Today must not silently leak into yesterday's counts.
 await metric('review').click();await expectIds(['TODAY-ACTUAL']);await close();
 for(const [source,id] of [['actual','ACTUAL'],['state','STATE'],['registration','REG']]){
  await scope.locator(`.ssEvidenceHit[data-evidence=${source}]`).click();await expectIds([id]);await close();
 }
 await metric('planned').click();
 assert.match(await scope.locator('thead').textContent(),/Days overdue/);
 assert.equal(await scope.locator('.ssRecordDetail').count(),0,'secondary fields do not occupy collapsed rows');
 const todayRow=mainRow('DUE-YESTERDAY');assert.match(await todayRow.textContent(),/08 Oct 2026/);assert.doesNotMatch(await todayRow.textContent(),/00:00:00/);
 await expand('REG');assert.equal(await mainRow('REG').locator('.ssExpandRecord').getAttribute('aria-expanded'),'true');
 assert.match(await scope.locator('.ssRecordDetail').textContent(),/REG-A.*Approved|Approved.*REG-A/);
 assert.match(await scope.locator('.ssRecordDetail').textContent(),/RO-A/);assert.match(await scope.locator('.ssRecordDetail').textContent(),/APP-A/);
 await mainRow('REG').locator('.ssExpandRecord').click();assert.equal(await scope.locator('.ssRecordDetail').count(),0);
 // Columns expose actual ordering and filtering; filtering narrows copy as well.
 await scope.locator('.ssSort[data-column=id]').click();const ordered=await ids();
 assert.deepEqual(ordered,ordered.slice().sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})));
 await scope.locator('.ssSort[data-column=id]').click();assert.deepEqual(await ids(),ordered.slice().reverse());
 const idFilter=scope.locator('.ssColumnFilter[data-column=id]');await idFilter.fill('CURRENT');
 await page.evaluate(()=>{window.v16Copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>v16Copies.push(value)}})});
 await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.equal(await page.evaluate(()=>v16Copies.at(-1)),'CURRENT-OPEN');await expectIds(['CURRENT-OPEN']);
 await close();await metric('overdue').click();await expectIds(['PREV-OPEN','CURRENT-OPEN','NEXT-INTERNAL']);await close();
 // The same joined submission must satisfy product+region together. Completion
 // still uses all its delivered evidence, and its registration country wins.
 const joined=[row('JOIN',{Product:'Product A',CommercialRegion:'North',RegistrationID:'REG-JOIN',RegistrationStatus:'Approved',RegistrationCountry:'Ireland'}),row('JOIN',{Product:'Product B',CommercialRegion:'South',SubStatus:'Planned'}),row('FALLBACK',{Product:'Product B',CommercialRegion:'North',FallbackCountry:'France'})];
 await send(joined);await scope.getByRole('combobox',{name:'Product',exact:true}).selectOption('Product B');await scope.getByRole('combobox',{name:'Commercial region',exact:true}).selectOption('North');
 await metric('planned').click();await expectIds(['FALLBACK']);await close();
 await scope.getByRole('combobox',{name:'Commercial region',exact:true}).selectOption('South');await metric('submitted').click();await expectIds(['JOIN']);await close();
 await scope.getByRole('combobox',{name:'Country',exact:true}).selectOption('France');await metric('planned').click();await expectIds([]);await close();
 await scope.getByRole('combobox',{name:'Country',exact:true}).selectOption('Ireland');await metric('submitted').click();await expectIds(['JOIN']);await close();
 const persisted=await page.evaluate(()=>window.testApi?.persisted.at(-1));
 if(persisted){const saved=JSON.parse(persisted.merge[0].properties.state);assert.equal(saved.product,'Product B');assert.equal(saved.region,'South');assert.equal(saved.country,'Ireland');}
 await send(joined,['Product','CommercialRegion','RegistrationCountry','FallbackCountry']);
 for(const label of ['Product','Commercial region','Country'])assert.equal(await scope.getByRole('combobox',{name:label,exact:true}).isDisabled(),true);
 await metric('planned').click();await expectIds(['JOIN','FALLBACK']);await close();
 await send(rows);await resetFilters();
 // A country/site with no delivered work still has usable zero-count drilldown.
 await scope.locator('.ssHit[data-site=ADK][data-month="2026-09"]').click();await expectIds([]);assert.equal(await scope.getByRole('button',{name:'Copy IDs',exact:true}).isDisabled(),true);await close();
 await scope.locator('.ssSites summary').click();
 for(const [i,site] of ['ABO','ADJ','ADK','AJG','ARDG','SCR'].entries()){await scope.getByRole('checkbox',{name:'Include '+site,exact:true}).click();assert.equal(await scope.locator('.ssHit').count(),(5-i)*3);}
 assert.equal(await scope.locator('.ssHit').count(),0);assert.match(await scope.locator('svg').textContent(),/Choose up to six sites/);
 await scope.getByRole('button',{name:'Use main six sites',exact:true}).click();await scope.locator('.ssSites summary').click();
 for(const width of [1440,760,520]){
  await page.evaluate(width=>{const v=window.visual||testApi.visual;v.update({type:4,viewport:{width,height:820}})},width);
  const overflow=await scope.locator('.siteSubmissions').evaluate(root=>({scroll:root.scrollWidth,client:root.clientWidth}));
  assert.ok(overflow.scroll<=overflow.client+1,`visual overflows at ${width}px: ${JSON.stringify(overflow)}`);
  assert.equal(await scope.locator('.ssHit').count(),18);
  assert.deepEqual(await scope.locator('svg').evaluate(svg=>[...svg.querySelectorAll('text')].filter(n=>{const b=n.getBBox(),v=svg.viewBox.baseVal;return b.x<0||b.x+b.width>v.width+1||b.y+b.height>v.height+1}).map(n=>n.textContent)),[]);
 }
 await page.evaluate(()=>{const v=window.visual||testApi.visual;v.update({type:4,viewport:{width:1440,height:800}})});
 await page.clock.setFixedTime(new Date(originalTime));
};
