const assert=require('node:assert/strict');

/** Search selects complete parent records while retaining the existing country/filter scope. */
async function runChecks(page,demoRows){
 const id='worklist-search',scope=page.locator('#'+id);
 const base={...demoRows[0],BusinessUnit:'ID',Product:'Alpha assay',Manufacturer:'Alpha Works',RegistrationManufacturingSite:'Assembly North',CommercialRegion:'Europe',ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:'',RegistrationState:'Planned'};
 const row=(suffix,country,extra={})=>({...base,ChangeID:'FIND-CHANGE-A',EventName:'FIND-EVENT-A',AppID:'FIND-APP-'+suffix,ROID:'FIND-RO-'+suffix,SubID:'FIND-SUB-'+suffix,RegistrationID:'FIND-REG-'+suffix,RegistrationCountry:country,Country:country,CatalogNumber:'CAT-'+suffix,...extra});
 const rows=[row('FR','France'),row('FR','France',{CatalogNumber:'CAT-FR-SECOND'}),row('DE','Germany',{CommercialRegion:'Central Europe'}),row('ES','Spain',{ChangeID:'FIND-CHANGE-B',EventName:'FIND-EVENT-B',Product:'Beta test',Manufacturer:'Beta Works'}),row('OTHER','France',{BusinessUnit:'Other',ChangeID:'FIND-CHANGE-OTHER',EventName:'FIND-EVENT-OTHER'})];
 const input=()=>scope.locator('[data-search]');
 const shown=()=>scope.locator('.cd-record[data-action=change]').allTextContents();
 const query=async value=>{await input().fill(value);await page.clock.runFor(300);};
 const searchState=()=>page.evaluate(id=>dashboardHarness.state(id),id);
 const countries=()=>scope.locator('.cd-countries [data-action=country]').allTextContents();
 const send=options=>page.evaluate(({id,rows,options})=>dashboardHarness.send(id,rows,options),{id,rows,options});
 const resize=(width,height=900)=>page.evaluate(({id,width,height})=>dashboardHarness.send(id,[],{type:4,width,height,noDataView:true}),{id,width,height});
 await page.setViewportSize({width:1280,height:1000});
 await page.evaluate(id=>dashboardHarness.create(id),id);
 try{
  await send({width:1280,height:900});
  assert.equal(await scope.locator('[data-filter=unit]').inputValue(),'ID');
  assert.equal(await input().getAttribute('type'),'search');
  assert(await input().getAttribute('aria-label'),'Search has an accessible name');
  assert.deepEqual((await shown()).sort(),['FIND-EVENT-A','FIND-EVENT-B']);
  const loaded=await scope.locator('.cd-coverage').last().textContent();
  for(const value of ['find-event-a','find-change-a','find-app-de','find-ro-de','find-sub-de','find-reg-de','aLpHa','germany','alpha works']){
   await query(value);assert.deepEqual(await shown(),['FIND-EVENT-A'],'Search matches '+value);
  }
  await query('  ALPHA   germany  ');
  assert.deepEqual(await shown(),['FIND-EVENT-A'],'Space-separated terms can match different fields of one parent');
  assert.deepEqual((await countries()).sort(),['France','Germany'],'Search does not discard other countries of its matched parent');
  assert.deepEqual(await page.evaluate(id=>dashboardHarness.metrics(id),id),[1,0,0],'Summary cards count each searched parent once');
  assert.match(await scope.locator('.cd-coverage').first().textContent(),/Events 1.*Apps 2.*ROs 2.*Subs 2.*Regs 2/,'Duplicate catalog rows do not inflate searched coverage');
  assert.equal(await scope.locator('.cd-coverage').last().textContent(),loaded,'Loaded counts do not change with search');
  await scope.locator('[data-action=copy]').click();
  assert.equal(await scope.locator('.cd-copybox textarea').inputValue(),'FIND-EVENT-A','Copy IDs uses the searched worklist');
  await scope.locator('[data-action=close-copy]').click();
  await scope.locator('[data-action=export]').click();
  const csv=await page.evaluate(id=>dashboardHarness.instances[id].exports.at(-1)?.[0],id);
  assert.match(csv,/FIND-EVENT-A/);assert.match(csv,/France/);assert.match(csv,/Germany/);assert.doesNotMatch(csv,/FIND-EVENT-B|Spain/,'Export retains countries of matching parents and excludes nonmatching parents');
  await scope.locator('[data-filter=country]').selectOption('France');
  await query('FIND-SUB-DE');assert.deepEqual(await shown(),[],'Search cannot match linked IDs removed by the top Country filter');
  await query('FIND-SUB-FR');assert.deepEqual(await shown(),['FIND-EVENT-A']);assert.deepEqual(await countries(),['France']);
  await scope.locator('[data-filter=country]').selectOption('all');
  await scope.locator('[data-filter=region]').selectOption('Central Europe');
  await query('FIND-SUB-FR');assert.deepEqual(await shown(),[],'Search cannot match linked IDs outside the selected commercial region');
  await query('FIND-SUB-DE');assert.deepEqual(await shown(),['FIND-EVENT-A']);assert.deepEqual(await countries(),['Germany']);
  await scope.locator('[data-filter=region]').selectOption('all');
  await scope.locator('[data-filter=product]').selectOption('Beta test');
  await query('Alpha');assert.deepEqual(await shown(),[],'Search combines with the top Product filter');
  await query('Beta');assert.deepEqual(await shown(),['FIND-EVENT-B']);
  await scope.locator('[data-filter=product]').selectOption('all');
  await query('Alpha');
  await scope.locator('[data-action=queue][data-value=approval]').click();assert.deepEqual(await shown(),[],'Queue selection still applies to the searched records');
  await scope.locator('[data-action=queue][data-value=dispatch]').click();assert.deepEqual(await shown(),['FIND-EVENT-A']);
  await scope.locator('[data-action=queue][data-value=dispatch]').click();
  await scope.locator('[data-filter-toggle=main][data-col=record]').click();await scope.locator('[data-table-filter=main][data-col=record]').fill('FIND-EVENT-B');assert.deepEqual(await shown(),[],'Column filters intersect the search');
  await scope.locator('[data-action=reset-table]').click();assert.equal(await input().inputValue(),'Alpha');assert.deepEqual(await shown(),['FIND-EVENT-A']);
  await query('FIND-SUB-DE');
  for(const [group,expected]of [['application','FIND-APP-DE'],['change','FIND-CHANGE-A'],['event','FIND-EVENT-A']]){
   await scope.locator('[data-group]').selectOption(group);
   assert.equal(await input().inputValue(),'FIND-SUB-DE','Grouping preserves the search text');
   assert.deepEqual(await shown(),[expected],'Linked ID search works in '+group+' view');
  }
  await scope.locator('[data-action=reset-table]').click();assert.equal(await input().inputValue(),'FIND-SUB-DE','Reset table leaves the top search intact');
  await scope.locator('[data-action=clear-search]').click();assert.equal(await input().inputValue(),'');assert.deepEqual((await shown()).sort(),['FIND-EVENT-A','FIND-EVENT-B']);
  assert.equal(await scope.locator('[data-filter=unit]').inputValue(),'ID','Clearing search preserves other filters');
  await input().fill('Beta');await page.keyboard.press('Enter');assert.deepEqual(await shown(),['FIND-EVENT-B'],'Enter applies the pending search immediately');
  await page.keyboard.press('Escape');assert.equal(await input().inputValue(),'');assert.deepEqual((await shown()).sort(),['FIND-EVENT-A','FIND-EVENT-B'],'Escape clears search without changing filters');
  await input().evaluate(n=>window.searchComposingInput=n);await input().dispatchEvent('compositionstart');await input().fill('German');await page.clock.runFor(300);
  assert.equal(await input().evaluate(n=>n===window.searchComposingInput),true,'IME keeps the same input node until composition ends');
  assert.deepEqual((await shown()).sort(),['FIND-EVENT-A','FIND-EVENT-B'],'IME composition does not filter partial composing text');
  await input().dispatchEvent('compositionend');await page.clock.runFor(300);assert.deepEqual(await shown(),['FIND-EVENT-A'],'Completed composition applies the query');
  await query('Alpha');
  await input().evaluate(n=>{n.focus();n.setSelectionRange(2,2);});await page.keyboard.insertText('x');await page.clock.runFor(300);
  assert.equal(await input().inputValue(),'Alxpha');assert.equal(await input().evaluate(n=>n===document.activeElement&&n.selectionStart===3&&n.selectionEnd===3),true,'Typing preserves focus and the insertion point');
  await page.keyboard.press('Backspace');await page.clock.runFor(300);assert.equal(await input().inputValue(),'Alpha');
  await input().evaluate(n=>n.setSelectionRange(1,4));
  await send({width:1280,height:900});await resize(736);
  assert.equal(await input().inputValue(),'Alpha','Data refresh and resize preserve search');
  assert.equal(await input().evaluate(n=>n===document.activeElement&&n.selectionStart===1&&n.selectionEnd===4),true,'Refresh preserves the focused search and selection range');
  await query('<img src=x onerror=alert(1)>');assert.deepEqual(await shown(),[]);assert.equal(await scope.locator('img').count(),0,'Query is literal text, never executable markup');
  await query('[');assert.deepEqual(await shown(),[],'Regex metacharacters are literal');
  assert.match(await scope.locator('.cd-empty').textContent(),/No events match/);assert.equal(await scope.locator('.cd-detail').count(),0,'Empty results remove stale selected-record details');
  await query('   ');assert.deepEqual((await shown()).sort(),['FIND-EVENT-A','FIND-EVENT-B'],'Whitespace-only search restores the scoped worklist');
  await input().fill('Alpha');await scope.locator('[data-action=reset]').evaluate(n=>n.click());await page.clock.runFor(300);assert.equal(await input().inputValue(),'','Clear filters cancels a pending search and clears its text');
  assert.equal(await scope.locator('[data-filter=unit]').inputValue(),'all');assert.equal((await shown()).length,3);
  await scope.locator('[data-filter=unit]').selectOption('ID');
  await input().fill('Beta');await scope.locator('[data-action=copy]').evaluate(n=>n.click());await page.clock.runFor(1);
  assert.equal(await scope.locator('.cd-copybox textarea').inputValue(),'FIND-EVENT-B','Copy flushes a pending search instead of copying stale matches');
  await scope.locator('[data-action=close-copy]').click();
  await input().fill('Alpha');await scope.locator('[data-action=export]').evaluate(n=>n.click());await page.clock.runFor(1);
  const pendingCsv=await page.evaluate(id=>dashboardHarness.instances[id].exports.at(-1)?.[0],id);
  assert.match(pendingCsv,/FIND-EVENT-A/);assert.doesNotMatch(pendingCsv,/FIND-EVENT-B/,'Export flushes the typed query before choosing records');
  const pagedRows=Array.from({length:65},(_,i)=>({...rows[0],ChangeID:'PAGE-CHANGE-'+i,EventName:'PAGE-EVENT-'+String(i).padStart(2,'0'),AppID:'PAGE-APP-'+i,ROID:'PAGE-RO-'+i,SubID:'PAGE-SUB-'+i,RegistrationID:'PAGE-REG-'+i}));
  await page.evaluate(({id,rows})=>dashboardHarness.send(id,rows),{id,rows:pagedRows});
  await scope.locator('[data-action=page][data-value="1"]').click();assert.equal((await searchState()).page,1);
  await query('PAGE-SUB-64');assert.deepEqual(await shown(),['PAGE-EVENT-64']);assert.equal((await searchState()).page,0,'Search resets pagination so matches on later pages become visible');
  await page.setViewportSize({width:390,height:844});await resize(390,844);
  assert(await input().isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Search never widens the page at phone-sized visual widths');
  const bounds=await input().evaluate(n=>{const b=n.getBoundingClientRect(),root=n.closest('.change-dashboard').getBoundingClientRect();return {left:b.left-root.left,right:b.right-root.right,width:b.width};});
  assert(bounds.left>=0&&bounds.right<=1&&bounds.width>100,'Compact search stays inside the visual and remains usable: '+JSON.stringify(bounds));
 }finally{
  await page.evaluate(async id=>{const entry=dashboardHarness.instances[id];entry.visual.destroy();await entry.visual.queue;entry.element.remove();delete dashboardHarness.instances[id];},id);
  await page.setViewportSize({width:1280,height:1000});
 }
 console.log('PASS worklist search: linked IDs/products/sites/countries, whole-parent scope, filters/counts/copy/export, grouping, safe empty queries, focus/caret, refresh/resize, pagination and narrow layout.');
}
module.exports={runChecks};
