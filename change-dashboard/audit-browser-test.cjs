const assert=require('node:assert/strict');

/** Additional regression checks run against both source and packaged Visuals. */
async function runChecks(page,demoRows,largeRows,{observe=false}={}){
 const findings=[];
 const check=(condition,message,detail)=>{if(!condition)findings.push({message,detail});};
 await page.setViewportSize({width:1280,height:1000});
 await page.evaluate(()=>dashboardHarness.create('audit'));
 const scope=page.locator('#audit');
 const rows=largeRows(200);
 await page.evaluate(rows=>dashboardHarness.send('audit',rows),rows);
 check(await scope.locator('[data-action=unlinked]:enabled').count()===0,'Empty missing-ID review disables both pagination controls');
 const visibleIDs=()=>scope.locator('.cd-record[data-action=change]').allTextContents();
 await scope.locator('[data-action=page][data-value="1"]').click();
 const pageIDs=await visibleIDs(),pageState=await page.evaluate(()=>dashboardHarness.state('audit'));
 check(pageIDs.includes(pageState.selected),'Changing main page must select a visible record, not leave Details on the previous page',{pageIDs,selected:pageState.selected});
 check(await scope.locator('.cd-record[data-action=change]').first().evaluate(n=>n===document.activeElement),'Disabled last-page Next moves keyboard focus to the visible selection');

 await scope.locator('[data-action=page][data-value="0"]').click();
 const table=scope.locator('.cd-body>.cd-table-wrap');
 await table.evaluate(el=>el.scrollTop=el.scrollHeight-el.clientHeight);
 const beforeScroll=await table.evaluate(el=>el.scrollTop);
 const record=scope.locator('.cd-record[data-action=change]').last(),recordID=await record.textContent();
 await record.focus({preventScroll:true});await page.keyboard.press('Enter');
 const afterSelect=await scope.locator('.cd-body>.cd-table-wrap').evaluate(el=>el.scrollTop);
 const active=await page.evaluate(()=>({action:document.activeElement?.getAttribute('data-action'),value:document.activeElement?.getAttribute('data-value')}));
 check(afterSelect>=beforeScroll-2,'Selecting a row must preserve the main table scroll position',{beforeScroll,afterSelect});
 check(active.action==='change'&&active.value===recordID,'Keyboard row selection must retain focus on the selected record',{recordID,active});

 const sort=scope.locator('[data-sort=main][data-col=record]');await sort.focus();await page.keyboard.press('Enter');
 const afterSort=await page.evaluate(()=>({table:document.activeElement?.getAttribute('data-sort'),col:document.activeElement?.getAttribute('data-col')}));
 check(afterSort.table==='main'&&afterSort.col==='record','Keyboard sorting must retain focus on its column heading',afterSort);

 // Superseded data cannot overwrite the final payload or trigger stale fetches.
 await page.evaluate(async rows=>{
  const a=dashboardHarness.instances.audit;a.calls.length=0;
  const old=dashboardHarness.send('audit',rows.slice(0,1),{segment:true});
  const newer=dashboardHarness.send('audit',rows);
  const resize=dashboardHarness.send('audit',[],{type:4,width:736,height:800,noDataView:true});
  await Promise.all([old,newer,resize]);
 },demoRows);
 const burst=await page.evaluate(()=>{const r=dashboardHarness.instances.audit;return {calls:r.calls,state:r.visual.app.getState(),coverage:r.visual.app.getResult().visibleCoverage,events:r.events,notice:r.element.querySelector('.host-notice').textContent};});
 check(burst.calls.length===0,'A superseded partial batch must not request stale additional data',burst.calls);
 check(!burst.events.some(x=>x.startsWith('failed')),'Burst data/resize updates must not produce rendering errors',burst.events);
 check(burst.coverage.event>0,'Latest complete data remains displayed after queued resize',burst.coverage);
 check(!/Loading additional|limited the delivered/.test(burst.notice),'Completed data clears partial-loading notices',burst.notice);

 // Data replacement is accumulated by the host; the visual must never append it again.
 await page.evaluate(rows=>dashboardHarness.send('audit',rows,{segment:true}),demoRows.slice(0,2));
 await page.evaluate(rows=>dashboardHarness.send('audit',rows),demoRows);
 const beforeEmpty=await page.evaluate(()=>dashboardHarness.instances.audit.visual.app.getResult().visibleCoverage);
 await page.evaluate(rows=>dashboardHarness.send('audit',rows),demoRows);
 const repeated=await page.evaluate(()=>dashboardHarness.instances.audit.visual.app.getResult().visibleCoverage);
 check(JSON.stringify(beforeEmpty)===JSON.stringify(repeated),'Repeated accumulated data must not inflate distinct counts',{beforeEmpty,repeated});
 await page.evaluate(()=>dashboardHarness.send('audit',[]));
 check(await scope.locator('.cd-detail').count()===0,'An empty data refresh must remove stale Details');
 check((await scope.locator('.cd-record[data-action=change]').count())===0,'An empty data refresh must remove stale worklist rows');
 await page.evaluate(rows=>dashboardHarness.send('audit',rows),demoRows);
 check((await scope.locator('.cd-record[data-action=change]').count())>0,'A valid update recovers after empty data');
 await page.evaluate(async()=>{const r=dashboardHarness.instances.audit;const update=dashboardHarness.send('audit',[],{segment:true});r.visual.destroy();await update;await r.visual.queue;});
 check(await scope.locator('.change-dashboard-host').count()===0,'Destroy during a queued update must remove the visual');
 if(observe){console.log('AUDIT FINDINGS '+JSON.stringify(findings));return findings;}
 assert.deepEqual(findings,[],'Interaction/lifecycle audit regressions');
 console.log('PASS interaction/lifecycle audit: paging selection, scroll/focus, burst data/resize, stale fetch prevention, repeated accumulation, empty refresh and destroy.');
}
module.exports={runChecks};
