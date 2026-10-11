const assert=require('node:assert/strict');
const registration=require('./registrations.js');
const sample=(extra={})=>({AppID:'A',ROID:'RO',SubID:'S1',Product:'Product A',Country:'France',Manufacturer:'ABO',RegistrationID:'REG-1',RegistrationCountry:'France',RegistrationState:'Approved',RegistrationStart:'2021-09-28',RegistrationEnd:'2031-09-27',...extra});
const parent=(extra={})=>({key:'sub:S1',appKey:'app:A',roKey:'ro:RO',level:2,AppID:'A',ROID:'RO',SubID:'S1',start:1,end:2,n:1,...extra});
const named=r=>r.filter(x=>x.level===3);
{
 const source=[sample({CatalogNumber:'0001'}),sample({CatalogNumber:'0001'}),sample({CatalogNumber:'0002'}),sample({Product:'Product B',Country:'Germany',CatalogNumber:'0007'}),sample({RegistrationID:'REG-2',CatalogNumber:'0003'})];
 const prepared=registration.prepare(source),p=parent(),result=registration.attach(prepared,[p]);
 assert.equal(prepared.records.length,2);assert.equal(result.count,2);assert.equal(named(result.registrationRows).length,2);assert.equal(result.rows.filter(r=>r.level===2).length,1);assert.equal(p.RegistrationID,undefined,'Never mutate original hierarchy rows');
 const r=result.registrationRows[0];assert.equal(r.subKey,p.key);assert.equal(r.level,3);assert.equal(r.State,'Approved');assert.equal(r.RegistrationInfo.values.RegistrationCountry[0],'France');assert.equal(r.start,Date.UTC(2021,8,28));assert.equal(r.end,Date.UTC(2031,8,27));
 assert.deepEqual(r.CatalogGroups.map(g=>[g.product,g.country,g.codes]),[['Product A','France',['0001','0002']],['Product B','Germany',['0007']]]);
 const repeated=registration.attach(prepared,[parent(),parent({key:'event-sub:S1',eventKey:'event:1',EventName:'Event 1'})],'Regulatory event');assert.equal(repeated.count,2);assert.equal(named(repeated.registrationRows).length,4);assert.equal(new Set(repeated.registrationRows.map(r=>r.key)).size,4);assert.equal(repeated.registrationRows[0].registrationGroup,'Regulatory event');
}
{
 const source=[sample({RegistrationID:'REG-2'}),sample({RegistrationID:'REG-10'})],r=registration.attach(registration.prepare(source),[parent()]);assert.deepEqual(r.registrationRows.map(r=>r.registrationRank),[0,1]);
 const noLink=registration.attach(registration.prepare([sample({SubID:'',RegistrationID:'NO-LINK'})]),[parent()]);assert.equal(noLink.registrationRows[0].registrationContainer,1);assert.equal(noLink.registrationRows[0].n,0);assert.equal(noLink.registrationRows[0].AppID,'');assert.equal(named(noLink.registrationRows)[0].SubID,'');assert.equal(named(noLink.registrationRows)[0].registrationUnlinked,1);assert.match(named(noLink.registrationRows)[0].RegistrationInfo.issues.join(' '),/link not recorded/);
 const hiddenParent=registration.attach(registration.prepare([sample()]),[]);assert.match(named(hiddenParent.registrationRows)[0].RegistrationInfo.issues.join(' '),/not present/);assert.equal(named(hiddenParent.registrationRows)[0].SubID,'');
}
{
 const all=[sample({CatalogNumber:'0010'}),sample({SubID:'S2',CatalogNumber:'0020'})],filtered=[all[0]],prepared=registration.prepare(filtered,all),result=registration.attach(prepared,[parent(),parent({key:'sub:S2',SubID:'S2'})]);
 assert.equal(prepared.records[0].RegistrationInfo.link.conflict,true,'A local filter cannot remove a global conflicting link');assert.equal(named(result.registrationRows).length,1);assert.equal(named(result.registrationRows)[0].registrationUnlinked,1);assert.equal(result.rows.filter(r=>r.level===2).length,2);assert.deepEqual(prepared.records[0].CatalogGroups[0].codes,['0010']);assert.deepEqual(prepared.records[0].RegistrationInfo.link.submissionIDs,['S1','S2']);
 const conflictedParent=registration.prepare([sample(),sample({AppID:'B'})]);assert.equal(conflictedParent.records[0].RegistrationInfo.link.conflict,true);assert.equal(registration.attach(conflictedParent,[parent()]).registrationRows[0].registrationContainer,1);
 const contradictoryState=[sample(),sample({RegistrationState:'Expired'})];assert.equal(registration.prepare([contradictoryState[0]],contradictoryState).records[0].State,'Conflicting values');
}
{
 for(const end of [null,'','8900-12-31','9000-12-31']){const r=registration.prepare([sample({RegistrationState:'Expired',RegistrationEnd:end})]).records[0];assert.equal(r.end,null);assert.equal(r.RegistrationOpenEnd,1);assert.equal(r.State,'Expired','Far-future end must not override source state');assert.equal(r.RegistrationInfo.dates.end.rawValues[0],end||undefined);}
 for(const delta of [{RegistrationStart:null},{RegistrationStart:'8900-12-31'},{RegistrationStart:'bad'},{RegistrationEnd:'bad'},{RegistrationStart:'2026-02-30'},{RegistrationEnd:'2020-01-01'}]){const r=registration.prepare([sample(delta)]).records[0];assert.equal(r.start,null,'Missing/invalid/reversed intervals have no chart bar');}
 for(const field of ['RegistrationStart','RegistrationEnd']){const r=registration.prepare([sample(),sample({[field]:'2029-01-01'})]).records[0];assert.equal(r.start,null);assert.equal(r.end,null);assert.equal(r.RegistrationOpenEnd,0);assert.equal(r.RegistrationInfo.dates[field==='RegistrationStart'?'start':'end'].conflicting,true);}
 const r=registration.prepare([sample({RegistrationEnd:new Date('2031-09-27T23:00:00Z'),RegistrationComments:'Line one\nLine two'}),sample({RegistrationEnd:'2031-09-27T00:00:00Z'})]).records[0];assert.equal(r.end,Date.UTC(2031,8,27));assert.equal(r.RegistrationInfo.values.RegistrationComments[0],'Line one\nLine two');
 assert.equal(registration.prepare([sample({RegistrationState:' approved '})]).records[0].State,'Approved');assert.equal(registration.prepare([sample({RegistrationState:''})]).records[0].State,'Not recorded');
}
{
 const source=[sample({Product:'',CatalogNumber:'001,002'}),sample({CatalogNumber:'0001',RegistrationID:'R1'}),sample({CatalogNumber:'0001',RegistrationID:'R2'}),sample({CatalogNumber:0,RegistrationID:'R2'})];const groups=registration.catalogGroups(source);assert(groups.some(g=>g.product===''&&g.codes[0]==='001,002'),'Opaque catalog code remains intact with missing product');assert.equal(groups.filter(g=>g.codes.includes('0001')).length,2,'Keep each registration association');assert(groups.some(g=>g.codes.includes('0')));assert.equal(registration.prepare([sample({RegistrationID:null})]).records.length,0,'No fabricated registration ID');
}
{
 const vega=require('./powerbi-visual/node_modules/vega'),liveParent=vega.ingest(parent()),source=[sample(),sample({RegistrationID:'REG-2',RegistrationState:'Expired'})],prepared=registration.prepare(source),first=registration.attach(prepared,[liveParent]);
 assert(Object.getOwnPropertySymbols(liveParent).length>0,'Fixture uses actual Vega tuple metadata');
 assert.equal(first.rows[0],liveParent,'Normal hierarchy tuples retain their existing identity');
 for(const row of first.registrationRows)assert.equal(Object.getOwnPropertySymbols(row).length,0,'New children must not inherit submission tuple IDs');
 const view=new vega.View(vega.parse({data:[{name:'registrations'}]}),{renderer:'none'}).initialize();
 for(let i=0;i<4;i++){const show=i%2?source.filter(r=>r.RegistrationState==='Approved'):source,attached=registration.attach(registration.prepare(show,source),[liveParent]);view.change('registrations',vega.changeset().remove(()=>true).insert(attached.registrationRows)).run();assert.equal(view.data('registrations').length,show.length,'Repeated filter changes remove every previous registration tuple');assert.equal(new Set(view.data('registrations').map(vega.tupleid)).size,show.length);assert(!view.data('registrations').some(r=>vega.tupleid(r)===vega.tupleid(liveParent)));}
 view.finalize();
}
{
 const start=performance.now(),source=[],parents=[];for(let i=0;i<10000;i++){const row=sample({SubID:'S'+i,RegistrationID:'REG-'+i,CatalogNumber:'000'+i});source.push(row,{...row,CatalogNumber:'001'+i});parents.push(parent({key:'sub:S'+i,SubID:'S'+i}));}const data=registration.prepare(source),result=registration.attach(data,parents);assert.equal(result.count,10000);assert.equal(result.registrationRows.length,10000);assert.equal(result.rows.length,20000);assert.equal(new Set(result.rows.map(r=>r.key)).size,20000);console.log('Registration model: 10,000 submissions / 20,000 catalog membership rows in '+Math.round(performance.now()-start)+'ms');
}
console.log('Registration identities, links, catalogs, raw dates, conflicts and 10,000-record indexing pass.');
