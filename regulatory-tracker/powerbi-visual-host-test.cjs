/* Host delivery regression: exercise the generated Visual, without mounting Vega.
   Run after installing the generated project's pinned build dependencies. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sourceRoot=__dirname;
const ts=require(path.join(sourceRoot,'powerbi-visual/node_modules/typescript'));
const files=new Map(),out=path.join(__dirname,'__host-test-output');
const virtualFS={...fs,mkdirSync(){},writeFileSync:(p,value)=>files.set(path.normalize(p),value),appendFileSync:(p,value)=>files.set(path.normalize(p),String(files.get(path.normalize(p))||'')+value)};
// Execute the production generator; generated files stay in memory, so this test
// cannot overwrite the package being built or a colleague's generated project.
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'powerbi-visual.build.cjs'),'utf8'),{
 require:n=>n==='fs'?virtualFS:require(n),process:{argv:['node','build',sourceRoot,out]},Buffer,console:{log(){}},
},{filename:'powerbi-visual.build.cjs'});
const generated=name=>String(files.get(path.join(out,name)));
const productionMap=vm.runInNewContext(generated('src/adapter.js').replaceAll('export ','')+';mapTable',{Date});
const compiled=ts.transpileModule(generated('src/visual.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const plain=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness({accept=[true,true],mountGate,updateGate,renderError}={}){
 const events=[],requests=[],renders=[],sizes=[],maps=[],mounts=[],notice={hidden:true,textContent:''};
 const main={style:{visibility:''},inert:false},properties=new Map(),attributes=new Map();
 const root={style:{setProperty:(k,v)=>properties.set(k,v)},append(){},replaceChildren(){this.removed=true},setAttribute:(k,v)=>attributes.set(k,v),querySelector:s=>s==='#host-notice'?notice:s==='#tracker-main'?main:null};
 let destroyed=0;
 const app={async resize(w,h){sizes.push([w,h])},async updateRows(rows,missingPrediction,mappedFields){if(updateGate)await updateGate.promise;if(renderError){const error=renderError;renderError=null;throw error;}renders.push(plain({rows,missingPrediction,mappedFields}))},destroy(){destroyed++}};
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
 // A delivered chunk must finish mapping/rendering before the host can be asked
 // for another chunk. This is the compatibility behavior required by the patch.
 for(const phase of ['mount','render']){
  const gate=deferred(),h=harness(phase==='mount'?{mountGate:gate}:{updateGate:gate});
  h.update(['S1','S2'],{segment:true});await tick();
  assert.equal(h.requests.length,0,'No request before '+phase+' settles');
  gate.resolve();await h.visual.queue;
  assert.equal(h.renders.length,1);assert.deepEqual(h.requests,[true]);
  assert.deepEqual(h.renders[0].rows.map(r=>r.SubID),['S1','S2']);
 }
 for(const batches of [2,3]){
  const h=harness();
  for(let batch=1;batch<batches;batch++){
   const ids=Array.from({length:batch*2},(_,i)=>'S'+i);
   await h.update(ids,{segment:true,operationKind:batch===1?0:1,id:'chunk'+batch});
   assert.equal(h.mounts.length,1);assert.equal(h.maps.length,batch);assert.equal(h.renders.length,batch);
   assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),ids,'Each render replaces the prior accumulated table without concatenating');
   assert.match(h.notice.textContent,new RegExp((batch*2)+' rows received'));
   assert.match(h.notice.textContent,/counts reflect loaded rows only/);
   assert.equal(h.main.style.visibility,'');assert.equal(h.main.inert,false);
   assert.equal(h.attributes.get('aria-busy'),'true');
   const before=h.sizes.length;
   await h.update([],{type:4,segment:true,id:'resize'+batch,viewport:{width:1200,height:800}});
   assert.equal(h.requests.length,batch,'Resize cannot request the same segment again');
   assert.equal(h.maps.length,batch,'Resize cannot replace displayed partial data');
   assert.equal(h.sizes.length,before+1,'Displayed partial data still resizes while fetching');
  }
  const all=Array.from({length:batches*2},(_,i)=>'S'+i);
  await h.update(all,{operationKind:1,id:'final',viewport:{width:1200,height:800}});
  assert.deepEqual(h.requests,Array(batches-1).fill(true));
  assert.equal(h.mounts.length,1);assert.equal(h.maps.length,batches);assert.equal(h.renders.length,batches);
  assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),all,'Final table contains every row exactly once');
  assert.equal(h.notice.hidden,true);assert.equal(h.attributes.get('aria-busy'),'false');
  assert.equal(h.events.filter(e=>e[0]==='start').length,h.events.filter(e=>e[0]==='finish').length);
 }
 for(const refusal of [false,new Error('Host unavailable')]){
  const h=harness({accept:[refusal]});await h.update(['S1','S2'],{segment:true});
  assert.equal(h.renders.length,1);assert.match(h.notice.textContent,/limited the delivered rows/);
  assert.equal(h.main.style.visibility,'');assert.equal(h.attributes.get('aria-busy'),'false');
  await h.update(['S1','S2'],{segment:true,type:4});
  assert.equal(h.requests.length,1);assert.equal(h.renders.length,1);
 }
 {
  const h=harness({accept:[true,false]});await h.update(['S1'],{segment:true});
  await h.update(['S1','S2','S3'],{segment:true,operationKind:1});
  assert.equal(h.maps.length,2);assert.equal(h.renders.length,2);
  assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),['S1','S2','S3']);
  assert.match(h.notice.textContent,/limited the delivered rows/);
 }
 {
  const h=harness();await h.update(['OLD']);
  await h.update(['NEW1'],{segment:true,id:'new filter'});
  assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),['NEW1'],'New filter drops all prior-query rows');
  await h.update(['NEW1','NEW2'],{operationKind:1});
  h.update(['NEW1','NEW2','OLD APPEND'],{operationKind:1,segment:true,id:'superseded append'});
  await h.update([],{id:'empty filter'});
  assert.equal(h.renders.at(-1).rows.length,0);assert.equal(h.requests.length,1,'Queued superseded data cannot request more');
  assert.equal(h.notice.hidden,true);assert.equal(h.main.style.visibility,'');
  h.visual.update({id:'empty dataView',type:2,viewport:{width:1000,height:700},dataViews:[]});await h.visual.queue;
  assert.equal(h.renders.at(-1).rows.length,0);assert.match(h.notice.textContent,/Add fields/);
 }
 for(const phase of ['mount','render']){
  const gate=deferred(),h=harness(phase==='mount'?{mountGate:gate}:{updateGate:gate});
  h.update(['OLD'],{segment:true,id:'old '+phase});await tick();
  h.update(['NEW'],{id:'new while '+phase});gate.resolve();await h.visual.queue;
  assert.equal(h.mounts.length,1);assert.equal(h.requests.length,0,'Data superseded during '+phase+' cannot fetch');
  assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),['NEW']);
 }
 {
  const gate=deferred(),h=harness({updateGate:gate});
  h.update(['OLD'],{segment:true});await tick();h.visual.destroy();gate.resolve();await h.visual.queue;await tick();
  assert.equal(h.requests.length,0);assert.equal(h.destroyed,1);assert.equal(h.visual.root.removed,true);
  const before=h.events.length;await h.update(['IGNORED']);assert.equal(h.events.length,before);
 }
 for(const mode of ['mapping','render']){
  const h=harness(mode==='render'?{renderError:new Error('Render failed')}:{ });
  const options=mode==='mapping'?{columns:[{roles:{SubID:true}},{roles:{SubID:true}}]}:{};
  await h.update(['S'],{...options,segment:true,id:'bad '+mode});
  assert.equal(h.events.at(-1)[0],'failed');assert.equal(h.requests.length,0,'Failed '+mode+' cannot request another batch');
  assert.match(h.notice.textContent,/Unable to render/);assert.equal(h.attributes.get('aria-busy'),'false');
  await h.update(['RECOVERED'],{id:'recovery'});
  assert.deepEqual(h.renders.at(-1).rows.map(r=>r.SubID),['RECOVERED']);assert.equal(h.notice.hidden,true);
 }
 // Preserve the unchanged-size chart update guard from1.17.2.
 {
  const lifecycle=generated('src/runtime.js').match(/return \{view, async updateRows[\s\S]*?view\.finalize\(\);\}\};/);
  assert.ok(lifecycle);let dimensions={width:900,height:500},runs=0,layouts=0;const chart={clientWidth:900,clientHeight:500};
  const view={signal(name,value){if(arguments.length===1)return dimensions;dimensions=value;return this},async runAsync(){runs++}};
  const api=vm.runInNewContext('('+lifecycle[0].slice(7,-1)+')',{view,chart,root:{style:{setProperty(){}}},updateLayout(){layouts++},run:fn=>Promise.resolve().then(fn)});
  await api.resize(900,700);await api.resize(900,700);assert.equal(runs,0);
  chart.clientHeight=600;await api.resize(900,800);assert.equal(runs,1);
  await api.resize(900,800);assert.equal(runs,1);
  chart.clientWidth=500;chart.clientHeight=100;await api.resize(500,300);
  assert.deepEqual(plain(dimensions),{width:720,height:280});assert.equal(runs,2);assert.equal(layouts,5);
 }
 console.log('PASS: render before fetch; accumulated delivery without duplicated rows; refusal, filter refresh, empty data, resize, errors, destroy, and unchanged-size guard.');
})().catch(error=>{console.error(error);process.exitCode=1});
