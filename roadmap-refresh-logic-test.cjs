const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const context={Date,dispatchModule:require('./dispatch-required.js')};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/roadmap-2026.logic.js','utf8').replace(/^import .*\r?\n/gm,'').replaceAll('export ','')+';this.api={summarize,parseDay,formatDay,selectStatusReview,dateRoles};',context);
const {summarize,parseDay,formatDay,selectStatusReview,dateRoles}=context.api;
const plain=value=>JSON.parse(JSON.stringify(value)),ids=records=>Array.from(records,r=>r.id),today=Date.UTC(2026,8,24);

// Selecting a calendar year must never move the actual overdue reference day.
const yearRows=[
 {SubID:'past',OriginalDispatch:'2025-12-30'},
 {SubID:'today',LatestDispatch:'2026-09-24'},
 {SubID:'future',LatestDispatch:'2027-01-03'},
 {SubID:'evidence-only',ActualApproval:'2028-03-04'},
 {SubID:'invalid',OriginalDispatch:'2024-02-30'}
];
const past=summarize(yearRows,today,false,'*',{year:2025}),future=summarize(yearRows,today,false,'*',{year:2027});
assert.equal(past.today,today);assert.equal(future.today,today);
assert.equal(past.records[0].category,2,'an earlier selected year remains overdue relative to today');
assert.equal(future.records[0].category,1,'a later selected year remains expected relative to today');
assert.equal(summarize(yearRows,today).records[0].category,1,'a plan on today is not overdue');
assert.equal(summarize(yearRows,today,false,'*',{year:null}).year,2026);
assert.equal(summarize(yearRows,today,false,'*',{year:'invalid'}).year,2026);
assert.deepEqual(plain(past.years),[2025,2026,2027,2028]);
assert.deepEqual(plain(summarize([],today).years),[2026]);
assert.equal(summarize(yearRows,today,false,'*',{year:2028}).missing.length,1,'cleanup evidence follows selected year');

// Calendar parsing and all dispatch-date priorities remain independent of display.
const priorityRows=[
 {SubID:'actual',ActualDispatch:'2026-02-05',LatestDispatch:'2025-12-20',OriginalDispatch:'2027-01-01'},
 {SubID:'latest',LatestDispatch:'2026-03-06',OriginalDispatch:'2025-12-20'},
 {SubID:'original',OriginalDispatch:'2026-04-07'},
 {SubID:'bad-actual',ActualDispatch:'invalid',LatestDispatch:'2026-03-06'},
 {SubID:'bad-latest',LatestDispatch:'invalid',OriginalDispatch:'2026-04-07'},
 {SubID:'dispatched-old',ActualDispatch:'2025-01-01',LatestDispatch:'2026-01-01'}
];
const priority=summarize(priorityRows,today);
assert.deepEqual(ids(priority.records),['actual','latest','original']);
assert.deepEqual(Array.from(priority.records,r=>r.chosenField),['ActualDispatch','LatestDispatch','OriginalDispatch']);
assert.equal(priority.records[0].reviewPlannedDay,Date.UTC(2025,11,20));
assert.equal(priority.records[0].plannedDay,null);
assert.equal(priority.records[0].originalDispatchDay,Date.UTC(2027,0,1));
assert.deepEqual(plain(priority.excluded),['bad-actual','bad-latest']);
assert.equal(priority.outsideYear,1,'actual dispatch takes priority even outside selected year');
assert.equal(formatDay('2026-01-01T23:00:00-08:00'),'1 Jan 2026');
assert.equal(formatDay(Date.UTC(2026,10,12)),'12 Nov 2026');
assert.equal(formatDay(new Date('2026-02-03T00:00:00Z')),'3 Feb 2026');
assert.equal(formatDay('invalid'),'—');assert.equal(formatDay(null,''),'');
assert.equal(parseDay('2026-02-30').kind,'invalid');

