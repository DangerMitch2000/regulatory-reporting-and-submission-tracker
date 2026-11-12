/* Stable real-pointer locators: chart resize must not invalidate a sampled coordinate. */
let registered;
function playwright(){try{return require('@playwright/test');}catch{return require('./powerbi-visual/node_modules/@playwright/test');}}
async function registerRowSelector(){
 if(!registered)registered=playwright().selectors.register('trackerRow',()=>({
  query(root,value){const {selector,key}=JSON.parse(value);return [...root.querySelectorAll(selector)].find(node=>node.__data__?.datum?.key===key)||null;},
  queryAll(root,value){const {selector,key}=JSON.parse(value);return [...root.querySelectorAll(selector)].filter(node=>node.__data__?.datum?.key===key);}
 }));
 await registered;
}
async function rowLocator(page,selector,key){
 await registerRowSelector();return page.locator('trackerRow='+JSON.stringify({selector,key}));
}
async function setFilterDrawer(page,open){const drawer=page.locator('#host #filter-drawer');await drawer.waitFor({state:'attached'});if(await drawer.evaluate(node=>node.open)!==open)await drawer.locator(':scope > summary').click();}
async function toggleFilter(page,filter){await setFilterDrawer(page,true);await filter.locator(':scope > summary').click();if(!await filter.evaluate(node=>node.open))await setFilterDrawer(page,false);}
async function resetFilters(page){await setFilterDrawer(page,true);await page.locator('#host #reset-filters').click();await setFilterDrawer(page,false);}
module.exports={registerRowSelector,rowLocator,setFilterDrawer,toggleFilter,resetFilters};
