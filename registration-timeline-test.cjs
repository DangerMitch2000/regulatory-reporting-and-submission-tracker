const assert=require('node:assert/strict');
const vega=require('./vega'),spec=require('./timeline.json'),registrations=require('./registrations'),events=require('./events'),changes=require('./changes');
const DAY=86400000,at=n=>Date.UTC(2026,0,1)+n*DAY;
const base={AppID:'APP-1',ROID:'RO-1',SubID:'SUB-1',AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',EventName:'EVENT-1',EventState:'Planned State',ChangeID:'CHANGE-1',ChangeQMS:'QMS-1',EventQMS:'QMS-1',ChangeStatus:'In Progress',Manufacturer:'Site A',Product:'Product A',Country:'Country A',OriginalDispatch:at(0),LatestSubmission:at(30),LatestApproval:at(60)};
const rows=[
 {...base,RegistrationID:'REG-2',RegistrationState:'Approved',RegistrationCountry:'Country A',RegistrationStart:'2021-01-01',RegistrationEnd:'2031-12-31',CatalogNumber:'00101'},
 {...base,RegistrationID:'REG-2',RegistrationState:'Approved',RegistrationCountry:'Country A',RegistrationStart:'2021-01-01',RegistrationEnd:'2031-12-31',CatalogNumber:'00102'},
 {...base,RegistrationID:'REG-10',RegistrationState:'Expired',RegistrationCountry:'Country A',RegistrationStart:'2020-01-01',RegistrationEnd:'8900-12-31'},
 {...base,SubID:'SUB-2',RegistrationID:'REG-3',RegistrationState:'Planned',RegistrationCountry:'Country B',RegistrationStart:'2026-01-10'},
 {RegistrationID:'REG-ORPHAN',RegistrationState:'Withdrawn',RegistrationCountry:'Country C',RegistrationStart:'2024-01-01',RegistrationEnd:'2030-01-01'}
];
function flatten(node){return [node,...(node.items||[]).flatMap(flatten)];}
const marks=(view,name)=>flatten(view.scenegraph().root).filter(n=>n.mark?.name===name);
const errors=[];
async function create(source=rows){
 const view=new vega.View(vega.parse(spec),{renderer:'none'}).logger({level:()=>0,error:e=>errors.push(String(e)),warn(){},info(){},debug(){}});
 view.signal('denebContainer',{width:1560,height:1900}).signal('nowDate',at(20)).signal('registrationLayerEnabled',source.some(r=>r.RegistrationID));
 view.change('dataset',vega.changeset().insert(source));await view.runAsync();
 const app=[...view.data('apps'),...view.data('ros'),...view.data('sub')],args=[view.data('raw'),view.data('sub'),view.data('apps'),view.data('ros')],ev=events.build(...args),ch=changes.build(...args),prepared=registrations.prepare(source);
 const newRows=[...registrations.attach(prepared,app,'Application').registrationRows,...registrations.attach(prepared,ev,'Regulatory event').registrationRows,...registrations.attach(prepared,ch,'Change initiation').registrationRows];
 view.change('eventRows',vega.changeset().insert(ev)).change('changeRows',vega.changeset().insert(ch)).change('registrationRows',vega.changeset().insert(newRows)).change('orderedRows',vega.changeset().insert(changes.order([...app,...ev,...ch],true)));
 await view.runAsync();
 view.change('expanded',vega.changeset().insert([...app,...ev,...ch,...newRows].filter(r=>r.level!==3).map(r=>({key:r.key}))));await view.runAsync();
 return {view,app,ev,ch,newRows};
}
(async()=>{
 let {view,app,ev,ch}=await create();
 try{
  const expectedFit=JSON.stringify(view.signal('fitRange'));
  assert.ok(view.signal('fitRange')[0]>=at(-4)&&view.signal('fitRange')[1]<=at(64),'Registration validity never stretches workflow Fit all');
  assert.equal(view.data('sub').length,2,'Catalog and registration membership duplicates never increase submissions');
  assert.equal(view.data('sub').find(r=>r.SubID==='SUB-1').issues,0,'Different validity dates on distinct registrations are not submission date conflicts');
  for(const group of ['Application','Regulatory event','Change initiation']){
   view.signal('groupBy',group);await view.runAsync();
   const visible=view.data('visible'),regs=visible.filter(r=>r.level===3),container=visible.find(r=>r.registrationContainer);
   assert.equal(regs.length,4,group+' retains matched and unmatched registrations');
   assert.ok(container&&regs.some(r=>r.registrationUnlinked),'Unmatched records remain visible separately');
   assert.equal(new Set(regs.map(r=>r.RegistrationID)).size,4,'No duplicate registration IDs within hierarchy');
   for(const sub of visible.filter(r=>r.level===2)){
    const parentIndex=visible.indexOf(sub),kids=regs.filter(r=>r.subKey===sub.key),after=visible.slice(parentIndex+1,parentIndex+1+kids.length);
    assert.deepEqual(after.map(r=>r.key),kids.map(r=>r.key),'Each registration immediately follows its own submission');
   }
   assert.deepEqual(regs.filter(r=>r.SubID==='SUB-1').map(r=>r.RegistrationID),['REG-10','REG-2'],'Natural numeric descending registration sort');
   assert.equal(JSON.stringify(view.signal('fitRange')),expectedFit,'Grouping cannot pull registration validity into Fit all');
   assert.equal(marks(view,'rowDetailsButton').length,0,'Names open Details without repeating a button on every row');
   assert.equal(['parentLabel','subLabel','registrationLabel'].flatMap(n=>marks(view,n)).length,view.data('pageRows').length,'Every selectable row exposes its clickable record name');
   assert.equal(marks(view,'registrationBar').length,4,'Registration bars retain rows for approved/expired/planned/withdrawn');
   assert.ok(marks(view,'registrationBar').find(n=>n.datum.RegistrationID==='REG-10').tooltip.State==='Expired','Stored registration state controls display despite far-future source end');
   const sub=view.data('displayRows').find(r=>r.level===2&&r.SubID==='SUB-1');
   view.change('expanded',vega.changeset().remove(r=>r.key===sub.key));await view.runAsync();
   assert.ok(!view.data('visible').some(r=>r.subKey===sub.key&&r.level===3),'Submission collapse hides its own registrations only');
   view.change('expanded',vega.changeset().insert({key:sub.key}));await view.runAsync();
   view.signal('eventDescending',false).change('orderedRows',vega.changeset().remove(()=>true).insert(changes.order([...app,...ev,...ch],false)));await view.runAsync();
   assert.deepEqual(view.data('visible').filter(r=>r.level===3&&r.SubID==='SUB-1').map(r=>r.RegistrationID),['REG-2','REG-10'],'Natural numeric ascending registration sort');
   view.signal('eventDescending',true).change('orderedRows',vega.changeset().remove(()=>true).insert(changes.order([...app,...ev,...ch],true)));await view.runAsync();
  }
  view.signal('groupBy','Application').signal('range',[at(15),at(45)]);await view.runAsync();
  const arrows=marks(view,'registrationBarContinuation');
  assert.equal(arrows.filter(n=>n.datum.RegistrationID==='REG-2').length,2,'Long validity shows both continuation directions');
  assert.equal(arrows.filter(n=>n.datum.RegistrationID==='REG-10').length,2,'Year8900 end acts as unplotted end with right continuation');
  assert.equal(arrows.filter(n=>n.datum.RegistrationID==='REG-3').length,2,'Missing end is shown with continuation, preserving missing value');
  for(const n of [...arrows,...marks(view,'registrationBar')]){
   assert.ok(n.bounds.x1>=view.signal('left')+2&&n.bounds.x2<=view.signal('width')-21,'Every registration glyph stays inside the visible timeline');
  }
  const sub=view.data('displayRows').find(r=>r.level===2&&r.SubID==='SUB-1');
  const labels=['Product A','00101, 00102 +3 more','Product B','00401','Product C','00501'];
  view.change('membershipRows',vega.changeset().insert({key:sub.key,MembershipLabels:labels}));await view.runAsync();
  const p=marks(view,'productText').find(n=>n.datum.key===sub.key),c=marks(view,'countryText').find(n=>n.datum.key===sub.key);
  assert.equal(p.text,'Product A','Legacy multi-line catalog previews stay compact and use the real product membership');
  assert.equal(c.y-p.y,view.signal('rowLineH'),'Country follows the single product line');
  assert.ok(p.bounds.y2<c.bounds.y1,'Compact product preview does not overlap country text');
  const pageRow=view.data('pageRows').find(r=>r.key===sub.key);
  assert.ok(c.bounds.y2<pageRow.y+pageRow.rowHeight,'Product and country fit inside their compact row height');
  view.signal('selectedKey',view.data('visible').find(r=>r.level===3).key);await view.runAsync();
  assert.equal(view.data('selectedRow')[0].level,3,'Registration selects its own Details context');
  view.signal('showRegistrationEnd',true).signal('range',null);await view.runAsync();
  assert.equal(JSON.stringify(view.signal('fitRange')),expectedFit,'Legacy registration-end toggle never stretches Fit all');
  view.signal('mode','Compare').signal('compareLevel',2);await view.runAsync();
  assert.ok(view.data('visible').every(r=>r.level===2),'Existing submission comparisons stay at submission grain');
  view.signal('axisMode','Elapsed days');await view.runAsync();
  assert.equal(marks(view,'registrationBar').length,0,'Registration validity is not shown on elapsed submission axis');
 }finally{view.finalize();}
 // Independent registration-only rows remain visible and use a bounded present-month fallback.
 ({view}=await create([rows[4]]));
 try{
  assert.equal(view.data('sub').length,0);assert.equal(view.data('visible').filter(r=>r.level===3).length,1);
  assert.ok(view.signal('fitRange')[1]-view.signal('fitRange')[0]<40*DAY,'No-workflow fallback ignores decade-long registration');
  view.change('dataset',vega.changeset().insert({...JSON.parse(JSON.stringify(rows[4])),RegistrationID:'REG-OTHER',CatalogNumber:'00099'}));
  view.signal('query','REG-ORPHAN');await view.runAsync();
  assert.deepEqual(view.data('raw').map(r=>r.RegistrationID),['REG-ORPHAN'],'Searching an orphan identifier never pulls in other blank-parent registrations');
  view.signal('query','00099');await view.runAsync();
  assert.deepEqual(view.data('raw').map(r=>r.RegistrationID),['REG-OTHER'],'Catalog search retains leading zeros and isolates orphan source identity');
 }finally{view.finalize();}
 assert.deepEqual(errors,[],'No Vega evaluation errors');
 console.log('PASS: registration nesting in all groups, numeric sibling sorting, direct-name Details, adaptive catalog/country layout, continuation clipping, far-future/missing ends, no Fit all distortion, orphan retention and submission comparisons.');
})().catch(e=>{console.error(e);process.exit(1)});
