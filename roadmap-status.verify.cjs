// Actual Visual browser checks: completion must never replace dispatch evidence.
module.exports=async function({page,assert,path,dir}){
 const y=new Date().getFullYear(),plan=y+'-01-02';
 const rows=[
  {SubID:'STATUS-A-001',LatestDispatch:plan,Site:'North',BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Health Authority Approved'},
  {SubID:'STATUS-B-002',LatestDispatch:plan,Site:'North',BusinessUnit:'ID',SubStatus:'In Progress',ROStatus:'In Progress'},
  {SubID:'STATUS-C-003',LatestDispatch:plan,Site:'South',BusinessUnit:'ID',SubStatus:null,ROStatus:'Planned'},
  {SubID:'STATUS-D-004',LatestDispatch:plan,Site:'South',BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Health Authority Approved'},
  {SubID:'STATUS-D-004',LatestDispatch:plan,Site:'South',BusinessUnit:'ID',SubStatus:'In Progress',ROStatus:'Health Authority Approved'},
  {SubID:'STATUS-E-005',LatestDispatch:plan,BusinessUnit:'ID',SubStatus:'Withdrawn',ROStatus:'Archived'},
  {SubID:'STATUS-F-006',LatestDispatch:plan,ActualSubmission:y+'-02-01',Site:'North',BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Health Authority Approved'},
  {SubID:'STATUS-G-007',ActualDispatch:plan,LatestDispatch:y+'-01-01',Site:'North',BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Health Authority Approved'},
  {SubID:'STATUS-H-008',LatestDispatch:y+'-12-31',Site:'South',BusinessUnit:'ID',SubStatus:'Planned',ROStatus:'Planned'},
  {SubID:'STATUS-I-009',ActualSubmission:y+'-01-03',Site:'North',BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Health Authority Approved'},
  {SubID:'STATUS-J-010',LatestDispatch:(y-1)+'-01-02',Site:'North',BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Health Authority Approved'}
 ];
 const send=async(data,mapped)=>page.evaluate(({data,mapped})=>window.__roadmapTest.send(data,false,mapped||window.__roadmapTest.roles),{data,mapped});
 const choose=(name,value)=>page.getByRole('combobox',{name,exact:true}).selectOption(value);
 const list=()=>page.locator('.status-worklist tbody tr[data-submission-id]');
 const summarySum=async(selector)=>page.locator(selector+' tbody tr:not(.total)').evaluateAll(trs=>trs.reduce((n,tr)=>n+(Number(tr.children[1]?.textContent)||0),0));
 const chartTotal=async()=>page.locator('.status-chart [data-count]').evaluateAll(bars=>bars.reduce((n,bar)=>n+Number(bar.getAttribute('data-count')),0));
 await send(rows);
 await choose('Business unit','*');
 await page.getByRole('checkbox',{name:'Include inferred dispatches'}).check();
 assert.match(await page.locator('.average').innerText(),/8 ÷ 12/);
 await choose('View','status');
 assert.equal(await page.getByRole('combobox',{name:'Status review scope',exact:true}).inputValue(),'unconfirmed');
 assert.equal(await list().count(),5);
 assert.equal(await chartTotal(),5);assert.equal(await page.locator('.status-chart [data-chart="status-monthly"]').count(),1);
 assert.equal(await page.getByRole('combobox',{name:'Colour bars by',exact:true}).inputValue(),'subStatus');
 await choose('Colour bars by','roStatus');assert.equal(await chartTotal(),5);assert.equal(await page.locator('.status-chart [data-count]').evaluateAll(bars=>bars.find(bar=>bar.getAttribute('data-status-key')==='value:"health authority approved"')?.getAttribute('data-count')), '2');
 await choose('Colour bars by','subStatus');
 assert.match(await page.locator('.status-worklist').innerText(),/Completed — dispatch date missing/);
 assert.equal(await summarySum('.submission-status-summary'),5);
 assert.equal(await summarySum('.ro-status-summary'),5);
 assert.match(await page.locator('.submission-status-summary').innerText(),/Conflicting/);
 await choose('Submission status','value:"completed"');
 assert.equal(await list().count(),1);assert.match(await list().innerText(),/STATUS-A-001/);
 assert.equal(await chartTotal(),1);
 await choose('Submission status','*');await choose('RO status','value:"health authority approved"');
 assert.equal(await list().count(),2);assert.match(await page.locator('.status-worklist').innerText(),/STATUS-D-004/);
 await choose('RO status','*');await choose('Review site','site:North');assert.equal(await list().count(),2);
 await page.locator('#resize').click();assert.equal(await page.getByRole('combobox',{name:'View',exact:true}).inputValue(),'status');assert.equal(await page.getByRole('combobox',{name:'Review site',exact:true}).inputValue(),'site:North');assert.equal(await list().count(),2);
 await send(rows);assert.equal(await page.getByRole('combobox',{name:'Review site',exact:true}).inputValue(),'site:North');
 await choose('Review site','*');
 const search=page.getByRole('searchbox',{name:'Search status records',exact:true});
 await search.fill('STATUS-D-004');await search.press('Tab');assert.equal(await list().count(),1);
 assert.match(await list().innerText(),/Conflicting/);assert.match(await list().innerText(),/In Progress/);
 await search.fill('');await search.press('Tab');
 await choose('Status review scope','inferred');assert.equal(await list().count(),1);assert.match(await list().innerText(),/STATUS-F-006/);
 await choose('Status review scope','missing-dispatch');assert.equal(await list().count(),7);
 await choose('Status review scope','missing-dates');assert.equal(await list().count(),1);assert.match(await list().innerText(),/STATUS-I-009/);
 assert.equal(await page.locator('.status-chart [data-chart="status-undated"]').count(),1);assert.equal(await chartTotal(),1);assert.equal(await page.locator('.status-chart [data-month]').count(),0);
 await send([...rows,{SubID:'STATUS-K-011',LatestDispatch:'bad-date',ActualSubmission:y+'-02-01',Site:'South',BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Planned'}]);
 assert.equal(await list().count(),2);assert.match(await page.locator('.status-worklist tr[data-submission-id="STATUS-K-011"]').innerText(),/Date issue/);
 await send(rows);
 await choose('Status review scope','all');assert.equal(await list().count(),8);
 const dispatched=await page.locator('.status-worklist tr[data-submission-id="STATUS-G-007"]').innerText();assert.ok(dispatched.includes(y+'-01-01'));assert.ok(dispatched.includes(plan));
 // Existing reports without the new roles keep their date counts, with an honest mapping state.
 const mapped=await page.evaluate(()=>window.__roadmapTest.roles.filter(k=>!['SubStatus','ROStatus'].includes(k)));
 await send(rows,mapped);assert.match(await page.locator('.submission-status-summary').innerText(),/not mapped/i);assert.match(await page.locator('.ro-status-summary').innerText(),/not mapped/i);assert.equal(await summarySum('.submission-status-summary'),8);
 await choose('View','overview');assert.match(await page.locator('.average').innerText(),/8 ÷ 12/);
 await send(rows);await choose('View','status');await choose('Status review scope','unconfirmed');
 // One ID with many joined rows must appear only once; no giant DOM for the worklist.
 const many=Array.from({length:62},(_,i)=>({SubID:'PAGE-'+String(i).padStart(3,'0'),LatestDispatch:plan,SubStatus:'Completed',ROStatus:'Planned',Site:'North',BusinessUnit:'ID'}));
 await send(many);assert.equal(await list().count(),25);assert.equal(await summarySum('.submission-status-summary'),62);
 assert.equal(await chartTotal(),62);
 await page.getByRole('button',{name:'Next records',exact:true}).click();assert.equal(await list().count(),25);
 await page.getByRole('button',{name:'Next records',exact:true}).click();assert.equal(await list().count(),12);
 await send(rows);assert.ok(await list().count()<=5);assert.ok(await list().count()>0);
 await page.locator('.roadmap2026').screenshot({path:path.join(dir,'roadmap-status-worklist.png')});
 // Captures contain the selected scope and both status summaries, not tiny record rows.
 await page.getByRole('button',{name:'Screenshot mode',exact:true}).click();
 const slide=page.locator('.slideCapture svg');assert.match(await slide.textContent(),/Dispatch status review/);assert.match(await slide.textContent(),/Unconfirmed/);assert.match(await slide.textContent(),/Submission status/i);assert.match(await slide.textContent(),/RO status/);assert.ok(!(await slide.textContent()).includes('STATUS-A-001'));
 assert.equal(await slide.locator('[data-chart="status-monthly"]').count(),1);assert.equal(await slide.locator('[data-count]').evaluateAll(bars=>bars.reduce((n,bar)=>n+Number(bar.getAttribute('data-count')),0)),5);
 await slide.evaluate(s=>{s.parentElement.style.height=(s.parentElement.clientWidth*s.viewBox.baseVal.height/1200)+'px'});await slide.screenshot({path:path.join(dir,'roadmap-status-review.png')});
 const before=await slide.textContent(),scale=await slide.evaluate(s=>s.getScreenCTM().a);
 await page.locator('#resize').click();assert.equal(await slide.textContent(),before);assert.ok(await slide.evaluate(s=>s.getScreenCTM().a)<scale);
 await slide.evaluate(s=>{s.parentElement.style.height=(s.parentElement.clientWidth*s.viewBox.baseVal.height/1200)+'px'});await slide.screenshot({path:path.join(dir,'roadmap-status-review-small.png')});
 await page.locator('.slideCapture').focus();await page.keyboard.press('Escape');assert.equal(await page.getByRole('combobox',{name:'View',exact:true}).inputValue(),'status');
 await send([]);assert.equal(await summarySum('.submission-status-summary'),0);
 assert.equal(await chartTotal(),0);
 console.log('PASS: optional status mappings, distinct status counts, unchanged dispatch classification, conflicts, scope/site/status/search filters, resize/refresh, pagination, and status screenshot mode.');
};
