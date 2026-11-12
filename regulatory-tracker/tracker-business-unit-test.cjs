const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('./powerbi-visual/node_modules/@playwright/test');
const project=path.dirname(__dirname),sample=JSON.parse(fs.readFileSync(path.join(__dirname,'sample.json'),'utf8'));
async function demoChecks(page,base){
 const rows=['ID','CMI'].map(unit=>({BusinessUnit:unit,AppID:'DEMO-A-'+unit,ROID:'DEMO-R-'+unit,SubID:'DEMO-S-'+unit,AppStatus:'Active',ROStatus:'In Progress',SubStatus:'Planned',Country:'Ireland',Product:'Device '+unit,Manufacturer:'Test site',OriginalSubmission:'2026-01-01'}));
 let delivered=rows;await page.route('**/sample.json?*',route=>route.fulfill({json:delivered}));
 const box=page.locator('.filter[data-kind=businessUnit]'),status=page.locator('#filter-status');
 const expect=async(unit,count)=>{await status.filter({hasText:count+' submissions'}).waitFor();assert.equal(await box.locator(':scope > summary').textContent(),'Business Unit · '+(unit==='All'?'All':unit+' (1 selected)'));};
 const load=async data=>{delivered=data;await page.goto(base+'/regulatory-tracker/index.html');await box.waitFor({state:'attached'});};
 const open=async()=>{const drawer=page.locator('#filter-drawer');if(!await drawer.evaluate(node=>node.open))await drawer.locator(':scope > summary').click();if(!await box.evaluate(node=>node.open))await box.locator(':scope > summary').click();};
 await load(rows);await expect('ID',1);await open();assert.equal(await box.getByLabel('ID',{exact:true}).isChecked(),true);
 await box.getByRole('button',{name:'Clear',exact:true}).click();await expect('All',2);await box.getByLabel('CMI',{exact:true}).check();await expect('CMI',1);
 await page.locator('select[name=groupBy]').selectOption('Regulatory event');await page.setViewportSize({width:1100,height:850});await expect('CMI',1);
 await page.locator('#reset-filters').click();await expect('All',2);await page.locator('select[name=groupBy]').selectOption('Application');await expect('All',2);
 await load([rows[1]]);await expect('ID',0);await open();assert.equal(await box.getByLabel('ID',{exact:true}).isChecked(),true,'Demo keeps the missing selected ID accessible');
 await load([]);await expect('ID',0);
 await load(rows.map(({BusinessUnit,...row})=>row));await expect('All',2);
 await load(rows.map(row=>({...row,BusinessUnit:null})));await expect('ID',0);
 await page.unroute('**/sample.json?*');await page.goto(base+'/regulatory-tracker/index.html');await expect('ID',new Set(sample.filter(row=>row.BusinessUnit==='ID').map(row=>row.SubID).filter(Boolean)).size);
 console.log('PASS: browser demo starts with visible ID, supports explicit CMI/All and Reset, preserves choices through grouping/resize, and handles empty/no-ID/blank/unmapped data.');
}
async function packageRuntime(){
 const dir=path.join(__dirname,'powerbi-visual/dist'),names=fs.readdirSync(dir).filter(name=>name.endsWith('.pbiviz'));assert.equal(names.length,1);
 const zip=await require('./powerbi-visual/node_modules/jszip').loadAsync(fs.readFileSync(path.join(dir,names[0]))),manifest=JSON.parse(await zip.file('package.json').async('string'));
 const pkg=JSON.parse(await zip.file(manifest.resources.find(resource=>resource.file.endsWith('.pbiviz.json')).file).async('string'));
 assert.equal(pkg.visual.guid,'regulatoryTimelineA2C514A9F58240B5A313F650E136F4F0');assert.equal(pkg.visual.version,'1.18.2.0');assert.equal(pkg.apiVersion,'5.11.0');
 const caps=JSON.parse(fs.readFileSync(path.join(__dirname,'powerbi-visual/capabilities.json'),'utf8'));assert.deepEqual(pkg.capabilities,caps,'Packaged capabilities retain every role and mapping rule');assert.equal(caps.dataRoles.length,69);
 const bootstrap=`window.__roles=${JSON.stringify(caps.dataRoles.map(role=>role.name))};window.__qualityRevision=0;const host={eventService:{renderingStarted(){},renderingFinished(){window.__qualityRevision++},renderingFailed(o,e){throw Error(e)}},fetchMoreData(){return false}};window.__themeVisual=window.powerbi.visuals.plugins[${JSON.stringify(pkg.visual.guid)}].create({element:document.getElementById('host'),host});window.__themeVisual.update({type:2,viewport:{width:1280,height:850},dataViews:[]});`;
 return {js:'window.powerbi={};\n'+pkg.content.js+'\n'+bootstrap,css:pkg.content.css};
}
(async()=>{
 const packaged=process.argv.includes('--package')?await packageRuntime():null,errors=[];
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;
  if(packaged&&pathname.startsWith('/package')){if(pathname==='/package.js'){res.setHeader('Content-Type','text/javascript');res.end(packaged.js);}else if(pathname==='/package.css'){res.setHeader('Content-Type','text/css');res.end(packaged.css);}else res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/package.css"><style>#host{width:1280px;height:850px}</style><div id="host"></div><script src="/package.js"></script>');return;}
  const file=path.resolve(project,'.'+pathname);if(!file.startsWith(project+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(body);});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{browser=await chromium.launch({headless:true,...(process.env.TRACKER_BROWSER_CHANNEL?{channel:process.env.TRACKER_BROWSER_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1500,height:1000}});page.on('pageerror',error=>errors.push(error.message));const base='http://127.0.0.1:'+server.address().port;
  if(!process.argv.includes('--demo')){await page.goto(base+(packaged?'/package.html':'/regulatory-tracker/powerbi-visual/verify/index.html'));await require('./tracker-business-unit.verify.cjs')(page);}
  if(!packaged)await demoChecks(page,base);assert.deepEqual(errors,[]);if(packaged)console.log('PASS: final .pbiviz runtime, version 1.18.2.0, original GUID, 69 roles and unchanged capabilities.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
