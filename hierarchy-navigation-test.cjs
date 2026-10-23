const assert=require('node:assert/strict');
const {plan,counts}=require('./hierarchy-navigation');
const events=require('./events'),changes=require('./changes'),registrations=require('./registrations');
const noop={targetKeys:[],expandKeys:[],firstKey:null};
const app={level:0,key:'app:A',appKey:'app:A',AppID:'A'},ro={level:1,key:'ro:A:R',appKey:app.key,roKey:'ro:A:R',AppID:'A',ROID:'R'};
const sub=id=>({level:2,key:'sub:A:R:'+id,appKey:app.key,roKey:ro.key,AppID:'A',ROID:'R',SubID:id});
const subs=[sub('S1'),sub('S2'),sub('S3')],base=[app,ro,...subs];
const source=subs.flatMap(s=>['E1','E2'].flatMap(EventName=>['C1','C2'].map(ChangeID=>({AppID:'A',ROID:'R',SubID:s.SubID,EventName,ChangeID,EventQMS:'Q',ChangeQMS:'Q',RegistrationID:'REG-'+s.SubID,RegistrationState:'Approved'}))));
const prepared=registrations.prepare(source);
const variants=[
 ['Application',base],
 ['Regulatory event',events.build(source,subs,[app],[ro])],
 ['Change',changes.build(source,subs,[app],[ro])]
];

{
 const labels=row=>counts(row).map(c=>c.label);
 assert.deepEqual(counts({level:0,ROCount:1,n:3,RegistrationCount:2}),[{level:1,count:1,label:'1 RO'},{level:2,count:3,label:'3 Subs'},{level:3,count:2,label:'2 Regs'}]);
 assert.deepEqual(labels({level:1,n:1,RegistrationCount:1}),['1 Sub','1 Reg']);
 assert.deepEqual(labels({level:-2,EventCount:1,n:3}),['1 Event','3 Subs','0 Regs']);
 assert.deepEqual(labels({level:-1,AppCount:2,n:1}),['2 Apps','1 Sub','0 Regs']);
 assert.deepEqual(labels({level:0}),['0 ROs','0 Subs','0 Regs'],'Parent count positions stay stable at zero');
 assert.deepEqual(labels({level:2,RegistrationCount:2}),['2 Regs']);
 assert.deepEqual(counts({level:2,RegistrationCount:0}),[],'Submission type can remain when there are no registration counts');
 assert.deepEqual(counts({level:3,RegistrationCount:1}),[]);
 assert.deepEqual(counts(null),[]);
 assert.deepEqual(labels({level:0,registrationContainer:1,RegistrationCount:1}),['1 Reg']);
 assert.deepEqual(labels({level:0,ROCount:NaN,n:-4,RegistrationCount:Infinity}),['0 ROs','0 Subs','0 Regs']);
}

for(const [mode,hierarchy]of variants){
 const rows=registrations.attach(prepared,hierarchy,mode).rows;
 const snapshot=JSON.stringify(rows);
 for(const row of rows)Object.freeze(row);
 Object.freeze(rows);
 const a=rows.find(r=>r.level===0),r=rows.find(r=>r.level===1&&r.appKey===a.key);
 const expectedSubs=rows.filter(s=>s.level===2&&s.roKey===r.key);
 const expectedRegs=rows.filter(g=>g.level===3&&g.roKey===r.key);
 assert.deepEqual(plan(rows,a.key,1),{targetKeys:[r.key],expandKeys:[a.key],firstKey:r.key},mode+': one RO opens only the clicked app');
 assert.deepEqual(plan(rows,a.key,2),{targetKeys:expectedSubs.map(s=>s.key),expandKeys:[a.key,r.key],firstKey:expectedSubs[0].key},mode+': submission count reveals exactly this branch');
 assert.deepEqual(plan(rows,r.key,2),{targetKeys:expectedSubs.map(s=>s.key),expandKeys:[r.key],firstKey:expectedSubs[0].key});
 const regPlan=plan(rows,a.key,3);
 assert.deepEqual(regPlan.targetKeys,expectedRegs.map(g=>g.key),mode+': registrations stay in the clicked app context');
 assert.deepEqual(regPlan.expandKeys,[a.key,r.key,...expectedSubs.map(s=>s.key)]);
 assert.equal(new Set(regPlan.targetKeys).size,regPlan.targetKeys.length,'No duplicate targets');
 for(const s of expectedSubs){assert.deepEqual(plan(rows,s.key,3).targetKeys,expectedRegs.filter(g=>g.subKey===s.key).map(g=>g.key));assert.deepEqual(plan(rows,s.key,3).expandKeys,[s.key]);}
 const expanded=new Set(['unrelated existing branch',r.key]);
 for(const key of regPlan.expandKeys)expanded.add(key);
 assert(expanded.has('unrelated existing branch'),'Merging a plan preserves unrelated expansion state');
 assert.deepEqual(plan(rows,expectedRegs[0].key,3),noop,'Count navigation never selects the parent itself');
 assert.deepEqual(plan(rows,'missing',3),noop);
 assert.equal(JSON.stringify(rows),snapshot,'Navigation never changes source rows, including frozen records');
 if(mode==='Change'){
  const c=rows.find(x=>x.level===-2),e=rows.find(x=>x.level===-1&&x.changeKey===c.key);
  assert.equal(plan(rows,c.key,2).targetKeys.length,6,'The same submission in two event branches retains two distinct display keys');
  assert.equal(plan(rows,e.key,2).targetKeys.length,3,'Event navigation cannot leak to another event or change');
  assert(plan(rows,e.key,3).targetKeys.every(k=>rows.find(x=>x.key===k).changeKey===c.key));
 }
}

