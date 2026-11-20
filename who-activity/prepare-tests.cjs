const fs=require('node:fs'), path=require('node:path');

// Shared by the source-class harness and the extracted package runtime test.
// Every public action goes through the Visual host, not a stand-in renderer.
function boot() {
  return `
const errors=[],persisted=[],fetchRequests=[],launches=[];
let allowFetch=false,viewport={width:1440,height:820},visual;
const target=document.getElementById('host');
const host={
 eventService:{renderingStarted(){},renderingFinished(){document.body.dataset.ready='true'},renderingFailed(o,e){errors.push(String(e))}},
 persistProperties(value){persisted.push(value)},
 launchUrl(url){launches.push(url)},
 fetchMoreData(aggregate){fetchRequests.push({aggregate,text:target.textContent,ready:document.body.dataset.ready==='true'});return allowFetch},
 colorPalette:{isHighContrast:false,foreground:{value:'#ffffff'},background:{value:'#000000'},foregroundSelected:{value:'#ffff00'},hyperlink:{value:'#00ffff'}}
};
const dataView=(rows,opts={})=>{
 const roles=ROLES.filter(r=>!(opts.omit||[]).includes(r));
 return {metadata:{...(opts.partial?{segment:{}}:{}),...(opts.preferences?{objects:{preferences:{state:JSON.stringify(opts.preferences)}}}:{})},
 table:{columns:roles.map(r=>({displayName:r,queryName:r,roles:{[r]:true}})),rows:rows.map(row=>roles.map(r=>row[r]??null))}};
};
const send=(rows=sample(),opts={})=>visual.update({type:2,operationKind:opts.append?1:0,viewport,dataViews:[dataView(rows,opts)]});
const reset=(rows=sample(),opts={})=>{visual?.destroy?.();target.replaceChildren();delete document.body.dataset.ready;visual=new Visual({element:target,host});send(rows,opts);};
window.testApi={send,reset,errors,persisted,fetchRequests,launches,sample,sixSiteSample,host,
 get visual(){return visual},setAllowFetch(value){allowFetch=value},
 resize(width,height){viewport={width,height};target.style.width=width+'px';target.style.height=height+'px';visual.update({type:4,viewport})},
 second(rows=sample().filter(r=>r.Site==='ADK'),opts={}){const e=document.getElementById('second');e.replaceChildren();const v=new Visual({element:e,host});v.update({type:2,viewport:{width:900,height:650},dataViews:[dataView(rows,opts)]});window.secondVisual=v;return true;}
};
reset();`;
}

function prepare() {
  const root=__dirname,verify=path.join(root,'verify');fs.mkdirSync(verify,{recursive:true});
  const ts=require('./powerbi/node_modules/typescript');
  const inline=text=>text.replace(/\r\n/g,'\n').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
  const visual=ts.transpileModule(fs.readFileSync(path.join(root,'powerbi','src','visual.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  // These local modules have unique top-level names. The actual generated Visual
  // class is transpiled, then linked to the exact generated logic and UI modules.
  const modules=['powerbi/src/logic.mjs','powerbi/src/ui.mjs','demo.mjs'].map(file=>inline(fs.readFileSync(path.join(root,file),'utf8')));
  fs.writeFileSync(path.join(verify,'harness.js'),'(()=>{\n'+modules.join('\n')+'\n'+inline(visual)+'\n'+boot()+'\n})();');
  fs.writeFileSync(path.join(verify,'harness.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>WHO actual Visual host test</title><style>body{margin:0;background:#171d23}#host{width:1440px;height:820px}#second{width:900px;height:650px}'+fs.readFileSync(path.join(root,'styles.css'),'utf8')+'</style><div id="host"></div><div id="second"></div><script src="harness.js"></script></html>');
  console.log('Prepared transpiled actual Visual class browser harness.');
}
module.exports={boot,prepare};
if(require.main===module)prepare();
