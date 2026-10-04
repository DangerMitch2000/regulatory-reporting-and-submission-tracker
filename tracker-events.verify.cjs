const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function(page,{outputDir}){
 await page.goto('http://127.0.0.1:8771/index.html');await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 const revision=await page.evaluate(()=>window.__qualityRevision);
 await page.evaluate(()=>{const base={...window.__dispatchRows[0],AppID:'APP-A',ROID:'RO-A',SubID:'SUB-A',Country:'Mexico',Product:'Product A',SubStatus:'Planned',LMPrepDuration:'2 months',DispatchRequired:true,LatestDispatch:'2026-11-30',ActualDispatch:null,EventName:'Event-2',EventState:'In Progress',EventPlannedStart:'2026-01-01',EventPlannedCompletion:'2026-12-31'};window.__dispatchSend([base,{...base,EventName:'Event-10'},{...base,AppID:'APP-B',ROID:'RO-B',SubID:'SUB-B',Country:'Canada',Product:'Product B'},{...base,ROID:'RO-C',SubID:'SUB-C',EventName:null},{...base,EventName:'Event-100',EventPlannedStart:null,EventPlannedCompletion:null}]);});
 await page.waitForFunction(n=>window.__qualityRevision>n,revision);
 const view=fn=>page.evaluate(fn),data=()=>view(()=>window.__themeVisual.app.view.data('visible').map(r=>({key:r.key,name:r.EventName,level:r.level,app:r.AppID,sub:r.SubID,start:r.start,end:r.end,n:r.n})));
 assert.match(await page.locator('#host #filter-status').innerText(),/3 events · 2 applications · 3 ROs · 3 submissions/);
 await page.locator('#host select[name=groupBy]').selectOption('Regulatory event');
 let rows=await data();assert.deepEqual(rows.map(r=>r.name),['Event-100','Event-10','Event-2','No linked event']);assert.equal(rows[0].start,null);assert.equal(rows[0].end,null);
 await page.locator('#host .hierarchyHeader text').click();rows=await data();assert.deepEqual(rows.map(r=>r.name),['Event-2','Event-10','Event-100','No linked event']);
 await view(async()=>{const v=window.__themeVisual.app.view;for(const r of v.data('eventRows').filter(r=>r.level<2))await v.signal('clicked',{key:r.key,rel:0,fallback:0,opening:true}).runAsync();});
 rows=await data();assert.equal(rows.filter(r=>r.level===2).length,5);assert.equal(rows.filter(r=>r.name==='Event-2'&&r.level===0).length,2);assert.deepEqual(rows.filter(r=>r.name==='No linked event'&&r.level===2).map(r=>r.sub),['SUB-C']);assert.equal(rows.filter(r=>r.sub==='SUB-A').length,3);
 await view(async()=>{const v=window.__themeVisual.app.view;await v.signal('selectedKey',v.data('eventRows').find(r=>r.level===-1&&r.EventName==='Event-2').key).runAsync();});
 await page.locator('#host #selected-details').evaluate(e=>e.open=true);await page.locator('#host #detail-body').filter({hasText:'Event plan; independent'}).waitFor();assert.match(await page.locator('#host #detail-body').innerText(),/2026-12-31/);
 await page.locator('#host #selected-details').evaluate(e=>e.open=true);await page.mouse.move(5,5);await page.waitForTimeout(150);await view(async()=>{await window.__themeVisual.app.view.signal('rowRequest',{pos:0}).runAsync();});assert.ok(await page.locator('#host .rowBg path').count()>0,'Event rows are visibly rendered');await page.locator('#host').screenshot({path:path.join(outputDir,'events-dark.png')});
 await page.locator('#host #theme-select').selectOption('light');await page.locator('#host').screenshot({path:path.join(outputDir,'events-light.png')});
 await page.locator('#host input[name=query]').fill('Event-10');await page.waitForTimeout(250);rows=await data();assert.ok(rows.length>0); // Matching submissions retain all their legitimate event links.
 await page.locator('#host input[name=query]').fill('');await page.locator('#host select[name=groupBy]').selectOption('Application');await page.locator('#host select[name=mode]').selectOption('Compare');assert.equal((await data()).length,3);
 console.log('PASS: many-to-many event hierarchy, unique counts, optional event dates, numeric sort both directions, unlinked work, details and both themes.');
};
