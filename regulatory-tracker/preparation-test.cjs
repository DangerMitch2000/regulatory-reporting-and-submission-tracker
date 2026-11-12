const assert=require('node:assert/strict'),prep=require('./preparation'),dispatchDetails=require('./dispatch-details'),vega=require('./vega-test-setup.cjs');
const day=s=>Date.parse(s+'T00:00:00Z');const base={AppID:'APP',ROID:'RO',SubID:'S1',Country:'Mexico',LMPrepDuration:'1 month',DispatchRequired:true,LatestDispatch:'2026-03-31',OriginalDispatch:'2026-02-01',SubStatus:'Planned'};
const now=new Date('2026-10-23T12:00:00Z'),estimate=(rows,options={})=>prep.analyze(rows,{now,...options}).get('S1');
assert.equal(estimate([{...base,LMPrepDuration:'2 months'}]).calendarDays,60);assert.equal(estimate([base]).start,day('2026-03-01'));assert.equal(estimate([{...base,LatestDispatch:'2024-03-31'}]).start,day('2024-03-01'));
assert.equal(estimate([{...base,LatestDispatch:null}]).end,day('2026-02-01'));
assert.equal(estimate([base]).anchorField,'LatestDispatch');assert.equal(estimate([base]).anchor,'Latest dispatch plan');assert.equal(estimate([{...base,LatestDispatch:null}]).anchorField,'OriginalDispatch');
for(const change of [{LatestDispatch:'bad'},{LMPrepDuration:'1-2 months'},{LMPrepDuration:2},{AppID:''},{DispatchRequired:false}])assert.notEqual(estimate([{...base,...change}]).status,'estimated');
assert.equal(estimate([{...base,DispatchRequired:null}]).status,'estimated');assert.equal(estimate([base,{...base,LMPrepDuration:'2 months'}]).status,'unavailable');
const sibling={...base,SubID:'S2',Country:'Peru',LMPrepDuration:null,LatestDispatch:'2026-05-31'};const inherited=prep.analyze([base,sibling]);assert.equal(inherited.get('S2').start,day('2026-05-01'));assert.equal(prep.analyze([base],{mappedFields:['AppID','SubID']}).get('S1').status,'unavailable');
assert.equal(prep.analyze(Array.from({length:30000},()=>({...base}))).size,1);

// Earlier or later recorded dispatch anchors the allowance independently of plans.
for(const actual of ['2026-02-15','2026-04-15']){
 const result=estimate([{...base,ActualDispatch:actual}]);assert.equal(result.status,'estimated');assert.equal(result.end,day(actual));assert.equal(result.start,day(actual)-30*86400000);assert.equal(result.calendarDays,30);assert.equal(result.anchor,'Actual dispatch');assert.equal(result.anchorField,'ActualDispatch');assert.match(result.reason,/not actual preparation activity/);
}
const dispatched={...base,ActualDispatch:'2026-04-15'};
for(const plans of [{LatestDispatch:null,OriginalDispatch:null},{LatestDispatch:'bad',OriginalDispatch:'bad'},{LatestDispatch:undefined,OriginalDispatch:undefined}]){
 const result=estimate([{...dispatched,...plans}]);assert.equal(result.status,'estimated','Usable actual dispatch does not depend on usable plans');assert.equal(result.end,day('2026-04-15'));
}
assert.equal(estimate([dispatched,{...dispatched,LatestDispatch:'2026-06-01',OriginalDispatch:'2026-01-01'}]).end,day('2026-04-15'),'Conflicting plans do not displace a consistent actual dispatch');
assert.equal(estimate([dispatched],{mappedFields:['AppID','SubID','LMPrepDuration','DispatchRequired','ActualDispatch']}).end,day('2026-04-15'),'Actual dispatch does not require mapped plans');
for(const ActualDispatch of [null,undefined,''])assert.equal(estimate([{...base,ActualDispatch}]).anchorField,'LatestDispatch','Only absent actual evidence falls back to a plan');
const withoutActual=Object.keys(dispatched).filter(field=>field!=='ActualDispatch');assert.equal(estimate([{...base,ActualDispatch:'bad'}],{mappedFields:withoutActual}).anchorField,'LatestDispatch','An unmapped actual role uses the planned fallback');
assert.equal(estimate([{...base,ActualDispatch:null,LatestDispatch:'bad'}],{mappedFields:withoutActual.filter(field=>field!=='LatestDispatch')}).anchorField,'OriginalDispatch','Unmapped latest plan can fall back to original');

