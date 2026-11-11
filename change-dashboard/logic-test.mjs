import assert from 'node:assert/strict';
import {analyze,derive,roles,mapTable,previousDay,dateField,safeURL,toCsv,MISSING_REGION,relatedItems} from './logic.mjs';
import {demoRows,demoAsOf,largeRows} from './demo-data.mjs';
import {compare,tableRows,dueOrder} from './table-tools.mjs';
const options={asOf:demoAsOf},base=demoRows[0],one=overrides=>analyze([{...base,...overrides}],options).submissions.get(base.SubID);
assert.equal(roles.length,70);assert.equal(new Set(roles).size,70);
assert.equal(previousDay(new Date('2026-11-10T10:00:00Z')),demoAsOf);
assert.equal(previousDay(new Date('2026-07-01T23:30:00Z')),Date.UTC(2026,6,1),'Dublin daylight saving calendar day');
assert.equal(dateField([{d:'1970-01-01'}],'d',demoAsOf).value,0);
assert.equal(dateField([{d:'2026-02-30'}],'d',demoAsOf).kind,'invalid');
assert.equal(dateField([{d:'9000-01-01'}],'d',demoAsOf).kind,'invalid');
assert.equal(dateField([{d:'2026-11-10'}],'d',demoAsOf,true).kind,'future');
assert.equal(one({}).stage,'dispatch');assert.equal(one({}).daysLate,6);
assert.equal(one({SubStatus:'Distributed'}).stage,'dispatch','internal distribution is not authority submission');
assert.equal(one({SubStatus:'Completed'}).stage,'approval');assert.equal(one({SubStatus:'Completed'}).approved,false);
for(const state of ['HA Received','Sent To Health Authority'])assert.equal(one({SubStatus:state}).stage,'approval');
assert.equal(one({SubStatus:'Rejected'}).stage,'rejected');assert.equal(one({SubStatus:'Rejected'}).sent,true);
assert.equal(one({ActualDispatch:'2026-10-30',LatestSubmission:'2026-11-01'}).stage,'submission');
assert.equal(one({DispatchRequired:false,LatestSubmission:'2026-11-01'}).overdue,true);
assert.equal(one({DispatchRequired:'unknown'}).stage,'review');
assert.equal(one({OriginalDispatch:'',LatestDispatch:''}).overdue,false,'missing due date is not overdue');
assert.equal(one({LatestDispatch:'bad'}).plans.dispatch.kind,'invalid','invalid latest must not fall back to original');
assert.equal(one({LatestDispatch:''}).plans.dispatch.label,'20 Oct 2026');
assert.equal(one({ActualSubmission:'2026-11-11'}).stage,'review');
assert.equal(one({ActualApproval:'2026-11-01'}).approved,true);
assert.equal(one({ROStatus:'Health Authority Approved'}).approved,true);
assert.equal(one({ChangeQMS:'different'}).stage,'review');
assert.equal(one({SubStatus:'Withdrawn'}).stage,'excluded');
const registration={RegistrationID:'REG-TEST',RegistrationState:'Approved',RegistrationCountry:'France'};
assert.equal(one(registration).approved,true);assert.equal(one({...registration,RegistrationCountry:'Germany'}).approved,false);
assert.equal(one({...registration,RegistrationID:''}).approved,false);
assert.equal(one({...registration,RegistrationState:'Expired'}).approved,false);
assert.equal(one({...registration,RegistrationState:'Conditionally Approved'}).approved,true);
let m=analyze([{...base,...registration},{...base,...registration,SubID:'different'}],options);assert.equal(m.submissions.get(base.SubID).approved,false,'shared registration cannot silently complete multiple filings');
m=analyze([{...base,...registration},{...base,...registration,Country:'Germany'}],options);assert.equal(m.submissions.get(base.SubID).stage,'review');
m=analyze(demoRows,options);let d=derive(m,{view:'all'});
assert.equal(m.changes.length,8);assert.equal(m.missing.length,2);assert.equal(m.submissions.size,11);
assert.deepEqual(d.counts,{assessment:1,dispatch:1,submission:2,approval:1});
const first=d.changes.find(c=>c.id===base.ChangeID);assert.equal(first.total,4);assert.equal(first.done,1);assert.equal(first.countries.find(c=>c.name==='Spain').pending,true);
assert.equal(derive(m,{site:'ADK',view:'all'}).counts.submission,1);
assert.equal(derive(m,{site:'ADJ',product:'Example assay A',view:'all'}).shown.length,0);
assert.equal(derive(m,{country:'Italy',view:'all'}).changes[0].done,1);
assert.equal(derive(m,{view:'all',includeInactive:true}).changes.length,8);
assert.equal(derive(analyze([...demoRows,...demoRows],options),{view:'all'}).counts.dispatch,d.counts.dispatch);
const mismatch=analyze([{...base,AssessmentResponseID:'WRONG'}],options).changes[0];assert.equal(mismatch.countries[0].pending,true);assert(mismatch.countries[0].issues.length);
const wrongCountry=analyze([{...base,AssessmentCountry:'Germany'}],options).changes[0];assert.equal(wrongCountry.countries[0].complete,false);assert(wrongCountry.countries[0].issues.some(i=>i.includes('country conflicts')));
const mixed=analyze([{...base,ROStatus:'Health Authority Approved'},{...base,SubID:'another'}],options).changes[0];assert.equal(mixed.countries[0].complete,false,'all linked submissions need approval evidence');
const missingDate=derive(analyze([{...base,OriginalDispatch:'',LatestDispatch:''}],options));assert.equal(missingDate.counts.dispatch,0);assert.equal(missingDate.attention,1);
assert.equal(safeURL('javascript:alert(1)'),null);assert.equal(safeURL('https://user:pass@example.com'),null);assert.equal(safeURL('https://example.com/record'),'https://example.com/record');
const mapped=mapTable({columns:[{roles:{ChangeID:true}},{roles:{ActualSubmission:true}}],rows:[['CHANGE',new Date('2026-11-01')]]});assert.equal(mapped.rows[0].ActualSubmission,'2026-11-01T00:00:00.000Z');
assert.throws(()=>mapTable({columns:[{roles:{ChangeID:true}},{roles:{ChangeID:true}}]}),/only one/);
assert.deepEqual(mapTable({columns:[],rows:[]}).missing,['EventName, AppID or ChangeID']);
assert.deepEqual(mapTable({columns:[{roles:{EventName:true}}],rows:[['EVENT']]}).missing,[]);
assert.deepEqual(mapTable({columns:[{roles:{AppID:true}}],rows:[['APP']]}).missing,[]);
assert(toCsv([{...first,id:'=DANGEROUS'}]).includes("'=DANGEROUS"));
const started=performance.now(),big=analyze(largeRows(),options),large=derive(big,{view:'all'}),duration=performance.now()-started;
assert.equal(big.submissions.size,10000);assert.equal(large.changes.length,2500);assert.equal(large.counts.dispatch,2500);assert(duration<20000,'10k submissions should analyze in under 20 seconds');
console.log(`PASS logic: 70 mappings, state/date evidence, duplicate handling, missing links, country assessments, filters and 10,000 submissions (${Math.round(duration)} ms).`);

