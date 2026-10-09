const assert=require('node:assert/strict');
module.exports=async function checkRegistration(page,scope=page){
 const fixture=await page.evaluate(()=>{
  const now=new Date(),y=now.getFullYear(),m=now.getMonth(),date=(offset,day)=>new Date(Date.UTC(y,m+offset,day)).toISOString().slice(0,10);
  const base={Site:'ABO',BusinessUnit:'ID',PlannedSubmission:date(0,1),ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'Yes',PlannedDispatch:date(-1,1),ActualDispatch:null};
  const reg=(id,state,patch={})=>({...base,SubID:id,RegistrationID:'REG-'+id,RegistrationCountry:'Ireland',RegistrationStatus:state,RegistrationStart:date(-1,1),RegistrationEnd:date(12,1),FallbackCountry:'France',...patch});
  return ['Approved','Conditionally Approved','Canceled','Expired','Planned','Rejected','Withdrawn'].map(state=>reg(state,state)).concat([
   {...base,SubID:'NO-REG',FallbackCountry:'Germany'},reg('ID-ONLY',''),reg('COUNTRY-ONLY','',{RegistrationID:''}),
   reg('NO-BORROW','Planned'),reg('NO-BORROW','Approved',{RegistrationID:''}),
   reg('MULTI','Approved',{RegistrationID:'REG-M1'}),reg('MULTI','Planned',{RegistrationID:'REG-M2',RegistrationCountry:'Spain'}),
   reg('BAD-DATE','Approved',{RegistrationStart:'bad source date'}),
   reg('OLD-APPROVED','Approved',{PlannedSubmission:date(-1,1)}),reg('OLD-PLANNED','Planned',{PlannedSubmission:date(-1,1)})
  ]);
 });
 const send=(rows,omit=[])=>page.evaluate(({rows,omit})=>window.send?window.send(rows,omit):testApi.send(rows,{omit}),{rows:rows.flatMap(row=>[row,row]),omit});
 const close=async()=>{const button=scope.getByRole('button',{name:'Close details',exact:true});if(await button.count())await button.click();};
 const metric=name=>scope.locator('.ssMetricHit[data-scope=plan][data-metric='+name+']');
 const ids=()=>scope.locator('.ssDetails tbody tr td:first-child').allTextContents();
 const getRow=id=>scope.locator('.ssDetails tbody tr').filter({has:page.locator('td:first-child').filter({hasText:new RegExp('^'+id+'$')})});
 await send(fixture);
 assert.match(await scope.locator('svg').getAttribute('aria-label'),/13 planned, 9 in process, 4 submitted/);
 assert.match(await scope.locator('svg').getAttribute('aria-label'),/1 overdue backlog/);
 await metric('submitted').click();assert.deepEqual((await ids()).sort(),['Approved','BAD-DATE','Conditionally Approved','MULTI']);
 assert.match(await getRow('Approved').locator('.ssAttention').textContent(),/Registration approval recorded.*REG-Approved.*Approved/);
 assert.match(await getRow('Approved').textContent(),/Submitted · Registration approval/);
 assert.match(await getRow('Approved').locator('.ssCountry').textContent(),/IrelandRegistration country/);
 assert.equal(await getRow('MULTI').locator('.ssRegistration').count(),2);
 assert.match(await getRow('MULTI').locator('.ssCountry').textContent(),/Ireland \/ Spain/);
 assert.match(await getRow('BAD-DATE').locator('.ssAttention').textContent(),/Check registration details/);
 assert.match(await getRow('BAD-DATE').locator('.ssRegistration').textContent(),/bad source date/);
 await page.evaluate(()=>{window.registrationCopies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>registrationCopies.push(value)}})});
 await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.deepEqual((await page.evaluate(()=>registrationCopies.at(-1))).split('\n').sort(),['Approved','BAD-DATE','Conditionally Approved','MULTI']);
 await close();await metric('planned').click();
 const allIds=await ids();assert.equal(new Set(allIds).size,13);
 assert.match(await getRow('NO-REG').locator('.ssCountry').textContent(),/GermanySecondary country/);
 assert.equal(await getRow('NO-REG').locator('.ssRegistration').count(),0);
 await scope.getByRole('textbox',{name:'Find submission',exact:true}).fill('Germany');await scope.getByRole('textbox',{name:'Find submission',exact:true}).press('Tab');assert.deepEqual(await ids(),['NO-REG']);
 await close();await metric('overdue').click();assert.equal((await ids()).length,9);assert.ok(!(await ids()).includes('Approved'));await close();
 await scope.locator('.ssBacklogHit[data-site="*"]').click();assert.deepEqual(await ids(),['OLD-PLANNED']);await close();
 await send(fixture,['RegistrationID']);assert.match(await scope.locator('svg').getAttribute('aria-label'),/13 planned, 13 in process, 0 submitted/);
 await send(fixture,['RegistrationStatus']);assert.match(await scope.locator('svg').getAttribute('aria-label'),/13 planned, 13 in process, 0 submitted/);
 await send(fixture,['RegistrationCountry']);await metric('planned').click();assert.match(await getRow('Approved').locator('.ssCountry').textContent(),/FranceSecondary country/);await close();
 await send(fixture,['RegistrationID','RegistrationStatus','RegistrationStart','RegistrationEnd','RegistrationCountry','FallbackCountry']);await metric('planned').click();assert.equal(await scope.locator('.ssRegistrations').count(),0);assert.equal(await scope.locator('.ssCountry').count(),0);await close();
 await send(fixture);await metric('submitted').click();
 const before=(await ids()).sort();await send(fixture.map(row=>({...row,RegistrationStatus:'Planned'})));assert.match(await scope.locator('.ssDetails').textContent(),/No matching submissions/);await close();await send(fixture);await metric('submitted').click();assert.deepEqual((await ids()).sort(),before);await close();
 const outside=await scope.locator('svg').evaluate(svg=>{const b=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].filter(n=>{const r=n.getBBox();return r.x<0||r.x+r.width>b.width+1||r.y+r.height>b.height+1}).map(n=>n.textContent)});assert.deepEqual(outside,[]);
};
