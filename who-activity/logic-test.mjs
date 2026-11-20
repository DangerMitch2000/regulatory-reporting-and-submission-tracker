import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SITES,ROLES,REQUIRED,defaultState,normalizeState,mapTable,summarize,parseDay,resolveDate,formatDate,isWHO} from './logic.mjs';

const now=new Date('2026-11-20T12:00:00Z');
const mapped=Object.fromEntries(ROLES.map(role=>[role,true]));
const row=(overrides={})=>({...Object.fromEntries(ROLES.map(role=>[role,null])),SubID:'SUB-1',ROID:'RO-1',AppID:'APP-1',RegistrationID:'REG-1',Site:'ABO',BusinessUnit:'ID',CommercialRegion:'WHO',Product:'Product A',SubmissionType:'Initial',ActualSubmission:'2025-03-01',ActualApproval:'2026-02-01',AsOfDate:'2026-11-18',...overrides});
const summary=(rows,options={})=>summarize(rows,{now,mapped,...options});
const sum=values=>values.reduce((a,b)=>a+b,0);
function reconciles(result) {
  for(const metric of ['submissions','approvals']) for(let index=0;index<2;index++) {
    assert.equal(result.totals[metric][index],sum(result.groups.map(group=>group[metric][index])));
    assert.equal(result.totals[metric][index],result.events.filter(event=>event.metric===metric&&event.year===result.years[index]).length);
  }
}

test('defaults are current/prior calendar years, six sites plus Unassigned, ID, fixed RO approvals',()=>{
  const state=defaultState(now);
  assert.deepEqual(state.years,[2025,2026]); assert.deepEqual(state.sites,[...DEFAULT_SITES,'']);
  assert.equal(state.unit,'ID'); assert.equal(state.whoValue,'@who'); assert.equal(state.approvalBasis,'ro');
  assert.equal(normalizeState({approvalBasis:'submission'},now).approvalBasis,'ro');
  assert.deepEqual(normalizeState({sites:[],years:[2026,2025]},now).sites,[]);
  assert.deepEqual(normalizeState({years:[2026,2026]},now).years,[2025,2026]);
  assert.deepEqual(defaultState(new Date('2027-01-01T12:00:00Z')).years,[2026,2027]);
});

test('strict dates accept source ISO/DD-MM year format, calendar days and reject rollovers',()=>{
  assert.equal(formatDate(parseDay('08/09/2026 00:00:00')),'08 Sep 2026');
  assert.equal(formatDate(parseDay('2026-11-16T23:59:59+02:00')),'16 Nov 2026');
  assert.equal(parseDay('2026-02-30').kind,'invalid');
  assert.equal(parseDay('31/04/2026 00:00:00').kind,'invalid');
  assert.equal(parseDay('2026-01-01T24:00:00Z').kind,'invalid');
  assert.equal(parseDay('2026-01-01T01:00:00+25:00').kind,'invalid');
  assert.equal(parseDay(45000).kind,'invalid');
  assert.equal(parseDay('tomorrow').kind,'invalid');
  assert.equal(parseDay('2101-01-01').kind,'invalid');
  assert.equal(parseDay(new Date(NaN)).kind,'invalid');
  assert.deepEqual(resolveDate(['2026-11-16',null,'16/11/2026 00:00:00']),parseDay('2026-11-16'));
  assert.equal(resolveDate(['2026-11-16','2026-11-17']).kind,'issue');
  assert.equal(resolveDate(['2026-11-16','bad']).kind,'issue');
});

test('only commercial region identifies WHO; no substring, yes or geography inference',()=>{
  for(const value of ['WHO',' who  ','WHO (Multi-country)','World Health Organization','world health organization (who)']) assert.ok(isWHO(value));
  for(const value of ['WHO pending','WHO/EMEA','WHOLESALE','Yes',true,1,'',null]) assert.equal(isWHO(value),false);
  const result=summary([row({CommercialRegion:'EMEA',WHOScope:'WHO',Country:'WHO (Multi-country)',HealthAuthority:'WHO'})]);
  assert.equal(sum(result.totals.submissions),0); assert.equal(sum(result.totals.approvals),0);
  assert.ok(result.notices.some(value=>value.includes('No rows match')));
  const selected=summary([row({CommercialRegion:'WHO / special'})],{whoValue:'WHO / special'});
  assert.equal(sum(selected.totals.submissions),1);
});

test('only three active sites shown; paired metrics have same additive groups',()=>{
  const result=summary([
    row(),row({SubID:'S2',ROID:'R2',Site:'ADK',ActualSubmission:'2026-04-01',ActualApproval:null}),
    row({SubID:'S3',ROID:'R3',Site:DEFAULT_SITES[5],ActualSubmission:'2024-01-01',ActualApproval:'2025-06-01'}),
    row({SubID:'S4',ROID:'R4',Site:'ADJ',ActualSubmission:null,ActualApproval:null})
  ]);
  assert.deepEqual(result.groups.map(group=>group.label),['ABO','ADK',DEFAULT_SITES[5]]);
  assert.deepEqual(result.totals,{submissions:[1,1],approvals:[1,1]}); assert.equal(result.visibleSites,3);
  assert.deepEqual(result.groups[2].submissions,[0,0]); reconciles(result);
});