const eventOptions={...options,groupBy:'event'},appOptions={...options,groupBy:'application'};
const eventModel=analyze(demoRows,eventOptions),events=derive(eventModel,{view:'all'});
assert.equal(eventModel.coverage.event,9);assert.equal(eventModel.missing.length,1);assert.equal(eventModel.missingApplications,1);
assert(events.changes.some(e=>e.id==='DEMO-EVT-NO-CHANGE'));
assert.deepEqual(events.counts,{assessment:1,dispatch:2,submission:2,approval:1});
const appModel=analyze(demoRows,appOptions),apps=derive(appModel,{view:'all'});
assert(apps.changes.some(a=>a.id==='DEMO-APP-NO-EVENT'));assert.equal(appModel.missing.length,0);
assert.equal(apps.changes.find(a=>a.id==='DEMO-APP-NO-EVENT').total,1);
const noChange={...base,ChangeID:'',ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''};
assert.equal(analyze([noChange],eventOptions).changes.length,1);
assert.equal(derive(analyze([{...noChange,EventName:''}],eventOptions),{view:'all'}).changes.length,0);
assert.equal(derive(analyze([{...noChange,EventName:''}],appOptions),{view:'all'}).changes.length,1);
const roOnly={...noChange,SubID:'',ROStatus:'Health Authority Approved'};
assert.equal(derive(analyze([roOnly],eventOptions),{view:'all'}).changes[0].done,1,'RO approval contributes even without submission ID');
const roWaiting={...roOnly,ROStatus:'Planned',ROID:'RO-WAIT',Country:'Germany',AppID:'APP-DE'};
const roScope=derive(analyze([roOnly,roWaiting],eventOptions),{view:'all'}).changes[0];assert.equal(roScope.total,2);assert.equal(roScope.done,1);
assert.equal(roScope.countries.find(c=>c.name==='Germany').submissions.length,0);
assert(roScope.countries.find(c=>c.name==='Germany').issues.some(i=>i.includes('No linked submission')));
const sibling={...roWaiting,EventName:'OTHER-EVENT',Country:'Spain'};assert.equal(analyze([roOnly,sibling],eventOptions).changes[0].countries.length,1,'do not import other event countries via shared change');
assert.equal(analyze([{...base,ChangeQMS:'wrong'}],eventOptions).submissions.get(base.SubID).stage,'dispatch','incomplete SharePoint join does not suppress native event evidence');
const statuses=derive(analyze([{...noChange,EventState:'Closed State'},{...noChange,EventName:'OPEN',EventState:'In Progress State',SubID:'SUB-OPEN',ROID:'RO-OPEN'}],eventOptions),{view:'all'});assert.equal(statuses.closed,1);assert.equal(statuses.counts.dispatch,1);
assert.equal(toCsv(events.changes,'event').split(',')[0],'"Event ID"');assert.equal(toCsv(apps.changes,'application').split(',')[0],'"Application ID"');
const delivered=Array.from({length:64000},(_,i)=>({...noChange,ChangeID:i<8?'SOURCE-CHANGE-'+i:'',EventName:i<60000?'SOURCE-EVENT-'+Math.floor(i/60):'',SubID:'SOURCE-SUB-'+Math.floor(i/4),ROID:'SOURCE-RO-'+Math.floor(i/4),AppID:'SOURCE-APP-'+Math.floor(i/4),CatalogNumber:'CAT-'+i%4}));
const startedLarge=performance.now(),eventLarge=analyze(delivered,eventOptions),appLarge=analyze(delivered,appOptions);
assert.equal(eventLarge.coverage.change,8);assert.equal(eventLarge.coverage.event,1000);assert.equal(eventLarge.coverage.application,16000);
assert.equal(eventLarge.changes.length,1000);assert.equal(eventLarge.missing.length,4000);assert.equal(eventLarge.missingApplications,1000);assert.equal(appLarge.changes.length,16000);
assert.equal(derive(eventLarge,{view:'all'}).counts.dispatch,1000);assert.equal(derive(appLarge,{view:'all'}).counts.dispatch,16000);
assert(performance.now()-startedLarge<30000);
console.log('PASS grouping: independent Event/Application/Change views, application lead-market countries, ROs without submissions and 64,000 rows with only eight Change IDs.');

