import assert from 'node:assert/strict';
import {analyze,derive,roles,mapTable,previousDay,dateField,planningDates,safeURL,toCsv,MISSING_REGION,relatedItems} from './logic.mjs';
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
assert.deepEqual(derive(implementationModel,{view:'all',sort:'implementation',direction:'asc'}).shown.slice(0,2).map(c=>c.id),['MISSING-IMPLEMENTATION','EARLY']);
assert.deepEqual(derive(implementationModel,{view:'all',sort:'implementation',direction:'desc'}).shown.slice(0,2).map(c=>c.id),['LATE','EARLY']);
assert.equal(implementationModel.changes.find(c=>c.id==='MISSING-IMPLEMENTATION').implementation.kind,'missing','event planned completion is not substituted for implementation');
assert.equal(implementationModel.changes.find(c=>c.id==='CONFLICT').implementation.kind,'conflict');
assert.deepEqual(derive(implementationModel,{view:'all',columnFilters:{implementation:'01 Dec 2026'}}).shown.map(c=>c.id).sort(),['CONFLICT','EARLY']);
assert(derive(implementationModel,{view:'all',columnFilters:{implementation:'Not recorded'}}).shown.some(c=>c.id==='MISSING-IMPLEMENTATION'));
const implementationExport=toCsv(derive(implementationModel,{view:'all',columnFilters:{implementation:'01 Dec 2026'}}).shown,'event');assert.match(implementationExport,/Planned implementation date/);assert.match(implementationExport,/01 Dec 2026/);assert.match(implementationExport,/Related application IDs/);
const regionExport=toCsv(derive(analyze(regionRows,eventOptions),{view:'all',region:'EMEA'}).shown,'event');assert.match(regionExport,/EMEA/);assert.match(regionExport,/SUB-FR/);assert.equal(regionExport.includes('SUB-JP'),false,'exported related IDs respect commercial-region scope');assert.equal(regionExport.includes('SUB-WITHDRAWN'),false,'exported related IDs respect inactive scope');
console.log('PASS additions: distinct related items and Change IDs, country/inactive scope, Commercial region across all groupings, missing regions, canonical evidence and implementation sorting/filtering.');

