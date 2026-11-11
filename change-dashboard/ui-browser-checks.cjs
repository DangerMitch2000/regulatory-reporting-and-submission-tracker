const assert=require('node:assert/strict');

/** Run against the same real Visual instance factory, including packaged JavaScript. */
async function runChecks(page,demoRows){
 await page.setViewportSize({width:1280,height:1000});
 await page.evaluate(()=>dashboardHarness.create('ui-audit'));
 const rows=Array.from({length:45},(_,i)=>({...demoRows[0],ChangeID:'SCROLL-CHANGE',EventName:'SCROLL-EVENT',AppID:'SCROLL-APP-'+i,ROID:'SCROLL-RO-'+i,SubID:'SCROLL-SUB-'+i,Country:'Country '+String(i).padStart(2,'0'),ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''}));
 await page.evaluate(rows=>dashboardHarness.send('ui-audit',rows),rows);
 const scope=page.locator('#ui-audit');
 await scope.locator('[data-action=country]').first().click();
 await scope.locator('.cd-countries').scrollIntoViewIfNeeded();
 const headerHits=async()=>scope.locator('.cd-countries').evaluate(async box=>{
  box.scrollTop=93;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return [...box.querySelectorAll('th')].map(th=>{const b=th.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {title:th.textContent.trim(),header:hit?.closest('th')===th,hit:hit?.outerHTML.slice(0,100)};});
 });
 const hits=await headerHits();assert(hits.every(x=>x.header),'Scrolled country rows must stay behind sticky column titles: '+JSON.stringify(hits));
 await scope.locator('[data-theme]').selectOption('light');await scope.locator('.cd-countries').scrollIntoViewIfNeeded();assert((await headerHits()).every(x=>x.header),'Light theme country headers cover scrolling rows');
 await scope.locator('[data-filter-toggle=country][data-col=country]').click();
 await scope.locator('[data-table-filter=country][data-col=country]').fill('Country');
 await scope.locator('.cd-countries').scrollIntoViewIfNeeded();assert((await headerHits()).every(x=>x.header),'Expanded header filters also cover scrolling rows');
 await scope.locator('[data-table-filter=country][data-col=country]').fill('No matching country');
 assert.equal(await scope.locator('.cd-countries tbody tr').count(),0);
 await scope.locator('[data-action=reset]').click();
 assert.equal(await scope.locator('.cd-countries tbody tr').count(),45,'Clear filters also clears country-table filters');
 const conflict={...demoRows[0],ChangeID:'CONFLICT-CHANGE',EventName:'CONFLICT-EVENT',AppID:'CONFLICT-APP',ROID:'CONFLICT-RO',SubID:'CONFLICT-SUB',Country:'France',SubStatus:'Planned',ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:'',CommercialRegion:'Europe'};
 await page.evaluate(rows=>dashboardHarness.send('ui-audit',rows),[conflict,{...conflict,Country:'Germany',SubStatus:'Withdrawn'}]);
 await scope.locator('[data-filter=region]').selectOption('Europe');
 assert.equal(await scope.locator('.cd-countries tbody tr').count(),1,'conflicting countries stay in one review bucket');
 await scope.locator('[data-action=related][data-kind=submission]').click();
 const sub=scope.getByRole('button',{name:'Select submission CONFLICT-SUB',exact:true});
 assert.equal(await sub.getAttribute('data-state'),'conflicting values','inactive source side of state conflict must remain visible');
 await sub.click();
 assert.equal(await scope.locator('.cd-countries tr[data-country-key="?"]').getAttribute('data-selected'),'true','conflict diagram record links to the missing-country review bucket');
 assert.match(await scope.locator('.cd-evidence').textContent(),/Submission country missing or conflicting/);
 assert.match(await scope.locator('.cd-coverage').first().textContent(),/Apps 1.*ROs 1.*Subs 1/,'review records remain in worklist counts and diagram');
 await page.evaluate(rows=>dashboardHarness.send('ui-audit',rows),[{...conflict,Country:'France',SubStatus:'Planned'},{...conflict,Country:'Germany',SubID:'OTHER-SUB',ROID:'OTHER-RO',AppID:'OTHER-APP'}]);
 await scope.locator('[data-filter=country]').selectOption('France');
 await page.evaluate(rows=>dashboardHarness.send('ui-audit',rows),[{...conflict,Country:'FRANCE',SubStatus:'Planned'},{...conflict,Country:'Germany',SubID:'OTHER-SUB',ROID:'OTHER-RO',AppID:'OTHER-APP'}]);
 assert.equal(await scope.locator('[data-filter=country]').inputValue(),'FRANCE','refresh changing only country capitalisation preserves selected scope');
 assert.equal(await scope.locator('.cd-countries tbody tr').count(),1);
 await page.evaluate(async()=>{dashboardHarness.instances['ui-audit'].visual.destroy();await dashboardHarness.instances['ui-audit'].visual.queue;});
 console.log('PASS UI audit: scrolled country rows remain below headings, Light theme/open filters, and conflicting country/state records remain linked for review.');
}
module.exports={runChecks};
