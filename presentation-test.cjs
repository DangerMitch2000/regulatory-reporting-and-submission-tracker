const assert=require('node:assert/strict');
const presentation=require('./presentation'),registrations=require('./registrations');
const row=(extra={})=>({AppID:'A1',ROID:'RO1',SubID:'S1',EventName:'E1',ChangeID:'C1',ChangeQMS:'Q1',EventQMS:'Q1',Manufacturer:'ABO',RegistrationID:'REG1',RegistrationManufacturingSite:'Galway',Product:'Alpha',Country:'France',RegistrationCountry:'France',RegistrationState:'Approved',RegistrationStart:'2020-01-01',RegistrationEnd:'2030-01-01',ApplicationURL:'https://example.test/application/A1',RegulatoryObjectiveURL:'https://example.test/ro/RO1',SubmissionURL:'https://example.test/submission/S1',RegistrationURL:'https://example.test/registration/REG1',...extra});
const hierarchy=()=>[{level:0,key:'a1',appKey:'a1',AppID:'A1'},{level:1,key:'ro1',appKey:'a1',roKey:'ro1',AppID:'A1',ROID:'RO1'},{level:2,key:'s1',appKey:'a1',roKey:'ro1',AppID:'A1',ROID:'RO1',SubID:'S1'}];
async function main(){
 for(const bad of ['javascript:alert(1)','data:text/html,<h1>x</h1>','file:///C:/private','/relative','//example.test/path','https://user:pass@example.test/','https://good.test@bad.test/','https://example.test/\nrecord','https:\\example.test\\x','https://example.test/a b','https://',null,123])assert.equal(presentation.safeURL(bad),null,String(bad));
 for(const good of ['https://example.test/records/00001','http://example.test/path?q=001#fragment','HTTPS://EXAMPLE.TEST/'])assert(presentation.safeURL(good));
 assert.equal(presentation.resolveURL(['https://example.test','https://example.test/','']).url,'https://example.test/');
 assert.match(presentation.resolveURL(['https://example.test/a','https://example.test/b']).issue,/Conflicting/);
 assert.equal(presentation.resolveURL(['https://example.test/a','javascript:x']).url,null);
 assert.match(presentation.resolveURL([]).issue,/not recorded/);
 let opened=[];assert.equal((await presentation.launchURL('https://example.test/A',url=>opened.push(url))).opened,true);assert.deepEqual(opened,['https://example.test/A']);
 assert.equal((await presentation.launchURL('javascript:alert(1)',url=>opened.push(url))).opened,false);assert.equal(opened.length,1);
 assert.equal((await presentation.launchURL('https://example.test/A',()=>false)).opened,false);
 assert.equal((await presentation.launchURL('https://example.test/A',()=>{throw Error('Blocked')})).opened,false);
 {
  const source=[row(),row({CatalogNumber:'001'}),row({RegistrationID:'REG2',RegistrationManufacturingSite:'Sligo',RegistrationURL:'https://example.test/registration/REG2'}),row({AppID:'A2',ROID:'RO2',SubID:'S2',EventName:'E2',ChangeID:'C2',EventQMS:'Q2',ChangeQMS:'Q2',Manufacturer:'ADK',RegistrationID:'REG3',RegistrationManufacturingSite:'Dublin'})],base=hierarchy(),attached=registrations.attach(registrations.prepare(source),base),analysis=presentation.analyze(source),result=presentation.enrich(attached.rows,analysis),byKey=new Map(result.map(r=>[r.key,r]));
  assert.equal(byKey.get('a1').RegistrationCount,2);assert.equal(byKey.get('ro1').RegistrationCount,2);assert.equal(byKey.get('s1').RegistrationCount,2);assert.deepEqual(byKey.get('s1').LegalSites,['ABO']);assert.deepEqual(byKey.get('s1').RegistrationSites,['Galway','Sligo']);assert.deepEqual(byKey.get('s1').SiteLabels,['Legal: ABO','Registration: Galway, Sligo']);assert.equal(byKey.get('s1').RecordURL,'https://example.test/submission/S1');
  const r=result.find(r=>r.key===attached.registrationRows.find(r=>r.RegistrationID==='REG1').key);assert.equal(r.RegistrationCount,1);assert.deepEqual(r.RegistrationSites,['Galway']);assert.equal(r.RecordURL,'https://example.test/registration/REG1');
  assert.equal(attached.registrationRows.find(r=>r.RegistrationID==='REG1').RegistrationInfo.values.RegistrationManufacturingSite[0],'Galway');
  assert.equal(attached.registrationRows.find(r=>r.RegistrationID==='REG1').RegistrationInfo.values.RegistrationURL[0],'https://example.test/registration/REG1');
  assert.equal(result.find(r=>r.key===attached.registrationRows.find(r=>r.registrationContainer).key).RegistrationCount,1,'Unavailable submission remains in the orphan registration container');
 }
 {
  const source=[row(),row({RegistrationID:'REG-CONFLICT',SubmissionURL:'https://example.test/submission/S1'}),row({SubID:'S2',ROID:'RO2',RegistrationID:'REG-CONFLICT'})],attached=registrations.attach(registrations.prepare(source),hierarchy()),result=presentation.enrich(attached.rows,presentation.analyze(source));
  assert.equal(result.find(r=>r.key==='s1').RegistrationCount,1,'Conflicting registration is not attributed to a submission');
  assert.equal(result.find(r=>r.key===attached.registrationRows.find(r=>r.registrationContainer).key).RegistrationCount,1,'Conflicting registration stays counted once in its review container');
  const filtered=[row()],all=[...filtered,row({Product:'Other',ApplicationURL:'https://example.test/application/OTHER'})],r=presentation.enrich(hierarchy(),presentation.analyze(filtered,all));assert.equal(r[0].RecordURL,null);assert.match(r[0].RecordURLIssue,/Conflicting/,'Local product filters cannot erase conflicting global URLs');
 }
 {
  const source=[row(),row({EventName:'E2',ChangeID:'C2',EventQMS:'Q2',ChangeQMS:'Q2',SubID:'S2',ROID:'RO2',RegistrationID:'REG2',Manufacturer:'ADK',RegistrationManufacturingSite:'Sligo'})],analysis=presentation.analyze(source);
  const scoped=[{...hierarchy()[0],key:'event-app1',eventKey:'E1key',EventName:'E1'},{...hierarchy()[0],key:'event-app2',eventKey:'E2key',EventName:'E2'},{level:-2,key:'C1key',changeKey:'C1key',ChangeID:'C1'},{level:-2,key:'C2key',changeKey:'C2key',ChangeID:'C2'}],results=presentation.enrich(scoped,analysis);
  assert.deepEqual(results[0].RegistrationSites,['Galway']);assert.deepEqual(results[1].RegistrationSites,['Sligo']);assert.deepEqual(results[2].LegalSites,['ABO']);assert.deepEqual(results[3].LegalSites,['ADK']);
  const many=Array.from({length:5},(_,i)=>row({Manufacturer:'Legal'+i,RegistrationManufacturingSite:'Factory'+i})),preview=presentation.enrich(hierarchy(),presentation.analyze(many))[0];assert.equal(preview.SiteLabels.length,2);assert.match(preview.SiteLabels[0],/\+3 more/);assert.match(preview.SiteLabels[1],/\+3 more/);assert.equal(preview.LegalSites.length,5);assert.equal(preview.RegistrationSites.length,5);
 }
 {
  const source=[],parents=[];for(let i=0;i<10000;i++){source.push(row({AppID:'A'+i,ROID:'RO'+i,SubID:'S'+i,RegistrationID:'REG'+i,ApplicationURL:'https://example.test/app/'+i,RegulatoryObjectiveURL:'https://example.test/ro/'+i,SubmissionURL:'https://example.test/sub/'+i,RegistrationURL:'https://example.test/reg/'+i}));parents.push({level:2,key:'s'+i,appKey:'a'+i,roKey:'ro'+i,AppID:'A'+i,ROID:'RO'+i,SubID:'S'+i});}
  const attached=registrations.attach(registrations.prepare(source),parents),started=performance.now(),analysis=presentation.analyze(source),result=presentation.enrich(attached.rows,analysis);assert.equal(result.length,20000);assert.equal(result.filter(r=>r.RegistrationCount===1).length,20000);assert.equal(result[19999].RecordURL,'https://example.test/reg/9999');console.log('Presentation indexing: 10,000 submissions and registrations in '+Math.round(performance.now()-started)+'ms');
 }
 console.log('Presentation counts, scoped manufacturing sites, safe source URLs and global ambiguity checks pass.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
