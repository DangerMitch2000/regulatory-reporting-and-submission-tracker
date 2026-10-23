const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),api=require('./text-wrap');
const unit=text=>Array.from(text).length,wrap=api.createWrapper(unit);
assert.deepEqual(wrap('  Alpha  beta\n gamma  ',10,14,2),['Alpha beta','gamma'],'Whitespace and word boundaries stay compact');
assert.deepEqual(wrap('Alpha beta gamma delta',10,14,2),['Alpha beta','gamma…'],'Only a clipped final line gets an ellipsis');
assert.deepEqual(wrap('Alpha beta',5,14,2),['Alpha','beta'],'Complete text does not get an ellipsis');
assert.deepEqual(wrap('ABCDEFGHIJKLM',5,14,2),['ABCDE','FGHI…'],'Long unbroken identifiers split within the width');
assert.deepEqual(wrap('😀😀😀😀😀',3,14,2),['😀😀😀','😀😀'],'Surrogate pairs stay intact');
assert.deepEqual(wrap('😀😀😀😀😀😀😀',3,14,2),['😀😀😀','😀😀…']);
assert.deepEqual(wrap('汉字产品名称',3,14,2),['汉字产','品名称']);
assert.deepEqual(wrap('ABCDE',1,14,1),['…']);
assert.deepEqual(wrap('ABCDE',.5,14,1),[],'Do not overflow even when the ellipsis cannot fit');
for(const value of [null,undefined,'',' \t\n '])assert.deepEqual(wrap(value,100,14,2),[]);
for(const width of [0,-1,NaN,Infinity])assert.deepEqual(wrap('Text',width,14,2),[]);
for(const size of [0,-1,NaN,Infinity])assert.deepEqual(wrap('Text',100,size,2),[]);
for(const count of [0,-1,NaN,Infinity])assert.deepEqual(wrap('Text',100,14,count),[]);
assert.deepEqual(wrap(0,10,14,1),['0']);
assert.equal(wrap.measure('Alpha beta',14),10,'Width and wrapping share the same measured glyph metrics');
assert.equal(wrap.measure('  A ',14),4,'Standalone measurement preserves meaningful spacing');
for(const value of [null,undefined,''])assert.equal(wrap.measure(value,14),0);
for(const size of [0,-1,NaN,Infinity])assert.equal(wrap.measure('Text',size),0);
const proportional=api.createWrapper((text,size)=>Array.from(text).reduce((sum,ch)=>sum+(ch==='W'?1.1:ch==='i'?.2:ch===' '? .25:.6)*size,0));
assert.equal(proportional('WWWWWWWW',32,10,2).length,2);assert.deepEqual(proportional('iiiiiiii',32,10,2),['iiiiiiii'],'Measured glyph widths determine wrapping, not character count');
for(const text of ['Alpha beta gamma delta','ABCDEFGHIJKLMNO','😀Wide words 😀 emoji','汉字产品名称另一个产品'])for(const width of [2,4,7,10,15])for(const count of [1,2,3]){
 const lines=wrap(text,width,14,count);assert.ok(lines.length<=count);assert.ok(lines.every(line=>unit(line)<=width));assert.ok(lines.slice(0,-1).every(line=>!line.endsWith('…')));assert.ok(lines.every(line=>line===line.trim()&&line.length>0));
}
{
 let calls=0;const cached=api.createWrapper(text=>{calls++;return unit(text);},{cacheSize:2,measurementCacheSize:0});
 const first=cached('Alpha beta gamma',6,14,2),after=calls;first[0]='Mutated';assert.deepEqual(cached('Alpha beta gamma',6,14,2),['Alpha','beta…']);assert.equal(calls,after,'Repeated layout uses cached measurements and copied output');
 cached('Other phrase',6,14,2);cached('Third phrase',6,14,2);cached('Alpha beta gamma',6,14,2);assert.ok(calls>after,'Old layout entries are evicted at the configured bound');
 const before=calls;cached.clearCache();cached('Alpha beta gamma',6,14,2);assert.ok(calls>before);
 let measured=0;const measures=api.createWrapper(text=>{measured++;return unit(text);},{cacheSize:0,measurementCacheSize:2});measures('A',10,14,1);measures('A',11,14,1);assert.equal(measured,1);measures('B',10,14,1);measures('C',10,14,1);measures('A',10,14,1);assert.equal(measured,4,'Measurement cache also evicts old entries');
 let longCalls=0;const uncachedLong=api.createWrapper(text=>{longCalls++;return unit(text);},{maxCacheTextLength:4});uncachedLong('Long product name',100,14,1);uncachedLong('Long product name',100,14,1);assert.equal(longCalls,2,'Oversized source strings are not retained in caches');
}
{
 // Execute the browser UMD path with a real measurement API contract. The root
 // browser suite additionally checks actual Canvas and SVG at chart widths.
 let created=0,calls=0;const ctx={font:'',measureText(text){calls++;return {width:unit(text)*2};}},sandbox={document:{createElement(tag){assert.equal(tag,'canvas');created++;return {getContext(type){assert.equal(type,'2d');return ctx;}};}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('./text-wrap'),'utf8'),sandbox);const browser=sandbox.regulatoryTextWrap;assert.equal(created,0,'Canvas setup is lazy');assert.deepEqual(Array.from(browser.wrap('One two three',14,12,2)),['One two','three']);assert.equal(created,1);assert.equal(ctx.font,'12px "Segoe UI"');const before=calls;browser.wrap('One two three',14,12,2);assert.equal(calls,before);browser.wrap('Other',14,16,1);assert.equal(ctx.font,'16px "Segoe UI"');
 const registered={};browser.register({expressionFunction(name,fn){registered[name]=fn;}});assert.equal(registered.trackerWrapText,browser.wrap);assert.equal(registered.trackerTextWidth,browser.measure);assert.equal(registered.trackerTextWidth('Wide',16),8);assert.equal(registered.trackerPointerScale,browser.pointerScale);
}
{
 const registered={};let metrics=0;const fn=api.register({textMetrics:{width(item,text){metrics++;assert.equal(item.font,'Segoe UI');assert.equal(item.fontSize,14);return unit(text);}},expressionFunction(name,callback){registered[name]=callback;}});assert.equal(fn,registered.trackerWrapText);assert.deepEqual(fn('One two three',7,14,2),['One two','three']);assert.ok(metrics>0,'Headless callers can use their own Vega text metrics');const before=metrics;assert.equal(registered.trackerTextWidth('One two three',14),13);assert.equal(metrics,before,'Width expression reuses wrapping measurements');assert.equal(registered.trackerPointerScale,api.pointerScale);
}
{
 const svg=(scale=1)=>({localName:'svg',getScreenCTM(){return {a:scale,b:0};}});
 assert.equal(api.pointerScale({target:svg()}),1);
 assert.equal(api.pointerScale({target:{ownerSVGElement:svg(.6)}}),.6,'Report CSS scaling applies to pointer distances');
 assert.equal(api.pointerScale({target:svg(2)}),2);
 assert.equal(api.pointerScale({target:{ownerSVGElement:{ownerSVGElement:svg(.75),getScreenCTM(){return {a:3,b:0};}}}}),.75,'Use the outer SVG rather than a nested viewport');
 assert.equal(api.pointerScale({target:{localName:'svg',getScreenCTM(){return {a:0,b:2};}}}),2,'CTM x scale accounts for rotation');
 const bounds={nodeName:'svg',width:{baseVal:{value:1000}},getBoundingClientRect(){return {width:600};}};
 assert.equal(api.pointerScale({target:bounds}),.6,'Bounding rectangle is a safe fallback without CTM');
 assert.equal(api.pointerScale({target:{...bounds,getScreenCTM(){throw new Error('Detached');}}}),.6);
 assert.equal(api.pointerScale({target:{...bounds,getScreenCTM(){return {a:NaN,b:0};}}}),.6);
 for(const event of [null,undefined,{}, {target:{}},{target:{localName:'div',getScreenCTM(){return {a:2,b:0};}}},{target:{localName:'svg'}},{target:{...bounds,width:{baseVal:{value:0}}}},{target:{...bounds,getBoundingClientRect(){throw new Error('Detached');}}}])assert.equal(api.pointerScale(event),1,'Missing or unusable SVG geometry defaults to unscaled');
}
console.log('PASS: measured compact wrapping, word boundaries, Unicode identifiers, final-line clipping, bounded caches, lazy browser Canvas, SVG pointer scales and Vega registration.');