for(const actual of ['bad','2026-02-30','1899-12-31','2101-01-01']){
 const result=estimate([{...base,ActualDispatch:actual}]);assert.equal(result.status,'unavailable');assert.equal(result.start,null);assert.equal(result.end,null);assert.match(result.reason,/Actual dispatch date is invalid or conflicting/,'Invalid actual evidence never silently falls back to a plan');
}
const conflict=estimate([dispatched,{...dispatched,ActualDispatch:'2026-04-16'}]);assert.equal(conflict.status,'unavailable');assert.equal(conflict.end,null);assert.match(conflict.reason,/Actual dispatch.*conflicting/);
const future=estimate([{...base,ActualDispatch:'2026-10-24'}]);assert.equal(future.status,'unavailable');assert.equal(future.end,null);assert.match(future.reason,/future/);assert.equal(estimate([{...base,ActualDispatch:'2026-10-23'}]).status,'estimated','Actual dispatch on the as-of calendar day remains usable');
const duplicates=[{...dispatched,ActualDispatch:'2026-04-15T00:30:00+14:00'},{...dispatched,ActualDispatch:'2026-04-15T23:30:00-12:00'},dispatched],before=JSON.stringify(duplicates),deduplicated=prep.analyze(duplicates,{now});assert.equal(deduplicated.size,1);assert.equal(deduplicated.get('S1').end,day('2026-04-15'),'Repeated written calendar days do not create a false conflict');assert.equal(JSON.stringify(duplicates),before,'Source dates and plans remain unchanged');
const actualSibling={...sibling,ActualDispatch:'2026-04-20'},actualInherited=prep.analyze([dispatched,actualSibling],{now});assert.equal(actualInherited.get('S2').duration,'1 month');assert.equal(actualInherited.get('S2').end,day('2026-04-20'),'Sibling inherits the application allowance but keeps its own actual endpoint');
assert.equal(estimate([{...dispatched,DispatchRequired:false}]).status,'not-required','An actual date does not override explicit dispatch-not-required suppression');assert.equal(estimate([dispatched,{...dispatched,DispatchRequired:false}]).status,'unavailable','Conflicting dispatch requirements remain withheld');
const summary=dispatchDetails.analyze([dispatched],{now}),plannedTarget=summary.get('S1').target;assert.equal(estimate([dispatched],{dispatchSummaries:summary}).end,day('2026-04-15'));assert.equal(summary.get('S1').target,plannedTarget);assert.equal(plannedTarget.day,day('2026-03-31'),'Dispatch target semantics remain planned for timing comparisons');