// A site filter selects IDs by association while retaining cross-site/BU evidence.
const joined=[
 {SubID:'joined',BusinessUnit:'ID',Site:'North',ActualDispatch:'2026-01-01',SubStatus:'Planned',DispatchRequired:true},
 {SubID:'joined',BusinessUnit:'Other',Site:'South',ActualDispatch:'2026-01-01',SubStatus:'Completed',DispatchRequired:false},
 {SubID:'date-conflict',BusinessUnit:'ID',Site:'North',LatestDispatch:'2026-03-01'},
 {SubID:'date-conflict',BusinessUnit:'Other',Site:'South',LatestDispatch:'2026-04-01'},
 {SubID:'north',BusinessUnit:'ID',Site:'North',LatestDispatch:'2026-12-01'},
 {SubID:'south',BusinessUnit:'ID',Site:'South',LatestDispatch:'2026-12-01'},
 {SubID:'none',BusinessUnit:'ID',LatestDispatch:'2026-12-01'}
];
const north=summarize(joined,today,false,'ID',{site:'site:North'});
assert.equal(north.distinct,3);assert.equal(north.total,2);assert.equal(north.excluded.length,1);
const joinedRecord=north.records.find(r=>r.id==='joined');
assert.deepEqual(plain(joinedRecord.sites),['North','South']);
assert.equal(joinedRecord.siteKey,'ambiguous');
assert.equal(joinedRecord.subStatus.kind,'conflict');assert.equal(joinedRecord.dispatchRequired.kind,'conflict');
assert.equal(north.sites.find(s=>s.key==='ambiguous').total,1);
assert.equal(north.sites.reduce((total,site)=>total+site.total,0),north.total);
assert.equal(north.siteOptions.find(site=>site.key==='site:North').count,3,'membership choices count distinct IDs including multiple-site IDs');
assert.equal(north.siteOptions.find(site=>site.key==='site:South').count,3,'choices remain available before the selected site is applied');
assert.equal(summarize(joined,today,false,'ID',{site:'ambiguous'}).distinct,2);
assert.equal(summarize(joined,today,false,'ID',{site:'unassigned'}).distinct,1);
assert.equal(summarize(joined,today,false,'ID',{site:'site:North',dispatchRequired:'review'}).distinct,1);
assert.equal(selectStatusReview(north,{scope:'all',site:'site:North'}).total,1,'site bar drill uses its exact allocated bucket');

// Coverage partitions every loaded distinct ID once; issue/cleanup lists overlap
// deliberately and must never be added to the coverage or chart total.
const coverageRows=[
 {SubID:'chart-with-issue',ActualDispatch:'2026-01-01',OriginalDispatch:'invalid',Site:'North'},
 {SubID:'outside',LatestDispatch:'2027-01-01',Site:'North'},
 {SubID:'undated',ActualSubmission:'2026-02-01',Site:'North'},
 {SubID:'excluded-cleanup',LatestDispatch:'invalid',ActualApproval:'2026-03-01',Site:'North'},
 {SubID:'excluded-cleanup',LatestDispatch:'invalid',ActualApproval:'2026-03-01',Site:'North'},
 {SubID:'false-undated',DispatchRequired:false,ActualApproval:'2026-03-01',Site:'North'},
 {SubID:' ',LatestDispatch:'2026-01-01',Site:'North'},
 {SubID:null,LatestDispatch:'2026-01-01',Site:'South'}
];
const coverage=summarize(coverageRows,today,true,'*',{site:'site:North'});
assert.deepEqual(plain(coverage.coverage),{loadedDistinct:5,chart:1,outsideYear:1,undated:2,excluded:1,missingIdRows:1});
assert.equal(coverage.coverage.loadedDistinct,coverage.coverage.chart+coverage.coverage.outsideYear+coverage.coverage.undated+coverage.coverage.excluded);
assert.equal(coverage.allRecords.length,5);assert.equal(new Set(ids(coverage.allRecords)).size,5);
assert.equal(coverage.issues.length,2);assert.equal(coverage.missing.length,2);assert.equal(coverage.notRequiredOutside.length,1);
for(const bucket of ['chart','outsideYear','undated','excluded'])assert.equal(coverage.allRecords.filter(record=>record.coverageBucket===bucket).length,coverage.coverage[bucket]);
const invalidRecord=coverage.allRecords.find(record=>record.id==='excluded-cleanup');
assert.equal(invalidRecord.dates.LatestDispatch.kind,'issue');
assert.deepEqual(plain(invalidRecord.dateValues.LatestDispatch),['invalid']);
assert.deepEqual(plain(invalidRecord.dateIssues),['LatestDispatch']);
for(const field of dateRoles)assert.ok(Array.isArray(invalidRecord.dateValues[field]),'every evidence field has retained raw values');
assert.equal(coverage.allRecords.find(record=>record.id==='undated').actualSubmissionDay,Date.UTC(2026,1,1));
assert.equal(coverage.allRecords.find(record=>record.id==='false-undated').actualApprovalDay,Date.UTC(2026,2,1));