const recentModel=analyze([
 {...noChange,EventName:'OLD',SubID:'OLD-SUB',ROID:'OLD-RO',LatestDispatch:'2026-10-01'},
 {...noChange,EventName:'RECENT',SubID:'RECENT-SUB',ROID:'RECENT-RO',LatestDispatch:'2026-11-08'},
 {...noChange,EventName:'FUTURE',SubID:'FUTURE-SUB',ROID:'FUTURE-RO',LatestDispatch:'2026-12-01'},
 {...noChange,EventName:'MISSING',SubID:'MISSING-SUB',ROID:'MISSING-RO',OriginalDispatch:'',LatestDispatch:''}
],eventOptions);
assert.deepEqual(derive(recentModel,{view:'all'}).shown.map(x=>x.id),['RECENT','OLD','FUTURE','MISSING']);
assert.deepEqual(derive(recentModel,{view:'all',sort:'due',direction:'asc'}).shown.map(x=>x.id),['OLD','RECENT','FUTURE','MISSING']);
assert.deepEqual(derive(recentModel,{view:'all',sort:'record',direction:'desc'}).shown.map(x=>x.id),['RECENT','OLD','MISSING','FUTURE']);
const filtered=derive(recentModel,{view:'all',columnFilters:{record:'RECENT',due:'Nov 2026'}});
assert.equal(filtered.shown.length,1);assert.equal(filtered.counts.dispatch,1);assert.equal(filtered.visibleCoverage.event,1);assert.equal(recentModel.coverage.event,4);
assert.equal(derive(recentModel,{view:'all',columnFilters:{due:'Not recorded'}}).shown[0].id,'MISSING');
assert.equal(compare(null,1,'desc'),1);assert(compare('RO-2','RO-10','asc')<0);
assert.deepEqual(tableRows([{x:'B'},{x:'A'},{x:''}],[{key:'x',value:r=>r.x}],{key:'x',direction:'asc',filters:{}}).map(x=>x.x),['A','B','']);
assert.equal(tableRows([{x:'Belgium'},{x:'France'}],[{key:'x',value:r=>r.x}],{key:'x',direction:'desc',filters:{x:'BEL'}}).length,1);
assert(dueOrder({due:demoAsOf-86400000,overdue:true},{due:demoAsOf+86400000,overdue:false})<0);
console.log('PASS tables: newest/oldest overdue, upcoming and blank dates, natural sorting, combined column filters and worklist versus loaded record counts.');

