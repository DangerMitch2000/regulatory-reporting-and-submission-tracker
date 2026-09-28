/* Verify theme changes against the real packaged Visual, not a copied UI. */
const assert=require('node:assert/strict'),path=require('node:path');

module.exports=async function verifyTrackerThemes(page,{outputDir}){
 const root=page.locator('#host .regulatory-timeline');
 const viewState=()=>page.evaluate(()=>{
  const view=window.__themeVisual.app.view;
  const signals=Object.fromEntries(['query','mode','compareLevel','axisMode','sortBy','stateColours','range','selectedKey','scrollTop'].map(name=>[name,view.signal(name)]));
  return {signals,pinned:view.data('pinned').map(d=>d.pinKey),expanded:view.data('expanded').map(d=>d.key),rows:view.data('pageRows').map(d=>d.key),count:document.querySelector('#host #filter-status').textContent,states:[...document.querySelectorAll('#host #state-legend input')].map(e=>[e.value,e.checked])};
 });
 const theme=async mode=>{
  await page.locator('#host #theme-select').selectOption(mode);
  await page.waitForFunction(expected=>document.querySelector('#host .regulatory-timeline')?.dataset.theme===expected&&window.__themeVisual.app.view.signal('themeMode')===expected,mode);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 };
 const luminance=colour=>{
  const rgb=colour.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;});
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 };
 const colours=async selector=>page.locator(selector).first().evaluate(node=>{
  const own=getComputedStyle(node);let ancestor=node,background=own.backgroundColor;
  while((background==='rgba(0, 0, 0, 0)'||background==='transparent')&&ancestor.parentElement){ancestor=ancestor.parentElement;background=getComputedStyle(ancestor).backgroundColor;}
  return {foreground:own.color,background};
 });
 const readable=async selector=>{
  const c=await colours(selector),a=luminance(c.foreground),b=luminance(c.background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(ratio>=4.5,selector+' text contrast is '+ratio.toFixed(2)+':1 ('+JSON.stringify(c)+')');return c;
 };
 const send=async label=>{
  const revision=await page.evaluate(()=>window.__qualityRevision);
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(previous=>window.__qualityRevision>previous,revision);
 };

 await page.goto('http://127.0.0.1:8771/index.html');
 await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 assert.equal(await page.locator('#host #theme-select').inputValue(),'dark','A new visual starts in Dark');
 assert.equal(await root.getAttribute('data-theme'),'dark');
 assert.equal(await page.evaluate(()=>window.__themeVisual.app.view.signal('themeMode')),'dark');
 const darkBackground=(await readable('#host .regulatory-timeline')).background;
 assert.ok(luminance(darkBackground)<.1,'Default visual has a dark background');
 await send('Second instance');
 assert.equal(await page.locator('#other #theme-select').inputValue(),'dark','A second visual starts in Dark');
 const otherBackground=(await colours('#other .regulatory-timeline')).background;

 // Select a real estimate, retain a pin and changed time window, and disable one
 // state filter. A colour change must not reset any of these user choices.
 await page.locator('#host select[name=mode]').selectOption('Compare');
 await page.locator('#host input[name=query]').fill('SUB-00003');
 await page.locator('#host svg .predictionApproval path').first().waitFor();
 await page.locator('#host svg .predictionApproval path').first().click();
 await page.locator('#host #selected-details').evaluate(node=>node.open=true);
 await page.locator('#host .prediction-date').waitFor();
 await page.locator('#host svg .pin text').first().click();
 await page.locator('#host #state-legend input[value="#f27b82"]').uncheck();
 await page.waitForFunction(()=>!window.__themeVisual.app.view.signal('stateColours').includes('#f27b82'));
 await page.locator('#host svg .timeText text').filter({hasText:/^Year$/}).click();
 const before=await viewState();
 assert.equal(before.pinned.length,1);assert.ok(before.signals.range);assert.ok(before.signals.selectedKey);
 await page.locator('#host #detail-body details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
 const detailsBefore=await page.locator('#host #detail-body').innerText();
 const expandedDetails=await page.locator('#host #detail-body details').evaluateAll(nodes=>nodes.map(node=>node.open));
 await theme('light');
 assert.deepEqual(await viewState(),before,'Light preserves filters, selection, pin, displayed rows and date window');
 assert.equal(await page.locator('#host #detail-body').innerText(),detailsBefore,'Details keep the same data');
 assert.deepEqual(await page.locator('#host #detail-body details').evaluateAll(nodes=>nodes.map(node=>node.open)),expandedDetails,'Open history and exclusion panels stay open');
 assert.ok(luminance((await readable('#host .regulatory-timeline')).background)>.8,'Light changes the whole host background');
 const palette=await page.evaluate(()=>window.__themeVisual.app.view.signal('themePalette'));
 assert.equal(palette.background,'#ffffff','The timeline uses its light palette');
 await readable('#host #theme-select');await readable('#host .prediction-card');
 await readable('#host #detail-title');await readable('#host .state-badge');
 assert.equal(await page.locator('#other .regulatory-timeline').getAttribute('data-theme'),'dark');
 assert.equal((await colours('#other .regulatory-timeline')).background,otherBackground,'Changing the first visual does not recolour its sibling');

 await page.locator('#host svg .timeText text').filter({hasText:/^Fit all$/}).click();
 await page.locator('#host svg .predictionApproval path').first().hover();
 await page.locator('#host #tooltip').waitFor({state:'visible'});
 await readable('#host #tooltip');
 assert.match(await page.locator('#host #tooltip').innerText(),/approval|history|historical/i);
 await page.mouse.move(1,1);
 await page.locator('#host .prediction-grid').screenshot({path:path.join(outputDir,'light-details.png')});
 const product=page.locator('#host .filter[data-kind=product]');
 await product.locator('summary').click();await readable('#host .filter[data-kind=product] .panel');await readable('#host .filter[data-kind=product] input');await product.locator('summary').click();
 await page.locator('#host #submission-date-filter summary').click();await readable('#host #submission-period');await page.locator('#host #submission-date-filter summary').click();

 const lightState=await viewState();await theme('dark');assert.deepEqual(await viewState(),lightState,'Switching back to Dark preserves data and controls');
 assert.equal((await colours('#host .regulatory-timeline')).background,darkBackground);
 await theme('light');
 await send('Refresh host data');assert.equal(await root.getAttribute('data-theme'),'light','Data refresh retains the chosen theme');
 await send('Resize host');assert.equal(await root.getAttribute('data-theme'),'light','Host resize retains the chosen theme');
 assert.equal(await page.evaluate(()=>window.__themeVisual.app.view.signal('themeMode')),'light');

 // Data quality, its inspector, dropdowns and export fallback share the theme.
 await page.locator('#host #reset-filters').click();await page.locator('#host #quality-tab').click();
 await send('Quality fixtures');await page.locator('#host #quality-table').filter({hasText:'QUALITY-ERROR'}).waitFor();
 await readable('#host #quality-table');await readable('#host #quality-detail');await readable('#host #quality-category');
 await page.locator('#host #quality-search').fill('QUALITY-CONFLICT');
 await page.waitForFunction(()=>document.querySelector('#host #quality-counts strong')?.textContent==='1');
 const qualityBefore=await page.locator('#host #quality-view').innerText();
 await theme('dark');await theme('light');
 assert.equal(await page.locator('#host #quality-search').inputValue(),'QUALITY-CONFLICT');
 assert.equal(await page.locator('#host #quality-view').innerText(),qualityBefore,'Changing theme preserves quality filters and selected issue');
 await page.locator('#host').screenshot({path:path.join(outputDir,'light-quality.png')});
 await page.getByRole('button',{name:'Reject export',exact:true}).click();await page.locator('#host #quality-export').click();
 await page.locator('#host .quality-fallback textarea').waitFor({state:'visible'});await readable('#host .quality-fallback textarea');
 await send('Empty host data');
 await page.waitForFunction(()=>document.querySelector('#host #filter-status')?.textContent.startsWith('0 submissions'));assert.equal(await root.getAttribute('data-theme'),'light');
 await page.locator('#host #timeline-tab').click();assert.equal(await page.locator('#host #theme-select').inputValue(),'light');
 await theme('dark');await theme('light');
 await send('Refresh host data');await page.locator('#host #reset-filters').click();
 await page.locator('#host select[name=mode]').selectOption('Hierarchy');await page.locator('#host #selected-details').evaluate(node=>node.open=false);
 await page.locator('#host svg .timeText text').filter({hasText:/^Fit all$/}).click();
 await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 await page.locator('#host').screenshot({path:path.join(outputDir,'light-theme.png')});
 console.log('PASS: Dark default, whole-visual Light/Dark, readable controls/details/tooltips/quality, unchanged data and view state, independent visual instances, refresh/resize/empty data.');
};