test('default blank sites retained in Unassigned; blank regions reviewed without assuming WHO',()=>{
  const result=summary([row({Site:''}),row({SubID:'S2',ROID:'R2',CommercialRegion:''})]);
  assert.deepEqual(result.totals,{submissions:[1,0],approvals:[0,1]});
  assert.equal(result.groups[0].label,'Unassigned site'); assert.equal(result.groups[0].key,'site:blank');
  assert.equal(result.visibleSites,0); assert.deepEqual(result.unassignedSiteActivity,result.totals);
  assert.ok(result.issues.some(issue=>issue.kind==='missingSite'));
  assert.ok(result.issues.some(issue=>issue.kind==='unclassifiedRegion'));
  assert.ok(result.choices.sites.includes('')); assert.ok(result.choices.regions.includes('')); reconciles(result);
  const blank=summary([row({CommercialRegion:''})],{whoValue:'',groupBy:'region'});
  assert.equal(blank.groups[0].label,'Not recorded'); assert.equal(blank.groups[0].key,'region:blank');
  assert.equal(sum(blank.totals.submissions),1);
});

test('literal Not recorded region does not merge with true blank region',()=>{
  const result=summary([row({CommercialRegion:''}),row({SubID:'S2',ROID:'R2',CommercialRegion:'Not recorded'})],{whoValue:'*',groupBy:'region'});
  assert.equal(result.groups.length,2); assert.notEqual(result.groups[0].key,result.groups[1].key);
  assert.equal(result.groups.filter(group=>group.label==='Not recorded').length,2); reconciles(result);
});

test('filing and approval independently assigned to own actual year, no status inference',()=>{
  const result=summary([row({ActualSubmission:'2024-12-01',ActualApproval:'2026-10-01',ROStatus:'Archived',SubStatus:'Withdrawn'}),row({SubID:'S2',ROID:'R2',ActualSubmission:'2025-12-01',ActualApproval:null,ROStatus:'Approved',RegistrationStart:'2026-01-01'})]);
  assert.deepEqual(result.totals,{submissions:[1,0],approvals:[0,1]});
  assert.ok(result.issues.some(issue=>issue.id==='R2'&&issue.metric==='approvals'&&issue.kind==='missingDate')); reconciles(result);
});

test('30,000 repeated joins do not inflate either metric or review identity count',()=>{
  const rows=Array.from({length:30000},(_,i)=>row({RegistrationID:`REG-${i%30}`}));
  const started=performance.now(),result=summary(rows),elapsed=performance.now()-started;
  assert.deepEqual(result.totals,{submissions:[1,0],approvals:[0,1]});
  assert.equal(result.events.length,2); assert.equal(result.events[0].registrationIds.length,30);
  assert.ok(elapsed<10000,`30k rows took ${elapsed.toFixed(0)} ms`); reconciles(result);
});

test('identified missing-site/region reviews deduplicate joins and retain source row counts',()=>{
  const rows=Array.from({length:30000},()=>row({Site:'',CommercialRegion:''}));
  const result=summary(rows);
  assert.equal(result.issues.filter(issue=>issue.kind==='missingSite').length,1);
  assert.equal(result.issues.filter(issue=>issue.kind==='unclassifiedRegion').length,1);
  for(const issue of result.issues) {
    assert.equal(issue.sourceRows,30000); assert.equal(issue.sourceRowExamples.length,20);
    assert.deepEqual(issue.subIds,['SUB-1']); assert.deepEqual(issue.roIds,['RO-1']);
    assert.equal(issue.rawSite,''); assert.equal(issue.rawCommercialRegion,'');
  }
  const anonymous=summary([row({SubID:'',ROID:'',Site:''}),row({SubID:'',ROID:'',Site:''})]);
  assert.equal(anonymous.issues.filter(issue=>issue.kind==='missingSite').length,2);
});

test('RO approval counted once across multiple children; legitimate submission dates kept separate',()=>{
  const result=summary([row(),row({SubID:'S2',ActualSubmission:'2026-01-10'})]);
  assert.deepEqual(result.totals,{submissions:[1,1],approvals:[0,1]});
  const approval=result.events.find(event=>event.metric==='approvals');
  assert.equal(approval.id,'RO-1'); assert.deepEqual(approval.subIds,['S2','SUB-1']);
  assert.equal(approval.submissionDate.kind,'multiple'); assert.equal(approval.submissionDate.days.length,2);
  assert.equal(result.approvalBasisLabel,'Distinct ROs with actual approval dates'); reconciles(result);
});

test('conflicting/invalid dates exclude only the owning metric and cannot hide behind filters',()=>{
  let result=summary([row(),row({ActualSubmission:'2025-04-01',Product:'Product B'})],{product:'Product A'});
  assert.deepEqual(result.totals,{submissions:[0,0],approvals:[0,1]});
  assert.ok(result.issues.some(issue=>issue.metric==='submissions'&&issue.kind==='invalidDate'));
  result=summary([row(),row({ActualApproval:'bad',BusinessUnit:'Other'})]);
  assert.deepEqual(result.totals,{submissions:[1,0],approvals:[0,0]});
  result=summary([row(),row({SubID:'S2',ActualApproval:'2026-02-02'})]);
  assert.equal(sum(result.totals.approvals),0); assert.equal(sum(result.totals.submissions),2);
});

test('blank SubID cannot invent a submission but valid RO approval remains counted',()=>{
  const result=summary([row({SubID:''}),row({SubID:null})]);
  assert.deepEqual(result.totals,{submissions:[0,0],approvals:[0,1]});
  assert.equal(result.issues.filter(issue=>issue.metric==='submissions'&&issue.kind==='missingID').length,1);
  assert.equal(result.issues.find(issue=>issue.metric==='submissions'&&issue.kind==='missingID').sourceRows,2);
  assert.deepEqual(result.events[0].subIds,[]);
  const missingRO=summary([row({ROID:''})]);
  assert.deepEqual(missingRO.totals,{submissions:[1,0],approvals:[0,0]});
});

