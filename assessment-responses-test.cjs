const assert=require('node:assert/strict'),a=require('./assessment-responses'),c=require('./changes'),dispatch=require('./dispatch-details');
const change={ChangeID:'C-1',ChangeStatus:'In Progress',ChangeResponseDue:'2026-01-01'},link={...change,EventName:'E-1',EventQMS:'CR1',ChangeQMS:'CR1',AppID:'A1',ROID:'R1'};
const rows=[
 {...change,ExpectedResponseID:'opaque-hu',ExpectedResponseCountry:'Hungary'},
 {...change,ExpectedResponseID:'opaque-mx',ExpectedResponseCountry:'Mexico'},
 {...change,ExpectedResponseID:'opaque-pe',ExpectedResponseCountry:'Peru'},
 {...change,ExpectedResponseID:'opaque-co',ExpectedResponseCountry:'Colombia'},
 {...change,AssessmentResponseID:'OPAQUE-HU ',AssessmentCountry:'Hungary response label',AssessmentTimeline:'1 month',AssessmentDocumentation:'HU certificate\nHU form'},
 {...change,AssessmentResponseID:'opaque-mx',AssessmentCountry:'Mexico',AssessmentTimeline:'6–8 months',AssessmentMOHFiling:'Not required',AssessmentDocumentation:'MX letter'},
 {...change,AssessmentResponseID:'opaque-co',AssessmentCountry:'Colombia',AssessmentTimeline:'N/A',AssessmentMOHFiling:'Product not commercialized'},
 {...link,SubID:'S-H1',Country:'Hungary',ActualDispatch:'2026-09-01',ActualSubmission:'2026-09-10',ActualApproval:'2026-10-15'},
 {...link,SubID:'S-H2',Country:'Hungary',SubStatus:'Planned',DispatchRequired:true,LatestDispatch:'2026-09-01',ActualDispatch:null,LatestSubmission:'2026-11-01'},
 {...link,SubID:'S-M1',Country:'Mexico',ActualDispatch:'2026-09-15',ActualSubmission:'2026-10-01'},
];
const progress=()=>a.progress([...rows,...rows],{now:'2026-10-06',dispatchSummaries:dispatch.analyze(rows,{now:'2026-10-06'})});
let p=progress();assert.equal(p.length,4);assert.equal(p.find(x=>x.country==='Hungary').dispatched,1);assert.equal(p.find(x=>x.country==='Hungary').submissions.length,2);assert.match(p.find(x=>x.country==='Hungary').attention,/past dispatch target/);assert.equal(p.find(x=>x.country==='Peru').response,'Awaiting response');assert.match(p.find(x=>x.country==='Peru').attention,/past due/);assert.equal(p.find(x=>x.country==='Mexico').dispatched,1);assert.equal(p.find(x=>x.country==='Colombia').submissions.length,0);assert.equal(p.find(x=>x.country==='Hungary').docs[0],'HU certificate\nHU form');
const source=c.index(rows),h=rows.filter(r=>r.SubID==='S-H1');let estimate=c.submissionSurvey(h,source);assert.equal(estimate.length,1);assert.equal(estimate[0].start,Date.UTC(2026,8,10)+30*86400000);assert.equal(estimate[0].anchorLabel,'Actual submission');assert.equal(c.countryResponses(h,source)[0].AssessmentCountry,'Hungary');assert.equal(c.countryResponses(h,source)[0].AssessmentDocumentation,'HU certificate\nHU form');
const planned=c.submissionSurvey(rows.filter(r=>r.SubID==='S-H2'),source)[0];assert.equal(planned.anchorLabel,'Latest submission plan');assert.equal(planned.start,Date.UTC(2026,10,1)+30*86400000);
assert.equal(c.submissionSurvey(h.map(r=>({...r,ActualSubmission:null,LatestSubmission:null,OriginalSubmission:null})),source)[0].start,null,'Dispatch does not anchor approval range');
assert.equal(c.submissionSurvey([...h,{...h[0],ActualSubmission:'2026-09-11'}],source)[0].start,null,'Conflicting submission anchors withheld');
assert.equal(c.submissionSurvey(h.map(r=>({...r,ActualSubmission:'invalid'})),source)[0].start,null);
assert.equal(c.submissionSurvey(h.map(r=>({...r,EventQMS:'mismatch'})),source).length,0,'No invented event-change link');
let bad=a.resolve([{...change,ExpectedResponseID:'X',ExpectedResponseCountry:'Hungary'},{...change,AssessmentResponseID:'Y',AssessmentCountry:'Hungary',AssessmentTimeline:'1 month'}]);assert.equal(bad.length,2);assert.equal(bad.filter(x=>x.returned).length,0,'Same country never overrides conflicting keys');
bad=a.resolve([{...change,ExpectedResponseID:'X',ExpectedResponseCountry:'Hungary'},{...change,ExpectedResponseID:'X',ExpectedResponseCountry:'Mexico'},{...change,AssessmentResponseID:'X',AssessmentTimeline:'1 month'}]);assert.match(bad[0].issue,/Conflicting/);assert.equal(bad[0].returned,false);
bad=a.resolve([{...change,ExpectedResponseID:'X',ExpectedResponseCountry:'Hungary'},{...change,ChangeID:'C-2',AssessmentResponseID:'X',AssessmentCountry:'Hungary'}]);assert.equal(bad.filter(x=>x.returned).length,0,'Keys cannot join across changes');
for(const actual of ['bad','2099-01-01',null]){const q=a.progress(rows.map(r=>r.SubID==='S-M1'?{...r,ActualDispatch:actual,ActualApproval:'2026-10-01',SubStatus:'Completed'}:r),{now:'2026-10-06'}).find(x=>x.country==='Mexico');assert.equal(q.dispatched,0,'Approval and Completed cannot invent actual dispatch');}
const conflicting=a.progress([...rows,{...rows.at(-1),ActualDispatch:'2026-09-16'}],{now:'2026-10-06'}).find(x=>x.country==='Mexico');assert.equal(conflicting.dispatched,0);assert.match(conflicting.attention,/Check actual/);
console.log('PASS: opaque expected/response IDs, parent-only response rows, pending countries, duplicate memberships, cross-change isolation, exact dispatch progress, priority evidence, submission-to-approval ranges and missing/conflicting inputs.');
module.exports=rows;
