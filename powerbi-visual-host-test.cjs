/* Host delivery regression: exercise the generated Visual, without mounting Vega.
   Run after installing the generated project's pinned build dependencies. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(path.join(__dirname,'powerbi-visual/node_modules/typescript'));
const files=new Map(),out=path.join(__dirname,'__host-test-output');
const virtualFS={...fs,mkdirSync(){},writeFileSync:(p,value)=>files.set(path.normalize(p),value),appendFileSync:(p,value)=>files.set(path.normalize(p),String(files.get(path.normalize(p))||'')+value)};
// Execute the production generator; generated files stay in memory, so this test
// cannot overwrite the package being built or a colleague's generated project.
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'powerbi-visual.build.cjs'),'utf8'),{
 require:n=>n==='fs'?virtualFS:require(n),process:{argv:['node','build',__dirname,out]},Buffer,console:{log(){}},
},{filename:'powerbi-visual.build.cjs'});
const generated=name=>String(files.get(path.join(out,name)));
const productionMap=vm.runInNewContext(generated('src/adapter.js').replaceAll('export ','')+';mapTable',{Date});
const compiled=ts.transpileModule(generated('src/visual.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const plain=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness({accept=[true,true],mountGate,updateGate}={}){
 const events=[],requests=[],renders=[],sizes=[],maps=[],mounts=[],notice={hidden:true,textContent:''};
 const main={style:{visibility:''},inert:false},properties=new Map(),attributes=new Map();
 const root={style:{setProperty:(k,v)=>properties.set(k,v)},append(){},replaceChildren(){this.removed=true},setAttribute:(k,v)=>attributes.set(k,v),querySelector:s=>s==='#host-notice'?notice:s==='#tracker-main'?main:null};
 let destroyed=0;
 const app={async resize(w,h){sizes.push([w,h])},async updateRows(rows,missingPrediction,mappedFields){if(updateGate)await updateGate.promise;renders.push(plain({rows,missingPrediction,mappedFields}))},destroy(){destroyed++}};
 const host={eventService:{renderingStarted:o=>events.push(['start',o.id]),renderingFinished:o=>events.push(['finish',o.id]),renderingFailed:(o,m)=>events.push(['failed',o.id,m])},fetchMoreData:aggregate=>{requests.push(aggregate);const result=accept.length?accept.shift():true;if(result instanceof Error)throw result;return result},launchUrl(){}};
 const exports={};
 vm.runInNewContext(compiled,{
  exports,require:n=>{
   if(n==='./runtime')return {mount:async(...args)=>{mounts.push(args);if(mountGate)await mountGate.promise;return app}};
   if(n==='./adapter')return {mapTable:table=>{maps.push(table);return productionMap(table)},exportQualityWorklist(){}};
   if(n==='./presentation')return {safeURL:value=>value};
   if(n==='./assets.json')return {html:'',spec:{}};
   return {};
  },document:{createElement:()=>root,importNode:n=>n},DOMParser:class{parseFromString(){return {body:{childNodes:[]}}}},
 });
 const visual=new exports.Visual({host,element:{appendChild(){}}});
 const update=(ids,{segment=false,type=2,operationKind=0,id='update',viewport={width:1000,height:700},columns}={})=>{
  const table={columns:columns||[{roles:{SubID:true}}],rows:ids.map(value=>[value])};
  visual.update({id,type,operationKind,viewport,dataViews:[{table,metadata:segment?{segment:{}}:{}}]});
  return visual.queue;
 };
 return {visual,update,host,events,requests,renders,sizes,maps,mounts,notice,main,properties,attributes,get destroyed(){return destroyed}};
}

(async()=>{
 for(const batches of [2,3]){
  const h=harness();
  for(let batch=1;batch<batches;batch++){
   await h.update(Array.from({length:batch*2},(_,i)=>'S'+i),{segment:true,operationKind:batch===1?0:1,id:'chunk'+batch});
   assert.equal(h.mounts.length,0,'No Vega mount while more accumulated rows are accepted');
   assert.equal(h.maps.length,0,'Partial tables are not mapped');
   assert.equal(h.renders.length,0,'Partial tables do not rebuild the hierarchy');
   assert.match(h.notice.textContent,new RegExp((batch*2)+' rows received'));
   assert.equal(h.main.style.visibility,'hidden','Prior query results stay hidden during host loading');
   assert.equal(h.attributes.get('aria-busy'),'true');
   await h.update([],{type:4,segment:true,id:'resize'+batch,viewport:{width:1200,height:800}});
   assert.equal(h.requests.length,batch,'Resize cannot request the same segment again');
  }
  const all=Array.from({length:batches*2},(_,i)=>'S'+i);
  await h.update(all,{operationKind:1,id:'final',viewport:{width:1200,height:800}});
  assert.deepEqual(h.requests,Array(batches-1).fill(true),'Always request accumulated delivery');
  assert.equal(h.mounts.length,1);assert.equal(h.maps.length,1);assert.equal(h.renders.length,1);
  assert.deepEqual(h.renders[0].rows.map(r=>r.SubID),all,'Final accumulated table retains each delivered row exactly once');
  assert.deepEqual(h.sizes,[[1200,800]]);assert.equal(h.notice.hidden,true);
  assert.equal(h.main.style.visibility,'');assert.equal(h.main.inert,false);assert.equal(h.attributes.get('aria-busy'),'false');
  assert.equal(h.events.filter(e=>e[0]==='start').length,h.events.filter(e=>e[0]==='finish').length);
 }
 for(const refusal of [false,new Error('Host unavailable')]){
  const h=harness({accept:[refusal]});
  await h.update(['S1','S2'],{segment:true});
  assert.equal(h.renders.length,1);assert.deepEqual(h.renders[0].rows.map(r=>r.SubID),['S1','S2']);
  assert.match(h.notice.textContent,/limited the delivered rows/);assert.equal(h.notice.hidden,false);
  await h.update(['S1','S2'],{segment:true,type:4});
  assert.equal(h.requests.length,1);assert.equal(h.renders.length,1,'Resize cannot remap a refused partial table');
 }
 {
  const h=harness({accept:[true,false]});
  await h.update(['S1'],{segment:true});
  await h.update(['S1','S2','S3'],{segment:true,operationKind:1});
  assert.equal(h.maps.length,1);assert.equal(h.renders.length,1);
  assert.deepEqual(h.renders[0].rows.map(r=>r.SubID),['S1','S2','S3'],'Refusal after an accepted request renders every accumulated row');
  assert.match(h.notice.textContent,/limited the delivered rows/);
 }
 {
  const h=harness();await h.update(['OLD']);
  await h.update(['NEW1'],{segment:true,id:'new filter'});
  assert.equal(h.main.style.visibility,'hidden');assert.equal(h.renders.length,1);
  await h.update(['NEW1','NEW2'],{operationKind:1});
  assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),['NEW1','NEW2'],'A new filter never concatenates old query results');
  h.update(['NEW1','NEW2','OLD APPEND'],{operationKind:1,segment:true,id:'superseded append'});
  await h.update([],{id:'empty filter'});
  assert.equal(h.renders.at(-1).rows.length,0,'An empty filter clears all prior data');
  assert.equal(h.requests.length,1,'Queued superseded data cannot fetch another old segment');
  assert.equal(h.notice.hidden,true);assert.equal(h.main.style.visibility,'');
  h.visual.update({id:'empty dataView',type:2,viewport:{width:1000,height:700},dataViews:[]});await h.visual.queue;
  assert.equal(h.renders.at(-1).rows.length,0);assert.match(h.notice.textContent,/Add fields/);
 }
 {
  const gate=deferred(),h=harness({mountGate:gate});
  h.update(['OLD'],{id:'old mount'});await tick();
  h.update(['NEW'],{id:'new while mounting'});gate.resolve();await h.visual.queue;
  assert.equal(h.mounts.length,1);assert.equal(h.maps.length,1);
  assert.deepEqual(h.renders[0].rows.map(r=>r.SubID),['NEW'],'Filter refresh during asynchronous mounting invalidates older data');
 }
 {
  const h=harness();await h.update(['PENDING'],{segment:true});h.visual.destroy();await h.visual.queue;await tick();
  await h.update(['PENDING','FINAL'],{operationKind:1});
  assert.equal(h.mounts.length,0);assert.equal(h.requests.length,1);assert.equal(h.renders.length,0);assert.equal(h.visual.root.removed,true);
  const gate=deferred(),inFlight=harness({updateGate:gate});
  inFlight.update(['S']);await tick();inFlight.visual.destroy();gate.resolve();await inFlight.visual.queue;await tick();
  assert.equal(inFlight.destroyed,1,'An in-flight app is disposed once after its queued operation finishes');
  const before=inFlight.events.length;await inFlight.update(['IGNORED']);assert.equal(inFlight.events.length,before,'Removed visuals cannot start new host work');
 }
 {
  const h=harness();await h.update(['S'],{columns:[{roles:{SubID:true}},{roles:{SubID:true}}],id:'bad mapping'});
  assert.equal(h.events.at(-1)[0],'failed');assert.match(h.notice.textContent,/Map only one/);
  await h.update(['RECOVERED'],{id:'recovery'});
  assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),['RECOVERED'],'A mapping error does not poison the host update queue');
  assert.equal(h.notice.hidden,true);
 }
 // Execute the actual generated mount lifecycle's resize method with a tiny Vega
 // signal stand-in. Equal dimensions must not schedule another signal pulse.
 {
  const lifecycle=generated('src/runtime.js').match(/return \{view, async updateRows[\s\S]*?view\.finalize\(\);\}\};/);
  assert.ok(lifecycle,'Generated mount lifecycle is available');
  let dimensions={width:900,height:500},runs=0,layouts=0;const chart={clientWidth:900,clientHeight:500};
  const view={signal(name,value){if(arguments.length===1)return dimensions;dimensions=value;return this},async runAsync(){runs++}};
  const api=vm.runInNewContext('('+lifecycle[0].slice(7,-1)+')',{view,chart,root:{style:{setProperty(){}}},updateLayout(){layouts++},run:fn=>Promise.resolve().then(fn)});
  await api.resize(900,700);await api.resize(900,700);assert.equal(runs,0,'Unchanged dimensions produce no Vega resize run');
  chart.clientHeight=600;await api.resize(900,800);assert.equal(runs,1);
  await api.resize(900,800);assert.equal(runs,1);
  chart.clientWidth=500;chart.clientHeight=100;await api.resize(500,300);
  assert.deepEqual(plain(dimensions),{width:720,height:280});assert.equal(runs,2);assert.equal(layouts,5,'Layout still follows every host resize');
 }
 console.log('PASS: accumulated host chunks render once; refusal, filter refresh, empty data, resize, errors, destroy, and unchanged-size Vega guard.');
})().catch(error=>{console.error(error);process.exitCode=1});