const planningRow=(id,changeDate,eventDate)=>({...noChange,EventName:id,AppID:'APP-'+id,ROID:'RO-'+id,SubID:'SUB-'+id,ChangePlannedImplementation:changeDate,EventPlannedCompletion:eventDate});
const planningRows=[planningRow('BOTH','2027-03-15','2026-11-30'),planningRow('EVENTONLY','','2026-12-01'),planningRow('CHANGEONLY','2027-01-01',''),planningRow('INVALID','not-a-date','2027-02-01'),planningRow('EMPTY','','')];
const planningModel=analyze(planningRows,eventOptions),plans=derive(planningModel,{view:'all',sort:'implementation',direction:'asc'});
assert.deepEqual(plans.shown.map(c=>c.id),['EVENTONLY','CHANGEONLY','INVALID','BOTH','EMPTY'],'sort uses valid change date first, otherwise event date, and undated records last');
assert.deepEqual(derive(planningModel,{view:'all',sort:'implementation',direction:'desc'}).shown.map(c=>c.id),['BOTH','INVALID','CHANGEONLY','EVENTONLY','EMPTY']);
const both=planningModel.changes.find(c=>c.id==='BOTH'),eventOnly=planningModel.changes.find(c=>c.id==='EVENTONLY'),invalidPlan=planningModel.changes.find(c=>c.id==='INVALID');
assert.equal(both.implementation.label,'15 Mar 2027');assert.equal(both.eventCompletion.label,'30 Nov 2026');assert.equal(both.planningDates.field,'ChangePlannedImplementation');
assert.deepEqual(both.planningDates.items.map(x=>x.sourceLabel),['Change implementation','Event planned completion']);
assert.equal(eventOnly.implementation.kind,'missing');assert.equal(eventOnly.planningDates.field,'EventPlannedCompletion');assert.equal(eventOnly.planningDates.items[0].label,'Not recorded','fallback never relabels event completion as implementation');
assert.equal(invalidPlan.implementation.kind,'invalid');assert.equal(invalidPlan.planningDates.field,'EventPlannedCompletion');assert.deepEqual(invalidPlan.planningDates.items[0].values,['not-a-date'],'bad primary source remains inspectable alongside event fallback');
assert.deepEqual(derive(planningModel,{view:'all',columnFilters:{implementation:'30 Nov 2026'}}).shown.map(c=>c.id),['BOTH'],'search matches secondary displayed date even when primary controls sorting');
assert.deepEqual(derive(planningModel,{view:'all',columnFilters:{implementation:'not-a-date'}}).shown.map(c=>c.id),['INVALID'],'bad source value remains searchable');
const manyEvents=analyze([{...planningRow('EVENT-A','','2027-01-01'),AppID:'SHARED-PLANNING-APP'},{...planningRow('EVENT-B','','2027-04-01'),AppID:'SHARED-PLANNING-APP'}],{...options,groupBy:'application'}).changes[0];
assert.equal(manyEvents.eventCompletion.kind,'conflict');assert.equal(manyEvents.planningDates.value,null,'multiple distinct event completion dates cannot silently choose one');
assert.deepEqual(manyEvents.planningDates.items[1].values,['01 Jan 2027','01 Apr 2027'],'all linked event dates remain available');
const ambiguousChange=analyze([{...planningRow('CHANGE-CONFLICT','2027-01-01','2027-03-01')},{...planningRow('CHANGE-CONFLICT','2027-02-01','2027-03-01')}],eventOptions).changes[0];
assert.equal(ambiguousChange.implementation.kind,'conflict');assert.equal(ambiguousChange.planningDates.field,'EventPlannedCompletion');assert.deepEqual(ambiguousChange.planningDates.items[0].values,['01 Jan 2027','01 Feb 2027']);
const sameDates=analyze([planningRow('SAME','2027-03-15','2027-03-15'),planningRow('SAME','15 Mar 2027','2027-03-15T18:00:00Z')],eventOptions).changes[0];
assert.equal(sameDates.eventCompletion.kind,'dated');assert.deepEqual(sameDates.planningDates.items[0].values,['15 Mar 2027']);
const epochZero=planningDates(dateField([{d:'1970-01-01'}],'d',demoAsOf),dateField([],'d',demoAsOf));assert.equal(epochZero.value,0,'zero timestamp remains a valid sort value');
const planningCsv=toCsv(plans.shown,'event'),csvHeaders=planningCsv.split('\r\n')[0].split(',');
assert.equal(csvHeaders.length,21);assert.equal(csvHeaders[13],'"Planned implementation date"');assert.equal(csvHeaders[20],'"Event planned completion date"');
assert.match(planningCsv,/15 Mar 2027/);assert.match(planningCsv,/30 Nov 2026/);assert.match(planningCsv,/01 Dec 2026/);
const originalQueues=derive(analyze(planningRows.map(({ChangePlannedImplementation,EventPlannedCompletion,...row})=>row),eventOptions),{view:'all'});
assert.deepEqual(plans.counts,originalQueues.counts,'planning display dates must not change overdue or approval queues');
console.log('PASS dual planning dates: independently labelled fields, usable fallback sorting, null-last order, both-date/raw search, retained conflicts, duplicate dates, CSV compatibility and unchanged workflow queues.');

