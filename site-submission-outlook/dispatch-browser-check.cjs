const assert=require('node:assert/strict');
module.exports=async function checkDispatch(page,scope=page) {
  const fixture=await page.evaluate(()=>{
    const now=new Date(),y=now.getFullYear(),m=now.getMonth(),d=now.getDate(),date=(offset,day)=>new Date(Date.UTC(y,m+offset,day)).toISOString().slice(0,10);
    const base={Site:'ABO',BusinessUnit:'ID',PlannedSubmission:date(1,10),ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'Yes',PlannedDispatch:date(0,d-1),ActualDispatch:null};
    return [
      ...Array.from({length:63},(_,i)=>({...base,SubID:'INTERNAL-'+String(i).padStart(3,'0'),Site:i%2?'ADJ':'ABO'})),
      ...Array.from({length:5},(_,i)=>({...base,SubID:'AUTHORITY-'+i,DispatchRequired:'No',PlannedSubmission:date(0,d-1),PlannedDispatch:null})),
      {...base,SubID:'ALREADY-DISPATCHED',PlannedSubmission:date(0,d-1),ActualDispatch:date(0,d-1)},
      {...base,SubID:'UNKNOWN',DispatchRequired:null,PlannedDispatch:null,PlannedSubmission:date(0,d-1)},
      {...base,SubID:'MISSING-DISPATCH-PLAN',PlannedDispatch:null,PlannedSubmission:date(0,d-1)},
      {...base,SubID:'COMPLETED',SubStatus:'Completed'},
      {...base,SubID:'APPROVED',ROStatus:'Health Authority Approved'},
      {...base,SubID:'NOT-YET',PlannedDispatch:date(0,d+1)}
    ];
  });
  const send=async rows=>page.evaluate(rows=>{const send=window.send||window.testApi.send;send(rows.flatMap(r=>[r,r]));},rows);
  await send(fixture);
  const card=key=>scope.locator(`.ssOverdueHit[data-group=${key}]`);
  assert.match(await card('all').getAttribute('aria-label'),/71/);
  assert.match(await card('internal').getAttribute('aria-label'),/63/);
  assert.match(await card('authority').getAttribute('aria-label'),/6/);
  assert.match(await card('unclassified').getAttribute('aria-label'),/2/);
  await card('internal').focus();await page.keyboard.press('Enter');
  assert.match(await scope.locator('.ssDetails h3').textContent(),/Internal dispatch overdue/);
  assert.match(await scope.locator('.ssDetails').textContent(),/Showing 1–50 of 63/);
  assert.ok((await scope.locator('thead').textContent()).includes('Dispatch required'));
  assert.ok((await scope.locator('thead').textContent()).includes('Planned dispatch'));
  assert.ok((await scope.locator('thead').textContent()).includes('Actual dispatch'));
  await page.evaluate(()=>{window.dispatchCopies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>dispatchCopies.push(value)}})});
  await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>dispatchCopies.at(-1).split('\n')),fixture.filter(r=>r.SubID.startsWith('INTERNAL-')).map(r=>r.SubID));
  await scope.getByRole('combobox',{name:'Details site',exact:true}).selectOption('ADJ');
  assert.match(await scope.locator('.ssDetails').textContent(),/Showing 1–31 of 31/);
  await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.equal(await page.evaluate(()=>dispatchCopies.at(-1).split('\n').length),31);
  await scope.getByRole('combobox',{name:'Details site',exact:true}).selectOption('*');
  await scope.getByRole('button',{name:'Next',exact:true}).click();assert.match(await scope.locator('.ssDetails').textContent(),/Showing 51–63 of 63/);
  await scope.getByRole('button',{name:'Close details'}).click();
  await card('authority').click();assert.equal(await scope.locator('tbody tr').count(),6);assert.match(await scope.locator('tbody').textContent(),/Awaiting authority submission/);
  assert.ok(!(await scope.locator('tbody').textContent()).includes('INTERNAL-'));await scope.getByRole('button',{name:'Close details'}).click();
  await card('unclassified').click();assert.deepEqual((await scope.locator('tbody tr td:first-child').allTextContents()).sort(),['MISSING-DISPATCH-PLAN','UNKNOWN']);await scope.getByRole('button',{name:'Close details'}).click();
  // A dispatch record must remove the same ID from internal delay immediately;
  // the still-future submission plan does not create a late authority submission.
  await send(fixture.map(r=>r.SubID==='INTERNAL-000'?{...r,ActualDispatch:r.PlannedDispatch}:r));
  assert.match(await card('internal').getAttribute('aria-label'),/62/);assert.match(await card('authority').getAttribute('aria-label'),/6/);assert.match(await card('all').getAttribute('aria-label'),/70/);
  await send(fixture.map(r=>r.SubID==='INTERNAL-000'?{...r,ActualDispatch:r.PlannedDispatch,PlannedSubmission:r.PlannedDispatch}:r));
  assert.match(await card('internal').getAttribute('aria-label'),/62/);assert.match(await card('authority').getAttribute('aria-label'),/7/);assert.match(await card('all').getAttribute('aria-label'),/71/);
  await send(fixture);
  await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();
  await scope.getByRole('button',{name:'Clear Submission state values',exact:true}).click();await scope.getByRole('checkbox',{name:'Include Completed in Submission state',exact:true}).check();
  assert.match(await card('all').getAttribute('aria-label'),/0/);
  await scope.getByRole('button',{name:'All Submission state values',exact:true}).click();await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();
  assert.match(await card('all').getAttribute('aria-label'),/71/);
  await card('all').click();await scope.getByRole('combobox',{name:'Dispatch stage',exact:true}).selectOption('Pending internal dispatch');
  // The record with an unknown dispatch due date is in the review overdue group,
  // but its recorded next action is still internal dispatch.
  assert.match(await scope.locator('.ssDetails').textContent(),/of 64/);
  await scope.getByRole('textbox',{name:'Find submission'}).fill('MISSING-DISPATCH');
  await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.equal(await page.evaluate(()=>dispatchCopies.at(-1)),'MISSING-DISPATCH-PLAN');
  await scope.getByRole('button',{name:'Close details'}).click();
  for(const theme of ['dark','light']) {
    await scope.getByRole('combobox',{name:'Theme'}).selectOption(theme);
    const outside=await scope.locator('svg').evaluate(svg=>{const b=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].filter(n=>{const r=n.getBBox();return r.x<0||r.x+r.width>b.width+1||r.y+r.height>b.height+1}).map(n=>n.textContent)});
    assert.deepEqual(outside,[]);
  }
  return fixture;
};
