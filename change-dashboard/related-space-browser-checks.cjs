const assert=require('node:assert/strict');

/** Related views use the embedded visual height, while preserving their interaction state. */
async function runChecks(page,demoRows){
 const id='related-space';
 await page.setViewportSize({width:1280,height:1000});
 await page.evaluate(id=>dashboardHarness.create(id),id);
 const base={...demoRows[0],ChangeID:'SPACE-CHANGE',EventName:'SPACE-EVENT',Country:'France',ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''};
 const rows=Array.from({length:40},(_,i)=>({...base,AppID:'SPACE-APP-'+i,ROID:'SPACE-RO-'+i,SubID:'SPACE-SUB-'+i,RegistrationID:'SPACE-REG-'+i,RegistrationState:'Planned'}));
 const scope=page.locator('#'+id),graph=scope.locator('.cd-graph-scroll');
 const resize=height=>page.evaluate(({id,height})=>dashboardHarness.send(id,[],{type:4,width:1200,height,noDataView:true}),{id,height});
 const size=el=>el.evaluate(n=>n.getBoundingClientRect().height);
 const expectSize=async(el,expected,label)=>assert(Math.abs(await size(el)-expected)<=2,label+': expected '+expected+'px, got '+await size(el)+'px');
 const selected=()=>scope.locator('[data-node][aria-pressed=true]').evaluateAll(ns=>ns.map(n=>n.dataset.node));
 const focus=()=>page.evaluate(()=>document.activeElement?.dataset.node||'');
 try{
  await page.evaluate(({id,rows})=>dashboardHarness.send(id,rows,{width:1200,height:600}),{id,rows});
  await scope.locator('[data-action=related][data-kind=submission]').click();
  await expectSize(graph,330,'A 600px visual gives the diagram more than the old 280px ceiling');
  const sub=scope.getByRole('button',{name:'Select submission SPACE-SUB-12',exact:true});
  await sub.click();
  const selectedSub=await selected();
  await graph.evaluate(n=>n.scrollTop=150);await sub.evaluate(n=>n.focus({preventScroll:true}));
  for(const [height,expected] of [[1000,550],[2000,560],[600,330]]){
   await resize(height);await expectSize(graph,expected,'Diagram follows visual height '+height);
   assert.equal(await graph.evaluate(n=>n.scrollTop),150,'Height-only resize keeps diagram scroll');
   assert.deepEqual(await selected(),selectedSub,'Height-only resize keeps diagram selection');
   assert.equal(await focus(),JSON.stringify(['submission','SPACE-SUB-12']),'Height-only resize keeps selected-node focus');
  }
  await scope.locator('[data-graph-mode=list]').click();
  const list=scope.locator('[data-related-kind=application] .cd-linked-ids');
  await expectSize(list,270,'A 600px visual gives List columns more than the old 180px ceiling');
  const app=scope.getByRole('button',{name:'Select application SPACE-APP-12',exact:true});
  await app.click();const selectedApp=await selected();
  await list.evaluate(n=>n.scrollTop=100);await app.evaluate(n=>n.focus({preventScroll:true}));
  for(const [height,expected] of [[1000,420],[2000,420],[600,270]]){
   await resize(height);await expectSize(list,expected,'List follows visual height '+height);
   assert.equal(await list.evaluate(n=>n.scrollTop),100,'Height-only resize keeps List column scroll');
   assert.deepEqual(await selected(),selectedApp,'Height-only resize keeps List selection');
   assert.equal(await focus(),JSON.stringify(['application','SPACE-APP-12']),'Height-only resize keeps List node focus');
  }
  await page.evaluate(({id,rows})=>dashboardHarness.send(id,rows,{width:1200,height:2000}),{id,rows:rows.slice(0,1)});
  assert(await size(list)<100,'A one-item List does not pad itself to the maximum height');
  await scope.locator('[data-graph-mode=diagram]').click();
  assert(await size(graph)<180,'A one-item diagram keeps its natural height instead of adding blank space');
  assert.equal(await scope.locator('.cd-graph-node').count(),6,'Sparse diagrams retain every linked record');
 }finally{
  await page.evaluate(async id=>{const entry=dashboardHarness.instances[id];entry.visual.destroy();await entry.visual.queue;entry.element.remove();delete dashboardHarness.instances[id];},id);
  await page.setViewportSize({width:1280,height:1000});
 }
 console.log('PASS related space: height-aware Diagram/List ceilings, capped tall visuals, natural sparse layouts and preserved selection, scrolling and focus.');
}
module.exports={runChecks};
