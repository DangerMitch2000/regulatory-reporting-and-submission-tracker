const assert=require('node:assert/strict');
module.exports=async(page)=>{
 await page.goto('http://127.0.0.1:8771/index.html');await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 const revision=await page.evaluate(()=>window.__qualityRevision),start=Date.now();
 await page.evaluate(()=>{window.__perfRows=Array.from({length:10000},(_,i)=>({AppID:'PERF-A'+Math.floor(i/4),ROID:'PERF-R'+Math.floor(i/2),SubID:'PERF-S'+i,AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',Country:'Hungary',EventName:'PERF-E'+Math.floor(i/10),EventState:'In Progress State',ChangeID:i%5?'PERF-C'+Math.floor(i/30):null,ChangeQMS:i%5?'CR'+Math.floor(i/30):null,EventQMS:i%5?'CR'+Math.floor(i/30):null,ChangeStatus:'In Progress',OriginalDispatch:'2027-01-01',LatestDispatch:'2027-01-01',OriginalSubmission:'2027-02-01',LatestSubmission:'2027-02-01',OriginalApproval:'2027-12-01',LatestApproval:'2027-12-01'}));window.__perfRows.push(...window.__perfRows.slice(0,100).map(r=>({...r,EventName:'OVERLAP-'+r.EventName})),...window.__perfRows.slice(0,100));const ids=[...new Set(window.__perfRows.map(r=>r.ChangeID).filter(Boolean))];for(const ChangeID of ids)window.__perfRows.push({ChangeID,ExpectedResponseID:ChangeID+'-HU',ExpectedResponseCountry:'Hungary'},{ChangeID,AssessmentResponseID:ChangeID+'-HU',AssessmentCountry:'Hungary',AssessmentTimeline:'6–8 months',AssessmentDocumentation:'Certificate'},{ChangeID,ExpectedResponseID:ChangeID+'-PE',ExpectedResponseCountry:'Peru'});window.__dispatchSend(window.__perfRows);});
 await page.waitForFunction(r=>window.__qualityRevision>r,revision,{timeout:60000});await page.locator('#filter-status').filter({hasText:'10000 submissions'}).waitFor();const loadMs=Date.now()-start;
 assert.ok(await page.evaluate(()=>window.__themeVisual.app.view.data('surveyRows').some(r=>r.anchorLabel==='Latest submission plan'&&r.start!==null)),'Parent-only keyed responses must supply ranges at 10,000-submission scale');
 const times=[];
 for(let i=0;i<18;i++){const group=['Application','Regulatory event','Change initiation'][i%3],t=Date.now();await page.locator('#host select[name=groupBy]').selectOption(group);await page.waitForFunction(g=>{const v=window.__themeVisual.app.view,rows=v.data('visible');return rows.length&&rows.every(r=>g==='Application'?r.level===0:g==='Regulatory event'?r.level===-1:r.level===-2);},group);times.push(Date.now()-t);const state=await page.evaluate(()=>{const v=window.__themeVisual.app.view;return {keys:v.data('displayRows').map(r=>r.key),scroll:v.signal('scrollTop'),selected:v.signal('selectedKey')};});assert.equal(new Set(state.keys).size,state.keys.length);assert.equal(state.scroll,0);assert.equal(state.selected,'');}
 // Expanded hierarchies and selection must not leak into another grouping.
 await page.locator('#host .parentLabel text').first().click();
 await page.waitForFunction(()=>window.__themeVisual.app.view.data('visible').some(r=>r.level===-1));
 await page.locator('#host select[name=groupBy]').selectOption('Application');
 assert.equal(await page.evaluate(()=>window.__themeVisual.app.view.signal('selectedKey')),'');
 assert.ok(await page.evaluate(()=>window.__themeVisual.app.view.data('visible').every(r=>r.level===0)));
 await page.locator('#host select[name=groupBy]').selectOption('Change initiation');
 assert.ok(await page.evaluate(()=>window.__themeVisual.app.view.data('visible').some(r=>r.level===-1)),'Returning preserves the change expansion without leaking it to Application');
 await page.evaluate(()=>{const v=window.__themeVisual.app.view;window.__perfEvents=v.data('eventRows')[0];});
 for(let i=0;i<6;i++){await page.locator('#host .hierarchyHeader text').click();await page.waitForTimeout(30);}
 assert.equal(await page.evaluate(()=>window.__perfEvents===window.__themeVisual.app.view.data('eventRows')[0]),true,'Sort must reuse existing hierarchy records');
 assert.equal(await page.evaluate(()=>window.__themeVisual.app.view.data('orderedRows').every(r=>Object.keys(r).length===4)),true,'Sort lookup must not retain full records or recursive orderInfo');
 await page.locator('#host input[name=query]').fill('PERF-S9999');await page.locator('#host #filter-status').filter({hasText:'1 submissions'}).waitFor();
 await page.locator('#host input[name=query]').fill('');await page.locator('#host #filter-status').filter({hasText:'10000 submissions'}).waitFor();
 for(let i=0;i<2;i++){const n=await page.evaluate(()=>window.__qualityRevision);await page.evaluate(()=>window.__dispatchSend(window.__perfRows));await page.waitForFunction(r=>window.__qualityRevision>r,n);await page.locator('#host #filter-status').filter({hasText:'10000 submissions'}).waitFor();}
 console.log('PASS: 10,000 distinct submissions with parent-only keyed responses and awaiting countries; 18 grouping switches; six sorts reuse hierarchy; search and repeated refresh. Load '+loadMs+' ms; slowest switch '+Math.max(...times)+' ms.');
};
