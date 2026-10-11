const assert=require('node:assert/strict'),vega=require('./vega'),spec=require('./timeline.json'),registrations=require('./registrations'),changes=require('./changes');
const DAY=86400000,at=d=>Date.UTC(2026,0,1)+d*DAY;
const source=Array.from({length:12},(_,i)=>({AppID:'APP-'+Math.floor(i/4),ROID:'RO-'+Math.floor(i/2),SubID:'SUB-'+i,AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',Manufacturer:'ABO',Product:'Product A',Country:'Ireland',OriginalDispatch:at(i),OriginalSubmission:at(i+10),ActualDispatch:at(i+1),ActualSubmission:at(i+12),LatestApproval:at(i+45),RegistrationID:'REG-'+i,RegistrationState:'Approved',RegistrationCountry:'Ireland',RegistrationStart:'2020-01-01',RegistrationEnd:'2030-01-01'}));
source.push(...['Product B','Product C'].map((Product,i)=>({...source[0],Product,Country:'France',CatalogNumber:'CAT-'+i})),...['Product B','Product C','Product D'].map(Product=>({...source[1],Product})),{...source[2],Product:''});
const flatten=n=>[n,...(n.items||[]).flatMap(flatten)],marks=(view,name)=>flatten(view.scenegraph().root).filter(n=>n.mark?.name===name);
const errors=[];
(async()=>{
 const view=new vega.View(vega.parse(spec),{renderer:'none'}).logger({level:()=>0,error:e=>errors.push(String(e)),warn(){},info(){},debug(){}});
 try{
  view.signal('registrationLayerEnabled',true).signal('nowDate',at(20));view.change('dataset',vega.changeset().insert(source));await view.runAsync();
  const base=[...view.data('apps'),...view.data('ros'),...view.data('sub')],reg=registrations.attach(registrations.prepare(source),base).registrationRows,all=[...base,...reg];
  const presentation=all.map(r=>({key:r.key,RegistrationCount:r.level===0?4:r.level===1?2:1,SiteLabels:['Legal: ABO','Registration: Galway'],LegalSites:['ABO'],RegistrationSites:['Galway'],RecordURL:r.level===0?'https://example.com/record/'+r.AppID:r.SubID==='SUB-1'?'javascript:alert(1)':null,RecordURLIssue:''}));
  // A valid-looking destination with conflicting source evidence remains hidden.
  presentation.find(r=>r.key===reg[2].key).RecordURL='https://example.com/conflict';presentation.find(r=>r.key===reg[2].key).RecordURLIssue='Conflicting destinations';
  // Whitespace and non-HTTP URLs are never made clickable in the chart.
  presentation.find(r=>r.key===reg[3].key).RecordURL='https://example.com/bad url';
  const sub=base.find(r=>r.level===2&&r.SubID==='SUB-0');
  view.change('registrationRows',vega.changeset().insert(reg)).change('orderedRows',vega.changeset().insert(changes.order(all,false))).change('presentationRows',vega.changeset().insert(presentation)).change('membershipRows',vega.changeset().insert({key:sub.key,MembershipLabels:['Product A','001, 002 +4 more','Product B','010, 011','Product C','020']})).change('expanded',vega.changeset().insert(base.map(r=>({key:r.key}))));
  view.signal('eventDescending',false);await view.runAsync();
  const products=view.data('visible').find(r=>r.key===sub.key);
  assert.equal(products.ProductInfo.count,3,'All product memberships remain available for Details');
  assert.equal(products.ProductPreview,'3 products · Product A','Multiple products have a count-first compact preview');
  assert.equal(view.data('visible').find(r=>r.level===2&&r.SubID==='SUB-1').ProductPreview,'4 products · Product A','More than three products use the same compact preview');
  assert.equal(view.data('visible').find(r=>r.level===2&&r.SubID==='SUB-2').ProductPreview,'Product A *','Missing-product indicator remains available');
  const workflowFit=[...view.signal('fitRange')],allKeys=new Set(view.data('visible').map(r=>r.key));
  assert.deepEqual(spec.signals.find(s=>s.name==='clicked').on.map(e=>e.events),['@toggle:click'],'Only expansion toggles change hierarchy state');
  const detailsEvents=spec.signals.find(s=>s.name==='detailsRequest').on[0].events;
  for(const name of ['parentLabel','subLabel','registrationLabel','parentBar','registrationBar','connector','milestone','surveyRange','preparationRange','predictionRange'])assert.ok(detailsEvents.includes('@'+name+':click'),name+' opens Details');
  assert.ok(!detailsEvents.includes('@toggle:click'),'Expansion never opens Details');
  assert.equal(spec.signals.find(s=>s.name==='showRegistrationEnd').bind,undefined,'No registration-end control is exposed');
  assert.equal(view.signal('showRegistrationEnd'),true,'Legacy expiry remains visible when inside the chosen window');
  for(const width of [720,1280,1500,1920])for(const height of [280,600,960]){
   view.signal('denebContainer',{width,height}).signal('viewportAnchor',{key:'',rel:0,fallback:0});await view.runAsync();
   assert.ok(view.signal('bodyFont')>=13&&view.signal('bodyFont')<=16,'Readable bounded body font at '+width+'x'+height);
   assert.ok(width-view.signal('left')>=320,'Narrow layouts retain at least 320 pixels for the timeline');
   if(width>=1280)assert.ok(view.signal('left')<=width*.4,'Desktop layouts reserve at least 60% of their width for the timeline');
   if(width===1500)assert.equal(view.signal('left'),570,'1500px layout uses compact 570px frozen columns');
   assert.deepEqual([...view.signal('fitRange')],workflowFit,'Resizing never changes workflow Fit all');
   assert.ok(view.data('pageRows').length>=1,'At least one full record remains visible in the shortest supported visual');
   const seen=new Set();
   for(let pos=0;pos<=view.signal('maxScroll');pos++){
    view.signal('rowRequest',{pos});await view.runAsync();
    const page=view.data('pageRows');
    for(let i=0;i<page.length;i++){
     const row=page[i];seen.add(row.key);
     assert.ok(row.y>=view.signal('top')-0.1&&row.y+row.rowHeight<=view.signal('viewBottom')+0.5,'Rows stay below header and above footer');
     if(i)assert.ok(page[i-1].y+page[i-1].rowHeight<=row.y+0.1,'Adaptive row heights never overlap');
    }
    for(const name of ['parentLabel','subLabel','registrationLabel','selectGroup','subMeta','registrationMeta','ownState','siteText','productText','countryText'])for(const item of marks(view,name)){
     assert.ok(item.fontSize>=13&&item.fontSize<=16,name+' uses readable font');
     if(item.text&&(!Array.isArray(item.text)||item.text.some(Boolean)))assert.ok(item.bounds.y1>=item.datum.y-0.5&&item.bounds.y2<item.datum.y+item.datum.rowHeight,name+' fits its row');
    }
    for(const toggle of marks(view,'toggle')){
     const label=['parentLabel','subLabel'].flatMap(n=>marks(view,n)).find(n=>n.datum.key===toggle.datum.key);
     assert.ok(label&&toggle.bounds.x2<label.bounds.x1,'Expansion control never overlaps the record name');
    }
    for(const icon of marks(view,'externalLink')){
     assert.equal(icon.datum.level,0,'Only mapped, valid and unambiguous HTTP(S) destinations get icons');
     assert.ok(icon.bounds.x1>icon.datum.labelX,'Link icon stays beside the record label');
    }
    for(const item of marks(view,'siteText'))assert.deepEqual([...item.text],['Legal: ABO','Registration: Galway'],'Both manufacturing-site sources remain labelled');
    for(const item of marks(view,'productText')){
     assert.equal(typeof item.text,'string','Product preview is one text line, including legacy multi-line catalog labels');
     assert.doesNotMatch(item.text,/[\r\n]|001|010|020|CAT-/,'Catalog codes stay out of the compact product preview');
     const country=marks(view,'countryText').find(n=>n.datum.key===item.datum.key);
     assert.equal(country.y-item.y,view.signal('rowLineH'),'Countries remain on the fixed second line');
     assert.ok(country.bounds.y2<item.datum.y+item.datum.rowHeight,'Country line fits inside the compact row');
    }
    const visible=view.data('visible'),multiple=visible.find(r=>r.key===sub.key),single=visible.find(r=>r.level===2&&r.SubID==='SUB-3');
    assert.equal(multiple.rowHeight,single.rowHeight,'Three products and legacy six-line catalog previews never increase row height');
    assert.ok(visible.every(r=>r.HierarchyMeta.length===1),'Hierarchy count subtitles occupy only one line');
    assert.ok(visible.every(r=>r.rowHeight===view.signal('rowH')),'Short count subtitles keep parent and child rows at the compact base height');
   }
   assert.deepEqual(seen,allKeys,'Scrolling reaches every record at '+width+'x'+height);
   view.signal('rowRequest',{pos:view.signal('maxScroll')});await view.runAsync();
   assert.equal(view.data('pageRows').at(-1).key,view.data('visible').at(-1).key,'End of scrolling includes the last record');
  }
  view.signal('denebContainer',{width:1280,height:960}).signal('rowRequest',{pos:0});await view.runAsync();
  const app=marks(view,'selectGroup').find(n=>n.datum.level===0);assert.deepEqual([...app.text],['2 ROs · 4 Subs · 4 Regs'],'Application counts use one concise subtitle');
  assert.equal(app.tooltip.Counts,'2 regulatory objectives · 4 submissions · 4 registrations','Count tooltip retains unabbreviated full values');
  assert.equal(marks(view,'parentLabel').find(n=>n.datum.key===app.datum.key).text,app.datum.AppID,'Record identifiers are not abbreviated');
  assert.equal(marks(view,'rowDetailsButton').length,0,'Repeated per-row Details buttons are removed');
  view.signal('mode','Compare').signal('compareLevel',2);await view.runAsync();
  const comparison=marks(view,'siteText')[0];assert.ok(String(comparison.text).includes('days'),'Submission comparison duration columns remain unchanged');
  assert.deepEqual(errors,[],'No Vega runtime errors');
  console.log('PASS: compact single-line product previews at twelve sizes, expanded timeline width, unchanged full memberships, fixed country line, complete scrolling, labelled site sources, registration subtitles, readable text, isolated expand/select/link interactions and preserved workflow fitting/comparison.');
 }finally{view.finalize();}
})().catch(e=>{console.error(e);process.exit(1)});
