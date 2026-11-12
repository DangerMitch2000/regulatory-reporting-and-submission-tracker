/* Count-label navigation through real SVG pointer clicks in the Visual host. */
const assert=require('node:assert/strict'),path=require('node:path');
const {rowLocator,setFilterDrawer,toggleFilter,resetFilters}=require('./tracker-browser-helpers.cjs');
const ancestorFields=[[-2,'changeKey'],[-1,'eventKey'],[0,'appKey'],[1,'roKey'],[2,'subKey']];
const sorted=values=>[...new Set(values)].sort();

function fixtures(){
 const base={...require('./tracker-layout.verify.cjs').fixtures()[0],AppID:'COUNT-A1',ROID:'COUNT-R1',SubID:'COUNT-S1',RegistrationID:'COUNT-REG1',RegistrationNumber:'COUNT-AUTH1',EventName:'COUNT-E1',ChangeID:'COUNT-C1',EventQMS:'COUNT-QMS',ChangeQMS:'COUNT-QMS',Product:'Count navigation product',RegistrationComments:'Count navigation source evidence',CatalogNumber:'00001'};
 const a1=[base,{...base,CatalogNumber:'00002'},{...base},{...base,SubID:'COUNT-S2',RegistrationID:'COUNT-REG2',SubStatus:'Planned',Country:'France',RegistrationCountry:'France',ActualDispatch:null,ActualSubmission:null,ActualApproval:null},{...base,SubID:'COUNT-S3',RegistrationID:'COUNT-REG3',Country:'Germany',RegistrationCountry:'Germany'}];
 const repeated=a1.flatMap(r=>[r,{...r,EventName:'COUNT-E2'},{...r,ChangeID:'COUNT-C2'}]);
 const a2=[{...base,AppID:'COUNT-A2',ROID:'COUNT-R2',SubID:'COUNT-S4',RegistrationID:'COUNT-REG4',Country:'Spain',RegistrationCountry:'Spain'},{...base,AppID:'COUNT-A2',ROID:'COUNT-R3',SubID:'COUNT-S5',RegistrationID:'COUNT-REG5',Country:'Portugal',RegistrationCountry:'Portugal'}];
 const empty={AppID:'COUNT-ZERO',AppStatus:'Active',EventName:'COUNT-E1',ChangeID:'COUNT-C1',EventQMS:'COUNT-QMS',ChangeQMS:'COUNT-QMS',ChangeStatus:'Completed',Country:'Norway',Product:'Empty app',Manufacturer:'ABO',BusinessUnit:'ID'};
 const orphan={RegistrationID:'COUNT-UNLINKED',RegistrationState:'Approved',RegistrationCountry:'Italy',RegistrationStart:'2026-03-23',RegistrationEnd:'2036-03-22',Country:'Italy',Product:'Unlinked registration'};
 return [...repeated,...a2,empty,orphan];
}