const countryBase={...noChange,ChangeID:'COUNTRY-CHANGE',EventName:'COUNTRY-EVENT',AppID:'COUNTRY-APP',ROID:'COUNTRY-RO',SubID:'COUNTRY-SUB',Country:'New Zealand',RegistrationID:'COUNTRY-REG',RegistrationCountry:'NEW ZEALAND',RegistrationState:'Approved'};
const countryVariants=[countryBase,{...countryBase,Country:' new   zealand ',RegistrationCountry:'New  Zealand',CatalogNumber:'SECOND'},{...countryBase,Country:'NEW ZEALAND',CatalogNumber:'THIRD'}];
for(const groupBy of ['change','event','application']){
 const canonical=analyze(countryVariants,{...options,groupBy}),single=derive(analyze([countryBase],{...options,groupBy}),{view:'all'}),combined=derive(canonical,{view:'all'}),item=combined.shown[0];
 assert.equal(item.countries.length,1);assert.equal(item.countries[0].key,'new zealand');assert.equal(item.countries[0].name,'New Zealand');assert.equal(item.scopedRows.length,3,'country case/whitespace variants retain all source memberships');
 assert.deepEqual(combined.counts,single.counts);assert.deepEqual(combined.visibleCoverage,single.visibleCoverage);assert.deepEqual(item.related.counts,{application:1,ro:1,submission:1,registration:1});
 assert.equal(canonical.submissions.get('COUNTRY-SUB').country,'new zealand');assert.equal(canonical.submissions.get('COUNTRY-SUB').countryLabel,'New Zealand');assert.equal(canonical.submissions.get('COUNTRY-SUB').approved,true,'registration-country case and whitespace variants match canonical application country');
 assert.equal(derive(canonical,{view:'all',country:'New Zealand'}).shown[0].scopedRows.length,3);
 const roVariants=countryVariants.map(r=>({...r,SubID:'',ROStatus:'Health Authority Approved'})),roCombined=derive(analyze(roVariants,{...options,groupBy}),{view:'all'}).shown[0];
 assert.equal(roCombined.countries.length,1);assert.equal(roCombined.countries[0].name,'New Zealand');assert.equal(roCombined.scopedRows.length,3);assert.equal(roCombined.related.counts.submission,0);assert.equal(roCombined.done,1,'RO-only records use the same country normalization');
}
const countryConflict=analyze([countryBase,{...countryBase,Country:'France'}],eventOptions).submissions.get('COUNTRY-SUB');assert.equal(countryConflict.stage,'review');assert.equal(countryConflict.approved,false,'genuinely different countries remain a conflict');
assert.equal(countryVariants[1].Country,' new   zealand ','normalization must not mutate delivered source values');
console.log('PASS country canonicalization: equivalent case/spacing stays one country across all views, source rows and distinct counts retained, registration and RO-only matching, genuine conflicts preserved.');