test('scope predicates must coexist on one delivered row, never hybrid across joins',()=>{
  const rows=[row({Product:'A',BusinessUnit:'Other',SubmissionType:'Initial'}),row({Product:'B',BusinessUnit:'ID',SubmissionType:'Renewal'})];
  const result=summary(rows,{product:'A',unit:'ID',submissionType:'Initial'});
  assert.deepEqual(result.totals,{submissions:[0,0],approvals:[0,0]});
  const crossRegion=summary([row({Product:'B',CommercialRegion:'WHO'}),row({Product:'A',CommercialRegion:'EMEA'})],{product:'A'});
  assert.equal(crossRegion.events.length,0);
  const crossSite=summary([row({Product:'B',Site:'ABO'}),row({Product:'A',Site:'ADK'})],{sites:['ABO'],product:'A'});
  assert.equal(crossSite.events.length,0);
});

test('multiple sites/regions use one additive bucket, even after membership filter',()=>{
  const rows=[row({Site:'ABO',CommercialRegion:'WHO'}),row({Site:'ADK',CommercialRegion:'EMEA'})];
  let result=summary(rows);
  assert.equal(result.groups.length,1); assert.equal(result.groups[0].key,'site:multiple');
  assert.equal(sum(result.totals.submissions),1); assert.equal(sum(result.totals.approvals),1); reconciles(result);
  result=summary(rows,{groupBy:'region',sites:['ABO']});
  assert.equal(result.groups[0].key,'region:multiple'); assert.equal(result.groups[0].label,'Multiple regions — review');
  assert.ok(result.issues.some(issue=>issue.kind==='multipleRegions')); reconciles(result);
});

test('a blank repeated dimension does not override a usable linked site/region',()=>{
  const result=summary([row(),row({Site:'',CommercialRegion:''})]);
  assert.equal(result.groups[0].label,'ABO'); assert.equal(result.groups.length,1);
  assert.equal(sum(result.totals.submissions),1); reconciles(result);
  assert.equal(summary([row(),row({CommercialRegion:''})],{whoValue:''}).events.length,0);
  assert.equal(summary([row(),row({Site:''})],{sites:['']}).events.length,0);
  assert.equal(summary([row({Site:'Other site'}),row({Site:''})]).events.length,0);
  const bothBlank=summary([row({Site:'',CommercialRegion:''})]);
  assert.ok(bothBlank.issues.some(issue=>issue.kind==='missingSite'));
  assert.ok(bothBlank.issues.some(issue=>issue.kind==='unclassifiedRegion'));
});

test('supplied extract cutoff excludes future actuals independently',()=>{
  const result=summary([row({ActualSubmission:'2026-11-19',ActualApproval:'2026-11-18'})]);
  assert.equal(result.asOfLabel,'18 Nov 2026'); assert.equal(result.referenceSource,'Supplied extract date');
  assert.deepEqual(result.totals,{submissions:[0,0],approvals:[0,1]});
  assert.ok(result.issues.some(issue=>issue.metric==='submissions'&&issue.kind==='futureDate'));
});

test('missing or invalid/conflicting extract date explicitly uses yesterday reference',()=>{
  for(const rows of [[row({AsOfDate:null})],[row({AsOfDate:'bad'})],[row(),row({AsOfDate:'2026-11-17'})]]) {
    const result=summary(rows); assert.equal(result.asOfLabel,'19 Nov 2026');
    assert.equal(result.referenceSource,'Previous-day reference (not source refresh time)');
    assert.ok(result.notices.some(value=>/reference|extract date/.test(value)));
  }
  const noMapped=summary([row()],{mapped:{...mapped,AsOfDate:false}});
  assert.equal(noMapped.asOfLabel,'19 Nov 2026');
  const yearTurn=summarize([row({ActualSubmission:'2026-12-31',ActualApproval:null,AsOfDate:null})],{now:new Date('2027-01-01T12:00:00Z'),mapped});
  assert.equal(yearTurn.asOfLabel,'31 Dec 2026'); assert.deepEqual(yearTurn.totals.submissions,[1,0]);
});

test('required mappings fail closed; unavailable independent metric shown explicitly',()=>{
  assert.deepEqual(REQUIRED,['CommercialRegion','Site']);
  for(const role of REQUIRED) {
    const result=summary([row()],{mapped:{...mapped,[role]:false}});
    assert.equal(result.scopeUnavailable,true); assert.equal(result.events.length,0);
    assert.ok(result.unavailableMetrics.submissions&&result.unavailableMetrics.approvals);
  }
  const noApproval=summary([row()],{mapped:{...mapped,ActualApproval:false}});
  assert.equal(noApproval.unavailableMetrics.approvals,true); assert.equal(noApproval.unavailableMetrics.submissions,false);
  assert.equal(sum(noApproval.totals.submissions),1);
  const noSub=summary([row()],{mapped:{...mapped,SubID:false}});
  assert.equal(noSub.unavailableMetrics.submissions,true); assert.equal(sum(noSub.totals.approvals),1);
  const optional=summary([row({BusinessUnit:'Other'})],{mapped:{...mapped,BusinessUnit:false}});
  assert.equal(sum(optional.totals.submissions),1);
});