async function verify(page,{url='http://127.0.0.1:8771/index.html',outputDir=__dirname}={}){
 const errors=[];const onError=error=>errors.push(error.message);page.on('pageerror',onError);
 const status=page.locator('#host #filter-status');
 const snapshot=()=>page.evaluate(()=>{
  const view=window.__themeVisual.app.view;
  const fields=['key','level','changeKey','eventKey','appKey','roKey','subKey','ChangeID','EventName','AppID','ROID','SubID','RegistrationID','registrationContainer','registrationUnlinked','EventCount','AppCount','ROCount','n','RegistrationCount'];
  return {selected:view.signal('selectedKey'),expanded:view.data('expanded').map(r=>r.key),visible:view.data('visible').slice().sort((a,b)=>a.idx-b.idx).map(r=>r.key),page:view.data('pageRows').slice().sort((a,b)=>a.idx-b.idx).map(r=>r.key),request:view.signal('rowRequest'),navigateRequest:view.signal('countNavigateRequest'),detailsOpen:document.querySelector('#host #selected-details').open,detailText:document.querySelector('#host #detail-body').textContent,rows:view.data('displayRows').map(row=>Object.fromEntries(fields.map(field=>[field,row[field]]))),source:JSON.stringify(view.data('dataset')),filters:[...document.querySelectorAll('#host #filters input,#host #filters select,#host #state-legend input,#host input[name=query]')].map(n=>[n.name,n.value,n.checked]),status:document.querySelector('#host #filter-status').textContent};
 });
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const labelFor=(row,level)=>{const field=level===-1?'EventCount':level===0?'AppCount':level===1?'ROCount':level===2?'n':'RegistrationCount',count=Number(row[field])||0,name=level===-1?'Event':level===0?'App':level===1?'RO':level===2?'Sub':'Reg';return count+' '+name+(count===1?'':'s');};
 let compactLabels=0;
 const chip=async(row,level)=>{
  const labels=await rowLocator(page,'#host .countChip text',row.key);
  const rendered=await labels.evaluateAll(nodes=>nodes.map((node,index)=>{const item=node.__data__,datum=item.datum,style=getComputedStyle(node),context=document.createElement('canvas').getContext('2d'),size=item.fontSize||parseFloat(style.fontSize),weight=item.fontWeight||style.fontWeight,font=item.font||style.fontFamily,box=node.getBoundingClientRect();context.font=weight+' '+size+'px '+font;return {index,key:datum.key,level:datum.countChip.level,count:datum.countChip.count,label:datum.countChip.label,text:node.textContent,naturalWidth:context.measureText(datum.countChip.label).width,chipWidth:datum.chipWidth,limit:item.limit,countFit:datum.countFit,availableWidth:window.__themeVisual.app.view.signal('hierarchyW')-datum.labelX-4,font:context.font,width:box.width,height:box.height};}));
  const matching=rendered.filter(label=>label.level===level),diagnostic=JSON.stringify({key:row.key,targetLevel:level,expected:labelFor(row,level),rendered});
  assert.equal(matching.length,1,'One distinct semantic count hit target: '+diagnostic);
  const match=matching[0],expected=labelFor(row,level);
  assert.equal(match.label,expected,'Full count metadata is correct: '+diagnostic);
  assert.equal(match.count,Number(expected.split(' ')[0]),'Numeric count metadata is correct: '+diagnostic);
  assert(match.width>0&&match.height>0,'Count label has a real pointer target: '+diagnostic);
  const naturalTotal=rendered.reduce((sum,label)=>sum+label.naturalWidth+8,0),fullLabelsFit=naturalTotal<=match.availableWidth+.5;
  if(fullLabelsFit)assert.equal(match.text,expected,'Count labels must remain complete when their actual font weight fits: '+diagnostic);
  else if(match.text!==expected){assert(match.text.endsWith('…')&&expected.startsWith(match.text.slice(0,-1)),'Compact labels may only abbreviate the correct label with an ellipsis: '+diagnostic);compactLabels++;}
  // Identity comes from the original row key and target level, not typography.
  // The assertions above still catch stale/wrong counts and premature clipping.
  return labels.nth(match.index);
 };
 const descendants=(rows,parent,level)=>rows.filter(row=>row.level===level&&(parent.registrationContainer?row.registrationUnlinked&&row.appKey===parent.key:row[ancestorFields.find(([n])=>n===parent.level)[1]]===parent.key));
 const prepare=async(parent,{detailsOpen=false}={})=>{
  const state=await snapshot(),existing=new Set(state.rows.map(r=>r.key));
  const expanded=ancestorFields.filter(([level,field])=>level<parent.level&&existing.has(parent[field])).map(([,field])=>parent[field]);
  const unrelated=state.rows.find(row=>row.level===0&&row.key!==parent.key&&row.key!==parent.appKey&&!row.registrationContainer);
  if(unrelated)expanded.push(unrelated.key);
  await page.evaluate(async({expanded,key,detailsOpen})=>{const view=window.__themeVisual.app.view;view.change('expanded',window.__themeVega.changeset().remove(()=>true).insert(expanded.map(key=>({key}))));view.signal('selectedKey',key);await view.runAsync();document.querySelector('#host #selected-details').open=detailsOpen;const row=view.data('visible').find(row=>row.key===key);if(!row)throw Error('Count-test parent is not visible: '+key);view.signal('rowRequest',{pos:row.idx-1});await view.runAsync();},{expanded:sorted(expanded),key:parent.key,detailsOpen});
  await page.waitForFunction(key=>window.__themeVisual.app.view.signal('selectedKey')===key&&document.querySelector('#host #detail-body h2'),parent.key);
  await settle();
  // Setup may open/close Details; establish its final viewport before scrolling
  // the parent into position for the real pointer action under test.
  await page.waitForFunction(()=>Math.abs(window.__themeVisual.app.view.signal('denebContainer').height-Math.max(280,document.querySelector('#host #chart').clientHeight))<2);
  await page.evaluate(async key=>{const view=window.__themeVisual.app.view,row=view.data('visible').find(r=>r.key===key);await view.signal('rowRequest',{pos:row.idx-1}).runAsync();},parent.key);
  await page.waitForFunction(key=>window.__themeVisual.app.view.data('pageRows').some(r=>r.key===key),parent.key);return snapshot();
 };
 const assertStable=(before,after,context)=>{
  assert.deepEqual(after.rows,before.rows,context+': navigation leaves all hierarchy counts and source identities intact');
  assert.equal(after.source,before.source,context+': navigation does not mutate the input dataset');
  assert.deepEqual(after.filters,before.filters,context+': navigation does not change filters');
  assert.equal(after.status,before.status,context+': overall distinct counts are unchanged');
 };
 const navigate=async(parent,level,options={})=>{
  const before=await prepare(parent,options),targets=descendants(before.rows,parent,level);
  assert(targets.length,'Fixture must have descendants for '+labelFor(parent,level));
  const needed=[parent.key];
  if(!parent.registrationContainer)for(const target of targets)for(const [ancestorLevel,field]of ancestorFields)if(ancestorLevel>=parent.level&&ancestorLevel<level&&target[field])needed.push(target[field]);
  const expectedExpansion=sorted([...before.expanded,...needed]),targetKeys=targets.map(row=>row.key);
  const target=await chip(parent,level);
  await target.click();
  await page.waitForFunction(({targetKeys,expectedExpansion,selected,multiple,detailsOpen})=>{const view=window.__themeVisual.app.view,expanded=view.data('expanded').map(r=>r.key).sort(),first=view.data('visible').filter(r=>targetKeys.includes(r.key)).sort((a,b)=>a.idx-b.idx)[0];return JSON.stringify(expanded)===JSON.stringify(expectedExpansion)&&first&&view.signal('rowRequest')?.pos===first.idx-1&&view.signal('selectedKey')===(multiple?selected:first.key)&&document.querySelector('#host #selected-details').open===(multiple?detailsOpen:true);},{targetKeys,expectedExpansion,selected:before.selected,multiple:targets.length>1,detailsOpen:before.detailsOpen});
  await settle();const after=await snapshot(),first=after.visible.find(key=>targetKeys.includes(key));
  assert.deepEqual(sorted(after.expanded),expectedExpansion,'Only the clicked branch’s required ancestor paths are added');
  assert.equal(new Set(after.expanded).size,after.expanded.length,'Existing expansions are not duplicated');
  assert(targetKeys.every(key=>after.visible.includes(key)),'Every matching descendant is revealed');
  assert(after.page.includes(first),'The first matching descendant is on screen: '+JSON.stringify({parent:parent.key,level,first,page:after.page,request:after.request,viewport:await page.evaluate(()=>{const v=window.__themeVisual.app.view;return Object.fromEntries(['scrollTop','maxScroll','viewportAnchor','height','top','viewBottom','rowCount'].map(name=>[name,v.signal(name)]));})}));
  if(targets.length===1){assert.equal(after.selected,first);assert.equal(after.detailsOpen,true,'Single counts open the matching record Details');}
  else{assert.equal(after.selected,before.selected,'Multiple counts preserve the previous selection');assert.equal(after.detailsOpen,before.detailsOpen,'Multiple counts preserve the Details open state');assert.equal(after.detailText,before.detailText,'Multiple counts preserve current Details content');}
  assertStable(before,after,labelFor(parent,level));return {before,after,targets};
 };
 const noOverlap=async()=>{
  const overlap=await page.evaluate(()=>{const grouped=new Map();for(const node of document.querySelectorAll('#host .countChip text')){const key=node.__data__?.datum?.key,b=node.getBoundingClientRect();if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push({text:node.textContent,left:b.left,right:b.right,top:b.top,bottom:b.bottom});}for(const [key,labels]of grouped)for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];if(a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5)return {key,a,b};}return null;});
  assert.equal(overlap,null,'Count labels do not overlap: '+JSON.stringify(overlap));
 };

 try{
  await page.goto(url);await status.filter({hasText:'60 submissions'}).waitFor();
  const revision=await page.evaluate(()=>window.__qualityRevision);await page.evaluate(rows=>window.__dispatchSend(rows),fixtures());await page.waitForFunction(n=>window.__qualityRevision>n,revision);await status.filter({hasText:'5 submissions'}).waitFor();
  await page.setViewportSize({width:1600,height:1150});await page.evaluate(()=>window.__resizeHost(1536,1050));await settle();
  assert.match(await status.innerText(),/6 registrations/,'Distinct source registrations include one unlinked record');
  for(const mode of ['Application','Regulatory event','Change initiation']){
   await page.locator('#host select[name=groupBy]').selectOption(mode);
   await page.waitForFunction(mode=>window.__themeVisual.app.view.signal('groupBy')===mode,mode);await settle();
   const state=await snapshot(),scoped=state.rows.filter(row=>(mode==='Application'||row.EventName==='COUNT-E1')&&(mode!=='Change initiation'||row.ChangeID==='COUNT-C1'));
   const app=scoped.find(row=>row.level===0&&row.AppID==='COUNT-A1'),otherApp=scoped.find(row=>row.level===0&&row.AppID==='COUNT-A2');
   assert(app&&otherApp,'Both application branches exist in '+mode);assert.equal(app.ROCount,1);assert.equal(app.n,3);assert.equal(app.RegistrationCount,3,'Catalog/source repetition does not inflate count labels');
   if(mode!=='Application')assert(state.rows.filter(row=>row.level===0&&row.AppID===app.AppID).length>1,'Fixture repeats the same application ID across actual contexts');
   await navigate(app,1);
   await navigate(app,2);
   await navigate(app,2,{detailsOpen:true});
   const sub=scoped.find(row=>row.level===2&&row.SubID==='COUNT-S1'&&row.appKey===app.key);
   assert.equal(sub.RegistrationCount,1);await navigate(sub,3);
   const nested=await navigate(otherApp,3);assert.equal(new Set(nested.targets.map(row=>row.roKey)).size,2,'Registration count opens two different RO/submission paths');
   assert(nested.targets.every(row=>row.appKey===otherApp.key),'Registration destinations remain in the clicked context');
   if(mode!=='Application'){
    const event=scoped.find(row=>row.level===-1&&row.EventName==='COUNT-E1');await navigate(event,0);await navigate(event,2);
   }
   if(mode==='Change initiation'){
    const change=state.rows.find(row=>row.level===-2&&row.ChangeID==='COUNT-C1');await navigate(change,-1);const result=await navigate(change,3);assert(result.targets.every(row=>row.changeKey===change.key),'Repeated registration IDs stay scoped to the clicked change');
    const widths=await page.evaluate(async()=>{const view=window.__themeVisual.app.view,previous=view.signal('columnWidths');await view.signal('columnWidths',{...previous,hierarchy:160}).runAsync();return previous;}),beforeCompact=compactLabels;
    await navigate(change,-1);assert(compactLabels>beforeCompact,'A deliberately narrow hierarchy still navigates through an abbreviated count label');
    await page.evaluate(async widths=>{await window.__themeVisual.app.view.signal('columnWidths',widths).runAsync();},widths);
   }
   const zero=scoped.find(row=>row.level===0&&row.AppID==='COUNT-ZERO');assert(zero,'Retained empty application is present');
   const before=await prepare(zero),zeroChip=await chip(zero,2);assert.equal(await zeroChip.textContent(),'0 Subs');await zeroChip.click();await settle();const after=await snapshot();
   assert.deepEqual(after.expanded,before.expanded,'Zero counts do not expand any branch');assert.equal(after.selected,before.selected);assert.equal(after.detailsOpen,before.detailsOpen);assert.deepEqual(after.request,before.request,'Zero count does not scroll');assert.deepEqual(after.navigateRequest,before.navigateRequest,'Disabled zero label does not emit a navigation request');assertStable(before,after,'Zero count');
   const container=state.rows.find(row=>row.registrationContainer);assert(container);const unlinked=await navigate(container,3);assert.deepEqual(unlinked.targets.map(row=>row.RegistrationID),['COUNT-UNLINKED'],'Unlinked count never jumps into ordinary registration branches');
   await noOverlap();
  }

  await page.locator('#host select[name=groupBy]').selectOption('Application');await settle();
  await setFilterDrawer(page,true);const country=page.locator('#host .filter[data-kind=country]');await country.locator(':scope > summary').click();await country.getByLabel('Ireland',{exact:true}).check();await status.filter({hasText:'1 submissions'}).waitFor();await country.locator(':scope > summary').click();await setFilterDrawer(page,false);
  let state=await snapshot(),app=state.rows.find(row=>row.level===0&&row.AppID==='COUNT-A1');assert.equal(app.n,1);const filtered=await navigate(app,2);assert.deepEqual(filtered.targets.map(row=>row.SubID),['COUNT-S1'],'Count navigation cannot restore submissions excluded by country filters');
  await resetFilters(page);await status.filter({hasText:'5 submissions'}).waitFor();
  const subState=page.locator('#host .state-filter[data-field=SubStatus]');await toggleFilter(page,subState);await subState.getByLabel('Planned',{exact:true}).uncheck();await status.filter({hasText:'4 submissions'}).waitFor();await toggleFilter(page,subState);
  state=await snapshot();app=state.rows.find(row=>row.level===0&&row.AppID==='COUNT-A1');assert.equal(app.n,2);const byState=await navigate(app,2);assert.deepEqual(sorted(byState.targets.map(row=>row.SubID)),['COUNT-S1','COUNT-S3'],'Count navigation respects the active submission-state filter');
  await resetFilters(page);await status.filter({hasText:'5 submissions'}).waitFor();
  await noOverlap();await page.mouse.move(1,1);await page.locator('#host').screenshot({path:path.join(outputDir,'count-navigation.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: real count-label clicks in Application/Event/Change modes; exact ancestor expansions; repeated-ID isolation; single/multiple Details behavior; first-target scrolling; zero/unlinked navigation; country/state filters; unchanged source/counts; nonoverlapping labels.');
 }finally{page.off('pageerror',onError);}
}

module.exports=verify;module.exports.fixtures=fixtures;
if(require.main===module){
 const fs=require('node:fs'),http=require('node:http');let pw;try{pw=require('@playwright/test');}catch{pw=require('./powerbi-visual/node_modules/@playwright/test');}
 (async()=>{await require('./tracker-browser-helpers.cjs').registerRowSelector();const dir=path.join(__dirname,'powerbi-visual','verify'),server=http.createServer((req,res)=>{const file=path.resolve(dir,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(dir+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await pw.chromium.launch({headless:true,channel:process.env.TRACKER_BROWSER_CHANNEL||'msedge'});try{await verify(await browser.newPage({viewport:{width:1600,height:1150}}),{url:'http://127.0.0.1:'+server.address().port+'/index.html',outputDir:dir});}finally{await browser.close();server.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
}
