const assert=require('node:assert/strict');

/** Visual dimensions, not the containing browser window, determine responsive text/layout. */
async function runChecks(page,demoRows){
 const id='resize-layout',scope=page.locator('#'+id);
 const row={...demoRows[0],BusinessUnit:'ID',EventName:'RESIZE-EVENT',ChangeID:'RESIZE-CHANGE',AppID:'RESIZE-APP',ROID:'RESIZE-RO',SubID:'RESIZE-SUB',RegistrationID:'',Country:'France',ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''};
 await page.evaluate(id=>dashboardHarness.create(id),id);
 const resize=(width,height=600)=>page.evaluate(({id,width,height})=>dashboardHarness.send(id,[],{type:4,width,height,noDataView:true}),{id,width,height});
 const dimensions=()=>scope.evaluate(section=>{
  const host=section.querySelector('.change-dashboard-host'),app=section.querySelector('.change-dashboard'),cs=getComputedStyle(app),style=selector=>getComputedStyle(app.querySelector(selector)),count=selector=>style(selector).gridTemplateColumns.split(' ').filter(Boolean).length;
  return {font:cs.fontSize,compact:app.dataset.compact,narrow:app.dataset.narrow,headerDirection:style('.cd-header').flexDirection,filterColumns:count('.cd-filters'),countryColumns:count('.cd-country-layout'),evidenceColumns:count('.cd-evidence dl'),bodyPadding:style('.cd-body').padding,hostWidth:host.getBoundingClientRect().width,hostHeight:host.getBoundingClientRect().height,appWidth:app.getBoundingClientRect().width,appHeight:app.getBoundingClientRect().height,outerOverflow:host.scrollWidth-host.clientWidth,appOverflow:app.scrollWidth-app.clientWidth,transform:cs.transform,diagramOpen:app.querySelector('.cd-related-records').open};
 });
 try{
  await page.setViewportSize({width:1280,height:1000});await page.evaluate(({id,row})=>dashboardHarness.send(id,[row],{width:900,height:600}),{id,row});
  await scope.locator('.cd-record[data-action=change]').click();
  for(const width of [390,700,900,1400,1920]){
   const captures=[];
   for(const browserWidth of [width,2560]){
    await page.setViewportSize({width:browserWidth,height:1000});await resize(width);const result=await dimensions();captures.push(result);
    assert.equal(result.hostWidth,width,'Host follows the Power BI visual width');assert.equal(result.appWidth,width,'Content follows the Power BI visual width');assert.equal(result.hostHeight,600);assert.equal(result.appHeight,600);
    assert.equal(result.outerOverflow,0,'No outer horizontal overflow');assert.equal(result.appOverflow,0,'Narrow tables and diagrams scroll internally');
    const font=parseFloat(result.font);assert(Number.isInteger(font)&&font>=13&&font<=15,'Readable whole-pixel base font remains within bounds');assert.equal(result.transform,'none','Responsive layout does not scale or zoom the dashboard');
    assert.equal(result.diagramOpen,true,'Resize preserves the open diagram');assert.equal(await page.evaluate(id=>dashboardHarness.state(id).selected,id),'RESIZE-EVENT','Resize preserves the selected item');
   }
   assert.deepEqual(captures[0],captures[1],'Identical '+width+'px visuals retain text and layout in different browser windows');
   const result=captures[0];assert.equal(result.filterColumns,width<550?2:width<800?3:7,'Filters use the visual-width breakpoint');assert.equal(result.countryColumns,width<800?1:2,'Country details use the visual-width breakpoint');
   if(width<800)assert.equal(result.evidenceColumns,width<550?2:3,'Narrow evidence fields wrap within the visual');
  }
  await resize(900,300);const short=await dimensions();assert.equal(short.hostHeight,300);assert.equal(short.appHeight,300,'A short visual stays within its host frame');
 }finally{
  await page.evaluate(async id=>{const entry=dashboardHarness.instances[id];entry.visual.destroy();await entry.visual.queue;entry.element.remove();delete dashboardHarness.instances[id];},id);
  await page.setViewportSize({width:1280,height:1000});
 }
 console.log('PASS responsive sizing: visual-width text and layout remain stable across browser sizes, bounded whole-pixel fonts, narrow fields/internal scrolling, height bounds and selected/open diagram preservation.');
}
module.exports={runChecks};
