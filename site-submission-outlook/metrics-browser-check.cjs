const assert=require('node:assert/strict');
module.exports=async function checkMetrics(page,scope=page,{compact=false}={}) {
 const originalTime=await page.evaluate(()=>Date.now());
 await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
 const base={Site:'ABO',BusinessUnit:'ID',PlannedSubmission:'2026-10-20',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'No',PlannedDispatch:null,ActualDispatch:null};
 const record=(SubID,patch={})=>({...base,SubID,...patch});
 const internal=Array.from({length:63},(_,i)=>record('PLAN-INTERNAL-'+String(i).padStart(3,'0'),{Site:i%2?'ADJ':'ABO',PlannedSubmission:'2026-11-20',DispatchRequired:'Yes',PlannedDispatch:'2026-10-05'}));
 const authority=Array.from({length:3},(_,i)=>record('PLAN-AUTHORITY-'+i,{PlannedSubmission:'2026-10-05'}));
 const future=[record('PLAN-NOT-DUE'),record('PLAN-NEXT-NOT-DUE',{PlannedSubmission:'2026-11-25'})];
 const submitted=[record('PLAN-COMPLETE',{SubStatus:'Completed'}),record('PLAN-RECEIVED',{SubStatus:'HA Received'}),record('PLAN-ACTUAL',{SubStatus:'Planned',ActualSubmission:'2026-10-02',BusinessUnit:'CMI'}),record('PLAN-REJECTED',{SubStatus:'Rejected'})];
 const review=[record('PLAN-BAD-DATE',{ActualSubmission:'bad'}),record('PLAN-FUTURE-DATE',{ActualSubmission:'2026-10-30'})];
 const planned=[...internal,...authority,...future,...submitted,...review],rows=[...planned,
   record('OLD-INTERNAL',{PlannedSubmission:'2026-09-20',DispatchRequired:'Yes',PlannedDispatch:'2026-09-05'}),record('OLD-AUTHORITY',{PlannedSubmission:'2026-09-20'}),
   record('LATER-INTERNAL',{PlannedSubmission:'2026-12-20',DispatchRequired:'Yes',PlannedDispatch:'2026-10-05'}),record('NO-PLAN',{PlannedSubmission:null,DispatchRequired:'Yes',PlannedDispatch:'2026-10-05'}),
   record('CLOSED-OLD',{PlannedSubmission:'2026-09-20',SubStatus:'Completed'}),record('OTHER-SITE',{Site:'OTHER'}),record('')];
 const send=async data=>page.evaluate(data=>(window.send||window.testApi.send)(data.flatMap(r=>r.SubID?[r,r]:[r])),data);
 await send(rows);
 await page.evaluate(()=>{window.metricCopies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>metricCopies.push(value)}})});
 const metric=key=>scope.locator(`.ssMetricHit[data-scope=plan][data-metric=${key}]`);
 const copied=async()=>{await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();return (await page.evaluate(()=>metricCopies.at(-1))).split('\n').sort();};
 const ids=values=>values.map(r=>r.SubID).sort();
 const close=async()=>scope.getByRole('button',{name:'Close details',exact:true}).click();
 const cases=[['planned',planned],['inProcess',[...internal,...authority,...future]],['submitted',submitted],['completion',submitted],['overdue',[...internal,...authority]],...(!compact?[['review',review]]:[])];
 for(const [key,values] of cases) {
   await metric(key).click();
   assert.deepEqual(await copied(),ids(values),key);
   assert.match(await scope.locator('.ssPager').textContent(),new RegExp('of '+values.length));
   assert.equal(await scope.locator('.ssDetails h3').evaluate(node=>document.activeElement===node),false); // Copy moved focus to the selected IDs.
   if(key==='completion')assert.match(await scope.locator('.ssDetails').textContent(),/4 of 74 planned submissions.*5%/);
   if(key==='overdue')assert.match(await scope.locator('.ssDetails').textContent(),/Earlier backlog and later submission plans are excluded/);
   assert.equal(await scope.locator('th').nth(1).textContent(),'Main issue / next action');
   if(key==='overdue')assert.match(await scope.locator('tbody tr').filter({hasText:'PLAN-INTERNAL-000'}).locator('.ssAttention').textContent(),/Internal dispatch overdue.*05 Oct 2026.*Complete internal dispatch/);
   if(key==='submitted')assert.match(await scope.locator('tbody tr').filter({hasText:'PLAN-REJECTED'}).locator('.ssAttention').textContent(),/Health authority rejection/);
   if(key==='review')assert.match(await scope.locator('tbody tr').first().locator('.ssAttention').textContent(),/Check actual submission date/);
   await close();
 }
 // Prior detail filters and pagination must not silently shrink a newly clicked count.
 await metric('overdue').focus();await page.keyboard.press('Enter');
 assert.equal(await scope.locator('.ssDetails h3').evaluate(n=>document.activeElement===n),true);
 await scope.getByRole('button',{name:'Next',exact:true}).click();assert.match(await scope.locator('.ssPager').textContent(),/51–66 of 66/);
 await scope.getByRole('combobox',{name:'Details site',exact:true}).selectOption('ADJ');assert.deepEqual(await copied(),ids(internal.filter(r=>r.Site==='ADJ')));
 await scope.getByRole('combobox',{name:'Dispatch stage',exact:true}).selectOption('Awaiting authority submission');assert.match(await scope.locator('.ssDetails').textContent(),/No matching submissions/);
 await scope.getByRole('textbox',{name:'Find submission',exact:true}).fill('nonexistent');await scope.getByRole('textbox',{name:'Find submission',exact:true}).press('Tab');
 await metric('planned').click();assert.deepEqual(await copied(),ids(planned));assert.match(await scope.locator('.ssPager').textContent(),/1–50 of 74/);await close();
 // Click the actual coloured segments, including their visible number; the total
 // label above each bar must still open the whole site/month cohort.
 const segment=key=>scope.locator(`.ssSegmentHit[data-site=ABO][data-month="2026-10"][data-metric=${key}]`);
 for(const [key,values] of [['inProcess',[...authority,future[0]]],['submitted',submitted],['review',review]]) {
   await segment(key).click();assert.deepEqual(await copied(),ids(values),key);await close();
 }
 await scope.locator('.ssHit[data-site=ABO][data-month="2026-10"]').click();assert.deepEqual(await copied(),ids([...authority,future[0],...submitted,...review]));await close();
 for(const [group,values] of [['outsideSites',['OTHER-SITE']],['outsideMonths',['CLOSED-OLD','LATER-INTERNAL']]]) {
   await scope.locator(`.ssCoverageCount[data-group=${group}]`).click();assert.deepEqual(await copied(),values);await close();
 }
  await scope.locator('.ssCoverageCount[data-group=missingIds]').click();assert.equal(await scope.locator('tbody tr').count(),1);assert.equal(await scope.locator('tbody td').first().textContent(),'Not recorded');assert.equal(await scope.getByRole('button',{name:'Copy IDs',exact:true}).isDisabled(),true);await close();
  await scope.getByRole('button',{name:'Data checks · 4',exact:true}).click();assert.equal(await scope.locator('tbody tr').count(),4);assert.deepEqual(await copied(),['NO-PLAN','PLAN-BAD-DATE','PLAN-FUTURE-DATE']);await close();
 // A summary is always calculated within the active business-unit and state scope.
 await scope.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('CMI');await metric('planned').click();assert.deepEqual(await copied(),['PLAN-ACTUAL']);await close();
 await metric('overdue').click();assert.match(await scope.locator('.ssDetails').textContent(),/No matching submissions/);assert.equal(await scope.getByRole('button',{name:'Copy IDs',exact:true}).isDisabled(),true);await close();
 await scope.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');
 await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();await scope.getByRole('button',{name:'Clear Submission state values',exact:true}).click();await scope.getByRole('checkbox',{name:'Include HA Received in Submission state',exact:true}).check();
 await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();await metric('planned').click();assert.deepEqual(await copied(),['PLAN-RECEIVED']);await close();
 await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();await scope.getByRole('button',{name:'All Submission state values',exact:true}).click();await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();
 await metric('overdue').click();await send(rows.map(r=>({...r,SubStatus:'Completed'})));assert.match(await scope.locator('.ssDetails').textContent(),/No matching submissions/);await close();await send(rows);
 await scope.getByRole('button',{name:'Screenshot mode',exact:true}).click();await metric('overdue').click();assert.equal(await scope.locator('.siteSubmissions.capture').count(),0);assert.equal(await scope.locator('.ssDetails').isVisible(),true);assert.equal(await scope.locator('.ssDetails h3').evaluate(n=>document.activeElement===n),true);await close();
 const outside=await scope.locator('svg').evaluate(svg=>{const b=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].filter(n=>{const r=n.getBBox();return r.x<0||r.x+r.width>b.width+1||r.y+r.height>b.height+1}).map(n=>n.textContent)});assert.deepEqual(outside,[]);
 await page.clock.setFixedTime(new Date(originalTime));
};
