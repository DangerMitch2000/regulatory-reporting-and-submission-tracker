const assert=require('node:assert/strict');

/** Exercise real top-filter clicks and lifecycle updates in the Power BI host. */
async function runChecks(page,demoRows){
 const id='filter-menu-host',other='filter-menu-other',scope=page.locator('#'+id),second=page.locator('#'+other);
 const base={...demoRows[0],ExpectedResponseID:'',ExpectedResponseCountry:'',AssessmentResponseID:'',AssessmentCountry:''};
 const row=(suffix,unit,country,product)=>({...base,ChangeID:'MENU-CHANGE-'+suffix,EventName:'MENU-EVENT-'+suffix,AppID:'MENU-APP-'+suffix,ROID:'MENU-RO-'+suffix,SubID:'MENU-SUB-'+suffix,BusinessUnit:unit,Country:country,Product:product});
 const rows=[row('FR','ID','France','France assay'),row('DE','ID','Germany','Germany assay'),row('OTHER','Other','France','Other assay'),...Array.from({length:36},(_,i)=>({...row('DE','ID','Germany','Product '+String(i).padStart(2,'0')),AppID:'MENU-APP-EXTRA-'+i,ROID:'MENU-RO-EXTRA-'+i,SubID:'MENU-SUB-EXTRA-'+i}))];
 const control=(key,s=scope)=>s.locator(key==='group'?'[data-group]':'[data-filter='+key+']');
 const menu=(key,s=scope)=>s.locator('.cd-filter-menu[data-filter-menu='+key+']');
 const send=(options={})=>page.evaluate(({id,rows,options})=>dashboardHarness.send(id,rows,{width:1200,height:800,...options}),{id,rows,options});
 const shown=()=>scope.locator('.cd-record[data-action=change]').allTextContents();
 // This host contains several vertically stacked visual instances. Settle any
 // automation scroll first; a real pointer can only click an onscreen filter.
 const open=async(key,s=scope)=>{await control(key,s).scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await control(key,s).click();await menu(key,s).waitFor({state:'visible'});assert.equal(await control(key,s).getAttribute('aria-expanded'),'true');};
 const choose=async(key,label,s=scope)=>{await open(key,s);await menu(key,s).getByRole('option',{name:label,exact:true}).click();assert.equal(await s.locator('.cd-filter-menu').count(),0,'Choosing '+label+' closes the menu');assert.equal(await control(key,s).evaluate(n=>n===document.activeElement),true,'Choosing a value returns focus to its filter');};
 const noMenu=async()=>assert.equal(await scope.locator('.cd-filter-menu').count(),0);
 await page.setViewportSize({width:1280,height:1000});
 await page.evaluate(({id,other})=>{dashboardHarness.create(id);dashboardHarness.create(other);},{id,other});
 try{
  await send();await page.evaluate(({other,rows})=>dashboardHarness.send(other,rows,{width:1200,height:800}),{other,rows});
  assert.equal(await control('unit').inputValue(),'ID');
  assert.deepEqual(await shown(),['MENU-EVENT-DE','MENU-EVENT-FR']);
  await choose('country','France');assert.deepEqual(await shown(),['MENU-EVENT-FR']);
  assert.deepEqual(await page.evaluate(id=>dashboardHarness.metrics(id),id),[1,0,0],'Country choice scopes the summary counts');
  assert.match(await scope.locator('.cd-coverage').first().textContent(),/Events 1/);assert.match(await scope.locator('.cd-coverage').last().textContent(),/Events 3/);
  await choose('country','All');await choose('product','Germany assay');assert.deepEqual(await shown(),['MENU-EVENT-DE']);
  await choose('product','All');await choose('unit','Other');assert.deepEqual(await shown(),['MENU-EVENT-OTHER']);
  await choose('unit','All');assert.equal((await shown()).length,3);
  // Keyboard choice uses the custom combobox rather than a native OS popup.
  await control('unit').focus();await page.keyboard.press('ArrowDown');await menu('unit').waitFor({state:'visible'});
  await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await control('unit').inputValue(),'ID');await noMenu();
  assert.equal(await control('unit').evaluate(n=>n===document.activeElement),true);
  await choose('group','Application');assert.equal(await control('group').inputValue(),'application');
  assert((await shown()).every(key=>key.startsWith('MENU-APP-')),'View by menu changes the parent level');
  await choose('group','Event');
  await open('product');await menu('product').locator('.cd-filter-search').fill('France assay');
  assert.equal(await menu('product').getByRole('option').count(),1);await page.keyboard.press('Enter');
  assert.deepEqual(await shown(),['MENU-EVENT-FR'],'Searching and pressing Enter applies the matching product');
  await choose('product','All');
  await open('country');await page.keyboard.press('Escape');await noMenu();
  assert.equal(await control('country').evaluate(n=>n===document.activeElement),true,'Escape returns focus to the filter');
  await open('country');await scope.locator('h1').click();await noMenu();
  await open('country');await send();await noMenu();
  assert.equal(await control('country').evaluate(n=>n===document.activeElement),true,'Data refresh restores focus before replacing an open filter');
  await open('country');await page.evaluate(id=>dashboardHarness.send(id,[],{type:4,width:1180,height:800,noDataView:true}),id);await noMenu();
  assert.equal(await control('country').evaluate(n=>n===document.activeElement),true,'Host resize closes the menu and preserves trigger focus');
  await open('product');
  const options=menu('product').locator('.cd-filter-options');assert(await options.evaluate(n=>n.scrollHeight>n.clientHeight),'Long choices have their own scroll area');
  await options.evaluate(n=>n.scrollTop=80);await page.waitForTimeout(30);
  assert.equal(await menu('product').count(),1,'Scrolling choices does not close their menu');assert(await options.evaluate(n=>n.scrollTop>0));
  await page.keyboard.press('Escape');
  await page.evaluate(id=>dashboardHarness.send(id,[],{type:4,width:1200,height:440,noDataView:true}),id);
  await open('country');await scope.locator('.change-dashboard').evaluate(n=>n.scrollTop=40);await page.waitForTimeout(30);await noMenu();
  await scope.locator('.change-dashboard').evaluate(n=>n.scrollTop=0);
  await open('country');await page.evaluate(()=>window.scrollBy(0,12));await page.waitForTimeout(30);await noMenu();
  // Menus belong to their own visual instance. A second instance must not write
  // through to the first instance's country or unit selections.
  await choose('country','France');const firstState=await page.evaluate(id=>dashboardHarness.state(id),id);
  await open('country',second);await menu('country',second).getByRole('option',{name:'Germany',exact:true}).click();
  assert.equal(await control('country',second).inputValue(),'Germany');assert.equal(await control('country').inputValue(),'France');
  assert.deepEqual(await page.evaluate(id=>dashboardHarness.state(id),id),firstState,'Another visual’s menu leaves this instance unchanged');
  await open('country',second);await page.evaluate(async other=>{const entry=dashboardHarness.instances[other];entry.visual.destroy();await entry.visual.queue;},other);
  assert.equal(await second.locator('.cd-filter-menu').count(),0,'Destroy removes any open menu');
 }finally{
  await page.evaluate(async ids=>{for(const id of ids){const entry=dashboardHarness.instances[id];entry.visual.destroy();await entry.visual.queue;entry.element.remove();delete dashboardHarness.instances[id];}},[id,other]);
  await page.setViewportSize({width:1280,height:1000});
 }
 console.log('PASS in-visual filter menus: actual pointer/keyboard/search choices, ID default and scope, refresh/resize/scroll closure, internal option scrolling, Escape/outside clicks and instance isolation.');
}
module.exports={runChecks};