const relatedSample=relatedItems([{AppID:'A',ROID:'R',SubID:'S',RegistrationID:'G',ChangeID:'C'},{AppID:'A',ROID:'R',SubID:'S',RegistrationID:'G',ChangeID:'C',CatalogNumber:'SECOND'},{AppID:'B',ROID:'R2',SubID:'',RegistrationID:'',ChangeID:'C2'}]);
assert.deepEqual(relatedSample.counts,{application:2,ro:2,submission:1,registration:1});assert.equal(relatedSample.total,6);assert.deepEqual(relatedSample.changeIDs,['C','C2']);assert.match(relatedSample.search,/2 Apps/);assert.match(relatedSample.detail,/Submissions: S/);
assert.deepEqual(relatedItems([{}]).counts,{application:0,ro:0,submission:0,registration:0});
const scopedRelated=derive(eventModel,{view:'all',country:'Italy'}).shown[0];
assert.deepEqual(scopedRelated.related.counts,{application:1,ro:1,submission:1,registration:1},'catalog rows must not inflate related counts');
assert.equal(scopedRelated.related.counts.registration,derive(eventModel,{view:'all',country:'Italy'}).visibleCoverage.registration);
assert.deepEqual(roScope.related.counts,{application:2,ro:2,submission:0,registration:0},'ROs without submissions remain related records');
const relatedFilter=derive(eventModel,{view:'all',columnFilters:{related:'DEMO-SUB-101-IT'}});assert.equal(relatedFilter.shown.length,1);assert.equal(relatedFilter.shown[0].id,'DEMO-EVT-101');
assert.equal(derive(eventModel,{view:'all',columnFilters:{related:'DEMO-CHG-101'}}).shown.length,1,'Change IDs are searchable');
const relatedSorted=derive(eventModel,{view:'all',sort:'related',direction:'desc'}).shown;assert(relatedSorted.every((r,i)=>!i||relatedSorted[i-1].related.total>=r.related.total));

const regionBase={...noChange,ChangeID:'REGION-CHANGE',EventName:'REGION-EVENT',AppID:'REGION-APP',ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''};
const regionRows=[
 {...regionBase,Country:'France',CommercialRegion:'EMEA',ROID:'RO-FR',SubID:'SUB-FR',RegistrationID:'REG-FR',RegistrationState:'Planned',LatestDispatch:'2026-11-03'},
 {...regionBase,Country:'France',CommercialRegion:'EMEA',ROID:'RO-FR',SubID:'SUB-FR',RegistrationID:'REG-FR',RegistrationState:'Planned',LatestDispatch:'2026-11-03',CatalogNumber:'EXTRA'},
 {...regionBase,Country:'Japan',CommercialRegion:'APAC',ROID:'RO-JP',SubID:'SUB-JP',DispatchRequired:false,LatestSubmission:'2026-11-08'},
 {...regionBase,Country:'Brazil',CommercialRegion:'',RegistrationRegion:'LATAM',ROID:'RO-BR',SubID:'SUB-BR',LatestDispatch:'2026-11-07'},
 {...regionBase,Country:'France',CommercialRegion:'EMEA',ROID:'RO-WITHDRAWN',SubID:'SUB-WITHDRAWN',SubStatus:'Withdrawn'}
];
for(const groupBy of ['event','application','change']){
 const regionModel=analyze(regionRows,{...options,groupBy});
 assert.deepEqual(new Set(regionModel.options.regions),new Set(['EMEA','APAC',MISSING_REGION]));
 const regional=derive(regionModel,{view:'all',region:'EMEA'}),event=regional.shown[0];
 assert.equal(regional.shown.length,1);assert.deepEqual(event.countries.map(c=>c.name),['France']);assert.equal(event.next.country,'France');assert.equal(regional.counts.submission,0);assert.equal(regional.counts.dispatch,1);
 assert.deepEqual(event.related.counts,{application:1,ro:1,submission:1,registration:1});assert.deepEqual(event.related.changeIDs,['REGION-CHANGE']);assert.equal(regional.visibleCoverage.submission,1);assert.equal(regionModel.coverage.submission,4);
 assert.equal(derive(regionModel,{view:'all',region:'EMEA',includeInactive:true}).shown[0].related.counts.submission,2);
 const unknown=derive(regionModel,{view:'all',region:MISSING_REGION});assert.deepEqual(unknown.shown[0].countries.map(c=>c.name),['Brazil'],'missing commercial region is not inferred from registration region');
 assert.equal(derive(regionModel,{view:'all',region:'EMEA',country:'Japan'}).shown.length,0);
 assert.equal(derive(regionModel,{view:'all',region:'APAC'}).shown[0].next.action,'Submit to health authority');
}
const regionConflict=analyze([{...regionRows[0]},{...regionRows[0],CommercialRegion:'APAC',SubStatus:'Completed'}],eventOptions);
assert.equal(derive(regionConflict,{view:'all',region:'EMEA'}).shown[0].countries[0].submissions[0].stage,'review','region cannot conceal conflicting canonical state evidence');
const unconfiguredRegion=analyze([{...noChange,CommercialRegion:undefined,RegistrationRegion:'EMEA'}],eventOptions);assert.deepEqual(unconfiguredRegion.options.regions,[MISSING_REGION]);assert.equal(derive(unconfiguredRegion,{view:'all',region:MISSING_REGION}).shown.length,1);

