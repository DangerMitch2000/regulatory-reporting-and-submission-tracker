const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function(page,{outputDir}){
 await page.goto('http://127.0.0.1:8771/index.html');
 await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 const revision=await page.evaluate(()=>window.__qualityRevision);
 await page.evaluate(()=>{
  const base={...window.__dispatchRows[0],AppID:'DETAIL-APP',ROID:'DETAIL-RO',SubID:'DETAIL-TARGET',Product:'Details fixture',SubStatus:'In Progress',DispatchRequired:true,OriginalDispatch:'2024-03-01',LatestDispatch:'2024-04-15T23:59:00-12:00',ActualDispatch:null,ActualSubmission:null,ActualApproval:null};
  window.__dispatchSend([base,{...base,SubID:'DETAIL-CLOSED',SubStatus:'Completed'},{...base,SubID:'DETAIL-FALSE',DispatchRequired:false},{...base,SubID:'DETAIL-ACTUAL',ActualDispatch:'2024-04-15T00:01:00+14:00'}]);
 });
 await page.waitForFunction(n=>window.__qualityRevision>n,revision);
 await page.locator('#host select[name=mode]').selectOption('Compare');
 const choose=async id=>{await page.locator('#host input[name=query]').fill(id);await page.locator('#host svg text').filter({hasText:new RegExp('^'+id+'$')}).click();await page.locator('#host #selected-details').evaluate(e=>e.open=true);await page.waitForFunction(id=>document.querySelector('#host #detail-title').textContent.includes(id),id);return page.locator('#host .dispatch-summary').innerText();};
 let text=await choose('DETAIL-TARGET');assert.match(text,/calendar days past dispatch target/);assert.match(text,/Latest dispatch plan\s+2024-04-15/);assert.match(text,/Preparation start: not recorded/);assert.ok(!text.includes('2024-04-16'),'Written calendar date, not offset-shifted date');
 text=await choose('DETAIL-CLOSED');assert.match(text,/Confirm dispatch record/);assert.ok(!text.includes('days past dispatch target'));
 text=await choose('DETAIL-FALSE');assert.match(text,/Not applicable — dispatch not required/);
 text=await choose('DETAIL-ACTUAL');assert.match(text,/Dispatched on the target date/);assert.match(text,/Actual dispatch\s+2024-04-15/);
 await choose('DETAIL-TARGET');await page.locator('#host #theme-select').selectOption('light');await page.waitForFunction(()=>document.querySelector('#host .regulatory-timeline').dataset.theme==='light');
 await page.locator('#host .dispatch-summary').screenshot({path:path.join(outputDir,'dispatch-details.png')});
 console.log('PASS: actual Visual submission Details dispatch dates, calendar-day timing, closed and not-required exceptions, same-day actual variance, and light theme.');
};