test('zero/one/six active sites adapt without losing additive totals',()=>{
  assert.equal(summary([]).groups.length,0);
  assert.equal(summary([row()]).visibleSites,1);
  const six=summary(DEFAULT_SITES.map((Site,index)=>row({Site,SubID:`S${index}`,ROID:`R${index}`})));
  assert.equal(six.visibleSites,6); assert.deepEqual(six.groups.map(group=>group.label),DEFAULT_SITES); reconciles(six);
  assert.equal(summary([row()],{sites:[]}).groups.length,0);
  const other=summary([row({Site:'Other site'})]); assert.equal(other.events.length,0);
  assert.equal(summary([row({Site:'Other site'})],{sites:'*'}).groups.length,1);
});

test('platform links only accept unique HTTPS record URL without credentials',()=>{
  const result=summary([row({SubmissionURL:'https://example.test/sub/1',RegulatoryObjectiveURL:'https://example.test/ro/1'})]);
  assert.equal(result.events.find(event=>event.metric==='submissions').url,'https://example.test/sub/1');
  assert.equal(result.events.find(event=>event.metric==='approvals').url,'https://example.test/ro/1');
  for(const SubmissionURL of ['javascript:alert(1)','http://example.test','https://user:secret@example.test','data:text/html,hello']) {
    assert.equal(summary([row({SubmissionURL})]).events.find(event=>event.metric==='submissions').url,'');
  }
  assert.equal(summary([row({SubmissionURL:'https://a.test'}),row({SubmissionURL:'https://b.test'})]).events.find(event=>event.metric==='submissions').url,'');
});

test('mapTable maps exact roles and reports missing requirements; duplicate role refuses ambiguity',()=>{
  const table={columns:[{displayName:'Region',roles:{CommercialRegion:true}},{displayName:'Manufacturer',roles:{Site:true}},{displayName:'Submission',roles:{SubID:true}}],rows:[['WHO','ABO','S1']]};
  const result=mapTable(table);
  assert.deepEqual(result.missing,[]); assert.equal(result.rows[0].CommercialRegion,'WHO');
  assert.equal(result.mapped.ActualApproval,false); assert.equal(result.labels.Site,'Manufacturer');
  assert.deepEqual(mapTable({columns:[],rows:[]}).missing,REQUIRED);
  assert.throws(()=>mapTable({...table,columns:[...table.columns,{roles:{Site:true}}]}),/only one field/);
  assert.equal(summary([row()],{mapped:new Set(ROLES)}).events.length,2);
});

test('planning and state controls default to actual history and all current states',()=>{
  const state=defaultState(now);
  assert.equal(state.dateBasis,'actual'); assert.equal(state.country,'*');
  assert.deepEqual(state.stateFilters,{AppStatus:'*',ROStatus:'*',SubStatus:'*'});
  const restored=normalizeState({dateBasis:'lbe',country:' France ',stateFilters:{AppStatus:[' Active ','active',''],ROStatus:[],SubStatus:'bad'}},now);
  assert.equal(restored.dateBasis,'lbe'); assert.equal(restored.country,'France');
  assert.deepEqual(restored.stateFilters.AppStatus,['','active']); assert.deepEqual(restored.stateFilters.ROStatus,[]);
  assert.equal(restored.stateFilters.SubStatus,'*'); assert.equal(normalizeState({dateBasis:'bad'},now).dateBasis,'actual');
  const result=summary([row({AppStatus:'Closed',ROStatus:'Archived',SubStatus:'Withdrawn'})]);
  assert.equal(result.events.length,2); assert.equal(result.events[0].states.AppStatus.label,'Closed');
  assert.equal(summary([row()],{stateFilters:{SubStatus:[]}}).events.length,0);
});

test('each date basis owns its years without falling back to another planned or actual date',()=>{
  const rows=[row({ActualSubmission:'2024-12-31',ActualApproval:'2025-06-01',OriginalSubmission:'2025-03-01',LatestSubmission:'2026-04-01',OriginalApproval:'2026-07-01',LatestApproval:'2027-01-31'})];
  const actual=summary(rows),initial=summary(rows,{dateBasis:'initial'}),lbe=summary(rows,{dateBasis:'lbe'});
  assert.deepEqual(actual.totals,{submissions:[0,0],approvals:[1,0]});
  assert.deepEqual(initial.totals,{submissions:[1,0],approvals:[0,1]});
  assert.deepEqual(lbe.totals,{submissions:[0,1],approvals:[0,0]});
  assert.deepEqual(initial.basisDateRoles,{submissions:'OriginalSubmission',approvals:'OriginalApproval'});
  assert.equal(lbe.dateBasisLabel,'LBE plan'); assert.deepEqual(lbe.choices.years,[2024,2025,2026,2027]);
  const submission=lbe.events[0];
  assert.equal(formatDate(submission.initialDate),'01 Mar 2025');
  assert.equal(formatDate(submission.lbeDate),'01 Apr 2026');
  assert.equal(formatDate(submission.actualDate),'31 Dec 2024');
  assert.equal(submission.date,submission.lbeDate.day); assert.equal(submission.submissionDate.day,submission.actualDate.day);
  const blankInitial=summary([row({LatestSubmission:'2026-06-01',OriginalApproval:'2026-07-01'})],{dateBasis:'initial'});
  assert.deepEqual(blankInitial.totals,{submissions:[0,0],approvals:[0,1]});
  assert.ok(blankInitial.issues.some(issue=>issue.field==='OriginalSubmission'&&issue.kind==='missingDate'));
  for(const result of [actual,initial,lbe,blankInitial]) reconciles(result);
});