const implementationRows=[
 {...noChange,EventName:'EARLY',ROID:'IMP-RO1',SubID:'IMP-SUB1',ChangePlannedImplementation:'2026-12-01'},
 {...noChange,EventName:'LATE',ROID:'IMP-RO2',SubID:'IMP-SUB2',ChangePlannedImplementation:'2027-02-01'},
 {...noChange,EventName:'MISSING-IMPLEMENTATION',ROID:'IMP-RO3',SubID:'IMP-SUB3',ChangePlannedImplementation:'',EventPlannedCompletion:'2026-11-20'},
 {...noChange,EventName:'CONFLICT',ROID:'IMP-RO4',SubID:'IMP-SUB4',ChangePlannedImplementation:'2026-12-01'},
 {...noChange,EventName:'CONFLICT',ROID:'IMP-RO4',SubID:'IMP-SUB4',ChangePlannedImplementation:'2026-12-02'}
];
const implementationModel=analyze(implementationRows,eventOptions);
assert.deepEqual(derive(implementationModel,{view:'all',sort:'implementation',direction:'asc'}).shown.slice(0,2).map(c=>c.id),['EARLY','LATE']);
assert.deepEqual(derive(implementationModel,{view:'all',sort:'implementation',direction:'desc'}).shown.slice(0,2).map(c=>c.id),['LATE','EARLY']);
assert.equal(implementationModel.changes.find(c=>c.id==='MISSING-IMPLEMENTATION').implementation.kind,'missing','event planned completion is not substituted for implementation');
assert.equal(implementationModel.changes.find(c=>c.id==='CONFLICT').implementation.kind,'conflict');
assert.equal(derive(implementationModel,{view:'all',columnFilters:{implementation:'01 Dec 2026'}}).shown[0].id,'EARLY');
assert.equal(derive(implementationModel,{view:'all',columnFilters:{implementation:'Not recorded'}}).shown[0].id,'MISSING-IMPLEMENTATION');
const implementationExport=toCsv(derive(implementationModel,{view:'all',columnFilters:{implementation:'01 Dec 2026'}}).shown,'event');assert.match(implementationExport,/Planned implementation date/);assert.match(implementationExport,/01 Dec 2026/);assert.match(implementationExport,/Related application IDs/);
const regionExport=toCsv(derive(analyze(regionRows,eventOptions),{view:'all',region:'EMEA'}).shown,'event');assert.match(regionExport,/EMEA/);assert.match(regionExport,/SUB-FR/);assert.equal(regionExport.includes('SUB-JP'),false,'exported related IDs respect commercial-region scope');assert.equal(regionExport.includes('SUB-WITHDRAWN'),false,'exported related IDs respect inactive scope');
console.log('PASS additions: distinct related items and Change IDs, country/inactive scope, Commercial region across all groupings, missing regions, canonical evidence and implementation sorting/filtering.');
