const assert=require('node:assert/strict');
const rows=[
 {AppID:'A-alone',AppStatus:'Active'},
 {AppID:'A-ro',ROID:'R-alone',ROStatus:'Planned'},
 {ROID:'R-orphan'}, {SubID:'S-orphan'},
 {AppID:'A-sub',SubID:'S-no-ro'},
 {EventName:'E-alone',EventState:'Planned State'},
 {ChangeID:'C-alone',ChangeStatus:'In Progress'},
 {ChangeID:'C-linked',ChangeQMS:'CR1',EventQMS:'CR1',EventName:'E-linked'},
 {ChangeID:'C-mismatch',ChangeQMS:'CR2',EventQMS:'CR3',EventName:'E-mismatch',AppID:'A-child',ROID:'R-child',SubID:'S-child'},
 {ChangeID:'C-linked',ChangeQMS:'CR1',EventQMS:'CR1',EventName:'E-child',AppID:'A-child',ROID:'R-child',SubID:'S-child'},
];
module.exports=rows;
if(require.main===module)(async()=>{
 const vega=require('./vega'),spec=require('./timeline.json'),events=require('./events'),changes=require('./changes');
 const errors=[],view=new vega.View(vega.parse(spec),{renderer:'none'}).logger({level:()=>0,error:e=>errors.push(String(e)),warn(){},info(){},debug(){}}).initialize();
 try{
  view.change('dataset',vega.changeset().remove(()=>true).insert([...rows,...rows]));await view.runAsync();assert.deepEqual(errors,[]);
  const args=()=>[view.data('raw'),view.data('sub'),view.data('apps'),view.data('ros')];
  const ev=events.build(...args()),ch=changes.build(...args());
  assert.equal(view.data('sub').length,3,'No phantom submissions for parent-only rows');
  assert.equal(view.data('apps').find(r=>r.AppID==='A-alone').n,0);
  assert.equal(view.data('ros').find(r=>r.ROID==='R-alone').n,0);
  assert.equal(ev.filter(r=>r.level===-1&&!r.unlinked).length,4);
  assert.equal(ch.filter(r=>r.level===-2&&r.ChangeID).length,3);
  assert.equal(ch.find(r=>r.level===-2&&r.ChangeID==='C-mismatch').EventCount,0,'No false link from conflicting QMS');
  assert.ok(ch.some(r=>r.EventName==='E-mismatch'&&r.changeOther));
  assert.equal(ch.find(r=>r.level===-2&&r.ChangeID==='C-linked').EventCount,2);
  assert.equal(ch.find(r=>r.level===-2&&r.ChangeID==='C-alone').n,0);
  for(const list of [ev,ch])assert.equal(new Set(list.map(r=>r.key)).size,list.length,'Membership duplicates do not duplicate hierarchy keys');
  const all=[...view.data('apps'),...view.data('ros'),...view.data('sub'),...ev,...ch];
  view.change('eventRows',vega.changeset().insert(ev)).change('changeRows',vega.changeset().insert(ch)).change('orderedRows',vega.changeset().insert(changes.order(all,true)));await view.runAsync();
  assert.equal(view.data('expanded').length,0,'Expansion defaults unchanged');
  view.change('expanded',vega.changeset().insert(all.filter(r=>r.level<2).map(r=>({key:r.key}))));
  for(const group of ['Application','Regulatory event','Change initiation']){view.signal('groupBy',group);await view.runAsync();assert.deepEqual(new Set(view.data('visible').filter(r=>r.level===2).map(r=>r.SubID)),new Set(['S-orphan','S-no-ro','S-child']));}
  for(const query of ['C-alone','E-alone','A-alone','R-alone']){view.signal('query',query);await view.runAsync();const a=args(),ee=events.build(...a),cc=changes.build(...a);assert.ok(a[0].length);assert.ok([...a[1],...a[2],...a[3],...ee,...cc].some(r=>[r.AppID,r.ROID,r.SubID,r.EventName,r.ChangeID].includes(query)));if(query==='C-alone')assert.equal(ee.length,0,'Blank submission IDs must not leak unrelated events into search');}
  const mixed=[{...rows[9]},{...rows[9],ChangeID:'C-mismatch',ChangeQMS:'CR3'}],idx=changes.index(mixed),other={level:2,AppID:'A-child',ROID:'R-child',SubID:'S-child',EventName:'E-child',ChangeID:'',changeOther:1,changeKey:'other'};assert.deepEqual(changes.related(other,idx),[mixed[1]],'Other events must not inherit a confirmed change response');assert.deepEqual(changes.related({...other,ChangeID:'C-linked',changeOther:0},idx),[mixed[0]]);
  assert.deepEqual(errors,[]);console.log('PASS: every named level retained without children/dates, orphan submissions, QMS isolation, distinct counts, search, all groupings and unchanged collapse defaults.');
 }finally{view.finalize();}
})().catch(e=>{console.error(e);process.exit(1)});
