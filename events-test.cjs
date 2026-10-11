const assert=require('node:assert/strict'),events=require('./events');
assert.equal(events.dateField([{d:'2026-04-01T23:00:00Z'},{d:'2026-04-01T00:00:00Z'}],'d').label,'2026-04-01');
assert.equal(events.dateField([{d:'2026-02-30'}],'d').value,null);
assert.match(events.dateField([{d:'2026-04-01'},{d:'2026-04-02'}],'d').label,/Conflicting/);
assert.equal(events.dateField([{d:'9999-01-01'}],'d').value,null);
assert.equal(events.dateField([{d:null}],'d').label,'Not recorded');
console.log('PASS: optional event date validation and calendar-day conflicts.');

{
 const vega=require('./vega'),changes=require('./changes');
 const live=row=>vega.ingest(row),app=live({AppID:'A1',key:'a1',appKey:'a1',level:0,State:'Active'}),ro1=live({AppID:'A1',ROID:'R1',key:'r1',appKey:'a1',roKey:'r1',level:1}),ro2=live({AppID:'A1',ROID:'R2',key:'r2',appKey:'a1',roKey:'r2',level:1});
 const milestone={raw:'2026-02-30',reason:'Invalid source date retained'},sub1=live({AppID:'A1',ROID:'R1',SubID:'S1',key:'s1',appKey:'a1',roKey:'r1',level:2,start:10,end:20,State:'Planned',milestone}),sub2=live({...sub1,ROID:'R2',SubID:'S2',key:'s2',roKey:'r2'});
 const parents=[app,ro1,ro2,sub1,sub2],original=JSON.stringify(parents),base={AppID:'A1',ROID:'R1',SubID:'S1',EventName:'E2',ChangeID:'C2',EventQMS:'Q2',ChangeQMS:'Q2',Country:'France',Product:'Product A',Manufacturer:'ABO',CatalogNumber:'0001'},source=[base,{...base,CatalogNumber:'0002'},{...base,ChangeID:'C10',EventQMS:'Q10',ChangeQMS:'Q10',Country:'Hungary',Product:'Product B'},{...base,ROID:'R2',SubID:'S2',EventName:'E10',ChangeID:'C99',ChangeQMS:'different'},{EventName:'E30',EventState:'Planned'},{ChangeID:'C30',Country:'Ireland'}];
 const args=[source,[sub1,sub2],[app],[ro1,ro2]],eventRows=events.build(...args),eventSnapshot=JSON.stringify(eventRows),changeRows=changes.build(...args);
 assert.deepEqual(eventRows.filter(r=>r.level===-1).map(r=>[r.EventName,r.eventRank]),[['E2',0],['E10',1],['E30',2]],'Natural event ranks retain parent-only events');
 const eventSub=eventRows.find(r=>r.SubID==='S1'&&r.level===2);
 assert.deepEqual(eventSub.CountryInfo.members.map(r=>r.label),['France','Hungary']);
 assert.equal(eventSub.milestone,milestone,'Cloning retains the complete existing milestone evidence');
 for(const [id,country]of [['C2','France'],['C10','Hungary']]){
  const sub=changeRows.find(r=>r.ChangeID===id&&r.level===2);
  assert.deepEqual(sub.CountryInfo.members.map(r=>r.label),[country],'The same event in two changes keeps each change’s own memberships');
  assert.equal(sub.milestone,milestone);
 }
 assert.ok(changeRows.some(r=>r.ChangeID==='C30'&&r.level===-2),'Parent-only changes remain visible');
 assert.ok(changeRows.some(r=>r.changeOther===1&&r.SubID==='S2'&&r.level===2),'Mismatched QMS records stay in Other regulatory events');
 assert.deepEqual(changeRows.filter(r=>r.level===-2&&r.ChangeID).map(r=>[r.ChangeID,r.changeRank]),[['C2',0],['C10',1],['C99',3],['C30',2]]);
 assert.equal(JSON.stringify(eventRows),eventSnapshot,'Building changes must not mutate the separately displayed event hierarchy');
 assert.equal(JSON.stringify(parents),original,'No public fields on live source tuples are mutated');
 const all=[...eventRows,...changeRows];assert.equal(new Set(all.map(r=>r.key)).size,all.length);
 assert.ok(all.every(r=>Object.getOwnPropertySymbols(r).length===0),'Every new event/change row has a fresh Vega identity');
 const view=new vega.View(vega.parse({data:[{name:'rows'}]}),{renderer:'none'}).initialize();
 for(let i=0;i<3;i++){
  const next=i%2?events.build(...args):changes.build(...args);view.change('rows',vega.changeset().remove(()=>true).insert(next)).run();
  assert.equal(view.data('rows').length,next.length,'Repeated changes remove all previous hierarchy tuples');
  assert.equal(new Set(view.data('rows').map(vega.tupleid)).size,next.length);
  assert.ok(view.data('rows').every(row=>!parents.some(parent=>vega.tupleid(parent)===vega.tupleid(row))));
 }
 view.finalize();
 console.log('PASS: overlapping changes retain exact event memberships, parent-only records, source evidence and independent Vega tuple identities.');
}