test('future initial and LBE plans count in their chosen year but future actuals do not',()=>{
  const rows=[row({ActualSubmission:'2027-01-10',ActualApproval:'2027-02-10',OriginalSubmission:'2026-12-10',OriginalApproval:'2027-01-10',LatestSubmission:'2027-02-10',LatestApproval:'2027-03-10'})];
  const actual=summary(rows,{years:[2026,2027]}),initial=summary(rows,{years:[2026,2027],dateBasis:'initial'}),lbe=summary(rows,{years:[2026,2027],dateBasis:'lbe'});
  assert.equal(actual.events.length,0); assert.equal(actual.issues.filter(issue=>issue.kind==='futureDate').length,2);
  assert.deepEqual(initial.totals,{submissions:[1,0],approvals:[0,1]});
  assert.deepEqual(lbe.totals,{submissions:[0,1],approvals:[0,1]});
  assert.equal(lbe.issues.filter(issue=>issue.kind==='futureDate').length,2,'actual-date checks remain visible in plan views');
  assert.ok(lbe.issues.filter(issue=>issue.kind==='futureDate').every(issue=>issue.dateBasis==='actual'));
  reconciles(initial); reconciles(lbe);
});

test('invalid or conflicting plans stay reviewable before filters without changing actual evidence',()=>{
  const rows=[row({OriginalSubmission:'2025-01-01',LatestApproval:'2026-02-30'}),row({OriginalSubmission:'2025-02-01',LatestApproval:'2026-02-30',Product:'Other'})];
  const actual=summary(rows,{product:'Product A'});
  assert.deepEqual(actual.totals,{submissions:[1,0],approvals:[0,1]});
  assert.ok(actual.issues.some(issue=>issue.field==='OriginalSubmission'&&issue.kind==='invalidPlanDate'&&issue.message.includes('Conflicting initial plan dates')));
  assert.ok(actual.issues.some(issue=>issue.field==='LatestApproval'&&issue.kind==='invalidPlanDate'));
  assert.equal(actual.events.find(event=>event.metric==='submissions').initialDate.kind,'issue');
  const initial=summary(rows,{product:'Product A',dateBasis:'initial'});
  assert.equal(initial.events.length,0); assert.ok(initial.issues.some(issue=>issue.field==='OriginalSubmission'&&issue.kind==='invalidPlanDate'));
  const independent=summary([row({ActualSubmission:'bad',OriginalSubmission:'2025-01-01',OriginalApproval:'2026-01-01'})],{dateBasis:'initial'});
  assert.deepEqual(independent.totals,{submissions:[1,0],approvals:[0,1]});
  assert.equal(independent.events.find(event=>event.metric==='submissions').actualDate.kind,'issue');
});

test('planned RO approvals use RO IDs and RO dates independently of child submission plans',()=>{
  const rows=[row({OriginalSubmission:'2025-03-01',OriginalApproval:'2026-06-01'}),row({SubID:'S2',OriginalSubmission:'2026-04-01',OriginalApproval:'2026-06-01'})];
  const result=summary(rows,{dateBasis:'initial'});
  assert.deepEqual(result.totals,{submissions:[1,1],approvals:[0,1]});
  assert.equal(result.events.find(event=>event.metric==='approvals').initialDate.day,parseDay('2026-06-01').day);
  assert.equal(result.issues.filter(issue=>issue.kind==='invalidDate').length,0); reconciles(result);
  const missingSub=summary([row({SubID:'',LatestApproval:'2026-07-01'})],{dateBasis:'lbe'});
  assert.deepEqual(missingSub.totals,{submissions:[0,0],approvals:[0,1]});
  const missingRO=summary([row({ROID:'',LatestSubmission:'2026-07-01'})],{dateBasis:'lbe'});
  assert.deepEqual(missingRO.totals,{submissions:[0,1],approvals:[0,0]});
  const conflict=summary([...rows,row({SubID:'S3',Product:'Other',OriginalApproval:'2026-07-01'})],{dateBasis:'initial',product:'Product A'});
  assert.equal(sum(conflict.totals.approvals),0); assert.equal(sum(conflict.totals.submissions),2);
});

test('date basis availability is independent for submission and approval mappings',()=>{
  const rows=[row({OriginalSubmission:'2025-03-01',OriginalApproval:'2026-06-01',LatestSubmission:'2026-06-01',LatestApproval:'2026-08-01'})];
  const result=summary(rows,{dateBasis:'lbe',mapped:{...mapped,LatestApproval:false}});
  assert.deepEqual(result.unavailableMetrics,{submissions:false,approvals:true});
  assert.equal(result.events.length,1); assert.ok(result.notices.some(message=>message.includes('LatestApproval')));
  const actual=summary(rows,{mapped:{...mapped,OriginalSubmission:false,OriginalApproval:false,LatestSubmission:false,LatestApproval:false}});
  assert.deepEqual(actual.totals,{submissions:[1,0],approvals:[0,1]});
  assert.equal(actual.events[0].initialDate.kind,'unmapped');
  const initial=summary(rows,{dateBasis:'initial',mapped:{...mapped,ActualSubmission:false,ActualApproval:false}});
  assert.deepEqual(initial.totals,{submissions:[1,0],approvals:[0,1]});
  assert.equal(initial.events[0].actualDate.kind,'unmapped');
});

