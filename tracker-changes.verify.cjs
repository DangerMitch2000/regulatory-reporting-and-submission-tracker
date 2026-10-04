const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async(page,{outputDir})=>{
 await page.goto('http://127.0.0.1:8771/index.html');await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 await page.evaluate(()=>{const b={...window.__dispatchRows[0],AppID:'A2',ROID:'R2',SubID:'S2',EventName:'E2',EventState:'In Progress State',ChangeID:'C2',ChangeQMS:'CR2',EventQMS:'CR2',ChangeStatus:'In Progress',ChangeCreated:'2026-01-01',ChangePlannedImplementation:'2027-12-01',ChangeResponseDue:'2026-03-01',ChangeResponseCount:2,AssessmentCountry:'Hungary',Country:'Hungary',AssessmentTimeline:'6–8 months',AssessmentMOHFiling:'Not required',AssessmentDocumentation:'Form A\nCertificate B',ActualDispatch:null,LatestDispatch:'2027-01-01',OriginalDispatch:'2027-01-01'};window.__dispatchSend([b,{...b,EventName:'E10',ROID:'R10',SubID:'S10'},{...b,ChangeID:'C10',ChangeQMS:'CR10',EventQMS:'CR10',EventName:'E20',SubID:'S20',ChangeStatus:'Completed'},{...b,ChangeID:null,ChangeQMS:null,EventQMS:null,EventName:'E30',SubID:'S30'}]);});
 await page.locator('#host #filter-status').filter({hasText:'2 change IDs · 4 events'}).waitFor();
 await page.locator('#host select[name=groupBy]').selectOption('Change initiation');
 const visible=()=>page.evaluate(()=>window.__themeVisual.app.view.data('visible').map(r=>({level:r.level,id:r.ChangeID,event:r.EventName,key:r.key})));
 let v=await visible();assert.deepEqual(v.map(r=>r.id),['C10','C2','']);
 await page.evaluate(async()=>{const v=window.__themeVisual.app.view,rows=v.data('changeRows');v.change('expanded',window.__themeVega.changeset().remove(()=>true).insert(rows.filter(r=>r.level<2).map(r=>({key:r.key}))));await v.runAsync();});
 v=await visible();assert.equal(v.filter(r=>r.level===-1&&r.id==='C2').length,2);
 // Select through Vega signals, then inspect the same Details renderer used by clicks.
 await page.evaluate(async()=>{const v=window.__themeVisual.app.view,r=v.data('changeRows').find(r=>r.level===2&&r.ChangeID==='C2');v.signal('selectedKey',r.key);await v.runAsync();});
 await page.locator('#host #selected-details').evaluate(e=>e.open=true);
 await page.locator('#host .change-details').filter({hasText:'Certificate B'}).waitFor();
 assert.match(await page.locator('#host .change-details').innerText(),/Not required/);
 await page.locator('#host .hierarchyHeader text').click();await page.waitForTimeout(250);v=await visible();assert.equal(v[0].id,'C2');assert.equal(v.at(-1).id,'');
 for(const group of ['Application','Regulatory event','Change initiation']){await page.locator('#host select[name=groupBy]').selectOption(group);assert.ok((await visible()).length>0);}
 await page.evaluate(async()=>{const v=window.__themeVisual.app.view;v.signal('rowRequest',{pos:3});await v.runAsync();});
 await page.mouse.move(5,5);await page.locator('#host').screenshot({path:path.join(outputDir,'changes-dark.png')});
 await page.locator('#host #theme-select').selectOption('light');await page.locator('#host').screenshot({path:path.join(outputDir,'changes-light.png')});
 const ranges=await page.evaluate(()=>window.__themeVisual.app.view.data('surveyRows').filter(r=>r.start!=null));assert.ok(ranges.length>=3);
 console.log('PASS: multiple events per change, other events, numeric sort, grouping, country assessment Details and both themes.');
};
