const assert=require('node:assert/strict');

/** Exercise both dates through the actual Visual factory, including the packaged runtime. */
async function runChecks(page,demoRows){
 await page.setViewportSize({width:1280,height:1000});
 await page.evaluate(()=>dashboardHarness.create('dual-dates'));
 const base={...demoRows[0],ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''};
 const item=(id,implementation,completion)=>({...base,ChangeID:'CHANGE-'+id,EventName:id,AppID:'APP-'+id,ROID:'RO-'+id,SubID:'SUB-'+id,ChangePlannedImplementation:implementation,EventPlannedCompletion:completion});
 const rows=[item('DATES-BOTH','2027-03-15','30/11/2026 00:00:00'),item('DATES-EVENT-ONLY','','01/12/2026 00:00:00'),item('DATES-CHANGE-ONLY','2027-01-01',''),item('DATES-INVALID','9000-01-01','2027-02-01'),item('DATES-EMPTY','','')];
 await page.evaluate(rows=>dashboardHarness.send('dual-dates',rows),rows);
 const scope=page.locator('#dual-dates');
 const row=id=>scope.locator('.cd-change-table tbody tr').filter({has:page.locator('[data-action=change][data-value="'+id+'"]')});
 const date=(id,field)=>row(id).locator('[data-planning-source="'+field+'"]');
 const change='ChangePlannedImplementation',event='EventPlannedCompletion';
 assert.match(await scope.locator('[data-sort=main][data-col=implementation]').textContent(),/Implementation.*event completion/i);
 for(const id of rows.map(r=>r.EventName))assert.equal(await row(id).locator('[data-planning-source]').count(),2,'both date sources remain identifiable on every row');
 assert.match(await date('DATES-BOTH',change).textContent(),/Change implementation.*15 Mar 2027/s);
 assert.match(await date('DATES-BOTH',event).textContent(),/Event planned completion.*30 Nov 2026/s);
 assert.match(await date('DATES-EVENT-ONLY',change).textContent(),/Not recorded/);
 assert.match(await date('DATES-EVENT-ONLY',event).textContent(),/01 Dec 2026/);
 assert.match(await date('DATES-CHANGE-ONLY',change).textContent(),/01 Jan 2027/);
 assert.match(await date('DATES-CHANGE-ONLY',event).textContent(),/Not recorded/);
 assert.match(await date('DATES-INVALID',change).textContent(),/Invalid|outside|Unusable/i,'invalid implementation is not hidden by an event date');
 assert.match(await date('DATES-INVALID',event).textContent(),/01 Feb 2027/,'valid event completion remains available beside an invalid implementation');
 assert.match(await date('DATES-EMPTY',change).textContent(),/Not recorded/);assert.match(await date('DATES-EMPTY',event).textContent(),/Not recorded/);

 const IDs=()=>scope.locator('.cd-record[data-action=change]').allTextContents();
 await scope.locator('[data-sort=main][data-col=implementation]').click();
 assert.deepEqual(await IDs(),['DATES-EVENT-ONLY','DATES-CHANGE-ONLY','DATES-INVALID','DATES-BOTH','DATES-EMPTY'],'ascending uses change date when usable, then usable event fallback, then undated rows');
 await scope.locator('[data-sort=main][data-col=implementation]').click();
 assert.deepEqual(await IDs(),['DATES-BOTH','DATES-INVALID','DATES-CHANGE-ONLY','DATES-EVENT-ONLY','DATES-EMPTY'],'descending still keeps missing dates last');
 await scope.locator('[data-filter-toggle=main][data-col=implementation]').click();
 const filter=scope.locator('[data-table-filter=main][data-col=implementation]');
 await filter.fill('30 Nov 2026');assert.deepEqual(await IDs(),['DATES-BOTH'],'the event date is searchable even when implementation is the preferred sort date');
 await filter.fill('15 Mar 2027');assert.deepEqual(await IDs(),['DATES-BOTH'],'implementation date is searchable independently');
 await filter.fill('Event planned completion');assert.equal((await IDs()).length,5,'both source labels are searchable');
 await scope.locator('[data-action=reset-table]').click();
 await page.evaluate(()=>dashboardHarness.instances['dual-dates'].allowed=1);
 await scope.locator('[data-action=export]').click();const csv=await scope.locator('.cd-copybox textarea').inputValue();
 assert.match(csv,/Planned implementation date/);assert.match(csv,/Event planned completion date/);
 assert.match(csv,/15 Mar 2027/);assert.match(csv,/30 Nov 2026/);await scope.locator('[data-action=close-copy]').click();

 // Multiple event dates under one application are not silently reduced to an arbitrary date.
 const shared=[{...rows[0],AppID:'APP-SHARED'},{...rows[0],EventName:'DATES-SECOND-EVENT',AppID:'APP-SHARED',ROID:'RO-SECOND',SubID:'SUB-SECOND',EventPlannedCompletion:'2026-12-15'}];
 await page.evaluate(rows=>dashboardHarness.send('dual-dates',rows),shared);await scope.locator('[data-group]').selectOption('application');
 assert.equal(await scope.locator('.cd-record[data-action=change]').textContent(),'APP-SHARED');
 assert.match(await date('APP-SHARED',change).textContent(),/15 Mar 2027/);
 assert.match(await date('APP-SHARED',event).textContent(),/Conflicting|Multiple|2 dates/i,'multiple event dates stay explicit in application view');
 await scope.locator('.cd-evidence details').evaluate(n=>n.open=true);
 assert.match(await scope.locator('.cd-source-fields').textContent(),/30 Nov 2026/);assert.match(await scope.locator('.cd-source-fields').textContent(),/15 Dec 2026/);
 await page.evaluate(async()=>{dashboardHarness.instances['dual-dates'].visual.destroy();await dashboardHarness.instances['dual-dates'].visual.queue;});
 console.log('PASS dual planning dates: separately labelled values, blank/invalid fallback, numeric sorting, both-source filtering/export, and multiple event dates in Application view.');
}
module.exports={runChecks};
