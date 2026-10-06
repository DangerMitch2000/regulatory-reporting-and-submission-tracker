const assert=require('node:assert/strict'),path=require('node:path'),rows=require('./assessment-responses-test.cjs');
module.exports=async(page,{outputDir})=>{
 await page.goto('http://127.0.0.1:8771/index.html');await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 await page.evaluate(rows=>window.__dispatchSend([...rows,...rows]),rows);
 await page.locator('#host #filter-status').filter({hasText:'1 change IDs · 1 events · 1 applications · 1 ROs · 3 submissions'}).waitFor();
 await page.locator('#host select[name=groupBy]').selectOption('Change initiation');await page.locator('#host .selectGroup text').first().click();await page.locator('#host #selected-details').evaluate(e=>e.open=true);
 for(const theme of ['dark','light']){
  await page.locator('#host #theme-select').selectOption(theme);
  await page.locator('#host .country-progress').waitFor();assert.equal(await page.locator('#host .country-progress tbody tr').count(),4);
  const hu=page.locator('#host .country-progress tr[data-country="Hungary"]'),pe=page.locator('#host .country-progress tr[data-country="Peru"]'),mx=page.locator('#host .country-progress tr[data-country="Mexico"]');
  assert.match(await hu.innerText(),/1 of 2 dispatched/);assert.match(await hu.innerText(),/HU certificate\nHU form/);assert.match(await pe.innerText(),/Awaiting response/);assert.match(await pe.innerText(),/No linked submission delivered/);assert.match(await mx.innerText(),/1 of 1 dispatched/);assert.doesNotMatch(await mx.innerText(),/HU certificate/);
  const search=page.getByRole('searchbox',{name:'Find country progress'});await search.fill('Peru');assert.equal(await page.locator('#host .country-progress tbody tr').count(),1);await search.fill('');
  await page.getByRole('combobox',{name:'Sort country progress'}).selectOption('country');assert.equal(await page.locator('#host .country-progress tbody tr').first().getAttribute('data-country'),'Colombia');
  await page.mouse.move(5,5);await page.locator('#host .country-progress').screenshot({path:path.join(outputDir,'assessment-progress-'+theme+'.png')});
 }
 await page.locator('#host .country-progress tr[data-country="Hungary"] summary').click();await page.locator('#host .country-progress button').filter({hasText:/^S-H1$/}).click();
 await page.locator('#host #detail-body h2').filter({hasText:'S-H1'}).waitFor();assert.match(await page.locator('#host .change-details').innerText(),/HU certificate/);assert.doesNotMatch(await page.locator('#host .change-details').innerText(),/MX letter/);
 let estimates=await page.evaluate(()=>window.__themeVisual.app.view.data('surveyRows').filter(r=>r.country==='Hungary'&&r.start!==null));assert.ok(estimates.some(e=>e.anchorLabel==='Actual submission'&&e.start===Date.UTC(2026,9,10)));
 // Local membership filtering must not discard parent-only assessment evidence.
 const country=page.locator('#host details[data-kind=country]');await country.locator('summary').click();await country.locator('label').filter({hasText:/^Hungary$/}).locator('input').check();
 await page.locator('#host #filter-status').filter({hasText:'2 submissions'}).waitFor();estimates=await page.evaluate(()=>window.__themeVisual.app.view.data('surveyRows').filter(r=>r.start!==null));assert.ok(estimates.some(e=>e.country==='Hungary'&&e.anchorLabel==='Actual submission'));assert.match(await page.locator('#host .change-details').innerText(),/HU certificate/);
 console.log('PASS: expected-response identifiers, country list and awaiting responses, actual-dispatch counts, source documents, sorting/search/selection, both themes, parent-only evidence under country filters and submission-to-approval anchors.');
};