test('state filters use linked record states on the same delivered row as other selections',()=>{
  const rows=[row({SubID:'S1',AppID:'A1',Product:'A',AppStatus:'Active',ROStatus:'In progress',SubStatus:'Planned'}),row({SubID:'S2',AppID:'A2',Product:'B',AppStatus:'Closed',ROStatus:'In progress',SubStatus:'Submitted'})];
  assert.equal(summary(rows,{product:'A',stateFilters:{SubStatus:['Submitted']}}).events.length,0);
  assert.equal(summary(rows,{product:'A',stateFilters:{AppStatus:['Closed']}}).events.length,0);
  const result=summary(rows,{product:'B',stateFilters:{AppStatus:['Closed'],SubStatus:['Submitted'],ROStatus:['In progress']}});
  assert.deepEqual(result.totals,{submissions:[1,0],approvals:[0,1]});
  const approval=result.events.find(event=>event.metric==='approvals');
  assert.equal(approval.states.SubStatus.kind,'multiple'); assert.deepEqual(approval.states.SubStatus.values,['Planned','Submitted']);
  assert.equal(approval.states.AppStatus.kind,'multiple');
  assert.equal(result.issues.filter(issue=>issue.kind==='conflictingState').length,0);
  assert.deepEqual(result.choices.stateFilters.SubStatus,['Planned','Submitted']);
  reconciles(result);
});

test('blank repeated state values do not override a known identity state or fabricate links',()=>{
  const rows=[row({AppStatus:'Active',ROStatus:'Approved',SubStatus:'Submitted'}),row({AppStatus:'',ROStatus:'',SubStatus:''})];
  for(const role of ['AppStatus','ROStatus','SubStatus']) assert.equal(summary(rows,{stateFilters:{[role]:['']}}).events.length,0);
  const blank=summary([row()],{stateFilters:{AppStatus:[''],ROStatus:[''],SubStatus:['']}});
  assert.equal(blank.events.length,2); assert.equal(blank.events[0].states.SubStatus.kind,'blank');
  const mixed=summary([row({SubStatus:'Submitted'}),row({SubID:'S2',SubStatus:''})],{stateFilters:{SubStatus:['']}});
  const approval=mixed.events.find(event=>event.metric==='approvals');
  assert.equal(approval.states.SubStatus.kind,'multiple'); assert.equal(approval.states.SubStatus.label,'Submitted · Not recorded');
  assert.equal(mixed.issues.filter(issue=>issue.kind==='conflictingState').length,0);
  const literal=summary([row({SubStatus:'Not recorded'})],{stateFilters:{SubStatus:['']}});
  assert.equal(literal.events.length,0);
  const missingSubIDs=[row({SubID:'',Product:'A',SubStatus:'Planned'}),row({SubID:'',Product:'B',SubStatus:'Submitted'})];
  assert.equal(summary(missingSubIDs,{product:'A',stateFilters:{SubStatus:['Submitted']}}).events.length,0);
  const missingAppIDs=[row({AppID:'',Product:'A',AppStatus:'Active'}),row({AppID:'',Product:'B',AppStatus:'Closed'})];
  assert.equal(summary(missingAppIDs,{product:'A',stateFilters:{AppStatus:['Closed']}}).events.length,0);
});

test('contradictory states on one ID remain reviewable before local filtering',()=>{
  const rows=[row({SubStatus:'Planned',ROStatus:'Approved'}),row({SubStatus:'Submitted',ROStatus:'Approved',Product:'Other'})];
  const result=summary(rows,{product:'Product A',stateFilters:{SubStatus:['Planned']}});
  assert.deepEqual(result.totals,{submissions:[1,0],approvals:[0,1]});
  const issues=result.issues.filter(issue=>issue.kind==='conflictingState');
  assert.equal(issues.length,1); assert.equal(issues[0].field,'SubStatus'); assert.equal(issues[0].id,'SUB-1');
  assert.deepEqual(issues[0].rawValues,['Planned','Submitted']);
  assert.equal(result.events[0].states.SubStatus.kind,'issue');
  const unavailable=summary([row()],{stateFilters:{ROStatus:['Approved']},mapped:{...mapped,ROStatus:false}});
  assert.equal(unavailable.events.length,2); assert.ok(unavailable.notices.some(message=>message.includes('RO state is not mapped')));
  assert.equal(unavailable.events[0].states.ROStatus.kind,'unmapped');
});

test('country filters coexist with dimensions and distinguish unknown from known joined countries',()=>{
  const rows=[row({Country:'France',Product:'A'}),row({Country:'Germany',Product:'B'})];
  assert.equal(summary(rows,{country:'Germany',product:'A'}).events.length,0);
  const result=summary(rows,{country:'France',product:'A'});
  assert.equal(result.events.length,2); assert.deepEqual(result.events[0].countries,['France','Germany']);
  assert.equal(result.events[0].country,'France · Germany');
  assert.equal(result.issues.filter(issue=>/countr/i.test(issue.kind)).length,0);
  assert.deepEqual(result.choices.countries,['France','Germany']); reconciles(result);
  const joinedBlank=[row({Country:'France'}),row({Country:''})];
  assert.equal(summary(joinedBlank,{country:''}).events.length,0);
  const trulyBlank=summary([row({Country:''})],{country:''});
  assert.equal(trulyBlank.events.length,2); assert.equal(trulyBlank.events[0].country,'Not recorded');
  assert.equal(summary([row({Country:'Not recorded'})],{country:''}).events.length,0);
  const unavailable=summary(rows,{country:'France',mapped:{...mapped,Country:false}});
  assert.equal(unavailable.events.length,2); assert.ok(unavailable.notices.some(message=>message.includes('Country is not mapped')));
});

