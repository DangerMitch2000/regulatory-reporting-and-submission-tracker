const assert=require('node:assert/strict'),c=require('./changes');
const rows=Array.from({length:10000},(_,i)=>({AppID:'A'+(i%20),ROID:'R'+(i%100),SubID:'S'+i,EventName:'E'+(i%50),ChangeID:'C'+(i%10),ChangeQMS:'CR'+(i%10),EventQMS:'CR'+(i%10)}));
const index=c.index(rows);
for(const i of [0,19,500,9999])for(const level of [-2,-1,0,1,2]){const row={...rows[i],level};assert.deepEqual(c.related(row,index),c.related(row,rows));}
const order=c.order(rows.map(r=>({...r,key:r.SubID,level:2,orderInfo:{unneeded:'previous record'}})),true);
assert.ok(order.every(r=>Object.keys(r).length===4&&!('orderInfo' in r)));
assert.equal(order.find(r=>r.key==='S9999').rankSub,1);
assert.equal(c.order(rows.map(r=>({...r,key:r.SubID,level:2})),false).find(r=>r.key==='S0').rankSub,1);
console.log('PASS: 10,000-row indexed evidence matches source scan; numeric sort records contain only keys and ranks.');

// Protect the loading fix without timing thresholds that depend on CI hardware:
// collapsed rows must be filtered before full-record copies, and geometry or
// selected-record formatting must never mutate the shared hierarchy sources.
async function verifyLazyTimeline(){
 const v=require('./vega'),spec=require('./timeline.json'),events=require('./events'),registrations=require('./registrations'),presentation=require('./presentation');
 const source=Array.from({length:120},(_,i)=>({AppID:'LOAD-A'+Math.floor(i/4),ROID:'LOAD-R'+Math.floor(i/2),SubID:'LOAD-S'+i,EventName:'LOAD-E'+Math.floor(i/10),ChangeID:'LOAD-C'+Math.floor(i/30),ChangeQMS:'Q'+Math.floor(i/30),EventQMS:'Q'+Math.floor(i/30),AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',Country:'Ireland',Product:'Product '+i%3,Manufacturer:'ABO',OriginalDispatch:'2026-01-01',LatestSubmission:'2026-02-01',ActualSubmission:'2026-02-02',LatestApproval:'2026-05-01',RegistrationID:'LOAD-REG'+i,RegistrationState:'Approved',RegistrationStart:'2020-01-01',RegistrationEnd:'8900-12-31'}));
 const errors=[],originalProject=v.transforms.project.prototype.transform;let copies=0;
 v.transforms.project.prototype.transform=function(params,pulse){const output=originalProject.call(this,params,pulse);if(!params.fields)copies+=output.add.length+output.mod.length;return output;};
 const view=new v.View(v.parse(spec),{renderer:'none'}).logger({level:()=>0,error:e=>errors.push(String(e)),warn(){},info(){},debug(){}});
 const sourceNames=['apps','ros','sub','eventRows','changeRows','registrationRows'];
 const unchanged=()=>JSON.stringify(sourceNames.map(name=>view.data(name)));
 const isolated=()=>{for(const name of sourceNames)for(const row of view.data(name))for(const field of ['rowTop','rowBottom','rowHeight','y','presentationInfo','_lo','_hi'])assert.equal(Object.hasOwn(row,field),false,name+' must not acquire '+field);};
 async function refresh(){
  const sub=view.data('sub'),apps=view.data('apps'),ros=view.data('ros'),raw=view.data('raw'),prepared=events.prepare(sub,apps,ros),ev=events.build(raw,sub,apps,ros,prepared),ch=c.build(raw,sub,apps,ros,prepared),reg=registrations.prepare(raw,source),base=[...apps,...ros,...sub];
  const rr=[...registrations.attach(reg,base,'Application').registrationRows,...registrations.attach(reg,ev,'Regulatory event').registrationRows,...registrations.attach(reg,ch,'Change initiation').registrationRows],all=[...base,...ev,...ch,...rr];
  for(const [name,values]of [['eventRows',ev],['changeRows',ch],['registrationRows',rr],['orderedRows',c.order(all,true)],['presentationRows',presentation.enrich(all,presentation.analyze(raw,source))]])view.change(name,v.changeset().remove(()=>true).insert(values));await view.runAsync();
 }
 try{
  view.signal('registrationLayerEnabled',true).change('dataset',v.changeset().insert(source));await view.runAsync();await refresh();
  const expectedFit=[...view.signal('fitRange')];
  for(let pass=0;pass<2;pass++)for(const group of ['Regulatory event','Change initiation','Application']){
   view.change('expanded',v.changeset().remove(()=>true));await view.runAsync();copies=0;view.signal('groupBy',group);await view.runAsync();
   assert.ok(copies<=view.data('visible').length+1,'Grouping only clones displayed parent records, not collapsed descendants');
   const baseline=unchanged(),all=view.data('displayRows'),target=all.find(r=>r.level===2&&r.SubID==='LOAD-S0');
   view.change('expanded',v.changeset().insert(all.filter(r=>r.level<3).map(r=>({key:r.key}))));await view.runAsync();
   for(const ascending of [false,true]){view.signal('eventDescending',!ascending).change('orderedRows',v.changeset().remove(()=>true).insert(c.order(all,!ascending)));await view.runAsync();assert.equal(new Set(view.data('visible').map(r=>r.key)).size,view.data('visible').length);}
   view.signal('selectedKey',target.key);await view.runAsync();assert.equal(view.data('selectedRow')[0].tip.Submission,'LOAD-S0','Context formatting remains available on selection');assert.equal(view.data('selectedRow')[0].tip['Actual submission'],'02/02/2026');
   view.signal('denebContainer',{width:900+pass*600,height:600});await view.runAsync();
   assert.deepEqual([...view.signal('fitRange')],expectedFit,'Lazy copies preserve the complete workflow date domain');
   assert.equal(unchanged(),baseline,'Sort, expand, selection and resize leave source records untouched');isolated();
  }
  assert.ok(view.data('sub').every(r=>!Object.hasOwn(r,'tip')),'Off-screen submission dates are not formatted eagerly');
  assert.ok(view.data('workflowExtentRows').every(r=>Object.keys(r).length<=10),'Extent calculation copies only its required date fields');
  for(const query of ['LOAD-S11','']){view.signal('query',query);await view.runAsync();await refresh();assert.equal(view.data('sub').length,query?11:120,'Search preserves complete submission memberships');isolated();}
  view.signal('mode','Compare').signal('compareLevel',2).signal('axisMode','Elapsed days');await view.runAsync();assert.equal(view.data('visible').length,120,'Elapsed comparison retains every submission');isolated();
  assert.deepEqual(errors,[]);
  console.log('PASS: lazy timeline copies only visible rows; repeated groups, sort, expand, selection, resize, search and comparison preserve shared source records and all workflow dates.');
 }finally{view.finalize();v.transforms.project.prototype.transform=originalProject;}
}
verifyLazyTimeline().catch(error=>{console.error(error);process.exitCode=1;});