// Drilldowns combine exact month/category with the full selected-year scope.
// Sort dates chronologically using the recorded plan even after dispatch.
const reviewRows=[
 {SubID:'D',Site:'North',ActualDispatch:'2026-03-01',LatestDispatch:'2026-02-28',SubStatus:'Done'},
 {SubID:'C',Site:'South',LatestDispatch:'2026-03-01',SubStatus:'Planned'},
 {SubID:'B',Site:'North',LatestDispatch:'2026-03-01',ActualSubmission:'2026-03-02',SubStatus:'Done'},
 {SubID:'A',Site:'North',LatestDispatch:'2026-12-01',SubStatus:'Planned'},
 {SubID:'E',Site:'West',ActualDispatch:'2026-02-01',SubStatus:'Done'},
 {SubID:'F',Site:'North',LatestDispatch:'2026-03-01',DispatchRequired:false,SubStatus:'No dispatch'}
];
const reviewSummary=summarize(reviewRows,today,true);
assert.equal(selectStatusReview(reviewSummary,{scope:'all'}).total,6);
const march=selectStatusReview(reviewSummary,{scope:'all',month:2});
assert.equal(march.total,4);assert.equal(march.scopeTotal,4);
for(let category=0;category<5;category++)assert.equal(selectStatusReview(reviewSummary,{scope:'all',month:2,category}).total,reviewSummary.months[2][category]);
assert.deepEqual(ids(selectStatusReview(reviewSummary,{scope:'all',month:2,category:3}).records),['B']);
assert.deepEqual(ids(selectStatusReview(reviewSummary,{scope:'all',sort:{column:'id',direction:'desc'}}).records),['F','E','D','C','B','A']);
assert.deepEqual(ids(selectStatusReview(reviewSummary,{scope:'all',sort:{column:'plannedDay',direction:'asc'}}).records),['D','B','C','F','A','E']);
assert.deepEqual(ids(selectStatusReview(reviewSummary,{scope:'all',sort:{column:'plannedDay',direction:'desc'}}).records),['A','B','C','F','D','E']);
assert.deepEqual(ids(selectStatusReview(reviewSummary,{scope:'all',sort:{column:'actualDay',direction:'desc'}}).records),['D','E','A','B','C','F']);
const configured=selectStatusReview(reviewSummary,{scope:'all',columns:['id','actualDay','id','invalid'],sort:{column:'invalid',direction:'invalid'}});
assert.deepEqual(plain(configured.columns),['id','actualDay']);assert.deepEqual(plain(configured.sort),{column:'site',direction:'asc'});
assert.equal(selectStatusReview(reviewSummary,{scope:'all',month:'2',category:'3'}).total,1);
assert.equal(selectStatusReview(reviewSummary,{scope:'all',month:null,category:null}).total,6);
const reversed=selectStatusReview(summarize([...reviewRows].reverse(),today,true),{scope:'all',sort:{column:'plannedDay',direction:'asc'}});
assert.deepEqual(ids(reversed.records),ids(selectStatusReview(reviewSummary,{scope:'all',sort:{column:'plannedDay',direction:'asc'}}).records));
console.log('PASS: year/reference-day separation, calendar formatting/date priority, retained cross-site evidence, exclusive coverage, full evidence records, exact drilldowns, deterministic sorting and selected columns.');
