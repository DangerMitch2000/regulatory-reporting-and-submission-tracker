/* Exercise startup and selection persistence through the actual Power BI Visual. */
const assert=require('node:assert/strict');
async function verify(page){
 await page.waitForFunction(()=>window.__themeVisual?.app?.view);await page.evaluate(()=>window.__themeVisual.queue);
 const errors=[],onError=error=>errors.push(error.message);page.on('pageerror',onError);
 const rows=['ID','CMI'].map(unit=>({BusinessUnit:unit,AppID:'UNIT-A-'+unit,ROID:'UNIT-R-'+unit,SubID:'UNIT-S-'+unit,AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',Country:'Ireland',Product:'Device '+unit,Manufacturer:'Test site',OriginalSubmission:'2026-01-01'}));
 const scope=page.locator('#unit-host'),box=scope.locator('.filter[data-kind=businessUnit]');
 const create=async()=>page.evaluate(async()=>{if(window.__unitVisual){const previous=window.__unitVisual;previous.destroy();await previous.queue;document.getElementById('unit-host').remove();}const root=document.createElement('div');root.id='unit-host';root.style.cssText='width:1280px;height:850px';document.body.append(root);window.__unitVisual=new window.__themeVisual.constructor({element:root,host:window.__themeVisual.host});});
 const send=async(data,{mapped=true,partial=false}={})=>page.evaluate(async({data,mapped,partial})=>{const visual=window.__unitVisual,roles=window.__roles.filter(role=>mapped||role!=='BusinessUnit');visual.update({type:2,viewport:{width:1280,height:850},dataViews:[{metadata:partial?{segment:{}}:{},table:{columns:roles.map(role=>({displayName:role,roles:{[role]:true}})),rows:data.map(row=>roles.map(role=>row[role]??null))}}]});await visual.queue;},{data,mapped,partial});
 const shown=()=>page.evaluate(()=>window.__unitVisual.app.view.data('dataset').map(row=>row.SubID).sort());
 const expect=async(unit,ids,message)=>{await page.waitForFunction(ids=>JSON.stringify(window.__unitVisual.app.view.data('dataset').map(row=>row.SubID).sort())===JSON.stringify(ids),ids.slice().sort());assert.deepEqual(await shown(),ids.slice().sort(),message);assert.equal(await box.locator(':scope > summary').textContent(),'Business Unit · '+(unit==='All'?'All':unit+' (1 selected)'),message+' exposes the selected unit');};
 const open=async()=>{const drawer=scope.locator('#filter-drawer');if(!await drawer.evaluate(node=>node.open))await drawer.locator(':scope > summary').click();if(!await box.evaluate(node=>node.open))await box.locator(':scope > summary').click();};
 const choose=async unit=>{await open();await box.getByRole('button',{name:'Clear',exact:true}).click();if(unit!=='All')await box.getByLabel(unit,{exact:true}).check();};
 try{
  await create();await send([],{mapped:false});await expect('ID',[],'Empty unmapped startup');
  await send([]);await expect('ID',[],'Empty mapped startup');await open();assert.equal(await box.getByLabel('ID',{exact:true}).isChecked(),true,'ID remains available when absent from the delivered options');
  await send([rows[1]],{partial:true});await expect('ID',[],'Partial delivery without ID');
  await send(rows,{partial:true});await expect('ID',['UNIT-S-ID'],'Accumulated mixed delivery');assert.match(await scope.locator('#filter-status').innerText(),/1 applications · 1 ROs · 1 submissions/,'Displayed counts follow the ID scope');
  await send([rows[1]]);await expect('ID',[],'Complete mapped delivery without ID');
  await send(rows);await expect('ID',['UNIT-S-ID'],'A later ID record restores the filtered chart');
  await choose('CMI');await expect('CMI',['UNIT-S-CMI'],'Explicit CMI selection');
  await send([]);await expect('CMI',[],'Empty refresh preserves CMI');await send([rows[0]],{partial:true});await expect('CMI',[],'Partial refresh without selected CMI');await send(rows);await expect('CMI',['UNIT-S-CMI'],'Refresh preserves CMI');
  await page.evaluate(async()=>{const visual=window.__unitVisual;visual.update({type:4,viewport:{width:1000,height:700}});await visual.queue;await visual.app.view.signal('groupBy','Regulatory event').runAsync();});await expect('CMI',['UNIT-S-CMI'],'Resize and grouping preserve CMI');
  await choose('All');await expect('All',['UNIT-S-CMI','UNIT-S-ID'],'Clear selects All');await send([]);await expect('All',[],'Empty refresh preserves All');await send(rows);await expect('All',['UNIT-S-CMI','UNIT-S-ID'],'Refresh preserves All');
  await choose('ID');await scope.locator('#reset-filters').click();await expect('All',['UNIT-S-CMI','UNIT-S-ID'],'Reset filters clears ID to All');await send(rows);await expect('All',['UNIT-S-CMI','UNIT-S-ID'],'Refresh after Reset keeps All');
  await create();await send(rows,{mapped:false});await expect('All',['UNIT-S-CMI','UNIT-S-ID'],'Populated unmapped startup keeps records accessible');
  await send(rows);await expect('All',['UNIT-S-CMI','UNIT-S-ID'],'Restoring the mapping preserves All');
  await choose('CMI');await send(rows,{mapped:false});await expect('All',['UNIT-S-CMI','UNIT-S-ID'],'Removing the mapping keeps records accessible');
  await create();await send(rows);await expect('ID',['UNIT-S-ID'],'A new instance starts with ID again');
  assert.deepEqual(errors,[],'Business Unit updates have no browser errors');
 }finally{await page.evaluate(async()=>{if(window.__unitVisual){window.__unitVisual.destroy();await window.__unitVisual.queue;document.getElementById('unit-host')?.remove();delete window.__unitVisual;}});page.off('pageerror',onError);}
 console.log('PASS: Business Unit ID startup, mixed/no-ID/empty/partial data, scoped counts, explicit CMI/All, refresh/resize/grouping, Reset filters, unmapped fallback and new-instance isolation.');
}
module.exports=verify;
