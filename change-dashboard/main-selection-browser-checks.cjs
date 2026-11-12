const assert=require('node:assert/strict');

/** Main-record selection opens the relationship diagram without disturbing scope or scrolling. */
async function runChecks(page,demoRows){
 const id='main-selection',scope=page.locator('#'+id);
 const base={...demoRows[0],BusinessUnit:'ID',Country:'France',CommercialRegion:'Europe',Manufacturer:'FOCUS-SITE',Product:'Focus product',ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''};
 const rows=Array.from({length:24},(_,i)=>{const suffix=String(i).padStart(2,'0');return {...base,ChangeID:'FOCUS-CHANGE-'+suffix,EventName:'FOCUS-EVENT-'+suffix,AppID:'FOCUS-APP-'+suffix,ROID:'FOCUS-RO-'+suffix,SubID:'FOCUS-SUB-'+suffix,RegistrationID:'FOCUS-REG-'+suffix,RegistrationCountry:'France',RegistrationState:'Planned'};});
 const main=key=>scope.locator('.cd-record[data-action=change]').filter({hasText:key});
 const panel=scope.locator('.cd-related-records'),graph=scope.locator('.cd-graph-scroll');
 const send=options=>page.evaluate(({id,rows,options})=>dashboardHarness.send(id,rows,options),{id,rows,options});
 const resize=(width,height=900)=>page.evaluate(({id,width,height})=>dashboardHarness.send(id,[],{type:4,width,height,noDataView:true}),{id,width,height});
 const open=()=>panel.evaluate(n=>n.open);
 const expectDiagram=async()=>{assert.equal(await open(),true,'Explicit main selection opens Related items');assert.equal(await scope.locator('[data-graph-mode=diagram]').getAttribute('aria-pressed'),'true','Main selection shows Diagram mode');assert.equal(await graph.count(),1);};
 const snapshot=()=>scope.evaluate(n=>({root:n.querySelector('.change-dashboard').scrollTop,main:n.querySelector('.cd-body>.cd-table-wrap').scrollTop,left:n.querySelector('.cd-body>.cd-table-wrap').scrollLeft,page:window.scrollY}));
 const counts=()=>scope.locator('.cd-metric strong,.cd-coverage').allTextContents();
 await page.setViewportSize({width:1920,height:1000});
 await page.evaluate(id=>dashboardHarness.create(id),id);
 try{
  await send({width:1920,height:900});
  assert.equal(await open(),false,'Automatic first-row selection remains lazy');
  const initialCounts=await counts();
  await main('FOCUS-EVENT-00').click();await expectDiagram();
  assert.equal(await main('FOCUS-EVENT-00').evaluate(n=>n===document.activeElement),true,'Opening does not steal focus from the record name');
  assert.deepEqual(await counts(),initialCounts,'Opening a diagram does not change worklist or summary counts');
  assert.equal(await scope.locator('.cd-graph-column').count(),6,'Every hierarchy column remains available');
  const geometry=await graph.evaluate(n=>({available:n.clientWidth,canvas:n.querySelector('.cd-graph-canvas').getBoundingClientRect().width,overflow:n.scrollWidth-n.clientWidth}));
  assert(geometry.available-geometry.canvas>=-1&&geometry.available-geometry.canvas<=30,'Wide diagram fills the visual width: '+JSON.stringify(geometry));
  assert(geometry.overflow<=1,'Wide diagram avoids unnecessary horizontal scrolling');
  assert(await scope.locator('.cd-country-panel').evaluate(n=>n.getBoundingClientRect().top>=n.parentElement.querySelector('.cd-related-records').getBoundingClientRect().bottom-1),'Country details stay below the full-width diagram');
  await scope.locator('[data-graph-search]').fill('FOCUS-SUB-00');
  await scope.getByRole('button',{name:'Select submission FOCUS-SUB-00',exact:true}).click();
  await main('FOCUS-EVENT-01').click();await expectDiagram();
  assert.equal(await scope.locator('[data-graph-search]').inputValue(),'','Changing parent clears the previous ID search');
  assert.equal(await scope.locator('[data-node][aria-pressed=true]').count(),0,'Changing parent clears the previous branch selection');
  assert.deepEqual(await scope.locator('[data-related-kind=submission] [data-node]').allTextContents(),['FOCUS-SUB-01']);
  await scope.locator('[data-graph-mode=list]').click();
  await panel.locator(':scope > summary').click();assert.equal(await open(),false);
  await main('FOCUS-EVENT-01').click();await expectDiagram();
  // A noninteractive row cell has the same selection action, without needing its name.
  await main('FOCUS-EVENT-02').locator('..').locator('..').locator('.cd-title').click();await expectDiagram();
  assert.equal(await page.evaluate(id=>dashboardHarness.state(id).selected,id),'FOCUS-EVENT-02');
  // Invoke an already-visible main control after setting nested scroll positions.
  // Native keyboard handling is checked below; this isolates render-induced jumps.
  await panel.locator(':scope > summary').click();
  await main('FOCUS-EVENT-04').evaluate(n=>{n.focus({preventScroll:true});const root=n.closest('.change-dashboard'),list=n.closest('.cd-table-wrap');root.scrollTop=120;list.scrollTop=170;list.scrollLeft=0;});
  const before=await snapshot();
  await main('FOCUS-EVENT-04').evaluate(n=>n.click());await expectDiagram();
  assert.deepEqual(await snapshot(),before,'Opening preserves page, visual and main-list scrolling');
  assert.equal(await main('FOCUS-EVENT-04').evaluate(n=>n===document.activeElement),true,'Main-list focus survives opening');
  for(const [group,key]of [['change','FOCUS-CHANGE-03'],['application','FOCUS-APP-03'],['event','FOCUS-EVENT-03']]){
   await scope.locator('[data-group]').selectOption(group);
   await main(key).focus();await page.keyboard.press('Enter');await expectDiagram();
   assert.equal(await page.evaluate(id=>dashboardHarness.state(id).selected,id),key,'Keyboard record selection works in '+group+' view');
  }
  await scope.locator('[data-filter=country]').selectOption('France');
  await scope.locator('[data-filter=product]').selectOption('Focus product');
  await scope.locator('[data-filter=site]').selectOption('FOCUS-SITE');
  await main('FOCUS-EVENT-03').click();
  await scope.locator('[data-action=country][data-value=france]').click();
  await scope.getByRole('button',{name:'Select submission FOCUS-SUB-03',exact:true}).click();
  const selectedKey=await scope.locator('[data-node][aria-pressed=true]').getAttribute('data-node');
  await send({width:1920,height:900});await resize(1600);
  assert.equal(await scope.locator('[data-node][aria-pressed=true]').getAttribute('data-node'),selectedKey,'Refresh and resize preserve selected graph record');
  assert.equal(await page.evaluate(id=>dashboardHarness.state(id).country,id),'france','Refresh and resize preserve country evidence');
  await panel.locator(':scope > summary').click();
  await send({width:1600,height:900});await resize(1920);
  assert.equal(await open(),false,'Ordinary refresh and resize respect a manually collapsed diagram');
  assert.equal(await scope.locator('[data-filter=unit]').inputValue(),'ID');
  assert.equal(await scope.locator('[data-filter=country]').inputValue(),'France');
  assert.equal(await scope.locator('[data-filter=product]').inputValue(),'Focus product');
  assert.equal(await scope.locator('[data-filter=site]').inputValue(),'FOCUS-SITE');
  await main('FOCUS-EVENT-03').click();await expectDiagram();
  await page.setViewportSize({width:390,height:844});await resize(390,844);
  assert(await graph.evaluate(n=>n.scrollWidth>n.clientWidth),'Narrow diagrams retain readable columns with internal scrolling');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Narrow diagram does not widen the browser page');
 }finally{
  await page.evaluate(async id=>{const entry=dashboardHarness.instances[id];entry.visual.destroy();await entry.visual.queue;entry.element.remove();delete dashboardHarness.instances[id];},id);
  await page.setViewportSize({width:1280,height:1000});
 }
 console.log('PASS main selection: automatic full-width Diagram, row/name/keyboard controls in all groupings, unchanged counts/scope, stable scroll/focus, manual collapse and narrow layouts.');
}
module.exports={runChecks};