test('all mapped milestone dates are audited independently of the selected chart basis',()=>{
  const rows=[row({ActualSubmission:'2026-11-19',OriginalSubmission:'bad baseline',LatestSubmission:'',ActualApproval:'2026-02-30',OriginalApproval:'',LatestApproval:'2026-12-01',AppStatus:'Active',ROStatus:'Health Authority Approved',SubStatus:'Completed'})];
  const results=['actual','initial','lbe'].map(dateBasis=>summary(rows,{dateBasis}));
  const signature=result=>result.issues.map(issue=>[issue.id,issue.kind,issue.field,issue.severity,issue.checkGroup,issue.message]);
  assert.deepEqual(signature(results[0]),signature(results[1])); assert.deepEqual(signature(results[0]),signature(results[2]));
  assert.equal(results[0].issues.length,5);
  assert.deepEqual(results[0].issues.filter(issue=>issue.severity==='review').map(issue=>issue.field).sort(),['ActualApproval','ActualSubmission','OriginalSubmission']);
  assert.deepEqual(results[2].totals,{submissions:[0,0],approvals:[0,1]},'future plan still counts independently');
  assert.ok(results[0].checkCoverage.every(field=>field.checked)); assert.equal(results[0].checkCoverage.length,10);
  for(const result of results) reconciles(result);
});

test('unavailable selected date fields do not hide other date and state checks',()=>{
  const result=summary([row({ActualSubmission:'bad actual',OriginalSubmission:'bad initial',LatestSubmission:null,AppStatus:'',ROStatus:'',SubStatus:''})],{dateBasis:'lbe',mapped:{...mapped,LatestSubmission:false,LatestApproval:false}});
  assert.ok(result.unavailableMetrics.submissions&&result.unavailableMetrics.approvals);
  assert.ok(result.issues.some(issue=>issue.field==='ActualSubmission'&&issue.kind==='invalidDate'));
  assert.ok(result.issues.some(issue=>issue.field==='OriginalSubmission'&&issue.kind==='invalidPlanDate'));
  assert.equal(result.issues.filter(issue=>issue.kind==='missingState').length,3);
  assert.equal(result.issues.filter(issue=>issue.field==='LatestSubmission'||issue.field==='LatestApproval').length,0,'unmapped optional fields are not reported as blank records');
  assert.equal(result.checkCoverage.find(field=>field.field==='LatestSubmission').checked,false);
});

test('blank actual dates distinguish conservative pending work from explicit milestone evidence',()=>{
  const check=(SubStatus,ROStatus)=>summary([row({ActualSubmission:null,ActualApproval:null,SubStatus,ROStatus,AppStatus:'Active'})]).issues.filter(issue=>['ActualSubmission','ActualApproval'].includes(issue.field));
  for(const issue of check('Planned','In Progress')) {assert.equal(issue.kind,'missingDate');assert.equal(issue.severity,'info');assert.equal(issue.checkGroup,'expectedPending');}
  for(const issue of check('Ready For Submission','On Hold By Health Authority')) assert.equal(issue.checkGroup,'expectedPending');
  for(const issue of check('Sent To Health Authority','Conditionally Approved')) {assert.equal(issue.severity,'review');assert.match(issue.message,/verify the actual date/i);}
  for(const issue of check('Archived','Withdrawn')) {assert.equal(issue.severity,'info');assert.equal(issue.checkGroup,'notRecorded');}
  assert.equal(check('Distributed','Custom workflow')[0].checkGroup,'notRecorded','distributed is not assumed to prove or disprove authority submission');
  const custom=summary([row({SubStatus:'Custom workflow',ROStatus:'Other workflow',AppStatus:'Custom application state'})]);
  assert.equal(custom.issues.filter(issue=>/State/.test(issue.kind)).length,0,'custom state names are not invented errors');
});

test('current planned states with actual dates are reviewable without discarding historical activity',()=>{
  const result=summary([row({SubStatus:'Planned',ROStatus:'Planned',AppStatus:'Inactive'})]);
  assert.deepEqual(result.totals,{submissions:[1,0],approvals:[0,1]});
  const mismatches=result.issues.filter(issue=>issue.kind==='stateDateMismatch');
  assert.equal(mismatches.length,2); assert.ok(mismatches.every(issue=>issue.severity==='review'));
  const historical=summary([row({SubStatus:'Withdrawn',ROStatus:'Archived',AppStatus:'Inactive'})]);
  assert.equal(historical.issues.filter(issue=>issue.kind==='stateDateMismatch').length,0);
  assert.deepEqual(historical.totals,result.totals);
});

test('as-of checks are global once and excluded from identified or unidentified record totals',()=>{
  for(const value of [null,'bad']) {
    const result=summary([row({AsOfDate:value}),row({AsOfDate:value})],{mapped:{...mapped,ActualSubmission:false,ActualApproval:false},dateBasis:'actual'});
    const checks=result.issues.filter(issue=>issue.field==='AsOfDate');
    assert.equal(checks.length,1); assert.equal(checks[0].recordType,'dataset');
    assert.equal(checks[0].severity,value==null?'info':'review'); assert.equal(result.issuesSummary.datasetCount,1);
    assert.equal(result.issuesSummary.unidentifiedCount,0); assert.equal(result.issuesSummary.recordCount,3);
  }
  const conflict=summary([row(),row({AsOfDate:'2026-11-17'})]);
  assert.equal(conflict.issues.filter(issue=>issue.field==='AsOfDate').length,1);
  assert.match(conflict.issues.find(issue=>issue.field==='AsOfDate').message,/Conflicting data as-of dates/);
  assert.equal(conflict.asOfLabel,'19 Nov 2026');
  const future=summary([row({AsOfDate:'2026-11-21'})]);
  assert.equal(future.issues.find(issue=>issue.field==='AsOfDate').kind,'futureDate'); assert.equal(future.asOfLabel,'21 Nov 2026','audit does not silently change supplied cutoff');
});