(async()=>{
 const spec=require('./timeline.json');
 for(const source of [base,dispatched]){
  const p=estimate([source]),row={...source,OriginalDispatch:day('2026-02-01'),LatestDispatch:day('2026-03-31'),ActualDispatch:source.ActualDispatch?day(source.ActualDispatch):null,LMPrepStart:p.start,LMPrepEnd:p.end,LMPrepLabel:p.duration,LMPrepStatus:p.status,LMPrepAnchor:p.anchor,LMPrepAnchorField:p.anchorField};
  const view=new vega.View(vega.parse(spec),{renderer:'none'});try{
   view.change('dataset',vega.changeset().insert([row,{...row,Product:'duplicate'}]));view.signal('mode','Compare');await view.runAsync();view.signal('range',null);await view.runAsync();
   assert.equal(view.data('preparationWindows').length,1);assert.equal(view.data('sub').length,1);assert.equal(view.data('apps')[0].start,day('2026-02-01'),'Preparation anchoring does not rewrite parent lifecycle dates');
   const window=view.data('preparationWindows')[0];assert.equal(window.LMPrepEnd,p.end);assert.equal(window.LMPrepStart,p.start);assert.ok((await view.toSVG()).includes('LM prep'));
   view.signal('themeMode','light');await view.runAsync();assert.ok((await view.toSVG()).includes('#6752b4'));
   view.signal('axisMode','Elapsed days');await view.runAsync();assert.equal(view.data('preparationWindows').length,0,'Calendar preparation allowance is not mistaken for elapsed processing geometry');
  }finally{view.finalize();}
 }
 // Switching axis coordinates must never overwrite the folded calendar dates.
 // Use all nine milestones, six connectors and repeated trips so a single successful first
 // elapsed render cannot hide a later mutation of source or plotting values.
 {
  const dates={OriginalDispatch:day('2026-02-01'),LatestDispatch:day('2026-03-31'),ActualDispatch:day('2026-04-15'),OriginalSubmission:day('2026-02-10'),LatestSubmission:day('2026-04-05'),ActualSubmission:day('2026-04-20'),OriginalApproval:day('2026-03-15'),LatestApproval:day('2026-05-01'),ActualApproval:day('2026-05-10')};
  const source={...base,...dates},sourceBefore=JSON.stringify(source),p=estimate([source]),row={...source,LMPrepStart:p.start,LMPrepEnd:p.end,LMPrepLabel:p.duration,LMPrepStatus:p.status,LMPrepAnchor:p.anchor,LMPrepAnchorField:p.anchorField},input=[row,{...row,Product:'duplicate'}];
  const pickDates=r=>Object.fromEntries(Object.keys(dates).map(field=>[field,r[field]])),originalInput=input.map(pickDates),view=new vega.View(vega.parse(spec),{renderer:'none'}),calendarRange=[day('2026-01-01'),day('2026-07-01')];
  const assertMilestones=elapsed=>{
   const milestones=view.data('milestones');assert.equal(milestones.length,9,'Every original, latest and actual milestone remains available');
   for(const [field,value]of Object.entries(dates)){
    const milestone=milestones.find(m=>m.milestone===field);assert.ok(milestone,field+' remains plotted');assert.equal(milestone.actualDate,value,field+' retains its original calendar value');assert.equal(milestone.date,elapsed?value-dates.ActualDispatch:value,field+' uses the correct coordinate system');
   }
   const segments=view.data('segments');assert.equal(segments.length,6,'Every original, latest and actual connector remains available');
   for(const [track,prefix]of ['Original','Latest','Actual'].entries()){
    for(const [from,to]of [['Dispatch','Submission'],['Submission','Approval']]){
     const a=prefix+from,b=prefix+to,segment=segments.find(s=>s.a===a&&s.b===b);assert.ok(segment,a+' to '+b+' remains connected');assert.equal(segment.track,track,prefix+' connector retains its track');
     assert.equal(segment.sourceDate1,dates[a],a+' connector source retains its original calendar value');assert.equal(segment.sourceDate2,dates[b],b+' connector source retains its original calendar value');
     assert.equal(segment.d1,elapsed?dates[a]-dates.ActualDispatch:dates[a],a+' connector start uses the correct coordinate system');assert.equal(segment.d2,elapsed?dates[b]-dates.ActualDispatch:dates[b],b+' connector end uses the correct coordinate system');
     assert.equal(segment.d1,milestones.find(m=>m.milestone===a).date,a+' connector starts at its milestone');assert.equal(segment.d2,milestones.find(m=>m.milestone===b).date,b+' connector ends at its milestone');
    }
   }
   assert.deepEqual(view.data('dataset').map(pickDates),originalInput,'Axis changes leave delivered source fields unchanged');assert.deepEqual(pickDates(view.data('sub')[0]),dates,'Resolved submission dates stay unchanged');assert.equal(JSON.stringify(source),sourceBefore);
  };
  try{
   view.change('dataset',vega.changeset().insert(input));view.signal('mode','Compare').signal('compareLevel',2);await view.runAsync();view.signal('range',calendarRange);await view.runAsync();assertMilestones(false);
   for(let round=0;round<3;round++){
    view.signal('axisMode','Elapsed days');await view.runAsync();view.signal('range',[-90*86400000,90*86400000]);await view.runAsync();assertMilestones(true);assert.equal(view.data('milestones').find(m=>m.milestone==='ActualDispatch').date,0,'Actual dispatch is exactly Day0 on every elapsed visit');assert.equal(view.data('preparationWindows').length,0,'Calendar preparation stays hidden in elapsed mode');
    view.signal('axisMode','Calendar');await view.runAsync();view.signal('range',calendarRange.slice());await view.runAsync();assertMilestones(false);assert.equal(view.data('preparationWindows').length,1,'Preparation returns with calendar coordinates');assert.equal(view.data('preparationWindows')[0].LMPrepEnd,dates.ActualDispatch,'Restored preparation ends at the original actual dispatch date');
   }
  }finally{view.finalize();}
 }
 console.log('Preparation: actual-first dispatch anchoring, planned fallback, invalid/conflicting/future withholding, fixed30-day months, inheritance,30k deduplication, source preservation, repeated calendar/elapsed milestone and connector roundtrips, Vega geometry and both themes passed');
})().catch(e=>{console.error(e);process.exit(1)});
