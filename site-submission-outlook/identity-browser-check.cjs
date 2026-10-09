const assert=require('node:assert/strict');

// Shared by the source harness and the downloaded Power BI package. All IDs are
// synthetic; intercepting copy keeps the test out of the user's clipboard.
module.exports=async function checkIdentity(page,scope=page){
 const originalTime=await page.evaluate(()=>Date.now());
 await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
 await page.evaluate(()=>{
  const visual=window.visual||window.testApi?.visual;
  window.identityCheckRestore={visual,values:{...visual},clipboard:Object.getOwnPropertyDescriptor(navigator,'clipboard'),userSelect:document.body.style.userSelect};
  window.identityWrites=[];window.identityNativeCopies=[];
  window.identityCopyListener=event=>{const node=document.activeElement;identityNativeCopies.push(node?.tagName==='TEXTAREA'?node.value.slice(node.selectionStart,node.selectionEnd):window.getSelection().toString());event.preventDefault();};
  document.addEventListener('copy',identityCopyListener);document.body.style.userSelect='none';
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>identityWrites.push(text)}});
 });
 const base={Site:'ABO',BusinessUnit:'ID',PlannedSubmission:'2026-10-01',ActualSubmission:null,SubStatus:'In Progress',ROStatus:'In Progress',AppStatus:'Active',DispatchRequired:'No',PlannedDispatch:null,ActualDispatch:null};
 const missing=Array.from({length:121},(_,i)=>({...base,SubID:'',ROID:'RO-M-'+String(Math.floor(i/2)).padStart(3,'0'),AppID:'APP-M-'+String(Math.floor(i/3)).padStart(3,'0'),BusinessUnit:i%3?'ID':'CMI',SubStatus:i%2?'In Progress':'Completed'}));
 missing.push({...missing[0]},{...base,SubID:'',ROID:'',AppID:''});
 const s1={...base,SubID:'SUB-1',ROID:'RO-SHARED',AppID:'APP-SHARED'};
 const known=[s1,{...s1},{...s1,ROID:'RO-OTHER',AppID:'APP-OTHER'},{...s1,SubID:'SUB-2'},{...base,SubID:'SUB-3',ROID:'RO-CMI',AppID:'APP-CMI',BusinessUnit:'CMI',SubStatus:'Completed'}];
 const rows=[...known,...missing];
 const send=(data,omit=[])=>page.evaluate(({data,omit})=>window.send?window.send(data,omit):testApi.send(data,{omit}),{data,omit});
 const close=async()=>{const button=scope.getByRole('button',{name:'Close details',exact:true});if(await button.count())await button.click();};
 const planned=()=>scope.locator('.ssMetricHit[data-scope=plan][data-metric=planned]').click();
 const openMissing=()=>scope.locator('.ssCoverageCount[data-group=missingIds]').click();
 const tableRows=()=>scope.locator('.ssDetails tbody tr');
 const row=id=>tableRows().filter({has:page.locator('td:first-child').filter({hasText:new RegExp('^'+id+'$')})});
 const search=()=>scope.getByRole('textbox',{name:'Find submission',exact:true});
 const allValues=(records,key)=>[...new Set(records.map(r=>r[key]).filter(Boolean))].sort();
 const copy=async(role,expected)=>{
  const cls=role==='ROID'?'.ssCopyROIDs':role==='AppID'?'.ssCopyAppIDs':'.ssCopyIDs';
  const label=role==='ROID'?'RO IDs to copy':role==='AppID'?'Application IDs to copy':'Submission IDs to copy';
  await scope.locator(cls).click();
  const box=scope.getByRole('textbox',{name:label,exact:true});
  const values=(await box.inputValue()).split('\n').filter(Boolean).sort();
  assert.deepEqual(values,expected.slice().sort(),role+' copies the exact matching values across all pages');
  assert.equal(await box.evaluate(node=>node.readOnly),true);
  assert.deepEqual((await page.evaluate(()=>identityWrites.at(-1))).split('\n').filter(Boolean).sort(),expected.slice().sort());
  return box;
 };
 const clearStateFilter=async()=>{
  await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();
  await scope.getByRole('button',{name:'All Submission state values',exact:true}).click();
  await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();
 };
 try{
  await close();
  await send(rows);
  await scope.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');
  await clearStateFilter();
  assert.match(await scope.locator('svg').getAttribute('aria-label'),/3 planned, 2 in process, 1 submitted/);
  assert.match(await scope.locator('svg').getAttribute('aria-label'),/0 overdue backlog/);
  await planned();
  assert.equal(await tableRows().count(),3,'shared parent IDs do not merge separate submissions');
  assert.equal(await scope.locator('.ssDetails th').nth(1).textContent(),'Main issue / next action');
  assert.equal(await scope.locator('.ssDetails th').nth(2).textContent(),'Related records');
  assert.equal(await row('SUB-1').locator('.ssRelatedRecord').count(),2,'duplicate source pairs collapse inside an identified submission');
  const pairs=await row('SUB-1').locator('.ssRelatedRecord').evaluateAll(cards=>cards.map(card=>[card.querySelector('[data-role=ROID]')?.textContent||'',card.querySelector('[data-role=AppID]')?.textContent||''].join('|')).sort());
  assert.deepEqual(pairs,['RO-OTHER|APP-OTHER','RO-SHARED|APP-SHARED']);
  assert.equal(await row('SUB-2').locator('.ssRelatedRecord').count(),1);
  assert.equal(await scope.locator('.ssRegistration').count(),0,'RO/application IDs remain usable with no registration');
  await copy('SubID',['SUB-1','SUB-2','SUB-3']);
  await copy('ROID',['RO-CMI','RO-OTHER','RO-SHARED']);
  await copy('AppID',['APP-CMI','APP-OTHER','APP-SHARED']);
  const individual=row('SUB-1').locator('.ssRelatedId[data-role=ROID]').filter({hasText:'RO-OTHER'});
  await individual.click();assert.equal(await page.evaluate(()=>window.getSelection().toString()),'RO-OTHER');
  await page.keyboard.press('Control+c');assert.equal(await page.evaluate(()=>identityNativeCopies.at(-1)),'RO-OTHER');
  const individualApp=row('SUB-1').locator('.ssRelatedId[data-role=AppID]').filter({hasText:'APP-OTHER'});
  await individualApp.focus();await page.keyboard.press('Control+c');assert.equal(await page.evaluate(()=>identityNativeCopies.at(-1)),'APP-OTHER');
  await search().fill('RO-SHARED');await copy('SubID',['SUB-1','SUB-2']);
  assert.equal(await tableRows().count(),2,'typing a related ID filters known submissions before Copy fires');
  await close();await openMissing();
  assert.match(await scope.locator('.ssPager').textContent(),/1–50 of 123/);
  assert.equal(await tableRows().count(),50);
  assert.deepEqual([...new Set(await tableRows().locator('td:first-child').allTextContents())],['Not recorded']);
  assert.equal(await scope.locator('.ssCopyIDs').isDisabled(),true,'parent IDs never become submission IDs');
  await scope.getByRole('button',{name:'Next',exact:true}).click();assert.match(await scope.locator('.ssPager').textContent(),/51–100 of 123/);
  await copy('ROID',allValues(missing,'ROID'));await copy('AppID',allValues(missing,'AppID'));
  await scope.getByRole('button',{name:'Next',exact:true}).click();assert.match(await scope.locator('.ssPager').textContent(),/101–123 of 123/);
  assert.equal(await tableRows().count(),23,'all missing-ID source rows, including an identical repeated row, remain accessible');
  await search().fill('APP-M-000');await copy('ROID',['RO-M-000','RO-M-001']);
  assert.equal(await tableRows().count(),4,'three source rows plus the identical repeated row remain visible');
  await search().fill('RO-M-060');await copy('AppID',['APP-M-040']);assert.equal(await tableRows().count(),1);
  // Exercise both unavailable-clipboard paths and the selected-text fallback.
  for(const mode of ['denied','absent']){
   await page.evaluate(mode=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:mode==='absent'?undefined:{writeText:async()=>{throw new DOMException('Blocked','NotAllowedError')}}}),mode);
   await scope.locator(mode==='denied'?'.ssCopyROIDs':'.ssCopyAppIDs').click();
   const label=mode==='denied'?'RO IDs to copy':'Application IDs to copy',expected=mode==='denied'?'RO-M-060':'APP-M-040';
   const box=scope.getByRole('textbox',{name:label,exact:true});
   assert.match(await scope.getByRole('status').textContent(),/Press Ctrl\+C/);assert.doesNotMatch(await scope.getByRole('status').textContent(),/Copied/);
   assert.equal(await box.evaluate(node=>node.value.slice(node.selectionStart,node.selectionEnd)),expected);
   await page.keyboard.press('Control+c');assert.equal(await page.evaluate(()=>identityNativeCopies.at(-1)),expected);
  }
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>identityWrites.push(text)}}));
  await search().fill('not-an-existing-related-id');await search().press('Tab');
  for(const cls of ['.ssCopyIDs','.ssCopyROIDs','.ssCopyAppIDs'])assert.equal(await scope.locator(cls).isDisabled(),true);
  await close();await scope.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('CMI');await openMissing();
  const cmi=missing.filter(r=>r.BusinessUnit==='CMI');await copy('ROID',allValues(cmi,'ROID'));await copy('AppID',allValues(cmi,'AppID'));
  assert.match(await scope.locator('.ssPager').textContent(),new RegExp('of '+cmi.length));
  await close();await scope.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('*');
  await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();await scope.getByRole('button',{name:'Clear Submission state values',exact:true}).click();await scope.getByRole('checkbox',{name:'Include Completed in Submission state',exact:true}).check();await scope.locator('.ssStateFilter[data-role=SubStatus] summary').click();
  await openMissing();const complete=missing.filter(r=>r.SubStatus==='Completed');await copy('ROID',allValues(complete,'ROID'));assert.match(await scope.locator('.ssPager').textContent(),new RegExp('of '+complete.length));
  await close();await clearStateFilter();
  // A refresh updates the current details and removes IDs that are no longer in scope.
  await openMissing();await send([{...missing[0],ROID:'RO-REFRESH',AppID:'APP-REFRESH'}]);assert.equal(await tableRows().count(),1);await copy('ROID',['RO-REFRESH']);await copy('AppID',['APP-REFRESH']);await close();
  await send(rows,['ROID']);await planned();assert.equal(await scope.locator('.ssRelatedId[data-role=ROID]').count(),0);await copy('AppID',['APP-CMI','APP-OTHER','APP-SHARED']);await close();
  await send(rows,['AppID']);await planned();assert.equal(await scope.locator('.ssRelatedId[data-role=AppID]').count(),0);await copy('ROID',['RO-CMI','RO-OTHER','RO-SHARED']);await close();
  await send(rows,['ROID','AppID']);await planned();assert.equal(await scope.locator('.ssRelatedRecords').count(),0);assert.equal(await scope.locator('.ssCopyROIDs,.ssCopyAppIDs').count(),0);await copy('SubID',['SUB-1','SUB-2','SUB-3']);await close();
  await send([{...base,SubID:'SUB-WITHOUT-PARENTS',ROID:'',AppID:''}]);await planned();
  assert.equal(await scope.locator('.ssRelatedRecords').textContent(),'Not recorded');
  assert.equal(await scope.locator('.ssCopyROIDs').isDisabled(),true);assert.equal(await scope.locator('.ssCopyAppIDs').isDisabled(),true);
  await copy('SubID',['SUB-WITHOUT-PARENTS']);await close();
 }finally{
  await page.evaluate(()=>{
   const saved=window.identityCheckRestore;
   document.removeEventListener('copy',window.identityCopyListener);document.body.style.userSelect=saved.userSelect;
   if(saved.clipboard)Object.defineProperty(navigator,'clipboard',saved.clipboard);else delete navigator.clipboard;
   Object.assign(saved.visual,saved.values);saved.visual.draw();
   delete window.identityCheckRestore;delete window.identityCopyListener;delete window.identityWrites;delete window.identityNativeCopies;
  });
  await page.clock.setFixedTime(new Date(originalTime));
 }
};
