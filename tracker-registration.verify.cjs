/* Registration and catalog behaviour through the actual packaged Visual. */
const assert=require('node:assert/strict'),path=require('node:path');

function fixtures(){
 const base={AppID:'REG-A1',ROID:'REG-R1',SubID:'REG-S1',EventName:'REG-E1',EventState:'In Progress State',ChangeID:'REG-C1',ChangeQMS:'CR-1',EventQMS:'CR-1',ChangeStatus:'In Progress',AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',BusinessUnit:'ID',Manufacturer:'ABO',Product:'Alpha device',Country:'France',OriginalDispatch:'2026-08-01',LatestDispatch:'2026-08-15',OriginalSubmission:'2026-09-01',LatestSubmission:'2026-09-15',OriginalApproval:'2027-03-01',LatestApproval:'2027-03-15'};
 const long={...base,RegistrationID:'REG-LONG',RegistrationNumber:'AUTH-0007',RegistrationState:'Approved',RegistrationCountry:'France',RegistrationStart:'2010-01-01',RegistrationEnd:'2050-12-31',RegistrationHolder:'Example holder',RegistrationAuthority:'Example authority',RegistrationRenewalRequired:'Yes',RegistrationRenewalStart:'2049-01-01',RegistrationRenewalTarget:'2050-06-01',RegistrationComments:'First line\nSecond line',RegistrationSKU:'SKU-0007'};
 const open={...base,AppID:'REG-A2',ROID:'REG-R2',SubID:'REG-S2',EventName:'REG-E2',ChangeID:'REG-C2',ChangeQMS:'CR-2',EventQMS:'CR-2',Product:'Beta device',Country:'Ireland',RegistrationID:'REG-8900',RegistrationCountry:'Ireland',RegistrationState:'Expired',RegistrationStart:'2021-01-01',RegistrationEnd:'8900-12-31',CatalogNumber:'000200'};
 const missing={...base,ROID:'REG-R3',SubID:'REG-S3',Product:'Gamma device',Country:'Germany',RegistrationID:'REG-NO-END',RegistrationState:'Planned',RegistrationCountry:'Germany',RegistrationStart:'2025-01-01',RegistrationEnd:null,CatalogNumber:'000300'};
 const rows=[...Array.from({length:6},(_,i)=>({...long,CatalogNumber:'00010'+i})),{...long,Product:'Second product',Country:'Belgium',CatalogNumber:'000900'},open,missing,
  {...base,RegistrationID:'REG-CONFLICT',RegistrationState:'Approved',RegistrationCountry:'France',RegistrationStart:'2024-01-01',RegistrationEnd:'2034-01-01'},
  {...open,RegistrationID:'REG-CONFLICT',RegistrationCountry:'Ireland',RegistrationStart:'2024-01-01',RegistrationEnd:'2034-01-01'},
  {RegistrationID:'REG-UNLINKED',RegistrationState:'Conditionally Approved',RegistrationCountry:'Italy',RegistrationStart:'2024-01-01',RegistrationEnd:'2034-01-01',Product:'Unlinked product',CatalogNumber:'000400'},
  {...base,SubID:'REG-S4',ROID:'REG-R4',RegistrationID:'REG-NO-START',RegistrationState:'Rejected',RegistrationCountry:'France',RegistrationStart:null,RegistrationEnd:'2031-01-01'},
  {...base,SubID:'REG-S5',ROID:'REG-R5',RegistrationID:'REG-REVERSED',RegistrationState:'Canceled',RegistrationCountry:'France',RegistrationStart:'2031-01-01',RegistrationEnd:'2021-01-01'}];
 return [...rows,...rows.slice(0,4),{...long,EventName:'REG-E10',CatalogNumber:'000100'}];
}

async function verify(page,{outputDir=__dirname,url='http://127.0.0.1:8771/index.html',stress=true}={}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const send=async rows=>{const revision=await page.evaluate(()=>window.__qualityRevision);await page.evaluate(rows=>window.__dispatchSend(rows),rows);await page.waitForFunction(r=>window.__qualityRevision>r,revision,{timeout:120000});};
 const state=()=>page.evaluate(()=>{const v=window.__themeVisual.app.view;return {range:[v.signal('xlo'),v.signal('xhi')],visible:v.data('visible').map(r=>({key:r.key,level:r.level,RegistrationID:r.RegistrationID,SubID:r.SubID,AppID:r.AppID,ROID:r.ROID,ChangeID:r.ChangeID,EventName:r.EventName,subKey:r.subKey,registrationContainer:r.registrationContainer})),all:v.data('displayRows').map(r=>({key:r.key,level:r.level,RegistrationID:r.RegistrationID,SubID:r.SubID,subKey:r.subKey,registrationContainer:r.registrationContainer})),selected:v.signal('selectedKey')};});
 const clickMark=async(selector,key)=>{
  const position=await page.evaluate(({selector,key})=>{const node=[...document.querySelectorAll(selector)].find(n=>n.__data__?.datum?.key===key);if(!node)return null;const b=node.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};},{selector,key});
  assert.ok(position,selector+' exists for '+key);await page.mouse.click(position.x,position.y);
 };
 const reveal=async key=>{await page.evaluate(async key=>{const v=window.__themeVisual.app.view,index=v.data('visible').findIndex(r=>r.key===key);if(index<0)throw Error('Row is not expanded: '+key);v.signal('rowRequest',{pos:index});await v.runAsync();},key);};
 const details=async key=>{await reveal(key);await clickMark('#host .rowDetailsText text',key);await page.waitForFunction(key=>window.__themeVisual.app.view.signal('selectedKey')===key,key);await page.locator('#host #selected-details').evaluate(e=>e.open=true);};
 const fit=async()=>{await page.locator('#host .timeText text').filter({hasText:/^Fit all$/}).click();return (await state()).range;};
 await page.goto(url);await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 const rows=fixtures();await send(rows);await page.locator('#host #filter-status').filter({hasText:'5 submissions'}).waitFor();
 assert.match(await page.locator('#host #filter-status').innerText(),/7 registrations/,'Catalog and join duplicates do not inflate registration totals');
 const expectedIDs=['REG-LONG','REG-8900','REG-NO-END','REG-CONFLICT','REG-UNLINKED','REG-NO-START','REG-REVERSED'];
 const withRegistrations=await fit();
 await send(rows.map(row=>Object.fromEntries(Object.entries(row).filter(([name])=>!name.startsWith('Registration')))));
 const withoutRegistrations=await fit();assert.deepEqual(withRegistrations,withoutRegistrations,'Registration start/end and renewal dates cannot enlarge Fit all');
 await send(rows);await fit();

 for(const group of ['Application','Regulatory event','Change initiation']){
  await page.locator('#host select[name=groupBy]').selectOption(group);
  let snapshot=await state();assert.equal(new Set(snapshot.all.map(r=>r.key)).size,snapshot.all.length,'Unique row keys in '+group);
  assert.deepEqual([...new Set(snapshot.all.filter(r=>r.level===3).map(r=>r.RegistrationID))].sort(),expectedIDs.slice().sort(),'All linked, unlinked and conflicting registrations available in '+group);
  for(const id of ['REG-CONFLICT','REG-UNLINKED']){const regs=snapshot.all.filter(r=>r.RegistrationID===id&&r.level===3);assert.ok(regs.length);assert.ok(regs.every(r=>!r.SubID&&!r.subKey),'No invented submission link for '+id);}
  // Open one full chain through real mouse controls, preserving group context.
  for(let pass=0;pass<7;pass++){
   snapshot=await state();if(snapshot.visible.some(r=>r.RegistrationID==='REG-LONG'&&r.level===3))break;
   const target=snapshot.visible.find(r=>r.level===-2&&r.ChangeID==='REG-C1')||snapshot.visible.find(r=>r.level===-1&&r.EventName==='REG-E1')||snapshot.visible.find(r=>r.level===0&&r.AppID==='REG-A1')||snapshot.visible.find(r=>r.level===1&&r.ROID==='REG-R1')||snapshot.visible.find(r=>r.level===2&&r.SubID==='REG-S1');
   assert.ok(target,'A real parent exists while expanding '+group);
   // Choose the deepest unexpanded parent so previously opened rows are never collapsed.
   const next=snapshot.visible.filter(r=>r.level<3&&((r.level===-2&&r.ChangeID==='REG-C1')||(r.level===-1&&r.EventName==='REG-E1')||(r.level===0&&r.AppID==='REG-A1')||(r.level===1&&r.ROID==='REG-R1')||(r.level===2&&r.SubID==='REG-S1'))).sort((a,b)=>b.level-a.level)[0];
   const beforeDetails=snapshot.visible.map(r=>r.key);await details(next.key);assert.deepEqual((await state()).visible.map(r=>r.key),beforeDetails,'Details does not toggle the parent hierarchy');
   await page.locator('#host #selected-details').evaluate(e=>e.open=false);await reveal(next.key);await clickMark('#host .toggle path',next.key);
  }
  snapshot=await state();const reg=snapshot.visible.find(r=>r.RegistrationID==='REG-LONG'&&r.level===3);assert.ok(reg,'Registration expands under submission in '+group);
  const parent=snapshot.all.find(r=>r.key===reg.subKey);assert.equal(parent?.SubID,'REG-S1');
  await details(reg.key);await page.locator('#host #detail-body').filter({hasText:'AUTH-0007'}).waitFor();
  for(const text of ['REG-LONG','France','2010-01-01','2050-12-31','Example holder','Example authority','First line','Second line','000100','000105','000900'])assert.ok((await page.locator('#host #detail-body').innerText()).includes(text),'Registration Details includes '+text);
  const expanded=await page.evaluate(()=>window.__themeVisual.app.view.data('expanded').map(r=>r.key));await page.locator('#host select[name=groupBy]').selectOption(group==='Application'?'Regulatory event':'Application');assert.equal((await state()).selected,'');await page.locator('#host select[name=groupBy]').selectOption(group);assert.ok((await state()).visible.some(r=>r.RegistrationID==='REG-LONG'));
  assert.ok(expanded.length,'Expansion state remains available when switching groups');
 }

 // Every registration remains selectable, including undated and rejected link evidence.
 await page.evaluate(async()=>{const v=window.__themeVisual.app.view;v.change('expanded',window.__themeVega.changeset().remove(()=>true).insert(v.data('displayRows').filter(r=>r.level<3).map(r=>({key:r.key}))));await v.runAsync();});
 for(const id of expectedIDs){const row=(await state()).visible.find(r=>r.level===3&&r.RegistrationID===id);assert.ok(row,id+' remains visible');await details(row.key);await page.locator('#host #detail-body').filter({hasText:id}).waitFor();const text=await page.locator('#host #detail-body').innerText();if(id==='REG-8900'){assert.match(text,/8900/,'Raw placeholder expiry is retained');assert.match(text,/Expired/,'Recorded state is not overwritten by the far-future date');}if(['REG-CONFLICT','REG-UNLINKED'].includes(id))assert.match(text,/link|match|conflict/i,'An unmatched relationship is explained');if(['REG-NO-START','REG-REVERSED'].includes(id))assert.equal(await page.evaluate(key=>[...document.querySelectorAll('#host .registrationBar path,#host .registrationBar rect')].filter(n=>n.__data__?.datum?.key===key).length,row.key),0,'Missing or reversed validity cannot invent a registration bar');}

 const reg=(await state()).visible.find(r=>r.level===3&&r.RegistrationID==='REG-LONG');await details(reg.key);
 await page.locator('#host .catalog-table').waitFor();
 const catalogRows=await page.locator('#host .catalog-table tr').allTextContents();
 assert.ok(catalogRows.some(text=>text.includes('Alpha device')&&text.includes('000100')&&!text.includes('000900')),'A catalog number retains its own product association');
 assert.ok(catalogRows.some(text=>text.includes('Second product')&&text.includes('000900')&&!text.includes('000100')),'Different products are not pooled into one catalog list');
 await page.locator('#host #list-search').fill('000105');await page.waitForFunction(()=>document.querySelector('#host .catalog-table')?.textContent.includes('000105'));
 assert.doesNotMatch(await page.locator('#host .catalog-table').innerText(),/000900/,'Full catalog search filters unrelated products');
 await page.locator('#host #list-search').fill('');
 await page.locator('#host #copy-catalogs').click();await page.locator('#host #catalog-copy-text').waitFor();
 const copied=await page.locator('#host #catalog-copy-text').inputValue();for(const code of ['000100','000105','000900'])assert.ok(copied.includes(code),'Copy includes complete catalog number '+code);
 assert.equal(new Set(copied.split(/\r?\n/)).size,7,'Copy contains all distinct catalog codes without duplicate join rows');
 for(const theme of ['dark','light']){
  await page.locator('#host #theme-select').selectOption(theme);await page.waitForFunction(theme=>window.__themeVisual.app.view.signal('themeMode')===theme,theme);
  await page.locator('#host #selected-details').evaluate(e=>e.open=false);await reveal(reg.key);await fit();
  const bar=await page.evaluate(key=>{const node=[...document.querySelectorAll('#host .registrationBar rect,#host .registrationBar path')].find(n=>n.__data__?.datum?.key===key);if(!node)return null;const b=node.getBBox(),v=window.__themeVisual.app.view;return {x:b.x,width:b.width,left:v.signal('left'),right:v.signal('width')-22};},reg.key);
  assert.ok(bar,'A long registration renders an actual bar');assert.ok(bar.x>=bar.left&&bar.x+bar.width<=bar.right+1,'Long registration bar is clipped to the workflow window');
  const arrows=await page.evaluate(key=>[...document.querySelectorAll('#host .registrationBarContinuation path')].filter(n=>n.__data__?.datum?.key===key).length,reg.key);assert.equal(arrows,2,'Long registration has both continuation arrows');
  await page.mouse.move(5,5);await page.locator('#host').screenshot({path:path.join(outputDir,'registrations-'+theme+'.png')});
 }
 assert.ok((await page.locator('#host .state-filter[data-field="RegistrationState"]').innerText()).includes('Registration state'));
 for(const label of ['Approved','Canceled','Conditionally Approved','Expired','Planned','Rejected','Withdrawn','Not recorded'])assert.ok(await page.locator('#host .state-filter[data-field="RegistrationState"] label').filter({hasText:new RegExp('^'+label+'$')}).count(),'Registration filter includes '+label);
 const registrationFilter=page.locator('#host .state-filter[data-field="RegistrationState"]');await registrationFilter.locator('summary').click();await registrationFilter.getByRole('button',{name:'Clear',exact:true}).click();await registrationFilter.locator('label').filter({hasText:/^Approved$/}).locator('input').check();await page.locator('#host #filter-status').filter({hasText:'1 registrations'}).waitFor().catch(async e=>{console.error(await page.locator('#host #filter-status').innerText());console.error(await page.evaluate(()=>window.__themeVisual.app.view.data('displayRows').filter(r=>r.level===3).map(r=>[r.RegistrationID,r.State])));throw e;});assert.deepEqual([...new Set((await state()).all.filter(r=>r.level===3).map(r=>r.RegistrationID))],['REG-LONG'],'Registration state filtering uses the registration own state');await page.locator('#host #reset-filters').click();await page.locator('#host #filter-status').filter({hasText:'7 registrations'}).waitFor();
 assert.deepEqual(errors,[],'No browser errors during registration interaction');

 if(stress){
  const start=Date.now();await page.evaluate(()=>{const rows=[];for(let i=0;i<10000;i++){const b={AppID:'RG-PERF-A'+Math.floor(i/4),ROID:'RG-PERF-R'+Math.floor(i/2),SubID:'RG-PERF-S'+i,EventName:'RG-PERF-E'+Math.floor(i/10),ChangeID:'RG-PERF-C'+Math.floor(i/30),ChangeQMS:'CR'+Math.floor(i/30),EventQMS:'CR'+Math.floor(i/30),ChangeStatus:'In Progress',AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',Country:'France',Product:'Product '+(i%17),RegistrationID:'RG-PERF-REG'+i,RegistrationCountry:'France',RegistrationState:i%2?'Approved':'Planned',RegistrationStart:'2020-01-01',RegistrationEnd:i%2?'8900-12-31':'2050-01-01',OriginalDispatch:'2026-08-01',LatestDispatch:'2026-08-15',OriginalSubmission:'2026-09-01',LatestSubmission:'2026-09-15',OriginalApproval:'2027-03-01',LatestApproval:'2027-03-15'};rows.push({...b,CatalogNumber:'00A'+i},{...b,CatalogNumber:'00B'+i});if(i%100===0)rows.push({...b,CatalogNumber:'00A'+i});}window.__registrationStressRows=rows;window.__dispatchSend(rows);});
  await page.locator('#host #filter-status').filter({hasText:'10000 submissions'}).waitFor({timeout:120000});await page.locator('#host #filter-status').filter({hasText:'10000 registrations'}).waitFor({timeout:120000});const loadMs=Date.now()-start;
  const switches=[];for(let i=0;i<12;i++){const group=['Application','Regulatory event','Change initiation'][i%3],then=Date.now();await page.locator('#host select[name=groupBy]').selectOption(group);await page.waitForFunction(group=>window.__themeVisual.app.view.signal('groupBy')===group&&window.__themeVisual.app.view.data('displayRows').some(r=>r.level===3),group);switches.push(Date.now()-then);const s=await state();assert.equal(new Set(s.all.map(r=>r.key)).size,s.all.length);assert.equal(s.selected,'');assert.equal(new Set(s.all.filter(r=>r.level===2).map(r=>r.SubID)).size,10000);assert.equal(new Set(s.all.filter(r=>r.level===3).map(r=>r.RegistrationID)).size,10000);}
  await page.locator('#host input[name=query]').fill('00B9999');await page.locator('#host #filter-status').filter({hasText:'1 submissions'}).waitFor();assert.match(await page.locator('#host #filter-status').innerText(),/1 registrations/);await page.locator('#host input[name=query]').fill('');await page.locator('#host #filter-status').filter({hasText:'10000 submissions'}).waitFor();
  for(let i=0;i<4;i++)await page.locator('#host .hierarchyHeader text').click();const revision=await page.evaluate(()=>window.__qualityRevision);await page.evaluate(()=>window.__dispatchSend(window.__registrationStressRows));await page.waitForFunction(r=>window.__qualityRevision>r,revision,{timeout:120000});assert.match(await page.locator('#host #filter-status').innerText(),/10000 submissions.*10000 registrations/);
  console.log('PASS: registration stress: 10,000 distinct submissions + 10,000 registrations, 20,100 catalog rows, 12 group switches, numeric sort, catalog search and refresh. Load '+loadMs+' ms; slowest group switch '+Math.max(...switches)+' ms.');
 }
 assert.deepEqual(errors,[]);console.log('PASS: registration nesting, all groups, distinct counts, complete Details, missing/conflicting links, catalog values, both themes, recorded states, clipped long bars and unchanged Fit all.');
}
module.exports=verify;
module.exports.fixtures=fixtures;
if(require.main===module){
 const fs=require('node:fs'),http=require('node:http'),{chromium}=require('./powerbi-visual/node_modules/@playwright/test');
 (async()=>{const dir=path.join(__dirname,'powerbi-visual','verify'),server=http.createServer((req,res)=>{const target=path.join(dir,new URL(req.url,'http://localhost').pathname);if(!target.startsWith(dir+path.sep)){res.writeHead(403).end();return;}fs.readFile(target,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_BROWSER_CHANNEL||'msedge'}),page=await browser.newPage({viewport:{width:1280,height:950}});try{await verify(page,{outputDir:dir,url:'http://127.0.0.1:'+server.address().port+'/index.html',stress:!process.argv.includes('--no-stress')});}finally{await browser.close();server.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
}