// Review records must remain traceable even when their country cannot be assigned.
const reviewBase={...noChange,ChangeID:'REVIEW-CHANGE',EventName:'REVIEW-EVENT',AppID:'REVIEW-APP',ROID:'REVIEW-RO',SubID:'REVIEW-SUB',Country:'France',CommercialRegion:'EMEA'};
for(const groupBy of ['event','application','change']){
 const conflictingRows=[reviewBase,{...reviewBase,Country:'Germany',CatalogNumber:'SECOND'}],reviewModel=analyze(conflictingRows,{...options,groupBy}),review=derive(reviewModel,{view:'all'}).shown[0];
 assert.equal(review.countries.length,1);assert.equal(review.countries[0].key,'?');assert.equal(review.scopedRows.length,2,'conflicting-country memberships remain visible for review');
 assert.deepEqual(review.related.counts,{application:1,ro:1,submission:1,registration:0});assert.equal(review.countryForRow(conflictingRows[0]),'');assert.equal(review.countryForRow(conflictingRows[1]),'');
 assert.equal(derive(reviewModel,{view:'all',region:'EMEA'}).shown[0].scopedRows.length,2);assert.equal(derive(reviewModel,{view:'all',country:'Country not recorded'}).shown[0].scopedRows.length,2);assert.equal(derive(reviewModel,{view:'all',country:'France'}).shown.length,0,'no conflicted filing is assigned arbitrarily to France');
 assert.equal(derive(reviewModel,{view:'all'}).visibleCoverage.submission,1);assert.equal(review.countries[0].complete,false);
 const roConflictRows=conflictingRows.map(r=>({...r,SubID:''})),roConflict=derive(analyze(roConflictRows,{...options,groupBy}),{view:'all'}).shown[0];
 assert.equal(roConflict.countries.length,1,'one conflicted RO is one review bucket, not three phantom countries');assert.equal(roConflict.countries[0].key,'?');assert.equal(roConflict.scopedRows.length,2);assert.equal(roConflict.related.counts.ro,1);assert.equal(roConflict.done,0);
 const blankMembership={...reviewBase,Country:'',CatalogNumber:'BLANK-COUNTRY'},resolvedRows=[reviewBase,blankMembership],resolved=derive(analyze(resolvedRows,{...options,groupBy}),{view:'all'}).shown[0];
 assert.equal(resolved.scopedRows.length,2,'an incomplete duplicate membership retains the canonical filing country');assert.equal(resolved.countryForRow(blankMembership),'France');assert.equal(blankMembership.Country,'','source evidence is not overwritten');
 const conflictStateRows=[reviewBase,{...reviewBase,SubStatus:'Withdrawn'},{...reviewBase,SubID:'INACTIVE-SUB',ROID:'INACTIVE-RO',SubStatus:'Withdrawn'}],conflictStateModel=analyze(conflictStateRows,{...options,groupBy}),stateReview=derive(conflictStateModel,{view:'all'}).shown[0];
 assert.equal(stateReview.scopedRows.length,2,'retain both conflicting states but exclude the separate truly inactive filing');assert.deepEqual(new Set(stateReview.scopedRows.map(r=>r.SubStatus)),new Set(['In Progress','Withdrawn']));assert.equal(stateReview.related.counts.submission,1);assert.equal(stateReview.countries[0].submissions.find(s=>s.id==='REVIEW-SUB').stage,'review');
 assert.equal(derive(conflictStateModel,{view:'all',includeInactive:true}).shown[0].scopedRows.length,3);
}
const inactiveAppOnly={EventName:'INACTIVE-EVENT',AppID:'INACTIVE-APP',AppStatus:'Inactive',Country:'France'},inactiveAppModel=analyze([inactiveAppOnly],eventOptions);
assert.equal(derive(inactiveAppModel,{view:'all'}).shown.length,0,'inactive application-only rows do not create empty visible worklist records');
const inactiveIncluded=derive(inactiveAppModel,{view:'all',includeInactive:true});assert.equal(inactiveIncluded.shown.length,1);assert.equal(inactiveIncluded.visibleCoverage.application,1);assert.equal(inactiveIncluded.shown[0].countries[0].candidates[0].stage,'excluded');assert.equal(inactiveIncluded.counts.dispatch,0);
const appStateConflict=derive(analyze([inactiveAppOnly,{...inactiveAppOnly,AppStatus:'Active'}],eventOptions),{view:'all'});assert.equal(appStateConflict.shown[0].scopedRows.length,2,'conflicting application-only states are preserved for diagram review');
const crossEventConflict=derive(analyze([reviewBase,{...reviewBase,EventName:'OTHER-REVIEW-EVENT',Country:'Germany'}],eventOptions),{view:'all'});
for(const c of crossEventConflict.shown){assert.equal(c.total,1,'partial event rows cannot turn the canonical conflicted filing into an extra certain RO country');assert.equal(c.countries[0].key,'?');assert.deepEqual(c.countries[0].roIDs,['REVIEW-RO']);assert.equal(c.scopedRows.length,1);}
console.log('PASS review visibility: conflicting/missing country source rows, canonical inactive/state conflicts, no duplicate RO-only countries, explicit inactive application-only scope.');
const variantParents=analyze([reviewBase,{...reviewBase,EventName:'SECOND-EVENT',AppID:'SECOND-APP',ROID:'SECOND-RO',SubID:'SECOND-SUB',Country:'FRANCE'}],eventOptions);
assert.deepEqual(variantParents.options.countries,['France'],'equivalent countries across separate records share a filter choice');assert.equal(derive(variantParents,{view:'all',country:'France'}).shown.length,2);assert.equal(derive(variantParents,{view:'all',country:' france '}).visibleCoverage.submission,2,'country filtering uses the same canonical comparison as country links');
