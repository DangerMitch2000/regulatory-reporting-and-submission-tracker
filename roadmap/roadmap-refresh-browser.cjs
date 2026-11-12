const nodeAssert = require('node:assert/strict');
const nodePath = require('node:path');

// This suite is deliberately shared by the compiled source Visual and the
// JavaScript extracted from the actual PBIVIZ. All records are synthetic.
module.exports = async function checkRefresh({page, assert=nodeAssert, path=nodePath, dir, scope=page, mode='source'}) {
 const originalTime=await page.evaluate(()=>Date.now());
 await page.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
 const root=scope.locator('.roadmap2026');
 const choose=(name,value)=>scope.getByRole('combobox',{name,exact:true}).selectOption(value);
 const send=(data,segment=false,omit=[])=>page.evaluate(({data,segment,omit})=>window.__roadmapTest.send(data,segment,window.__roadmapTest.roles.filter(role=>!omit.includes(role))),{data,segment,omit});
 const resize=(width,height)=>page.evaluate(({width,height})=>{const api=window.__roadmapTest;if(api.resize)api.resize(width,height);else api.visual.update({type:4,viewport:{width,height}});},{width,height});
 const row=(SubID,patch={})=>({SubID,LatestDispatch:'2026-01-10',Site:'North',BusinessUnit:'ID',SubStatus:'In Progress',ROStatus:'Planned',DispatchRequired:true,...patch});
 const longStatus='Pending health authority review following receipt of additional technical documentation and confirmation of the final country specific application requirements';
 const fixture=[
  row('REF-A-ACTUAL',{OriginalDispatch:'2025-12-20',LatestDispatch:'2026-01-02',ActualDispatch:'2026-01-06',ActualSubmission:'2026-02-03',ActualApproval:'2026-03-04',SubStatus:'Completed',ROStatus:'Health Authority Approved'}),
  row('REF-B-OPEN',{SubStatus:'Completed'}),
  row('REF-C-FUTURE',{LatestDispatch:'2026-12-20',Site:'South',BusinessUnit:'CMI',SubStatus:longStatus,ROStatus:longStatus}),
  row('REF-D-INFERRED',{Site:'South',ActualSubmission:'2026-02-01'}),
  row('REF-E-NOT-REQUIRED',{DispatchRequired:false,ActualDispatch:'2026-01-07'}),
  row('REF-F-MISSING',{LatestDispatch:null,ActualSubmission:'2026-03-01',Site:'South'}),
  row('REF-G-NOT-REQUIRED-OUTSIDE',{LatestDispatch:null,ActualApproval:'2026-04-01',DispatchRequired:false,Site:'South'}),
  row('REF-H-MULTISITE'),row('REF-H-MULTISITE',{Site:'South'}),
  row('REF-I-CONFLICT',{LatestDispatch:'2026-01-02'}),row('REF-I-CONFLICT',{LatestDispatch:'2026-02-02'}),
  row('REF-J-PREVIOUS',{ActualDispatch:'2025-05-01'}),
  row('REF-K-NEXT',{LatestDispatch:'2027-01-10'}),
  row('REF-L-UNASSIGNED',{Site:null}),
  row('REF-M-JOINED'),row('REF-M-JOINED',{BusinessUnit:'Other',SubStatus:'Completed'})
 ];
 const chartIDs=['REF-A-ACTUAL','REF-B-OPEN','REF-C-FUTURE','REF-D-INFERRED','REF-E-NOT-REQUIRED','REF-H-MULTISITE','REF-L-UNASSIGNED','REF-M-JOINED'];
 const ids=()=>scope.locator('.status-worklist tbody tr[data-submission-id]').evaluateAll(rows=>rows.map(row=>row.dataset.submissionId));
 const expectIds=async(expected,label='drilldown')=>assert.deepEqual((await ids()).sort(),expected.slice().sort(),label+' returns the exact distinct Submission IDs');
 const expectTotal=async(count)=>assert.match(await scope.locator('.average').innerText(),new RegExp('\\('+count+' ÷ 12\\)'));
 const mainRow=id=>scope.locator('.status-worklist tbody tr[data-submission-id="'+id+'"]');
 const toggle=id=>mainRow(id).getByRole('button',{name:new RegExp('^(Show|Hide) details for '+id+'$')});
 const close=async()=>{const button=scope.getByRole('button',{name:'Close worklist',exact:true});if(await button.count())await button.click();};
 const all=async()=>{await choose('View','overview');await scope.locator('.chart-total').click();};
 const clearReview=async()=>{const button=scope.getByRole('button',{name:'Clear review filters',exact:true});if(await button.count())await button.click();};
 const frame=()=>scope.locator('.worklist-frame[data-scroll-key="worklist"]');
 const capture=async(name)=>{if(dir)await root.screenshot({path:path.join(dir,`roadmap-refresh-${mode}-${name}.png`)});};

 assert.equal(await scope.getByRole('combobox',{name:'Theme',exact:true}).inputValue(),'dark','new actual Visual defaults to Dark');
 assert.equal(await root.getAttribute('data-theme'),'dark');
 await choose('Theme','light');assert.equal(await scope.getByRole('combobox',{name:'Business unit',exact:true}).inputValue(),'"ID"','theme change keeps the default ID unit');
 await choose('Theme','dark');
 await send(fixture.flatMap(record=>[record,record]));
 await choose('Year','2026');await choose('Business unit','*');await choose('Site','*');await choose('Dispatch required','all');await choose('View','overview');
 await scope.getByRole('checkbox',{name:'Include inferred dispatches'}).check();
 await expectTotal(8);
 assert.match(await scope.locator('.cleanup').textContent(),/: 1\./);
 assert.match(await scope.locator('.not-required-outside').textContent(),/: 1 outside chart/);
 assert.equal(await scope.locator('.chart rect[data-count]').evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number(node.dataset.count),0)),8);
 await all();await expectIds(chartIDs,'whole-chart total');
 await scope.locator('.chart [data-month="0"][data-category="*"]').click();await expectIds(chartIDs.filter(id=>id!=='REF-C-FUTURE'),'January total');
 await scope.locator('.chart rect[data-month="0"][data-category="2"]').click();await expectIds(['REF-B-OPEN','REF-H-MULTISITE','REF-L-UNASSIGNED','REF-M-JOINED'],'January Unconfirmed');
 await scope.locator('.category-summary button[data-category="3"]').click();await expectIds(['REF-D-INFERRED'],'Inferred category total');
 await scope.getByRole('checkbox',{name:'Include inferred dispatches'}).uncheck();await expectIds(chartIDs,'global inference change clears stale drill selection');
 await scope.getByRole('checkbox',{name:'Include inferred dispatches'}).check();
 // SVG targets must also be keyboard controls, not hover-only decorations.
 await scope.locator('.chart rect[data-month="11"][data-category="1"]').focus();await page.keyboard.press('Enter');await expectIds(['REF-C-FUTURE'],'keyboard chart segment');
 await scope.locator('.sites > summary').click();
 await scope.locator('.sites button[data-site="site:North"][data-category="*"]').click();await expectIds(['REF-A-ACTUAL','REF-B-OPEN','REF-E-NOT-REQUIRED','REF-M-JOINED'],'North site total');
 await scope.locator('.sites button[data-site="site:North"][data-category="2"]').click();await expectIds(['REF-B-OPEN','REF-M-JOINED'],'North Unconfirmed cell');
 await scope.getByRole('button',{name:'Clear drill selection',exact:true}).click();await expectIds(chartIDs,'cleared local drill');
 await close();

 // Historical/future choices change the chart year, never the as-of day.
 await choose('Year','2025');await expectTotal(1);assert.match(await scope.locator('h1').innerText(),/2025/);await all();await expectIds(['REF-J-PREVIOUS']);await close();
 await choose('Year','2027');await expectTotal(1);await all();await expectIds(['REF-K-NEXT']);assert.match(await mainRow('REF-K-NEXT').innerText(),/In Progress \/ Expected/);await close();
 assert.match(await root.locator('header').innerText(),/12 Nov 2026/);
 await choose('Year','2026');await choose('Site','site:North');await expectTotal(5);
 await choose('View','status');await clearReview();await choose('Status review scope','all');await expectIds(['REF-A-ACTUAL','REF-B-OPEN','REF-E-NOT-REQUIRED','REF-H-MULTISITE','REF-M-JOINED'],'shared North membership retains multiple-site evidence');
 assert.equal(await scope.getByRole('combobox',{name:'Site',exact:true}).inputValue(),'site:North');
 await resize(800,650);assert.equal(await scope.getByRole('combobox',{name:'Site',exact:true}).inputValue(),'site:North');
 await send(fixture);await expectIds(['REF-A-ACTUAL','REF-B-OPEN','REF-E-NOT-REQUIRED','REF-H-MULTISITE','REF-M-JOINED'],'shared filters after data refresh');
 await choose('Site','ambiguous');await expectIds(['REF-H-MULTISITE'],'multiple sites remain one unallocated submission');
 await choose('Site','unassigned');await expectIds(['REF-L-UNASSIGNED']);
 await choose('Site','*');await choose('View','overview');await expectTotal(8);
 await choose('Business unit','"ID"');await expectTotal(7);
 await send([row('NO-ID-UNIT',{BusinessUnit:'CMI'})]);await expectTotal(0);assert.equal(await scope.getByRole('combobox',{name:'Business unit',exact:true}).inputValue(),'"ID"','missing ID unit does not silently broaden to All');
 await resize(1440,800);assert.equal(await scope.getByRole('combobox',{name:'Business unit',exact:true}).inputValue(),'"ID"');
 await send(fixture);await choose('Business unit','*');await all();

 // Sorting must affect the displayed records, and expose its direction.
 const sort=scope.getByRole('button',{name:'Sort by Submission ID',exact:true});
 await scope.getByRole('button',{name:'Sort by Site',exact:true}).click();
 await sort.click();const ordered=await ids();assert.deepEqual(ordered,ordered.slice().sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})));
 assert.equal(await sort.locator('..').getAttribute('aria-sort'),'ascending');
 await sort.click();assert.deepEqual(await ids(),ordered.slice().reverse());assert.equal(await sort.locator('..').getAttribute('aria-sort'),'descending');
 assert.equal(await scope.locator('tr[data-detail-for]').count(),0);
 await toggle('REF-A-ACTUAL').click();
 const detail=scope.locator('tr[data-detail-for="REF-A-ACTUAL"]');
 for(const label of ['Original dispatch','Latest dispatch','Actual dispatch','Actual submission','Actual approval'])assert.match(await detail.innerText(),new RegExp(label,'i'));
 for(const date of [/20 Dec 2025/,/0?2 Jan 2026/,/0?6 Jan 2026/,/0?3 Feb 2026/,/0?4 Mar 2026/])assert.match(await detail.innerText(),date,'expanded details include each recorded calendar date');
 assert.equal(await toggle('REF-A-ACTUAL').getAttribute('aria-expanded'),'true');
 await detail.scrollIntoViewIfNeeded();await capture('worklist-expanded-1440x800');
 await mainRow('REF-A-ACTUAL').evaluate(row=>{const frame=row.closest('.worklist-frame');frame.scrollTop+=row.getBoundingClientRect().top-frame.getBoundingClientRect().top-frame.querySelector('thead').getBoundingClientRect().height;});
 await capture('worklist-expanded-context-1440x800');
 await resize(1920,1080);assert.equal(await toggle('REF-A-ACTUAL').getAttribute('aria-expanded'),'true','resize preserves expanded rows');
 await toggle('REF-A-ACTUAL').click();
 const statusCell=mainRow('REF-C-FUTURE').locator('td[data-status-kind]').first();
 const wrapping=await statusCell.evaluate(cell=>({whiteSpace:getComputedStyle(cell).whiteSpace,scroll:cell.scrollWidth,client:cell.clientWidth,height:cell.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(cell).lineHeight)||18}));
 assert.notEqual(wrapping.whiteSpace,'nowrap','long statuses wrap');assert.ok(wrapping.scroll<=wrapping.client+1,'long status text stays within its cell');assert.ok(wrapping.height>wrapping.lineHeight*2,'long status uses multiple visible lines');
 await page.evaluate(()=>{window.refreshCopies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.refreshCopies.push(value)}});});
 const search=scope.getByRole('searchbox',{name:'Search status records',exact:true});await search.fill('REF-B-OPEN');await expectIds(['REF-B-OPEN']);
 await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.equal(await page.evaluate(()=>window.refreshCopies.at(-1)),'REF-B-OPEN');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
 await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();
 const fallback=scope.getByRole('textbox',{name:'Submission IDs to copy',exact:true});assert.equal(await fallback.inputValue(),'REF-B-OPEN');assert.equal(await fallback.evaluate(input=>input.value.slice(input.selectionStart,input.selectionEnd)),'REF-B-OPEN');assert.match(await scope.locator('.copy-status').innerText(),/Ctrl\+C|copy manually/i);
 await search.fill('');await expectIds(chartIDs);await close();
 await send([row('DATE-ISSUES',{OriginalDispatch:'not a date',LatestDispatch:'2026-01-03',ActualDispatch:'2026-01-04'}),row('DATE-ISSUES',{OriginalDispatch:'not a date',LatestDispatch:'2026-01-05',ActualDispatch:'2026-01-04'})]);
 await all();await toggle('DATE-ISSUES').click();
 const issueDetail=scope.locator('tr[data-detail-for="DATE-ISSUES"]');
 assert.match(await issueDetail.locator('[data-date-field="OriginalDispatch"]').innerText(),/not a date/);
 assert.match(await issueDetail.locator('[data-date-field="LatestDispatch"]').innerText(),/2026-01-03/);assert.match(await issueDetail.locator('[data-date-field="LatestDispatch"]').innerText(),/2026-01-05/);
 assert.match(await issueDetail.locator('[data-date-field="ActualDispatch"]').innerText(),/0?4 Jan 2026/);
 await close();await send(fixture);

 // Views remain usable at each supported report size, with horizontal scroll
 // confined to deliberate chart/table containers rather than the visual root.
 for(const [width,height] of [[1440,800],[800,650],[1920,1080]]){
  await page.setViewportSize({width:Math.max(width+60,900),height:Math.max(height+100,800)});await resize(width,height);
  const geometry=await root.evaluate(element=>({client:element.clientWidth,scroll:element.scrollWidth,width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}));
  assert.ok(geometry.scroll<=geometry.client+1,`root horizontal overflow at ${width}x${height}: ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(geometry.width-width)<=2&&Math.abs(geometry.height-height)<=2,'host resize is applied to visual dimensions');
  await expectTotal(8);await capture(width+'x'+height);
 }
 await choose('Site','site:North');await scope.getByRole('button',{name:'Screenshot mode',exact:true}).click();
 const slide=scope.locator('.slideCapture svg');assert.match(await slide.textContent(),/2026/);assert.match(await slide.textContent(),/North/);await capture('screenshot-mode');
 await root.focus();await page.keyboard.press('Escape');assert.equal(await scope.getByRole('combobox',{name:'Site',exact:true}).inputValue(),'site:North');
 await scope.locator('.category-summary button[data-category="2"]').click();await choose('View','status');
 await scope.locator('.status-chart rect[data-month="0"]').filter({hasText:'Submission status: Completed'}).click();await expectIds(['REF-B-OPEN'],'status/month drill within shared site and dispatch category');
 await scope.getByRole('button',{name:'Screenshot mode',exact:true}).click();
 for(const context of [/North/,/Jan 2026/,/Unconfirmed/,/Completed/,/1 matching submissions/])assert.match(await slide.textContent(),context,'status screenshot discloses every active filter');await capture('status-screenshot-filter-context');
 await root.focus();await page.keyboard.press('Escape');await clearReview();await choose('Site','*');await choose('View','overview');await close();

 // Paging and copying refer to the whole filtered result, not only one page.
 const many=Array.from({length:62},(_,i)=>row('PAGE-'+String(i).padStart(3,'0')));
 await send(many.flatMap(record=>[record,record]));await all();assert.equal((await ids()).length,25);
 await scope.getByRole('button',{name:'Next records',exact:true}).click();assert.equal((await ids()).length,25);
 await scope.getByRole('button',{name:'Next records',exact:true}).click();assert.equal((await ids()).length,12);
 assert.equal(await scope.getByRole('button',{name:'Next records',exact:true}).evaluate(button=>document.activeElement===button),true,'paging to the final page retains keyboard focus');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.refreshCopies.push(value)}}));
 await scope.getByRole('button',{name:'Copy IDs',exact:true}).click();assert.deepEqual((await page.evaluate(()=>window.refreshCopies.at(-1))).split('\n').sort(),many.map(record=>record.SubID));
 await search.fill('PAGE-06');assert.equal((await ids()).length,2,'search resets stale page index');await search.fill('');assert.equal((await ids()).length,25);
 await checkScrollPreservation();
 await checkThemes();

 // Replacing report rows removes stale expanded results, and partial delivery
 // remains explicit instead of claiming report-wide totals.
 await send([row('FILTERED-ONLY')]);await expectIds(['FILTERED-ONLY']);assert.equal(await scope.locator('tr[data-detail-for]').count(),0);
 await send([row('FILTERED-ONLY')],true);assert.match(await scope.locator('.notice').innerText(),/partial|delivered|loaded|incomplete/i);
 await send([]);assert.equal((await ids()).length,0);assert.equal(await scope.getByRole('button',{name:'Copy IDs',exact:true}).isDisabled(),true);
 await send(fixture,false,['SubStatus','ROStatus','DispatchRequired']);await choose('View','status');await clearReview();await choose('Status review scope','all');
 assert.match(await scope.locator('.submission-status-summary').textContent(),/not mapped/i);assert.match(await scope.locator('.ro-status-summary').textContent(),/not mapped/i);
 await choose('View','overview');await expectTotal(8);assert.match(await root.innerText(),/Dispatch required is not mapped/);
 await scope.getByRole('checkbox',{name:'Include inferred dispatches'}).uncheck();
 const elapsed=await page.evaluate(()=>{const api=window.__roadmapTest;const rows=Array.from({length:10000},(_,i)=>({SubID:'STRESS-'+String(i).padStart(5,'0'),LatestDispatch:'2026-01-10',Site:['North','South','East','West'][i%4],BusinessUnit:'ID',SubStatus:'In Progress',ROStatus:'Planned',DispatchRequired:true}));const start=performance.now();api.send(rows.flatMap(row=>[row,row,row]),false,api.roles);return performance.now()-start;});
 await expectTotal(10000);await all();assert.equal((await ids()).length,25);assert.match(await scope.locator('.review-count').innerText(),/10000|10,000/);assert.ok(await root.locator('*').count()<5000,'10,000 submissions do not produce a 10,000-row DOM');assert.ok(elapsed<10000,`10,000 distinct / 30,000 joined rows render within 10 seconds (${Math.round(elapsed)}ms)`);
 await close();await send(fixture);await scope.getByRole('checkbox',{name:'Include inferred dispatches'}).check();await choose('Business unit','"ID"');await choose('Site','*');await choose('Year','2026');await choose('View','overview');await resize(1440,800);await page.clock.setFixedTime(new Date(originalTime));
 console.log(`PASS (${mode}): Dark default and both themes/contrast/state/screenshot; year/site/unit lifecycle; exact month/category/site IDs; sort, all dates, long statuses, clipboard fallback, paging/search; parent/root/table scroll and focus; responsive screenshot; optional mappings; 10,000 distinct / 30,000 joined rows (${Math.round(elapsed)}ms).`);
 return {mode,stressMilliseconds:Math.round(elapsed),distinctSubmissions:10000,joinedRows:30000};

 async function checkThemes(){
  const themeRows=Array.from({length:62},(_,i)=>row('THEME-'+String(i).padStart(3,'0'),{BusinessUnit:'CMI',LatestDispatch:'2027-01-10',OriginalDispatch:'2026-12-20',ROStatus:'Health Authority Approved'}));
  await send([...fixture,...themeRows]);await choose('Business unit','"CMI"');await choose('Year','2027');await choose('Site','site:North');await choose('View','status');await clearReview();await choose('Status review scope','missing-dispatch');
  await scope.getByRole('button',{name:'Sort by Site',exact:true}).click();await scope.getByRole('button',{name:'Sort by Submission ID',exact:true}).click();
  await resize(800,650);await toggle('THEME-005').click();
  await root.evaluate(element=>{const frame=element.querySelector('.worklist-frame');element.scrollTop+=frame.getBoundingClientRect().top-element.getBoundingClientRect().top-100;frame.scrollTop=200;frame.scrollLeft=10;frame.querySelector('tr[data-submission-id="THEME-005"] button').focus({preventScroll:true});});
  const state=()=>root.evaluate(element=>{const frame=element.querySelector('.worklist-frame');return {year:element.querySelector('[aria-label="Year"]')?.value,unit:element.querySelector('[aria-label="Business unit"]')?.value,site:element.querySelector('[aria-label="Site"]')?.value,scope:element.querySelector('[aria-label="Status review scope"]')?.value,expanded:[...element.querySelectorAll('tr[data-detail-for]')].map(row=>row.dataset.detailFor),root:element.scrollTop,table:frame?.scrollTop,left:frame?.scrollLeft,maxRoot:element.scrollHeight-element.clientHeight,maxTable:frame?.scrollHeight-frame?.clientHeight,maxLeft:frame?.scrollWidth-frame?.clientWidth,focus:document.activeElement?.getAttribute('data-focus-key')};});
  const expected=await state();assert.ok(expected.root>0&&expected.table>0&&expected.left>0,'theme regression starts in a scrolled expanded worklist');
  const preserved=async(before,label,clamp=false)=>{const after=await state();for(const key of ['year','unit','site','scope','expanded','focus'])assert.deepEqual(after[key],before[key],label+' retains '+key);for(const [key,max]of [['root','maxRoot'],['table','maxTable'],['left','maxLeft']])assert.ok(Math.abs(after[key]-(clamp?Math.min(before[key],after[max]):before[key]))<=2,label+' retains '+key+': '+JSON.stringify({before,after}));return after;};
  for(const theme of ['light','dark']){
   const before=await state();await choose('Theme',theme);await preserved(before,theme+' switch');assert.equal(await root.getAttribute('data-theme'),theme);
   await assertThemeContrast(theme);
   await send([...fixture,...themeRows]);await preserved(before,theme+' data refresh');
   for(const [width,height]of [[1440,800],[800,650]]){
    const preResize=await state();await resize(width,height);await preserved(preResize,theme+' resize '+width,true);await assertThemeContrast(theme);
    await capture(`theme-${theme}-worklist-${width}x${height}`);
   }
   // Invoke the real screenshot button without first scrolling the normal
   // worklist back to its header; exit must restore that reading position.
   await scope.getByRole('button',{name:'Screenshot mode',exact:true}).evaluate(button=>button.focus({preventScroll:true}));
   const beforeCapture=await state();await scope.getByRole('button',{name:'Screenshot mode',exact:true}).evaluate(button=>button.click());
   assert.equal(await root.getAttribute('data-theme'),theme);assert.ok(await root.locator('svg').count());await assertThemeContrast(theme,true);await capture('theme-'+theme+'-screenshot');
   const captureText=await root.locator('svg').textContent(),alternate=theme==='dark'?'light':'dark';await choose('Theme',alternate);await assertThemeContrast(alternate,true);assert.equal(await root.locator('svg').textContent(),captureText,'theme changes inside Screenshot keep the same filter/count context');await choose('Theme',theme);
   await root.focus();await page.keyboard.press('Escape');await preserved(beforeCapture,theme+' screenshot exit');assert.equal(await scope.getByRole('combobox',{name:'Theme',exact:true}).inputValue(),theme);
  }
  await choose('Business unit','*');await choose('Year','2026');await choose('Site','*');await choose('View','overview');await send(many);await all();
 }

 async function assertThemeContrast(theme,screenshot=false){
  const report=await root.evaluate((element,{screenshot})=>{
   const rgba=value=>{const channels=String(value).match(/[\d.]+/g)?.map(Number)||[];return [channels[0]||0,channels[1]||0,channels[2]||0,channels.length>3?channels[3]:1];};
   const composite=(fg,bg)=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3])).concat(1);
   const background=node=>{const layers=[];for(let n=node;n;n=n.parentElement)layers.push(rgba(getComputedStyle(n).backgroundColor));return layers.reverse().reduce((base,layer)=>composite(layer,base),[255,255,255,1]);};
   const luminance=colour=>colour.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
   const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   const svg=element.querySelector('svg'),canvas=svg?.querySelector('rect[width="1200"]')||svg?.querySelector('rect'),slideBackground=screenshot&&canvas?rgba(getComputedStyle(canvas).fill):null;
   const failures=[],samples=[];
   const selector=screenshot?'svg text,button':'header h1,header p,label,select,input,button:not([aria-disabled="true"]):not(:disabled),.review-count,.status-worklist th,.status-worklist td,.record-details dt,.record-details dd,.record-details p,.status-chart svg text';
   for(const node of element.querySelectorAll(selector)){
    if(!node.getClientRects().length||node.getAttribute('aria-hidden')==='true')continue;
    const css=getComputedStyle(node),bg=screenshot&&node instanceof SVGElement?slideBackground:background(node),fg=rgba(node instanceof SVGElement?css.fill:css.color),contrast=ratio(composite(fg,bg),bg);
    const item={tag:node.tagName,label:(node.textContent||node.getAttribute('aria-label')||'').trim().slice(0,55),foreground:fg.slice(0,3),background:bg.slice(0,3),ratio:Number(contrast.toFixed(2))};samples.push(item);if(contrast<4.45)failures.push(item);
   }
   const marks=[...element.querySelectorAll('svg rect[data-count]')].map(node=>{const bg=screenshot?slideBackground:background(node),fg=rgba(getComputedStyle(node).fill);return {fill:getComputedStyle(node).fill,ratio:ratio(fg,bg),count:node.getAttribute('data-count')};});
   const grids=[...element.querySelectorAll('svg line')].map(node=>{const bg=screenshot?slideBackground:background(node),stroke=rgba(getComputedStyle(node).stroke);return {stroke:getComputedStyle(node).stroke,ratio:ratio(stroke,bg)};}).filter(line=>line.stroke!=='none');
   return {rootBackground:background(element).slice(0,3),rootLuminance:luminance(background(element)),failures,samples:samples.length,marks,grids};
  },{screenshot});
  assert.ok(report.samples>5,'contrast check samples visible controls, table or screenshot text');assert.deepEqual(report.failures,[],theme+' readable text contrast >=4.5: '+JSON.stringify(report.failures));
  assert.ok(theme==='dark'?report.rootLuminance<.08:report.rootLuminance>.65,theme+' has the expected actual painted surface: '+JSON.stringify(report.rootBackground));
  assert.ok(report.marks.length>0,'render contains data marks');assert.ok(report.marks.every(mark=>mark.ratio>=1.8),theme+' data marks remain distinct from the canvas: '+JSON.stringify(report.marks));
  assert.ok(report.grids.length>0,'render contains chart grid');assert.ok(report.grids.every(grid=>grid.ratio>=1.12),theme+' grid strokes remain visible: '+JSON.stringify(report.grids));
 }

 async function checkScrollPreservation(){
  await resize(800,650);await page.setViewportSize({width:1000,height:900});
  await page.evaluate(()=>{
   const host=document.getElementById('host'),parent=document.createElement('div'),before=document.createElement('div'),after=document.createElement('div');
   parent.dataset.refreshScrollParent='';parent.style.cssText='height:780px;width:900px;box-sizing:border-box;overflow:auto;padding-top:100px;padding-bottom:350px;';
   before.dataset.refreshScrollSpacer='';after.dataset.refreshScrollSpacer='';before.style.height='250px';after.style.height='800px';
   host.before(before,parent);parent.append(host);parent.after(after);parent.scrollTop=60;window.scrollTo(0,120);
  });
  const target=await root.evaluate(element=>{
   const table=element.querySelector('.worklist-frame[data-scroll-key="worklist"]');
   element.scrollTop=table.offsetTop-element.offsetTop-100;table.scrollTop=200;table.scrollLeft=10;
   const bounds=table.getBoundingClientRect(),rootBounds=element.getBoundingClientRect(),head=table.querySelector('thead').getBoundingClientRect();
   const top=Math.max(bounds.top+head.height+10,rootBounds.top+10),bottom=Math.min(bounds.bottom,rootBounds.bottom)-30;
   const button=[...table.querySelectorAll('button[aria-expanded]')].find(button=>{const b=button.getBoundingClientRect();return b.top>top&&b.bottom<bottom;});
   if(!button)throw Error('No visible scrolled worklist row');button.focus({preventScroll:true});return button.closest('[data-submission-id]').dataset.submissionId;
  });
  const button=toggle(target);
  const position=()=>root.evaluate((element,id)=>{const table=element.querySelector('.worklist-frame[data-scroll-key="worklist"]'),button=element.querySelector('tr[data-submission-id="'+id+'"] button[aria-expanded]');return {parent:document.querySelector('[data-refresh-scroll-parent]').scrollTop,root:element.scrollTop,table:table.scrollTop,left:table.scrollLeft,page:window.scrollY,y:button.getBoundingClientRect().top,focus:document.activeElement===button};},target);
  const before=await position();assert.ok(before.parent>0&&before.root>0&&before.table>0&&before.left>0&&before.page>0,'regression starts with every scroll container offset: '+JSON.stringify(before));
  const stable=async(label,expanded)=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const after=await position();for(const key of ['parent','root','table','left','page','y'])assert.ok(Math.abs(after[key]-before[key])<=2,`${label} preserves ${key}: ${JSON.stringify({before,after})}`);assert.equal(after.focus,true,label+' preserves button focus');assert.equal(await button.getAttribute('aria-expanded'),String(expanded));assert.equal((await ids()).length,25);};
  await button.click();await stable('pointer expansion',true);await button.click();await stable('pointer collapse',false);await page.keyboard.press('Enter');await stable('keyboard expansion',true);await page.keyboard.press('Space');await stable('keyboard collapse',false);
  await page.evaluate(()=>{const parent=document.querySelector('[data-refresh-scroll-parent]'),host=document.getElementById('host');parent.before(host);parent.remove();document.querySelectorAll('[data-refresh-scroll-spacer]').forEach(node=>node.remove());window.scrollTo(0,0);});
 }
};
