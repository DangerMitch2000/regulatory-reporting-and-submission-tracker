module.exports=async({page,assert,path,dir})=>{
 const fixture=await page.evaluate(()=>{const year=new Date().getFullYear();return [
  {SubID:'FALSE-ACTUAL',DispatchRequired:false,ActualDispatch:year+'-01-02',BusinessUnit:'ID',Site:'North',SubStatus:'Completed'},
  {SubID:'FALSE-PLAN',DispatchRequired:'false',LatestDispatch:year+'-01-02',ActualSubmission:year+'-02-01',BusinessUnit:'ID',Site:'North',SubStatus:'Completed'},
  {SubID:'FALSE-UNDATED',DispatchRequired:false,ActualApproval:year+'-03-01',BusinessUnit:'ID',Site:'South',ROStatus:'Approved'},
  {SubID:'TRUE',DispatchRequired:true,LatestDispatch:year+'-01-02',BusinessUnit:'ID',Site:'South',SubStatus:'Planned'},
  {SubID:'BLANK',DispatchRequired:null,LatestDispatch:year+'-01-02',BusinessUnit:'ID',Site:'South',SubStatus:'Planned'},
  {SubID:'CONFLICT',DispatchRequired:false,LatestDispatch:year+'-01-02',BusinessUnit:'ID',Site:'South'},
  {SubID:'CONFLICT',DispatchRequired:true,LatestDispatch:year+'-01-02',BusinessUnit:'Other',Site:'South'},
 ];});
 await page.evaluate(rows=>window.__roadmapTest.send(rows),fixture);
 await page.getByRole('combobox',{name:'Business unit',exact:true}).selectOption('"ID"');
 await page.getByRole('combobox',{name:'View',exact:true}).selectOption('overview');
 await page.getByRole('checkbox',{name:'Include inferred dispatches'}).check();
 const flag=page.getByRole('combobox',{name:'Dispatch required',exact:true});assert.equal(await flag.inputValue(),'all');
 assert.match(await page.locator('.average').innerText(),/5 ÷ 12/);
 assert.match(await page.locator('.not-required-outside').innerText(),/: 1 outside chart/);
 assert.match(await page.locator('.cleanup').innerText(),/: 0$/);
 const grey=page.locator('svg rect[fill="#6b7280"][tabindex]');assert.equal(await grey.count(),1);assert.match(await grey.getAttribute('aria-label'),/Dispatch not required, 2/);
 await flag.selectOption('false');assert.match(await page.locator('.average').innerText(),/2 ÷ 12/);
 await page.locator('#resize').click();assert.equal(await flag.inputValue(),'false');
 await page.getByRole('combobox',{name:'View',exact:true}).selectOption('status');
 await page.getByRole('combobox',{name:'Status review scope',exact:true}).selectOption('not-required');
 await page.getByRole('button',{name:'Clear review filters',exact:true}).click();
 assert.match(await page.locator('.review-count').innerText(),/^2 matching/);
 assert.match(await page.locator('.status-worklist').innerText(),/False — dispatch not required/);
 assert.match(await page.locator('tr[data-submission-id="FALSE-ACTUAL"]').innerText(),/Actual dispatch:/);
 assert.equal(await page.locator('.completed-missing').count(),0);
 await page.getByRole('combobox',{name:'Status review scope',exact:true}).selectOption('not-required-outside');
 assert.match(await page.locator('.review-count').innerText(),/^1 matching/);
 assert.match(await page.locator('.status-chart h3').innerText(),/Dispatch not required by status/);
 assert.equal(await page.locator('.status-chart svg [data-month]').count(),0);
 await page.getByRole('button',{name:'Screenshot mode',exact:true}).click();assert.match(await page.locator('.slideCapture').innerText(),/Dispatch required: False/);
 await page.locator('.slideCapture').focus();await page.keyboard.press('Escape');
 await flag.selectOption('blank');await page.getByRole('combobox',{name:'Status review scope',exact:true}).selectOption('unconfirmed');assert.match(await page.locator('.status-worklist').innerText(),/BLANK/);
 await flag.selectOption('review');assert.match(await page.locator('.status-worklist').innerText(),/CONFLICT/);assert.match(await page.locator('.status-worklist').innerText(),/Conflicting values/);
 await flag.selectOption('all');
 await page.evaluate(rows=>window.__roadmapTest.send(rows,false,window.__roadmapTest.roles.filter(k=>k!=='DispatchRequired')),fixture);
 await page.getByRole('combobox',{name:'View',exact:true}).selectOption('overview');assert.match(await page.locator('.roadmap2026').innerText(),/Dispatch required is not mapped/);
 await flag.selectOption('unmapped');assert.match(await page.locator('.average').innerText(),/5 ÷ 12/);
 await flag.selectOption('all');await page.evaluate(rows=>window.__roadmapTest.send(rows),fixture);
 await page.getByRole('button',{name:'Screenshot mode',exact:true}).click();await page.locator('.slideCapture svg').screenshot({path:path.join(dir,'roadmap-dispatch-required.png')});
 await page.locator('.slideCapture').focus();await page.keyboard.press('Escape');
 console.log('PASS: actual Visual dispatch filter persistence, distinct false category, grey bars, separate undated scope, evidence worklist, status screenshot and unmapped compatibility.');
};
