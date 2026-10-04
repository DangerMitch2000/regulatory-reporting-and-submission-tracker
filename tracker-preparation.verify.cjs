const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function(page,{outputDir}){
 await page.goto('http://127.0.0.1:8771/index.html');await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 const revision=await page.evaluate(()=>window.__qualityRevision);
 await page.evaluate(()=>{const base={...window.__dispatchRows[0],AppID:'PREP-APP',ROID:'PREP-RO',SubID:'PREP-ONE',Product:'Preparation example',SubStatus:'Planned',LMPrepDuration:'2 months',DispatchRequired:true,OriginalDispatch:'2026-11-30',LatestDispatch:'2026-11-30',ActualDispatch:null,ActualSubmission:null,ActualApproval:null};window.__dispatchSend([base,{...base,SubID:'PREP-TWO',Country:'Other destination',LMPrepDuration:null,LatestDispatch:'2026-12-31'},{...base,SubID:'PREP-NONE',DispatchRequired:false}]);});
 await page.waitForFunction(n=>window.__qualityRevision>n,revision);await page.locator('#host select[name=mode]').selectOption('Compare');
 const choose=async id=>{await page.locator('#host input[name=query]').fill(id);await page.locator('#host svg text').filter({hasText:new RegExp('^'+id+'$')}).click();await page.locator('#host #selected-details').evaluate(e=>e.open=true);return page.locator('#host .preparation-card').innerText();};
 let text=await choose('PREP-ONE');assert.match(text,/60 calendar days/);assert.match(text,/2026-10-01/);assert.match(text,/2026-11-30/);assert.equal(await page.locator('#host .mark-rect.role-mark.preparationRange path').count(),1);
 text=await choose('PREP-TWO');assert.match(text,/2026-11-01/);assert.match(text,/2 months/);
 text=await choose('PREP-NONE');assert.match(text,/Dispatch is not required/);assert.equal(await page.locator('#host .mark-rect.role-mark.preparationRange path').count(),0);
 await choose('PREP-ONE');await page.locator('#host').screenshot({path:path.join(outputDir,'preparation-dark.png')});await page.locator('#host #theme-select').selectOption('light');await page.waitForFunction(()=>document.querySelector('#host .regulatory-timeline').dataset.theme==='light');await page.locator('#host').screenshot({path:path.join(outputDir,'preparation-light.png')});
 console.log('PASS: actual Visual preparation field, inherited application duration, fixed-day dates, filtered bars, no-dispatch suppression and both themes.');
};
