const assert=require('node:assert/strict'),path=require('node:path'),rows=require('./retained-records-test.cjs');
module.exports=async(page,{outputDir})=>{
 await page.goto('http://127.0.0.1:8771/index.html');await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 await page.evaluate(rows=>window.__dispatchSend([...rows,...rows]),rows);
 await page.locator('#host #filter-status').filter({hasText:'3 change IDs · 4 events · 4 applications · 3 ROs · 3 submissions'}).waitFor();
 await page.locator('#host #selected-details').evaluate(e=>e.open=true);
 for(const theme of ['dark','light']){
  await page.locator('#host #theme-select').selectOption(theme);
  for(const group of ['Application','Regulatory event','Change initiation']){
   await page.locator('#host select[name=groupBy]').selectOption(group);
   await page.evaluate(async()=>{const v=window.__themeVisual.app.view;v.change('expanded',window.__themeVega.changeset().remove(()=>true).insert(v.data('displayRows').filter(r=>r.level<2).map(r=>({key:r.key}))));await v.runAsync();});
   const visible=await page.evaluate(()=>window.__themeVisual.app.view.data('visible').map(r=>({key:r.key,level:r.level,AppID:r.AppID,ROID:r.ROID,SubID:r.SubID,EventName:r.EventName,ChangeID:r.ChangeID,start:r.start})));
   assert.deepEqual(new Set(visible.filter(r=>r.level===2).map(r=>r.SubID)),new Set(['S-orphan','S-no-ro','S-child']));
   assert.equal(new Set(visible.map(r=>r.key)).size,visible.length);
   if(group==='Regulatory event')assert.ok(visible.some(r=>r.EventName==='E-alone'&&r.level===-1));
   if(group==='Change initiation')assert.ok(visible.some(r=>r.ChangeID==='C-alone'&&r.level===-2));
   // Every retained record, including empty parents, has a functioning Details panel.
   for(const row of visible){await page.evaluate(async key=>{const v=window.__themeVisual.app.view;v.signal('selectedKey',key);await v.runAsync();},row.key);const name=row.level===-2?(row.ChangeID||'Other regulatory events'):row.level===-1?row.EventName:row.level===0?(row.AppID||'Application not recorded'):row.level===1?(row.ROID||'RO not recorded'):row.SubID;await page.waitForFunction(name=>document.querySelector('#host #detail-body h2')?.textContent.startsWith(name),name);assert.ok(await page.locator('#host #detail-body').textContent());}
  }
  await page.evaluate(async()=>{const v=window.__themeVisual.app.view;v.signal('selectedKey',v.data('changeRows').find(r=>r.level===-2&&r.ChangeID==='C-alone').key).signal('rowRequest',{pos:0});await v.runAsync();});
  await page.locator('#host #selected-details').evaluate(e=>e.open=true);await page.locator('#host .change-details').filter({hasText:'C-alone'}).waitFor();
  await page.locator('#host').screenshot({path:path.join(outputDir,'retained-records-'+theme+'.png')});
 }
 for(const id of ['C-alone','E-alone']){
  await page.locator('#host select[name=groupBy]').selectOption(id[0]==='C'?'Change initiation':'Regulatory event');
  await page.locator('#host input[name=query]').fill(id);await page.waitForFunction(id=>{const v=window.__themeVisual.app.view;return v.data('displayRows').length===1&&(v.data('displayRows')[0].ChangeID===id||v.data('displayRows')[0].EventName===id);},id);
 }
 await page.locator('#host #reset-filters').click();await page.locator('#host #filter-status').filter({hasText:'3 change IDs · 4 events'}).waitFor();
 console.log('PASS: retained parents and missing-parent submissions in all groupings, both themes, selection/Details, independent search and reset.');
};
