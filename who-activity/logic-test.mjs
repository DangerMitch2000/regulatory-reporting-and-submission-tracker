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
