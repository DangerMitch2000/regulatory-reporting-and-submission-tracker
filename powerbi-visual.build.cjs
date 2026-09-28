/* Reproducible Power BI project generator. Uses the published demo assets. */
const fs=require('fs'),path=require('path');
const source=process.argv[2]||'.',out=process.argv[3]||'powerbi-visual';
const read=n=>fs.readFileSync(path.join(source,n),'utf8').replace(/\r\n/g,'\n');
const write=(n,v)=>{const p=path.join(out,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2));};
const roles=['AppID','ROID','SubID','AppCreated','ROCreated','SubCreated','AppStatus','ROStatus','SubStatus','BusinessUnit','Manufacturer','Product','Country','SubmissionType','OriginalDispatch','LatestDispatch','ActualDispatch','OriginalSubmission','LatestSubmission','ActualSubmission','OriginalApproval','LatestApproval','ActualApproval','RegistrationStart','RegistrationEnd'];
const dates=roles.filter(x=>/Created|Dispatch|Approval|Registration|Submission$/.test(x)&&x!=='SubmissionType');
write('package.json',{name:'regulatory-timeline-powerbi',version:'1.9.0',private:true,scripts:{package:'pbiviz package',test:'node test.cjs'},dependencies:{'powerbi-visuals-api':'5.11.0','vega':'5.33.0','vega-interpreter':'1.2.1'},devDependencies:{'powerbi-visuals-tools':'7.2.1','typescript':'5.9.3','@playwright/test':'1.55.1','esbuild':'0.25.10'}});
write('pbiviz.json',{visual:{name:'regulatoryTimeline',displayName:'Regulatory Tracker',guid:'regulatoryTimelineA2C514A9F58240B5A313F650E136F4F0',visualClassName:'Visual',version:'1.9.0.0',description:'The regulatory lifecycle demo as a self-contained Power BI visual. Hierarchy, searchable filters, comparison, full details and a data-quality worklist.',supportUrl:'https://github.com/DangerMitch2000/regulatory-timeline-demo/issues',gitHubUrl:'https://github.com/DangerMitch2000/regulatory-timeline-demo'},apiVersion:'5.11.0',author:{name:'Dualta Mitchell',email:'dualtamitchell@gmail.com'},assets:{icon:'assets/icon.png'},externalJS:null,style:'style/visual.less',capabilities:'capabilities.json',dependencies:null,stringResources:[]});
write('tsconfig.json',{compilerOptions:{allowJs:true,checkJs:false,allowSyntheticDefaultImports:true,esModuleInterop:true,resolveJsonModule:true,target:'es2022',module:'esnext',moduleResolution:'node',sourceMap:true,outDir:'./.tmp/build',declaration:false,skipLibCheck:true,lib:['es2022','dom']},files:['src/visual.ts']});
write('capabilities.json',{privileges:[{name:'ExportContent',essential:false}],dataRoles:roles.map(name=>({name,displayName:name,kind:'Grouping',description:dates.includes(name)?'Date column (not Date hierarchy); do not summarize.':'Map the source column to this role; no renaming required.'})),dataViewMappings:[{conditions:[Object.fromEntries(roles.map(n=>[n,{max:1}]))],table:{rows:{select:roles.map(role=>({for:{in:role}})),dataReductionAlgorithm:{window:{count:30000}}}}}],objects:{},supportsHighlight:false,supportsKeyboardFocus:true,supportsEmptyDataView:true,sorting:{default:{}}});
let html=read('index.html').match(/<body>([\s\S]*?)<script/)[1];
html=html.replace(/VERSION [\d.]+ · FICTIONAL DATA/,'POWER BI · 1.9 PREVIEW').replace(/<small>[\d.]+<\/small>/,'<small>1.9</small>').replace('All examples are fictional. ','').replace(/<a href="https:\/\/github.com[\s\S]*?<\/a>/,'');
html=html.replace('Loading…','Add AppID, ROID and SubID to begin.');
let css=read('style.css').replaceAll(':root','&').replace(/(?<![-\w])body(?![-\w])/g,'&');
// Keep every demo rule, scoped to this visual instance. Size follows host viewport.
css+='\n&{height:100%;width:100%;overflow:auto;position:relative} #chart{height:clamp(480px,calc(var(--host-height,780px) - 280px),1100px)} &.details-expanded #chart{height:clamp(480px,calc(var(--host-height,780px) - 360px),850px)}';
write('style/visual.less','.regulatory-timeline{\n'+css+'\n}');
html='<div id="host-notice" role="status" hidden></div>'+html;
const spec=JSON.parse(read('timeline.json'));
// Window key listeners would affect sibling instances. Vega key input stays in its view.
let specText=JSON.stringify(spec).replaceAll('window:keydown','view:keydown').replaceAll('window:keyup','view:keyup');
write('src/assets.json',{html,spec:JSON.parse(specText)});
let app=read('app.js');
app=app.replace('(async()=>{',"import * as predictionModule from './predictions';\nimport * as qualityModule from './quality';\nimport * as qualityUIModule from './quality-ui';\nexport async function mount(root, data, config){\n const vega=config.vega;");
app=app.replace('window.regulatoryPredictions','predictionModule');
app="import * as submissionPeriodModule from './submission-period';\n"+app.replace('window.regulatorySubmissionPeriod','submissionPeriodModule');
app=app.replace('window.regulatoryQualityUI','qualityUIModule').replace('window.regulatoryQuality','qualityModule').replace('window.regulatoryExportWorklist','config.exportWorklist');
write('src/predictions.js',read('predictions.js'));
write('src/submission-period.js',read('submission-period.js'));
write('src/quality.js',read('quality.js'));
write('src/quality-ui.js',read('quality-ui.js').replace('All examples are fictional. ',''));
app=app.replace('document.getElementById(id)','root.querySelector(\'[id="\'+id+\'"]\')');
app=app.replace("let view,rows,queue=Promise.resolve(),detailQuery='',detailPage=0,selectedKey='',timer;","let view,rows,queue=Promise.resolve(),detailQuery='',detailPage=0,selectedKey='',timer,disposed=false;");
app=app.replace("queue.then(fn)","queue.then(()=>disposed?undefined:fn())");
app=app.replace(/const \[spec,data\]=window\.__demoBundle[\s\S]*?rows=data;/,"const spec=config.spec; rows=data;");
app=app.replace("vega.parse(spec),{renderer:'svg',hover:true}","vega.parse(spec,null,config.expr?{ast:true}:{}),{renderer:'svg',hover:true,...(config.expr?{expr:config.expr}:{})}");
app=app.replaceAll('document.body','root');
if(!app.includes("// POWERBI_MOUNT_READY"))throw Error("Missing Power BI mount lifecycle marker");
app=app.replace("// POWERBI_MOUNT_READY",`
  return {view, async updateRows(next,missingPrediction=[],mappedFields=null){predictionFieldsMissing=missingPrediction;qualityMappedFields=mappedFields;rows=next;preparePredictions();prepareQuality();filterBoxes.forEach(f=>f.refresh());await filter();},async resize(width,height){root.style.setProperty('--host-height',height+'px'); await run(()=>view.signal('denebContainer',{width:Math.max(720,chart.clientWidth),height:Math.max(480,chart.clientHeight)}).runAsync());},destroy(){disposed=true;clearTimeout(timer);filterBoxes.forEach(f=>f.dispose());qualityPanel?.destroy();resize.disconnect();view.finalize();}};`);
app=app.replace("status.textContent='Could not load the demo: '+error.message;console.error(error);","status.textContent='Could not load the visual: '+error.message;throw error;");
app=app.replace(/\}\)\(\);\s*$/,'}');
write('src/runtime.js',app);
write('src/adapter.js',`export const roles=${JSON.stringify(roles)};\nexport const dateRoles=${JSON.stringify(dates)};
export function mapTable(table){
 const columns=table?.columns||[],mapped=new Map();
 for(const role of roles){const matches=columns.map((c,i)=>c.roles?.[role]?i:-1).filter(i=>i>=0);if(matches.length>1)throw Error('Map only one column to '+role);if(matches.length)mapped.set(role,matches[0]);}
 const mappedFields=[...mapped.keys()];const missing=['AppID','ROID','SubID'].filter(r=>!mapped.has(r));const missingPrediction=['Country','ActualSubmission','ActualApproval'].filter(r=>!mapped.has(r));
 if(missing.length)return {rows:[],missing,missingPrediction,mappedFields};
 const rows=(table.rows||[]).map(values=>Object.fromEntries(roles.map(role=>{let value=mapped.has(role)?values[mapped.get(role)]:null;if(dateRoles.includes(role)&&value instanceof Date)value=Number.isFinite(value.valueOf())?value.toISOString():null;return [role,value];})));
 return {rows,missing,missingPrediction,mappedFields};
}
// PrivilegeStatus.Allowed is zero in the supported Power BI API. Use the value
// here so browser host harnesses do not need a runtime dependency on its type-only enum.
export async function exportQualityWorklist(host,csv,fileName){
 const service=host?.downloadService;
 if(typeof service?.exportVisualsContent!=='function')return false;
 try{
  if(typeof service.exportStatus==='function' && await service.exportStatus()!==0)return false;
  return !!(await service.exportVisualsContent(csv,fileName,'csv','Regulatory Tracker data-quality worklist'));
 }catch{return false;}
}
`);
write('src/visual.ts',`import powerbi from 'powerbi-visuals-api';
import * as vega from 'vega';
import {expressionInterpreter} from 'vega-interpreter';
import {mount} from './runtime';
import {mapTable,exportQualityWorklist} from './adapter';
import assets from './assets.json';
import '../style/visual.less';
export class Visual implements powerbi.extensibility.visual.IVisual {
 private root:HTMLElement; private host:powerbi.extensibility.visual.IVisualHost;
 private app:any; private queue:Promise<any>=Promise.resolve(); private destroyed=false; private lastTable:any;
 constructor(options:powerbi.extensibility.visual.VisualConstructorOptions){
  this.host=options.host;this.root=document.createElement('div');this.root.className='regulatory-timeline';
  // Static bundled markup only. All data values are inserted using textContent.
  const markup=new DOMParser().parseFromString(assets.html,'text/html');
  this.root.append(...Array.from(markup.body.childNodes).map(node=>document.importNode(node,true)));options.element.appendChild(this.root);
 }
 public update(options:powerbi.extensibility.visual.VisualUpdateOptions):void{
  this.host.eventService?.renderingStarted(options);
  this.queue=this.queue.then(async()=>{
   if(this.destroyed)return;
   const dv=options.dataViews?.[0],table=dv?.table;
   const isData=!!(options.type & 2)||(!this.app);
   const notice=this.root.querySelector('#host-notice') as HTMLElement;
   if(!this.app)this.app=await mount(this.root,[],{vega,expr:expressionInterpreter,spec:JSON.parse(JSON.stringify(assets.spec)),exportWorklist:(csv:string,fileName:string)=>exportQualityWorklist(this.host,csv,fileName)});
   await this.app.resize(options.viewport.width,options.viewport.height);
   if(isData){
    const mapped=mapTable(table);await this.app.updateRows(mapped.rows,mapped.missingPrediction,mapped.mappedFields);this.lastTable=table;
    notice.hidden=!mapped.missing.length&&!dv?.metadata?.segment;
    notice.textContent=mapped.missing.length?'Add fields: '+mapped.missing.join(', '):dv?.metadata?.segment?'Loading additional data…':'';
    if(dv?.metadata?.segment){
     const accepted=this.host.fetchMoreData(true);
     if(!accepted)notice.textContent='Power BI limited the delivered rows. Narrow report filters; counts and memberships reflect loaded rows only.';
    }
   }
   if(!this.destroyed)this.host.eventService?.renderingFinished(options);
  }).catch(error=>{const notice=this.root.querySelector('#host-notice') as HTMLElement;notice.hidden=false;notice.textContent='Unable to render: '+error.message;this.host.eventService?.renderingFailed(options,error.message);});
 }
 public getFormattingModel():powerbi.visuals.FormattingModel{return {cards:[]};}
 public destroy():void{this.destroyed=true;this.queue.finally(()=>{this.app?.destroy();this.root.replaceChildren();});}
}
`);
write('test.cjs',`const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('src/adapter.js','utf8').replaceAll('export ','');const ctx={Date};vm.createContext(ctx);vm.runInContext(code+';this.mapTable=mapTable;this.exportQualityWorklist=exportQualityWorklist;',ctx);
const table={columns:[{roles:{SubID:true}},{roles:{ActualDispatch:true}},{roles:{AppID:true}},{roles:{ROID:true}}],rows:[['S',new Date('2026-01-02'),'A','R']]};
const result=ctx.mapTable(table);assert.equal(result.rows[0].AppID,'A');assert.equal(result.rows[0].ActualDispatch,'2026-01-02T00:00:00.000Z');assert.equal(result.rows[0].Product,null);assert.equal(result.missingPrediction.length,3);assert.equal(ctx.mapTable({columns:[],rows:[]}).missing.length,3);assert.equal(ctx.mapTable({...table,rows:[]}).rows.length,0);
const predictionRoles=['Country','ActualSubmission','ActualApproval'];const predictionTable={columns:[...table.columns,...predictionRoles.map(role=>({roles:{[role]:true}}))],rows:[['S',null,'A','R','France','2026-07-01',null]]};
assert.deepEqual(Array.from(ctx.mapTable(predictionTable).missingPrediction),[],'Plan mappings are optional for independent estimates');
for(const role of predictionRoles){const i=predictionTable.columns.findIndex(c=>c.roles[role]);const missingRole={columns:predictionTable.columns.filter((_,j)=>j!==i),rows:predictionTable.rows.map(r=>r.filter((_,j)=>j!==i))};assert.deepEqual(Array.from(ctx.mapTable(missingRole).missingPrediction),[role]);}
assert.deepEqual(Array.from(result.mappedFields),['AppID','ROID','SubID','ActualDispatch']);assert.deepEqual(Array.from(ctx.mapTable().mappedFields),[]);assert.deepEqual(Array.from(ctx.mapTable({columns:[{roles:{Country:true}}],rows:[]}).mappedFields),['Country']);assert.deepEqual(Array.from(ctx.mapTable({...table,rows:[]}).mappedFields),['AppID','ROID','SubID','ActualDispatch']);
assert.throws(()=>ctx.mapTable({...table,columns:[...table.columns,{roles:{SubID:true}}]}),/one column/);
const caps=JSON.parse(fs.readFileSync('capabilities.json'));assert.equal(caps.dataRoles.length,25);assert.deepEqual(caps.privileges,[{name:'ExportContent',essential:false}]);
const app=fs.readFileSync('src/runtime.js','utf8');assert(!app.includes('fetch('));assert(!app.includes('document.getElementById'));assert(!app.includes('document.body'));assert(app.includes('filterBoxes.forEach'));assert(app.includes('predictionModule'));assert(!app.includes('window.regulatoryPredictions'));assert(app.includes('qualityModule'));assert(app.includes('qualityUIModule'));assert(app.includes('config.exportWorklist'));assert(app.includes('qualityMappedFields=mappedFields'));assert(app.includes('prepareQuality()'));assert(app.includes('qualityPanel?.destroy()'));assert(!app.includes('window.regulatoryQuality'));assert(rolesAreMapped());function rolesAreMapped(){return caps.dataRoles.some(r=>r.name==='BusinessUnit')}
const visual=fs.readFileSync('src/visual.ts','utf8');assert(visual.includes('mapped.mappedFields'));assert(visual.includes('exportQualityWorklist(this.host,csv,fileName)'));
(async()=>{
 let called=0,args;const service={exportStatus:async()=>0,exportVisualsContent:async(...values)=>{called++;args=values;return true}};
 assert.equal(await ctx.exportQualityWorklist({downloadService:service},'id,status','quality.csv'),true);assert.deepEqual(args,['id,status','quality.csv','csv','Regulatory Tracker data-quality worklist']);assert.equal(called,1);
 for(const status of [1,2,3])assert.equal(await ctx.exportQualityWorklist({downloadService:{...service,exportStatus:async()=>status}},'x','quality.csv'),false);
 assert.equal(called,1);assert.equal(await ctx.exportQualityWorklist({},'x','quality.csv'),false);
 assert.equal(await ctx.exportQualityWorklist({downloadService:{...service,exportVisualsContent:async()=>false}},'x','quality.csv'),false);
 assert.equal(await ctx.exportQualityWorklist({downloadService:{...service,exportStatus:async()=>{throw Error('blocked')}}},'x','quality.csv'),false);
 assert.equal(await ctx.exportQualityWorklist({downloadService:{...service,exportVisualsContent:async()=>{throw Error('cancelled')}}},'x','quality.csv'),false);
 console.log('PASS: explicit mapping and mapped-field coverage, optional CSV export privilege, host export success/blocked/cancelled handling, no runtime network or global IDs.');
})().catch(error=>{console.error(error);process.exitCode=1});
`);
write('README.md',`# Regulatory Tracker Power BI visual 1.9.0 preview\n\nThis project reuses the demo HTML, CSS, controls and Vega specification. It is not a Deneb import.\n\nInstall: Power BI Desktop → Visualizations (…) → Import a visual from a file → regulatory-tracker-1.9.0.0.pbiviz. Your tenant must permit uncertified custom visuals.\n\nMap each source column to its named field well. The source names do not need renaming. AppID, ROID and SubID are required; other fields are optional and missing values are explicit. Use raw Date columns, not Date hierarchies. Set Don't summarize where offered. Dates should be Date/DateTime columns. Fields: ${roles.join(', ')}.\n\nStart with a visual at least 1100 × 850, or use Focus mode. This preserves the demo's 720px minimum chart width and internal scrolling. Match date zoom and expanded rows when comparing against the demo. The header is Regulatory Tracker, with no sample-data notice in the installed visual.\n\nUse Theme at the top-right to switch the entire visual between Dark and Light. Each new instance starts in Dark; Light remains selected through data refresh, resize and switching views. Theme selection is local to this visual instance and is not saved in report bookmarks or across reopening. Status colours use matching higher-contrast variants in Light; counts, dates, filters, pins and calculations are unchanged.\n\nBusiness Unit uses your business_unit__c field. Product options render only after two typed characters, with at most 50 matches and a bounded selected list. Approval estimates use country medians from delivered history, with both actual dates from 2020 to today, at least 10 distinct submissions, and the middle 50% historical interval. Recorded approval plans are shown alongside independent estimates; plan fields are optional for estimation. Valid approved submissions show a historical approval benchmark, excluding that submission from its own supporting history and requiring at least 10 other qualifying submissions. This is a retrospective comparison using current history, not a forecast made before approval. Map Country, ActualSubmission and ActualApproval to enable estimation. Missing or invalid actual dates and ambiguous countries still withhold estimates. The anchor is actual submission, otherwise latest planned submission, otherwise original planned submission. Future planned anchors are allowed from 2020 through 2100 and clearly labelled Forecast based on planned submission. Invalid, conflicting or unmapped higher-priority fields do not silently fall back. Training still uses only trusted actual submission-to-approval intervals. Map both LatestSubmission and OriginalSubmission to enable the complete planned-date fallback. The model is descriptive and not externally validated; source errors, report filters and incomplete rows limit reliability. Multi-country history is withheld. Long durations are retained and flagged. Searchable filters, hierarchy, states, pins, comparison, elapsed days, date matrix, membership paging and selectable details reuse the demo implementation. Copy buttons depend on the host's clipboard permission; selectable text is the fallback. Visual interactions stay inside this visual; they do not filter other report visuals. Report filters feed this visual normally. Local filters and selection persist through ordinary updates/resizing but are not saved in report bookmarks/reopening.\n\nPower BI table data uses windowed delivery and requests additional accumulated rows using fetchMoreData(true); a notice remains if the host refuses more rows. Counts reflect delivered filtered rows. Never enable Show items with no data to manufacture membership combinations. Use appropriate model relationships.\n\nThe Submission date filter offers All dates, years, a custom inclusive From/To range, and No usable date. It resolves the same actual/latest/original submission priority using all delivered membership evidence before local filters; planned dates never enter historical training. Local date filtering preserves the supporting country history. It combines with membership filters and applies to the Data quality worklist and export. Host refresh/resize retain its selection; Reset filters clears it.

The Data quality view uses the same Business Unit, Site, Product, Country and Submission Type filters. It groups the filtered worklist by site and shows source-date issues for review. Unmapped optional fields are tracked separately from genuinely blank mapped values. CSV export uses the Power BI host download service where available, with optional ExportContent permission. Power BI may ask for consent or block download under tenant policy; a selectable/copy fallback remains available. This export is initiated only by the user and does not send records over the network. The public demo downloads a CSV locally through the browser.\n\nNo runtime network access, analytics, demo records, private source mappings or screenshots are embedded in the package. Vega is bundled under its BSD license.\n\nBuild: npm install; npm test; npm run package. See the repository generator and workflow for exact tool versions. This preview is built with official Microsoft tooling and tested in a browser host harness. Actual Power BI Desktop/Service import and tenant compatibility still require verification. It is not Microsoft-certified.\n`);
write('VEGA-LICENSE.txt',read('VEGA-LICENSE.txt'));
// 20px PNG icon; source is generated locally and contains no external branding.
const zlib=require('zlib');function crc(b){let c=0xffffffff;for(const a of b){c^=a;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,b){const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([n,t,b,c]);}
const ih=Buffer.alloc(13);ih.writeUInt32BE(20,0);ih.writeUInt32BE(20,4);ih[8]=8;ih[9]=6;const pixels=Buffer.alloc(20*81);for(let y=0;y<20;y++)for(let x=0;x<20;x++){const i=y*81+1+x*4,bar=(y>=4&&y<7&&x>=3&&x<13)||(y>=9&&y<12&&x>=7&&x<18)||(y>=14&&y<17&&x>=5&&x<15);pixels.set(bar?[109,158,255,255]:[20,24,31,255],i);}write('assets/icon.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
console.log('Generated Power BI project in '+out);