test('lone application and RO states are checked without requiring a selected milestone date',()=>{
  const appOnly=summary([row({SubID:'',ROID:'',AppID:'APP-ONLY',ActualSubmission:null,ActualApproval:null,AppStatus:''})],{mapped:{...mapped,ActualSubmission:false,ActualApproval:false}});
  const appCheck=appOnly.issues.find(issue=>issue.field==='AppStatus');
  assert.equal(appCheck.kind,'missingState');assert.equal(appCheck.recordType,'application');assert.equal(appCheck.id,'APP-ONLY');
  assert.equal(appOnly.issues.filter(issue=>issue.field==='SubStatus'||issue.field==='ROStatus').length,0,'no invented absent child identities');
  const roOnly=summary([row({SubID:'',ROStatus:'Planned'}),row({SubID:'',ROStatus:'Health Authority Approved'})],{mapped:{...mapped,ActualApproval:false}});
  assert.equal(roOnly.issues.filter(issue=>issue.field==='ROStatus'&&issue.kind==='conflictingState').length,1);
});

test('typed issue counts deduplicate joined evidence while preserving all checked fields',()=>{
  const base=row({SubID:'SAME',ROID:'SAME',AppID:'SAME',ActualSubmission:null,ActualApproval:null,AsOfDate:null});
  const result=summary([base,{...base,RegistrationID:'REG-2'},base]);
  assert.equal(result.issuesSummary.recordCount,3,'typed identities prevent one text ID merging three record types');
  assert.equal(result.issuesSummary.total,10,'six date blanks, three state blanks and one global reference blank');
  assert.equal(result.issuesSummary.review,0);assert.equal(result.issuesSummary.info,10);assert.equal(result.issuesSummary.datasetCount,1);
  const known=summary([row({AppStatus:'Active',SubStatus:'Completed',ROStatus:'Health Authority Approved',OriginalSubmission:'2025-01-01',LatestSubmission:'2025-02-01',OriginalApproval:'2026-01-01',LatestApproval:'2026-01-15'}),row()]);
  assert.equal(known.issues.filter(issue=>issue.kind==='missingState'||issue.kind==='conflictingState'||issue.kind==='missingDate').length,0,'blank repeat joins do not conceal recorded identity evidence');
});

test('missing owner IDs retain bounded raw source date/state examples without fabricating records',()=>{
  const orphan=row({SubID:'',ROID:'',AppID:'',ActualSubmission:'bad date',SubStatus:'Completed',AppStatus:'Active'});
  const result=summary([orphan,{...orphan,ActualSubmission:'2026-12-31'}]);
  const missingSub=result.issues.filter(issue=>issue.field==='SubID'&&issue.kind==='missingID');
  assert.equal(missingSub.length,2);assert.deepEqual(missingSub[0].sourceFields.ActualSubmission,['bad date']);assert.deepEqual(missingSub[0].sourceFields.SubStatus,['Completed']);
  assert.equal(result.issues.filter(issue=>issue.field==='AppID').length,2);assert.deepEqual(result.issues.find(issue=>issue.field==='AppID').sourceFields.AppStatus,['Active']);
  assert.equal(result.issuesSummary.recordCount,0);assert.equal(result.issuesSummary.unidentifiedCount,2);
  const linked=summary(Array.from({length:30},(_,i)=>row({SubID:'',ActualSubmission:`raw ${i}`,SubStatus:'Completed'})));
  const review=linked.issues.find(issue=>issue.field==='SubID');assert.equal(review.sourceRows,30);assert.equal(review.sourceFields.ActualSubmission.length,20);
  assert.equal(review.recordType,'ro');assert.equal(review.id,'RO-1');
});

test('coverage distinguishes unmapped fields, missing identities, unavailable scope and no delivered data',()=>{
  const noScope=summary([row()],{mapped:{...mapped,Site:false}});
  assert.equal(noScope.checkCoverage.filter(field=>field.checked).length,1);assert.equal(noScope.checkCoverage.find(field=>field.checked).field,'AsOfDate');
  assert.equal(noScope.checkCoverage.find(field=>field.field==='AppStatus').reason,'Map required scope fields');
  const noID=summary([row()],{mapped:{...mapped,AppID:false}});
  assert.equal(noID.checkCoverage.find(field=>field.field==='AppStatus').reason,'Owning ID field not mapped');
  const blankID=summary([row({AppID:'',AppStatus:''})]);
  assert.equal(blankID.checkCoverage.find(field=>field.field==='AppStatus').reason,'No owning IDs delivered');assert.equal(blankID.issues.filter(issue=>issue.field==='AppID').length,0);
  assert.ok(summary([]).checkCoverage.every(field=>!field.checked));assert.equal(summary([]).issues.length,0);
});

test('audit scope can include older records but never claims their warnings are counted chart activity',()=>{
  const rows=[row({ActualSubmission:'2020-01-01',ActualApproval:'2020-02-01',Site:'ABO'}),row({ActualSubmission:'2020-01-01',ActualApproval:'2020-02-01',Site:'ADK'})];
  const result=summary(rows);
  assert.equal(result.events.length,0);assert.ok(result.issues.length>0);
  assert.ok(result.issues.filter(issue=>issue.kind==='multipleSites').every(issue=>issue.message.includes('When otherwise eligible')));
  const otherYear=summary(rows,{years:[2019,2020]});assert.equal(otherYear.issues.length,result.issues.length);
  assert.deepEqual(otherYear.totals,{submissions:[0,1],approvals:[0,1]});
});
