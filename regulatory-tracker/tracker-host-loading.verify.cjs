/* Host paging order through the actual generated or downloaded Power BI Visual.
 * Only the host's delivery boundary is controlled; mapping, model, Vega and DOM
 * rendering all execute the production code. */
const assert=require('node:assert/strict'),path=require('node:path');

function fixtures(){
 const base={AppID:'HOST-A1',ROID:'HOST-R1',SubID:'HOST-S1',EventName:'HOST-E1',ChangeID:'HOST-C1',ChangeQMS:'HOST-QMS',EventQMS:'HOST-QMS',ChangeStatus:'In Progress',AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',BusinessUnit:'ID',Manufacturer:'ABO',Product:'First device',Country:'France',SubmissionType:'Renewal',DispatchRequired:true,OriginalDispatch:'2026-01-01',LatestDispatch:'2026-01-11',ActualDispatch:null,OriginalSubmission:'2026-02-01',LatestSubmission:'2026-02-11',ActualSubmission:null,OriginalApproval:'2026-03-01',LatestApproval:'2026-03-11',ActualApproval:null,RegistrationID:'HOST-REG1',RegistrationNumber:'AUTH-001',RegistrationState:'Planned',RegistrationCountry:'France',RegistrationStart:'2026-03-12',RegistrationEnd:'2036-03-11',CatalogNumber:'000101'};
 const second={...base,ROID:'HOST-R2',SubID:'HOST-S2',Product:'Second device',Country:'Ireland',SubStatus:'Completed',ActualDispatch:'2026-01-12',ActualSubmission:'2026-02-12',ActualApproval:'2026-03-12',RegistrationID:'HOST-REG2',RegistrationNumber:'AUTH-002',RegistrationState:'Approved',RegistrationCountry:'Ireland',CatalogNumber:'000201'};
 const third={...base,AppID:'HOST-A2',ROID:'HOST-R3',SubID:'HOST-S3',Product:'Third device',Country:'Germany',Manufacturer:'ADJ',RegistrationID:'HOST-REG3',RegistrationNumber:'AUTH-003',RegistrationCountry:'Germany',CatalogNumber:'000301'};
 return [[base],[base,{...base,CatalogNumber:'000102'},second],[base,{...base,CatalogNumber:'000102'},second,third,{...base}]];
}

async function verify(page,{url='http://127.0.0.1:8771/index.html',navigate=true}={}){
 const errors=[],onError=error=>errors.push(error.message);page.on('pageerror',onError);
 if(navigate)await page.goto(url);
 await page.waitForFunction(()=>window.__themeVisual?.app?.view&&window.__qualityRevision>0);
 await page.evaluate(()=>window.__themeVisual.queue);
 const fields=['SubID','RegistrationID','CatalogNumber','Product','Country','LatestSubmission','ActualSubmission'];
 let installed=false,restored;
 try{
  await page.evaluate(fields=>{
   const visual=window.__themeVisual;
   if(typeof visual.host?.fetchMoreData!=='function')throw Error('The real Visual host is unavailable');
   const root=document.querySelector('#host .regulatory-timeline');
   const snapshot=()=>{
    const view=visual.app.view,notice=root.querySelector('#host-notice'),main=root.querySelector('#tracker-main');
    return {rows:view.data('dataset').map(row=>Object.fromEntries(fields.map(field=>[field,row[field]??null]))),submissions:[...new Set(view.data('sub').map(row=>row.SubID))].sort(),registrations:[...new Set(view.data('displayRows').filter(row=>row.level===3).map(row=>row.RegistrationID))].sort(),status:root.querySelector('#filter-status').textContent,notice:notice.textContent,noticeHidden:notice.hidden,visible:getComputedStyle(main).visibility,inert:main.inert,busy:root.getAttribute('aria-busy'),svgCount:root.querySelectorAll('#chart svg').length};
   };
   window.__hostLoadingQA={originalFetch:visual.host.fetchMoreData,originalRows:window.__dispatchRows,calls:[],snapshot};
   visual.host.fetchMoreData=function(aggregate){window.__hostLoadingQA.calls.push({aggregate,...snapshot()});return true;};
  },fields);
  installed=true;
  const batches=fixtures();
  for(let index=0;index<batches.length;index++){
   const rows=batches[index],more=index<batches.length-1;
   await page.evaluate(async({rows,more,index})=>{
    const visual=window.__themeVisual,roles=window.__roles;
    visual.update({type:2,operationKind:index?1:0,viewport:visual.viewport,dataViews:[{metadata:more?{segment:{}}:{},table:{columns:roles.map(role=>({displayName:role,roles:{[role]:true}})),rows:rows.map(row=>roles.map(role=>row[role]??null))}}]});
    await visual.queue;
   },{rows,more,index});
   const result=await page.evaluate(()=>({current:window.__hostLoadingQA.snapshot(),calls:window.__hostLoadingQA.calls}));
   const expectedRows=rows.map(row=>Object.fromEntries(fields.map(field=>[field,row[field]??null]))),expectedSubs=[...new Set(rows.map(row=>row.SubID))].sort(),expectedRegs=[...new Set(rows.map(row=>row.RegistrationID))].sort();
   assert.deepEqual(result.current.rows,expectedRows,'Batch '+(index+1)+' replaces the accumulated table without re-appending prior rows');
   assert.deepEqual(result.current.submissions,expectedSubs,'Distinct submission IDs survive accumulated batch '+(index+1));
   assert.deepEqual(result.current.registrations,expectedRegs,'Distinct registration IDs survive accumulated batch '+(index+1));
   assert.match(result.current.status,new RegExp(expectedSubs.length+' submissions.*'+expectedRegs.length+' registrations'),'The actual rendered totals match the current accumulated table');
   assert.equal(result.current.visible,'visible','Delivered rows remain visible during paging');assert.equal(result.current.inert,false,'Delivered rows remain interactive');assert.ok(result.current.svgCount>0,'The actual Vega SVG is mounted');
   assert.equal(result.calls.length,Math.min(index+1,2),'Exactly one next-page request per segmented data update');
   if(more){
    const atRequest=result.calls[index];assert.equal(atRequest.aggregate,true,'Power BI sends accumulated tables');
    assert.deepEqual(atRequest.rows,expectedRows,'The current batch is mapped and rendered before fetchMoreData');assert.deepEqual(atRequest.submissions,expectedSubs,'The next host request sees current submission totals');assert.deepEqual(atRequest.registrations,expectedRegs,'The next host request sees current registration totals');assert.equal(atRequest.visible,'visible');assert.equal(atRequest.inert,false);assert.ok(atRequest.svgCount>0);
    assert.equal(result.current.noticeHidden,false);assert.match(result.current.notice,/Loading additional data/i);assert.match(result.current.notice,/counts reflect loaded rows only/i,'Partial totals are explicitly labelled');assert.equal(result.current.busy,'true');
    await page.evaluate(async()=>{const visual=window.__themeVisual;visual.update({type:4,viewport:visual.viewport});await visual.queue;});
    const resized=await page.evaluate(()=>({current:window.__hostLoadingQA.snapshot(),calls:window.__hostLoadingQA.calls.length}));assert.equal(resized.calls,result.calls.length,'Resize never requests another host batch');assert.deepEqual(resized.current.rows,expectedRows,'Resize preserves the delivered accumulated table');assert.equal(resized.current.noticeHidden,false,'Resize retains the partial-data notice');
   }else{
    assert.equal(result.current.noticeHidden,true,'The final complete batch clears the loading notice');assert.equal(result.current.notice,'');assert.equal(result.current.busy,'false');
   }
  }
  assert.deepEqual(errors,[],'Actual Visual batching renders without browser errors');
 }finally{
  if(installed)restored=await page.evaluate(async fields=>{const qa=window.__hostLoadingQA,visual=window.__themeVisual;visual.host.fetchMoreData=qa.originalFetch;delete window.__hostLoadingQA;window.__dispatchSend(qa.originalRows);await visual.queue;return {actual:qa.snapshot().rows,expected:qa.originalRows.map(row=>Object.fromEntries(fields.map(field=>[field,row[field]??null])))};},fields);
  page.off('pageerror',onError);
 }
 assert.deepEqual(restored.actual,restored.expected,'The original sample is restored for following browser checks');assert.deepEqual(errors,[],'Restoring the original sample does not cause browser errors');
 console.log('PASS: actual Visual renders each of three accumulated host batches before requesting more; duplicate catalog rows do not inflate counts; partial notice, final notice, resize and original-data restoration behave correctly.');
}
module.exports=verify;module.exports.fixtures=fixtures;
if(require.main===module){
 const fs=require('node:fs'),http=require('node:http');let pw;try{pw=require('@playwright/test');}catch{pw=require('./powerbi-visual/node_modules/@playwright/test');}
 (async()=>{const dir=path.join(__dirname,'powerbi-visual','verify'),server=http.createServer((req,res)=>{const file=path.resolve(dir,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(dir+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;try{browser=await pw.chromium.launch({headless:true,channel:process.env.TRACKER_BROWSER_CHANNEL||'msedge'});await verify(await browser.newPage({viewport:{width:1600,height:1150}}),{url:'http://127.0.0.1:'+server.address().port+'/index.html'});}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1;});
}
