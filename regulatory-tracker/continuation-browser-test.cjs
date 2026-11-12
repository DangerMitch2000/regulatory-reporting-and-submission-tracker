/* Exercise continuation arrows through the actual Power BI Visual and SVG renderer. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('./powerbi-visual/node_modules/@playwright/test');

const categories = [
  {mark:'parentBar',data:'spans',start:'start',end:'end',parent:true},
  {mark:'connector',data:'segments',start:'d1',end:'d2'},
  {mark:'preparationRange',data:'preparationWindows',start:'LMPrepStart',end:'LMPrepEnd'},
  {mark:'predictionRange',data:'predictions',start:'PredictionLow',end:'PredictionHigh'},
  {mark:'surveyRange',data:'surveyWindows',start:'start',end:'end'}
];

async function verify(page, {url,outputDir}) {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const root=page.locator('#host');
  const windowState=()=>page.evaluate(()=>{
    const v=window.__themeVisual.app.view;
    return {range:[v.signal('xlo'),v.signal('xhi')],scrollTop:v.signal('scrollTop'),pageY:window.scrollY};
  });
  const setRange=async range=>page.evaluate(async range=>{
    const v=window.__themeVisual.app.view;v.signal('range',range);await v.runAsync();
  },range);
  const assertArrows=async()=>{
    const result=await page.evaluate(categories=>{
      const v=window.__themeVisual.app.view,lo=v.signal('xlo'),hi=v.signal('xhi'),left=v.signal('left')+3,right=v.signal('width')-22;
      return categories.map(c=>{
        const expected=v.data(c.data).flatMap(d=>{
          const a=d[c.start],b=d[c.end];
          if(a==null||b==null||!Number.isFinite(a)||!Number.isFinite(b)||b<a||b<lo||a>hi)return [];
          return [a<lo?'left':null,b>hi?'right':null].filter(Boolean).map(side=>[d.key,side]);
        });
        const actual=v.data(c.data+'Continuations').map(d=>[d.key,d.continuationSide]);
        const nodes=[...document.querySelectorAll('#host .'+c.mark+'Continuation path')].map(node=>{
          const item=node.__data__,box=node.getBBox();
          return {key:item.datum.key,side:item.datum.continuationSide,x:item.x,left,right,fill:node.getAttribute('fill'),width:box.width,height:box.height};
        });
        return {name:c.mark,expected,actual,nodes};
      });
    },categories);
    for(const r of result){
      assert.deepEqual(r.actual,r.expected,r.name+' data changes with the visible window');
      assert.equal(r.nodes.length,r.expected.length,r.name+' renders every expected arrow');
      for(const n of r.nodes){
        assert.equal(n.x,n.side==='left'?n.left:n.right,r.name+' is anchored at the matching edge');
        assert.ok(n.fill&&n.fill!=='none',r.name+' arrow is filled');
        assert.ok(n.width>=7&&n.height>=7,r.name+' arrow is readable');
      }
    }
    return result;
  };
  const inspectArrow=locator=>locator.evaluate(node=>({key:node.__data__.datum.key,side:node.__data__.datum.continuationSide}));
  await page.goto(url);
  await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
  await page.evaluate(()=>{
    // Retain the realistic history needed by the approval estimate while ensuring
    // the target submission has all four child bar categories.
    window.__continuationRows=window.__dispatchRows.map(r=>({...r,...(r.AppID==='APP-001'?{LMPrepDuration:'6 months'}:{}),...(r.SubID==='SUB-00003'?{DispatchRequired:true}:{})}));
    window.__dispatchSend(window.__continuationRows);
  });
  await page.locator('#host select[name=mode]').selectOption('Compare');
  await page.locator('#host input[name=query]').fill('SUB-00003');
  await page.waitForFunction(()=>window.__themeVisual.app.view.data('predictions').length>0);
  const testIntervals={};
  for(const category of categories){
    await page.locator('#host select[name=mode]').selectOption(category.parent?'Hierarchy':'Compare');
    await setRange(null);
    const record=await page.evaluate(c=>{
      const r=window.__themeVisual.app.view.data(c.data).find(d=>d[c.end]>d[c.start]);
      return r&&{start:r[c.start],end:r[c.end],key:r.key};
    },category);
    assert.ok(record,category.mark+' has a genuine positive-length source bar');
    const span=record.end-record.start,range=[record.start+span*.25,record.end-span*.25];
    testIntervals[category.mark]=range;
    await setRange(range);await assertArrows();
    const arrows=page.locator('#host .'+category.mark+'Continuation path');
    assert.ok(await arrows.count()>=2,category.mark+' has arrows at both edges');
    const arrow=arrows.first(),datum=await inspectArrow(arrow),before=await windowState();
    await arrow.hover();
    await page.locator('#host #tooltip').waitFor({state:'visible'});
    assert.match(await page.locator('#host #tooltip').innerText(),/Continues (before|after) visible window/,category.mark+' explains its continuation');
    // A small pointer movement begun on an arrow must never initiate background pan.
    const box=await arrow.boundingBox();
    const expandedBeforeDrag=await page.evaluate(()=>window.__themeVisual.app.view.data('expanded').map(d=>d.key));
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2,{steps:4});await page.mouse.up();
    assert.deepEqual((await windowState()).range,before.range,category.mark+' pointer drag does not pan');
    assert.deepEqual(await page.evaluate(()=>window.__themeVisual.app.view.data('expanded').map(d=>d.key)),expandedBeforeDrag,category.mark+' pointer drag does not toggle hierarchy');
    await page.mouse.move(1,1);
    const expandedBefore=await page.evaluate(()=>window.__themeVisual.app.view.data('expanded').map(d=>d.key));
    await page.evaluate(async()=>{const v=window.__themeVisual.app.view;v.signal('selectedKey',null);await v.runAsync();});
    await arrow.click();
    await page.waitForFunction(key=>window.__themeVisual.app.view.signal('selectedKey')===key,datum.key);
    assert.equal(await page.locator('#host #selected-details').evaluate(node=>node.open),true,category.mark+' opens Details');
    const expectedExpansion=category.parent?(expandedBefore.includes(datum.key)?expandedBefore.filter(key=>key!==datum.key):[...expandedBefore,datum.key]):expandedBefore;
    assert.deepEqual((await page.evaluate(()=>window.__themeVisual.app.view.data('expanded').map(d=>d.key))).sort(),expectedExpansion.slice().sort(),category.parent?'Parent continuation toggles its children':'Comparison continuation only opens Details');
    if(!category.parent)assert.match(await page.locator('#host #detail-body').innerText(),/SUB-00003/);
    await page.locator('#host #selected-details').evaluate(node=>node.open=false);
    if(category.parent){await arrow.click();await page.waitForFunction(({key,expanded})=>window.__themeVisual.app.view.data('expanded').some(d=>d.key===key)===expanded,{key:datum.key,expanded:expandedBefore.includes(datum.key)});assert.deepEqual((await page.evaluate(()=>window.__themeVisual.app.view.data('expanded').map(d=>d.key))).sort(),expandedBefore.slice().sort(),'Second continuation click restores child expansion');await page.locator('#host #selected-details').evaluate(node=>node.open=false);}
    assert.deepEqual((await windowState()).range,before.range,category.mark+' click keeps dates fixed');
    // Exact endpoints and fully off-screen bars should not create misleading arrows.
    await setRange([record.start,record.end]);await assertArrows();
    await setRange([record.end+span,record.end+2*span]);await assertArrows();
  }

  // Mouse controls recompute the arrows and consume the gesture, retaining rows and page position.
  await page.locator('#host select[name=mode]').selectOption('Compare');
  await setRange(testIntervals.surveyRange);
  await page.evaluate(()=>window.scrollTo(0,0));
  const point=await page.evaluate(()=>{
    const v=window.__themeVisual.app.view,b=document.querySelector('#host #chart').getBoundingClientRect();
    return {x:b.x+(v.signal('left')+v.signal('width')-24)/2,y:b.y+v.signal('top')+20};
  });
  for(const modifier of ['Shift','Control']){
    const before=await windowState();await page.mouse.move(point.x,point.y);await page.keyboard.down(modifier);
    try{await page.mouse.wheel(0,100);await page.waitForFunction(old=>JSON.stringify([window.__themeVisual.app.view.signal('xlo'),window.__themeVisual.app.view.signal('xhi')])!==JSON.stringify(old),before.range);}
    finally{await page.keyboard.up(modifier);}
    const after=await windowState();assert.equal(after.scrollTop,before.scrollTop,modifier+' wheel retains row position');assert.equal(after.pageY,before.pageY,modifier+' wheel does not scroll page');
    if(modifier==='Shift')assert.ok(after.range[1]-after.range[0]>before.range[1]-before.range[0],'Shift wheel zooms out gently');
    else assert.ok(Math.abs((after.range[1]-after.range[0])-(before.range[1]-before.range[0]))<1,'Control wheel pans without changing scale');
    await assertArrows();
  }
  // Repeated wide / narrow windows prove that edge hints appear and disappear.
  for(const range of [null,testIntervals.connector,testIntervals.predictionRange,testIntervals.surveyRange,null]){await setRange(range);await assertArrows();}

  await setRange(testIntervals.surveyRange);
  for(const theme of ['dark','light']){
    await page.locator('#host #theme-select').selectOption(theme);
    await page.waitForFunction(theme=>window.__themeVisual.app.view.signal('themeMode')===theme,theme);
    await assertArrows();await page.mouse.move(1,1);
    await root.screenshot({path:path.join(outputDir,'continuations-'+theme+'.png')});
  }
  await page.evaluate(()=>{document.querySelector('#host').style.width='760px';window.__themeVisual.update({type:4,viewport:{width:760,height:650}});});
  await page.waitForFunction(()=>window.__themeVisual.app.view.signal('width')<1000);
  await assertArrows();await root.screenshot({path:path.join(outputDir,'continuations-compact.png')});
  assert.deepEqual(errors,[],'Actual Visual has no browser errors');
  console.log('PASS: all five bar continuation categories, viewport edges and offscreen handling, parent hierarchy expansion, comparison Details, no arrow drag expansion/pan, Ctrl+wheel and Shift+wheel with stable rows/page, dynamic ranges, both themes and compact rendering.');
}

async function main(){
  const directory=path.resolve(process.argv[2]||'powerbi-visual/verify');
  fs.mkdirSync(directory,{recursive:true});
  const server=http.createServer((req,res)=>{
    const file=path.resolve(directory,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(directory+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,content)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(content);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_BROWSER_CHANNEL||'msedge'});
  try{const page=await browser.newPage({viewport:{width:1400,height:1100}});await verify(page,{url:'http://127.0.0.1:'+server.address().port+'/index.html',outputDir:directory});}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports=verify;
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
