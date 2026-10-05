const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async(page,{outputDir})=>{
 await page.goto('http://127.0.0.1:8771/index.html');await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 await page.evaluate(()=>{
  const base={AppID:'A-SURVEY',ROID:'R-SURVEY',ChangeID:'C-SURVEY',EventName:'E-SURVEY',EventQMS:'CR-SURVEY',ChangeQMS:'CR-SURVEY',ChangeStatus:'In Progress',SubStatus:'Planned',LatestDispatch:'2027-01-01',OriginalDispatch:'2027-01-01'};
  const responses=[{AssessmentCountry:'Hungary',AssessmentTimeline:'6–8 months',AssessmentMOHFiling:'Not required',AssessmentDocumentation:'HU certificate\nHU form'},{AssessmentCountry:'Mexico',AssessmentTimeline:'3 months',AssessmentDocumentation:'MX certificate'},{AssessmentCountry:'Colombia',AssessmentTimeline:'N/A',AssessmentMOHFiling:'Product not commercialized'}];
  window.__countrySurveyRows=['Hungary','Mexico','Colombia'].flatMap(Country=>responses.map(r=>({...base,...r,Country,SubID:'S-'+Country})));
  window.__dispatchSend([...window.__countrySurveyRows,...window.__countrySurveyRows]);
 });
 await page.locator('#host #filter-status').filter({hasText:'1 change IDs · 1 events · 1 applications · 1 ROs · 3 submissions'}).waitFor();
 await page.locator('#host #selected-details').evaluate(e=>e.open=true);
 for(const theme of ['dark','light']){
  await page.locator('#host #theme-select').selectOption(theme);
  for(const group of ['Application','Regulatory event','Change initiation']){
   await page.locator('#host select[name=groupBy]').selectOption(group);
   for(const country of ['Hungary','Mexico','Colombia']){
    const estimate=await page.evaluate(async country=>{const v=window.__themeVisual.app.view,r=v.data('displayRows').find(r=>r.level===2&&r.SubID==='S-'+country);v.signal('selectedKey',r.key);await v.runAsync();return v.data('surveyRows').find(s=>s.key===r.key);},country);
    await page.waitForFunction(country=>document.querySelector('#host #detail-body h2')?.textContent.startsWith('S-'+country),country);
    await page.locator('#host .change-details').filter({hasText:'Assessment · C-SURVEY · '+country}).waitFor();
    const detail=await page.locator('#host .change-details').innerText();assert.equal(estimate.country,country);
    if(country==='Hungary'){assert.equal(estimate.start,Date.UTC(2027,0,1)+180*86400000);assert.equal(estimate.end,Date.UTC(2027,0,1)+240*86400000);assert.match(detail,/HU certificate/);assert.doesNotMatch(detail,/MX certificate|Assessment · C-SURVEY · Mexico/);}
    if(country==='Mexico'){assert.equal(estimate.start,Date.UTC(2027,0,1)+90*86400000);assert.doesNotMatch(detail,/HU certificate/);}
    if(country==='Colombia'){assert.equal(estimate.start,null);assert.match(detail,/N\/A/);assert.match(detail,/Product not commercialized/);}
   }
  }
  await page.evaluate(async()=>{const v=window.__themeVisual.app.view,r=v.data('changeRows').find(r=>r.level===-2&&r.ChangeID==='C-SURVEY');v.signal('selectedKey',r.key);await v.runAsync();});
  await page.locator('#host .change-details').filter({hasText:'MX certificate'}).waitFor();assert.match(await page.locator('#host .change-details').innerText(),/HU certificate/);
  // Render the matched range in the actual chart, not just in its data table.
  await page.locator('#host select[name=mode]').selectOption('Compare');
  await page.locator('#host .subLabel text').filter({hasText:/^S-Hungary$/}).click();
  assert.equal(await page.locator('#host .surveyRange path').count(),2,'Only Hungary and Mexico have usable ranges');
  await page.locator('#host').screenshot({path:path.join(outputDir,'survey-country-'+theme+'.png')});
  await page.locator('#host select[name=mode]').selectOption('Hierarchy');
 }
 await page.evaluate(()=>window.__dispatchSend(window.__countrySurveyRows.map(r=>r.AssessmentCountry==='Hungary'?{...r,AssessmentTimeline:''}:r)));
 await page.locator('#host select[name=mode]').selectOption('Compare');await page.locator('#host .subLabel text').filter({hasText:/^S-Hungary$/}).click();
 await page.locator('#host .change-details').filter({hasText:'No surveyed duration recorded.'}).waitFor();assert.match(await page.locator('#host .change-details').innerText(),/HU certificate/);
 console.log('PASS: multi-country responses match each submission in all three groupings and both themes; parent Details retain all countries; blank/N/A durations retain documentation without a bar.');
};