{
 const first=subs[0],second=subs[1],rows=registrations.attach(prepared,base).rows;
 const filtered=rows.filter(r=>r.key!==second.key&&r.subKey!==second.key);
 assert.deepEqual(plan(filtered,ro.key,2).targetKeys,[first.key,subs[2].key],'Targets absent from the filtered hierarchy are never recovered from source data');
 assert.deepEqual(plan([app,ro],ro.key,2),noop,'Zero descendants is a no-op');
 assert.deepEqual(plan(rows.filter(r=>r.key!==ro.key),app.key,3),noop,'Missing intermediate RO cannot be bypassed with repeated IDs');
 assert.deepEqual(plan(rows.filter(r=>r.level!==2),app.key,3),noop,'Missing submissions do not make registrations direct children of an app');
 const duplicate=rows.concat(rows.filter(r=>r.level===3));
 assert.deepEqual(plan(duplicate,app.key,3),plan(rows,app.key,3),'Duplicate tuples do not duplicate count targets');
 const mixed={...first,key:'stale-sub',eventKey:'different-event'};
 assert.deepEqual(plan([app,ro,mixed],app.key,2),noop,'Explicit ancestor disagreement cannot jump grouping contexts');
 assert.deepEqual(plan(null,app.key,3),noop);
 for(const level of [-2,4,2.5,'2'])assert.deepEqual(plan(rows,app.key,level),noop);
}

{
 const source=[{AppID:'A',ROID:'R',SubID:'S1',RegistrationID:'LINKED'},{RegistrationID:'ORPHAN'},{RegistrationID:'ORPHAN-2'}];
 const rows=registrations.attach(registrations.prepare(source),base).rows;
 const container=rows.find(r=>r.registrationContainer),orphans=rows.filter(r=>r.registrationUnlinked),linked=rows.find(r=>r.RegistrationID==='LINKED');
 assert.deepEqual(plan(rows,container.key,3),{targetKeys:orphans.map(r=>r.key),expandKeys:[container.key],firstKey:orphans[0].key},'Unlinked registration container opens only its own children');
 assert.deepEqual(plan(rows,app.key,3).targetKeys,[linked.key],'Ordinary app counts do not select unlinked registrations');
 assert.deepEqual(plan(rows,container.key,2),noop);
 assert.deepEqual(plan(rows.filter(r=>r.key!==container.key),app.key,3).targetKeys,[linked.key]);
 const falseOrphan={...orphans[0],key:'false-orphan',appKey:app.key};
 assert.deepEqual(plan([app,falseOrphan],app.key,3),noop,'An unlinked record cannot use an ordinary app as its container');
 const falseChild={...linked,key:'false-linked',subKey:container.key};
 assert.deepEqual(plan([container,falseChild],container.key,3),noop,'A linked registration cannot masquerade as a direct container child');
}

{
 let reads=0;const size=10000,rows=[app,ro,subs[0]];
 for(let i=0;i<size;i++)rows.push({level:3,key:'reg:'+i,subKey:subs[0].key,roKey:ro.key,appKey:app.key,RegistrationID:'R'+i});
 const guarded=rows.map(row=>new Proxy(row,{get(target,key){reads++;return target[key];}}));
 const start=performance.now(),result=plan(guarded,app.key,3),elapsed=Math.round(performance.now()-start);
 assert.equal(result.targetKeys.length,size);assert.equal(new Set(result.targetKeys).size,size);
 assert.deepEqual(result.expandKeys,[app.key,ro.key,subs[0].key]);
 assert(reads<rows.length*100,'Index plus bounded-depth walks must use O(rows × hierarchy depth) property reads; got '+reads);
 console.log('Hierarchy navigation: '+size+' registrations in '+elapsed+'ms; '+reads+' property reads.');
}
console.log('PASS: application/event/change count navigation, repeated IDs, filtered/missing paths, unlinked containers, immutable inputs and bounded indexing.');
