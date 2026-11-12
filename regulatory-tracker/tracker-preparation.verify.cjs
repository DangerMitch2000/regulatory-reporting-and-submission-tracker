const assert=require('node:assert/strict'),path=require('node:path');
const DAY=86400000,day=value=>Date.parse(value+'T00:00:00Z');
async function verify(page,{outputDir=__dirname,url='http://127.0.0.1:8771/index.html'}={}){
 const errors=[],onError=error=>errors.push(error.message);page.on('pageerror',onError);
 const status=page.locator('#host #filter-status');
 const send=async({unmappedActual=false}={})=>{
  const revision=await page.evaluate(()=>window.__qualityRevision);
  await page.evaluate(unmappedActual=>{
   const base={...window.__dispatchRows[0],AppID:'PREP-APP',ROID:'PREP-RO',SubID:'PREP-ONE',Product:'Preparation example',SubStatus:'Planned',LMPrepDuration:'2 months',DispatchRequired:true,OriginalDispatch:'2026-11-30',LatestDispatch:'2026-11-30',ActualDispatch:'',ActualSubmission:null,ActualApproval:null};
   const actual={...base,OriginalDispatch:'2024-08-01',LatestDispatch:'2024-08-30'};
   const rows=[base,{...base,SubID:'PREP-TWO',Country:'Other destination',LMPrepDuration:null,LatestDispatch:'2026-12-31'},{...actual,SubID:'PREP-NONE',DispatchRequired:false,ActualDispatch:'2024-08-15'},
    {...actual,SubID:'PREP-EARLY',ActualDispatch:'2024-08-15'},{...actual,SubID:'PREP-LATE',ActualDispatch:'2024-09-14'},
    {...actual,SubID:'PREP-ACTUALONLY',ActualDispatch:'2024-07-10',OriginalDispatch:null,LatestDispatch:null},
    {...actual,SubID:'PREP-ORIGINAL',ActualDispatch:null,OriginalDispatch:'2024-07-30',LatestDispatch:null},
    {...actual,SubID:'PREP-INVALID',ActualDispatch:'not-a-date'},
    {...actual,SubID:'PREP-CONFLICT',ActualDispatch:'2024-08-15',Product:'First membership'},{...actual,SubID:'PREP-CONFLICT',ActualDispatch:'2024-08-16',Product:'Second membership'},
    {...actual,SubID:'PREP-FUTURE',ActualDispatch:'2099-07-10'}];
   if(!unmappedActual){window.__prepActualFixtures=rows;window.__dispatchSend(rows);return;}
   const roles=window.__roles.filter(role=>role!=='ActualDispatch'),record={...actual,SubID:'PREP-UNMAPPED',ActualDispatch:'2024-08-15'};
   window.__themeVisual.update({type:2,viewport:{width:1280,height:850},dataViews:[{metadata:{},table:{columns:roles.map(role=>({displayName:role,roles:{[role]:true}})),rows:[roles.map(role=>record[role]??null)]}}]});
  },unmappedActual);
  await page.waitForFunction(n=>window.__qualityRevision>n,revision);
 };
 const choose=async id=>{
  await page.locator('#host input[name=query]').fill(id);
  await page.waitForFunction(id=>{const rows=window.__themeVisual.app.view.data('sub');return rows.length===1&&rows[0].SubID===id;},id);
  await page.locator('#host .subLabel text').filter({hasText:new RegExp('^'+id+'$')}).click();
  await page.waitForFunction(id=>document.querySelector('#host #detail-body h2')?.textContent.startsWith(id),id);
  await page.locator('#host #selected-details').evaluate(element=>element.open=true);
  return page.locator('#host .preparation-card').innerText();
 };
 const calendarRange=async(end,start=end-60*DAY)=>page.evaluate(async({start,end})=>{const view=window.__themeVisual.app.view;view.signal('range',[start-10*86400000,end+20*86400000]);await view.runAsync();},{start,end});
 const geometry=()=>page.evaluate(()=>{
  const view=window.__themeVisual.app.view,row=view.data('sub')[0],bars=[...document.querySelectorAll('#host .preparationRange path,#host .preparationRange rect')],markers=[...document.querySelectorAll('#host .milestone path')];
  const bar=bars.find(node=>node.__data__?.datum?.SubID===row.SubID),marker=markers.find(node=>node.__data__?.datum?.SubID===row.SubID&&node.__data__.datum.milestone==='ActualDispatch');
  const item=bar?.__data__,point=marker?.__data__;
  return {id:row.SubID,start:row.LMPrepStart,end:row.LMPrepEnd,ready:row.LMPrepReady,actual:row.ActualDispatch,original:row.OriginalDispatch,latest:row.LatestDispatch,elapsed:view.signal('elapsed'),range:[view.signal('xlo'),view.signal('xhi')],barCount:bars.length,windowCount:view.data('preparationWindows').length,barRight:item?item.x+item.width:null,markerX:point?.x??null,tip:item?.tooltip??null,actualMarkerDate:point?.datum.actualDate??null,dispatchMarkers:markers.map(node=>node.__data__).filter(item=>item.datum.SubID===row.SubID&&['OriginalDispatch','LatestDispatch','ActualDispatch'].includes(item.datum.milestone)).map(item=>({field:item.datum.milestone,actualDate:item.datum.actualDate,date:item.datum.date,x:item.x,expectedX:view.scale('x')(item.datum.date)}))};
 });
 const assertDispatchMarkers=result=>{
  for(const [field,key]of [['OriginalDispatch','original'],['LatestDispatch','latest'],['ActualDispatch','actual']]){
   const recorded=result[key];if(recorded==null)continue;const plotted=result.elapsed?recorded-result.actual:recorded;
   if(plotted<result.range[0]||plotted>result.range[1])continue;
   const marker=result.dispatchMarkers.find(item=>item.field===field);assert(marker,result.id+' retains '+field+' across axis changes: '+JSON.stringify(result));
   assert.equal(marker.actualDate,recorded,field+' preserves the original calendar date');assert.equal(marker.date,plotted,field+' uses the correct calendar/elapsed coordinate');assert.ok(Math.abs(marker.x-marker.expectedX)<.01,field+' is rendered at its expected coordinate');
  }
 };
 const assertWindow=async(id,end,{actual=false,basis='Latest dispatch plan'}={})=>{
  const text=await choose(id);await calendarRange(end);
  const result=await geometry();assert.equal(result.ready,true,id+' has a valid estimate');assert.equal(result.start,end-60*DAY,id+' retains fixed30-day months');assert.equal(result.end,end,id+' uses the selected dispatch anchor');assert.equal(result.barCount,1,id+' shows one filtered preparation bar');assert.equal(result.windowCount,1);
  assert.match(text,/60 calendar days/);
  assert.match(text,actual?/Preparation finish \/ actual dispatch/:/Target finish \/ planned dispatch/);
  assert.equal(result.tip.Basis,basis,id+' tooltip explains actual versus planned basis');assert.ok(result.tip['Finish / dispatch'],id+' tooltip uses the generic finish label');assert.ok(!('Target dispatch' in result.tip),'Actual endpoints are not described as targets');
  if(actual){assert.equal(result.actual,end);assert.equal(result.actualMarkerDate,end,id+' actual dispatch milestone is rendered at its recorded date: '+JSON.stringify(result));assert.notEqual(result.markerX,null,'Actual dispatch milestone is rendered');assert.ok(Math.abs(result.barRight-result.markerX)<.01,id+' preparation ends exactly at actual dispatch marker: '+JSON.stringify(result));assertDispatchMarkers(result);}
  return {text,result};
 };
 try{
  await page.goto(url);await status.filter({hasText:'60 submissions'}).waitFor();await send();
  await page.locator('#host select[name=mode]').selectOption('Compare');await page.locator('#host select[name=axisMode]').selectOption('Calendar');
  const sourceBefore=await page.evaluate(()=>JSON.stringify(window.__themeVisual.app.view.data('dataset').map(row=>[row.SubID,row.OriginalDispatch,row.LatestDispatch,row.ActualDispatch])));
  let result=await assertWindow('PREP-ONE',day('2026-11-30'));assert.match(result.text,/01 Oct 2026/);assert.match(result.text,/30 Nov 2026/);
  result=await assertWindow('PREP-TWO',day('2026-12-31'));assert.match(result.text,/01 Nov 2026/);assert.match(result.text,/2 months/,'A child inherits its application duration');
  await assertWindow('PREP-ORIGINAL',day('2024-07-30'),{basis:'Original dispatch plan'});
  for(const [id,date]of [['PREP-EARLY','2024-08-15'],['PREP-LATE','2024-09-14'],['PREP-ACTUALONLY','2024-07-10']]){
   await assertWindow(id,day(date),{actual:true,basis:'Actual dispatch'});
   for(let roundTrip=0;roundTrip<2;roundTrip++){
    await page.locator('#host select[name=axisMode]').selectOption('Elapsed days');
    await page.waitForFunction(()=>window.__themeVisual.app.view.signal('elapsed'));
    const elapsed=await geometry();assert.equal(elapsed.windowCount,0,'Preparation stays hidden on the elapsed comparison axis');assert.equal(await page.locator('#host .preparationRange path,#host .preparationRange rect').count(),0);assertDispatchMarkers(elapsed);
    const actualMarker=elapsed.dispatchMarkers.find(item=>item.field==='ActualDispatch');assert.equal(actualMarker?.date,0,'Actual dispatch remains elapsed day zero');
    await page.locator('#host select[name=axisMode]').selectOption('Calendar');await assertWindow(id,day(date),{actual:true,basis:'Actual dispatch'});
   }
  }
  for(const [id,reason]of [['PREP-NONE',/Dispatch is not required/],['PREP-INVALID',/actual dispatch.*invalid|invalid.*actual dispatch/i],['PREP-CONFLICT',/actual dispatch.*conflict|conflict.*actual dispatch/i],['PREP-FUTURE',/actual dispatch.*future|future.*actual dispatch/i]]){
   const text=await choose(id);assert.match(text,reason);await calendarRange(day('2024-08-30'));
   const state=await geometry();assert.equal(state.barCount,0,id+' never falls back to a planned preparation bar');assert.equal(state.windowCount,0);assert.ok(!state.ready);assert.ok(state.end==null,id+' withholds the anchor despite valid plans');
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__themeVisual.app.view.data('dataset').map(row=>[row.SubID,row.OriginalDispatch,row.LatestDispatch,row.ActualDispatch]))),sourceBefore,'Preparation anchoring never rewrites recorded actual or planned dates');
  await assertWindow('PREP-ONE',day('2026-11-30'));await page.locator('#host #theme-select').selectOption('dark');await page.mouse.move(1,1);await page.locator('#host').screenshot({path:path.join(outputDir,'preparation-dark.png')});
  await page.locator('#host #theme-select').selectOption('light');await page.waitForFunction(()=>document.querySelector('#host .regulatory-timeline').dataset.theme==='light');await page.locator('#host').screenshot({path:path.join(outputDir,'preparation-light.png')});
  await assertWindow('PREP-EARLY',day('2024-08-15'),{actual:true,basis:'Actual dispatch'});await page.locator('#host').screenshot({path:path.join(outputDir,'preparation-actual-dispatch.png')});
  await page.locator('#host input[name=query]').fill('');await send({unmappedActual:true});
  const unmapped=await assertWindow('PREP-UNMAPPED',day('2024-08-30'));assert.ok(unmapped.result.actual==null,'Unmapped actual dispatch falls back to the plan');
  assert.deepEqual(errors,[]);
  console.log('PASS: actual Visual preparation inheritance and fixed-day duration; early/late/actual-only dispatch anchors; blank/unmapped latest/original fallback; invalid/conflicting/future actual and not-required suppression; exact marker alignment, actual/planned labels, hidden elapsed preparation, unchanged source dates, filters and both themes.');
 }finally{page.off('pageerror',onError);}
}
module.exports=verify;
if(require.main===module){
 const fs=require('node:fs'),http=require('node:http');let pw;try{pw=require('@playwright/test');}catch{pw=require('./powerbi-visual/node_modules/@playwright/test');}
 (async()=>{const dir=path.join(__dirname,'powerbi-visual','verify'),server=http.createServer((req,res)=>{const file=path.resolve(dir,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(dir+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await pw.chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL==='chromium'?{}:{channel:process.env.TRACKER_BROWSER_CHANNEL||'msedge'})});try{await verify(await browser.newPage({viewport:{width:1280,height:950}}),{url:'http://127.0.0.1:'+server.address().port+'/index.html',outputDir:dir});}finally{await browser.close();server.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
}
