import geography from './geography.json';
import {analyze,derive,DEFAULT_STATE,toCsv} from './logic.mjs';

const NS='http://www.w3.org/2000/svg';
const fmt=n=>Number(n||0).toLocaleString('en-GB');
const date=v=>{if(!Number.isFinite(v))return 'Not recorded';const d=new Date(v);return String(d.getUTCDate()).padStart(2,'0')+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+' '+d.getUTCFullYear();};
const text=v=>v==null?'':String(v);
const list=v=>Array.isArray(v)?v.filter(Boolean).join(' · '):text(v);
function el(tag,content,cls){const n=document.createElement(tag);if(content!=null)n.textContent=content;if(cls)n.className=cls;return n;}
function button(label,fn,cls=''){const b=el('button',label,cls);b.type='button';b.onclick=fn;return b;}
function svg(tag,attrs={}){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
function safeUrl(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function mount(root,services={}){
 const state={...DEFAULT_STATE,states:[...DEFAULT_STATE.states],products:[],sites:[],units:['ID'],countries:[],search:'',expiry:'all'};
 let model=null,result=null,selectedCountry=null,selectedRecord=null,scope='countries',page=0,theme='dark',palette=null,searchTimer=null,disposed=false;
 const PAGE=40,countryById=new Map(geography.countries.map(c=>[String(c.id),c])),shapes=new Map(),filterUIs=new Map();
 const app=el('section',null,'registration-map');app.dataset.theme=theme;root.append(app);
 const head=el('header',null,'map-header'),identity=el('div');identity.append(el('h1','Registration coverage'),el('p','Country view · registration states and expiry','map-subtitle'));head.append(identity);
 const themeLabel=el('label','Theme ','map-theme'),themeSelect=el('select');themeSelect.setAttribute('aria-label','Theme');for(const value of ['dark','light']){const o=el('option',value==='dark'?'Dark':'Light');o.value=value;themeSelect.append(o);}themeSelect.value=theme;themeSelect.onchange=()=>{theme=themeSelect.value;applyTheme();renderData();};themeLabel.append(themeSelect);head.append(themeLabel);app.append(head);
 const metrics=el('div',null,'map-metrics');app.append(metrics);
 const toolbar=el('div',null,'map-toolbar'),search=el('input');search.type='search';search.placeholder='Search IDs, products, catalog numbers…';search.setAttribute('aria-label','Search registrations');search.className='map-search';search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=search.value;page=0;selectedRecord=null;renderData();},160);};toolbar.append(search);
 const filterBar=el('div',null,'map-filterbar');toolbar.append(filterBar);app.append(toolbar);
 const filters=[['products','Products'],['sites','Sites'],['units','Business units'],['states','Registration state'],['countries','Countries']];
 for(const [key,label]of filters){
  const d=el('details',null,'map-filter'),summary=el('summary',label);d.dataset.filter=key;d.append(summary);
  const pop=el('div',null,'map-filter-popover'),find=el('input');find.type='search';find.placeholder='Find '+label.toLowerCase();find.setAttribute('aria-label','Find '+label.toLowerCase());
  const choices=el('div',null,'map-filter-options');pop.append(find,button('All '+label.toLowerCase(),()=>{state[key]=[];page=0;selectedRecord=null;renderData();drawChoices(key);},'map-filter-all'),choices);d.append(pop);filterBar.append(d);
  filterUIs.set(key,{d,summary,find,choices,label});find.oninput=()=>drawChoices(key);d.addEventListener('toggle',()=>{if(d.open){for(const [other,ui]of filterUIs)if(other!==key)ui.d.open=false;drawChoices(key);}});
 }
 const expiryLabel=el('label','Expiry ','map-expiry'),expiry=el('select');expiry.setAttribute('aria-label','Expiry');for(const [value,label]of [['all','All dates'],['next90','Next 90 days'],['expired','Past end date'],['noend','Missing / beyond 2100']]){const option=el('option',label);option.value=value;expiry.append(option);}expiry.onchange=()=>{state.expiry=expiry.value;page=0;selectedRecord=null;renderData();};expiryLabel.append(expiry);filterBar.append(expiryLabel);
 filterBar.append(button('Reset filters',()=>{Object.assign(state,{...DEFAULT_STATE,states:[...DEFAULT_STATE.states],products:[],sites:[],units:[],countries:[],search:'',expiry:'all'});search.value='';expiry.value='all';selectedCountry=null;selectedRecord=null;scope='countries';page=0;for(const ui of filterUIs.values()){ui.d.open=false;ui.find.value='';}renderData();},'map-reset'));
 const active=el('div',null,'map-active'),notice=el('div',null,'map-notice');notice.setAttribute('role','status');app.append(active,notice);
 const main=el('div',null,'map-main'),mapPanel=el('section',null,'map-canvas-panel'),side=el('section',null,'map-side');main.append(mapPanel,side);app.append(main);
 const mapTop=el('div',null,'map-map-toolbar'),mapHint=el('span','Select a country for registrations','map-muted'),zoomControls=el('div');mapTop.append(mapHint,zoomControls);mapPanel.append(mapTop);
 const world=svg('svg',{viewBox:'0 0 1000 520',role:'group','aria-label':'World registration coverage map',preserveAspectRatio:'xMidYMid meet'});world.classList.add('map-world');
 const ocean=svg('rect',{x:0,y:0,width:1000,height:520,fill:'transparent'}),land=svg('g');world.append(ocean,land);mapPanel.append(world);
 const tooltip=el('div',null,'map-tooltip');tooltip.setAttribute('role','tooltip');tooltip.hidden=true;mapPanel.append(tooltip);
 let zoom=1,tx=0,ty=0,drag=null,suppressClick=false,suppressTimer=null;
 function transform(){land.setAttribute('transform',`translate(${tx} ${ty}) scale(${zoom})`);zoomLabel.textContent=Math.round(zoom*100)+'%';}
 function setZoom(next){next=Math.max(1,Math.min(8,next));const ratio=next/zoom;tx=500-(500-tx)*ratio;ty=260-(260-ty)*ratio;zoom=next;if(zoom===1){tx=ty=0;}transform();}
 zoomControls.append(button('−',()=>setZoom(zoom/1.4),'map-zoom-out'));const zoomLabel=el('span','100%','map-zoom-label');zoomControls.append(zoomLabel,button('+',()=>setZoom(zoom*1.4),'map-zoom-in'),button('World',()=>{zoom=1;tx=ty=0;transform();},'map-world-reset'));
 zoomControls.querySelector('.map-zoom-out').setAttribute('aria-label','Zoom out');zoomControls.querySelector('.map-zoom-in').setAttribute('aria-label','Zoom in');
 world.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,tx,ty,moved:false};suppressClick=false;});
 world.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4){drag.moved=true;world.setPointerCapture?.(e.pointerId);tooltip.hidden=true;const scale=1000/world.getBoundingClientRect().width;tx=Math.max(-1000*zoom,Math.min(1000,drag.tx+dx*scale));ty=Math.max(-520*zoom,Math.min(520,drag.ty+dy*scale));transform();}});
 function endDrag(){if(drag){suppressClick=drag.moved;drag=null;clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>{suppressClick=false;},0);}}world.addEventListener('pointerup',endDrag);world.addEventListener('pointercancel',endDrag);world.addEventListener('lostpointercapture',endDrag);
 world.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();setZoom(zoom*(e.deltaY<0?1.15:1/1.15));},{passive:false});
 function selectCountry(id){selectedCountry=id;selectedRecord=null;scope='registrations';page=0;renderData();}
 function activateCountry(id,e){if(e.type==='keydown'){if(!['Enter',' '].includes(e.key))return;e.preventDefault();}else if(suppressClick&&e.detail!==0){suppressClick=false;return;}selectCountry(id);}
 function describeCountry(c){const a=result?.countries.find(x=>String(x.id)===String(c.id));return c.name+' · '+fmt(a?.count)+' matching registrations';}
 function showTip(c,e){tooltip.textContent=describeCountry(c);tooltip.hidden=false;const box=mapPanel.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(box.width-250,(e?.clientX||box.left+20)-box.left+12))+'px';tooltip.style.top=Math.max(42,(e?.clientY||box.top+42)-box.top-52)+'px';}
 for(const c of geography.countries){
  const id=String(c.id),g=svg('g',{'data-country':id}),p=svg('path',{d:c.path,tabindex:0,role:'button','aria-label':c.name,'data-country':id});p.classList.add('map-country');g.append(p);
  const activate=e=>activateCountry(id,e);p.addEventListener('click',activate);p.addEventListener('keydown',activate);p.addEventListener('pointermove',e=>{if(!drag?.moved)showTip(c,e);});p.addEventListener('pointerleave',()=>{tooltip.hidden=true;});p.addEventListener('focus',()=>showTip(c));p.addEventListener('blur',()=>{tooltip.hidden=true;});land.append(g);shapes.set(id,{g,p,c});
 }
 // Tiny-country targets stay selectable at world scale; each uses its own real geometry centroid.
 for(const [id,{g,p,c}]of shapes){const b=p.getBBox();if((b.width<6||b.height<5)&&Number.isFinite(c.cx)&&Number.isFinite(c.cy)){const dot=svg('circle',{cx:c.cx,cy:c.cy,r:3.3,tabindex:0,role:'button','aria-label':c.name,'data-country':id});dot.classList.add('map-country-dot');dot.onclick=e=>activateCountry(id,e);dot.onkeydown=e=>activateCountry(id,e);dot.onpointermove=e=>showTip(c,e);dot.onpointerleave=()=>{tooltip.hidden=true;};dot.onfocus=()=>showTip(c);dot.onblur=()=>{tooltip.hidden=true;};g.append(dot);shapes.get(id).dot=dot;}}
 const legend=el('div',null,'map-legend');mapPanel.append(legend,el('p','No matching records means none in the delivered, filtered data. It does not establish that a product is unregistered.','map-footnote'));
 const footer=el('footer',null,'map-footer');footer.append(el('span','Map: Natural Earth · country boundaries'),el('span','Drag to pan · Ctrl+wheel to zoom'));app.append(footer);
 const fallback=el('section',null,'map-copy-fallback');fallback.hidden=true;const fallbackTitle=el('strong'),copyArea=el('textarea');copyArea.readOnly=true;copyArea.setAttribute('aria-label','Copyable content');fallback.append(fallbackTitle,button('Close',()=>{fallback.hidden=true;}),copyArea);app.append(fallback);
 function manualCopy(value,label){fallbackTitle.textContent=label;copyArea.value=value;fallback.hidden=false;copyArea.focus();copyArea.select();}
 async function copy(value,label='Copy IDs'){if(!value)return;try{if(services.onCopy){if(await services.onCopy(value)!==false)return;}else if(navigator.clipboard){await navigator.clipboard.writeText(value);return;}}catch{}manualCopy(value,label+' — select and copy');}
 async function exportRows(records){const csv=toCsv(records);try{if(services.onExport&&await services.onExport(csv,'registration-coverage.csv')!==false)return;}catch{}manualCopy(csv,'CSV — select and copy');}
 function applyTheme(){app.dataset.theme=theme;app.classList.toggle('map-high-contrast',!!palette);for(const [prop,value]of [['--map-hc-fg',palette?.foreground],['--map-hc-bg',palette?.background]]){if(value)app.style.setProperty(prop,value);else app.style.removeProperty(prop);}}
 function optionsFor(key){let value=result?.options?.[key]||model?.options?.[key]||[];if(key==='units')value=[...new Set([...state.units,...value])];return key==='countries'?value.map(c=>({value:String(c.id),label:c.name})):value.map(s=>({value:String(s),label:String(s)}));}
 function drawChoices(key){const ui=filterUIs.get(key),query=ui.find.value.trim().toLowerCase(),values=optionsFor(key).filter(o=>o.label.toLowerCase().includes(query));ui.choices.replaceChildren();for(const o of values.slice(0,120)){const label=el('label'),box=el('input');box.type='checkbox';box.checked=state[key].includes(o.value);box.onchange=()=>{state[key]=box.checked?[...new Set([...state[key],o.value])]:state[key].filter(v=>v!==o.value);page=0;selectedRecord=null;renderData();};label.append(box,el('span',o.label));ui.choices.append(label);}if(values.length>120)ui.choices.append(el('p','Type to narrow '+fmt(values.length)+' choices.','map-muted'));if(!values.length)ui.choices.append(el('p','No matching values.','map-muted'));}
 function filteredRecords(){let values=scope==='review'?result.review:result.records;if(selectedCountry&&scope!=='review')values=values.filter(r=>r.countryIds?.map(String).includes(selectedCountry));return values;}
 function field(grid,label,value){const box=el('div',null,'map-detail-field');box.append(el('span',label),el('strong',value||'Not recorded'));grid.append(box);}
 function openRecord(r){selectedRecord=r;renderSide();}
 function renderSide(){
  side.replaceChildren();if(!result)return;
  const heading=el('div',null,'map-side-heading');heading.append(el('h2',selectedCountry&&scope!=='review'?countryById.get(selectedCountry)?.name:scope==='review'?'Needs review':scope==='countries'?'Country coverage':'Registrations'));side.append(heading);
  if(selectedRecord){const r=selectedRecord;heading.append(button('Back',()=>{selectedRecord=null;renderSide();}));side.append(el('h3',r.id||'Registration ID missing','map-record-id'));const actions=el('div',null,'map-record-actions');if(r.id)actions.append(button('Copy ID',()=>copy(r.id)));const link=r.url?safeUrl(r.url):null;if(link)actions.append(button('Open in platform ↗',()=>{if(services.onLaunchUrl)services.onLaunchUrl(link);else window.open(link,'_blank','noopener,noreferrer');}));side.append(actions);
   const grid=el('div',null,'map-detail-grid');field(grid,'State',r.state);field(grid,'Country',list(r.countryNames)||'Not placed on map');field(grid,'Registration number',list(r.registrationNumbers));field(grid,'Start date',r.startInfo?.label||date(r.start));field(grid,'End date',r.endInfo?.label||date(r.end));field(grid,'Holder',list(r.holders));field(grid,'Legal manufacturer',list(r.legalSites));field(grid,'Registration site',list(r.registrationSites));field(grid,'Business units',list(r.units));field(grid,'Applications',list(r.appIds));field(grid,'ROs',list(r.roIds));field(grid,'Submissions',list(r.subIds));side.append(grid);
   side.append(el('h3','Products & catalog numbers'));side.append(el('p',list(r.products)||'Not recorded','map-full-value'));side.append(el('p',list(r.catalogNumbers)||'No catalog numbers recorded','map-full-value'));
   if(r.issues?.length){side.append(el('h3','Review notes'));const ul=el('ul',null,'map-issues');for(const issue of r.issues)ul.append(el('li',issue));side.append(ul);}
   const evidence=el('details',null,'map-memberships');evidence.append(el('summary','Original date values'));for(const [label,info] of [['Start',r.startInfo],['End',r.endInfo]])evidence.append(el('p',label+': '+list(info?.rawValues)));side.append(evidence);const memberships=el('details',null,'map-memberships');memberships.append(el('summary','Source memberships ('+fmt((r.matchingRows||r.rows||[]).length)+')'));for(const row of (r.matchingRows||r.rows||[]).slice(0,80)){memberships.append(el('p',[row.Product||row.ProductID,row.CatalogNumber,row.RegistrationCountry||row.Country,row.Manufacturer,row.RegistrationManufacturingSite,row.BusinessUnit].filter(Boolean).join(' · ')));}if((r.matchingRows||r.rows||[]).length>80)memberships.append(el('p','Showing the first 80 source memberships.'));side.append(memberships);return;
  }
  if(selectedCountry&&scope!=='review')heading.append(button('All countries',()=>{selectedCountry=null;scope='countries';page=0;renderData();}));
  const tabs=el('div',null,'map-tabs');for(const [value,label]of [['countries','Countries'],['registrations','Registrations'],['review','Review']]){const b=button(label,()=>{scope=value;selectedRecord=null;if(value!=='registrations')selectedCountry=null;page=0;renderData();});b.setAttribute('aria-pressed',scope===value?'true':'false');tabs.append(b);}side.append(tabs);
  if(scope==='countries'){
   const countries=result.countries.filter(c=>c.count>0).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));side.append(el('p',fmt(countries.length)+' countries with matching records','map-muted'));
   const table=el('table',null,'map-country-table'),thead=el('thead'),tr=el('tr');tr.append(el('th','Country'),el('th','Registrations'));thead.append(tr);table.append(thead);const tbody=el('tbody');
   for(const c of countries){const row=el('tr'),name=el('td');name.append(button(c.name,()=>selectCountry(String(c.id))));row.append(name,el('td',fmt(c.count)));tbody.append(row);}table.append(tbody);side.append(table);if(!countries.length)side.append(el('p','No countries match these filters. Choose All registration states to inspect other records.','map-empty'));return;
  }
  const values=filteredRecords(),pages=Math.max(1,Math.ceil(values.length/PAGE));page=Math.min(page,pages-1);
  side.append(el('p',scope==='review'?'Review includes all states; other filters still apply.':fmt(values.length)+' distinct registrations','map-muted'));
  const actions=el('div',null,'map-list-actions');actions.append(button('Copy IDs',()=>copy([...new Set(values.map(r=>r.id).filter(Boolean))].join('\n'))),button('CSV',()=>exportRows(values)));for(const b of actions.children)b.disabled=!values.length;side.append(actions);
  const table=el('table',null,'map-record-table'),thead=el('thead'),tr=el('tr');tr.append(el('th','Registration'),el('th','State'),el('th','End date'));thead.append(tr);table.append(thead);const tbody=el('tbody');for(const r of values.slice(page*PAGE,(page+1)*PAGE)){const row=el('tr'),id=el('td'),b=button(r.id||'Missing ID',()=>openRecord(r));b.title=r.id||list(r.appIds);id.append(b);const status=el('td',r.state||'Not recorded');row.append(id,status,el('td',r.endKind==='sentinel'?'Beyond 2100':Number.isFinite(r.end)?date(r.end):['invalid','conflict'].includes(r.endKind)?r.endInfo.label:'—'));tbody.append(row);}table.append(tbody);side.append(table);
  if(!values.length)side.append(el('p',scope==='review'?'No records need review under these filters.':'No matching registrations in the delivered data.','map-empty'));
  const pagination=el('div',null,'map-pagination'),prev=button('Previous',()=>{page--;renderSide();}),next=button('Next',()=>{page++;renderSide();});prev.disabled=page===0;next.disabled=page>=pages-1;pagination.append(prev,el('span',(page+1)+' / '+pages),next);side.append(pagination);
 }
 function renderData(){
  if(!model||disposed)return;result=derive(model,state);tooltip.hidden=true;
  const k=result.kpis;metrics.replaceChildren();for(const [label,value,action,description]of [
   ['Countries',k.countries,()=>{selectedCountry=null;selectedRecord=null;scope='countries';page=0;renderData();},'Countries with matching registrations'],
   ['Registrations',k.registrations,()=>{selectedCountry=null;selectedRecord=null;scope='registrations';page=0;renderData();},'Distinct registration IDs'],
   ['Expiring · 90 days',k.expiring,()=>{state.expiry='next90';expiry.value='next90';selectedCountry=null;selectedRecord=null;scope='registrations';page=0;renderData();},'End dates in the next 90 days'],
   ['Needs review',k.review,()=>{selectedCountry=null;selectedRecord=null;scope='review';page=0;renderData();},'All states; includes missing IDs and country issues']]){const b=button('',action,'map-metric');b.title=description;b.append(el('strong',fmt(value)),el('span',label));metrics.append(b);}
  active.replaceChildren();const chips=[];for(const [key,label]of filters){const values=state[key],unit=key==='units'&&values.length===1;filterUIs.get(key).summary.textContent=label+(values.length?' · '+(unit?values[0]:values.length):' · All');if(values.length)chips.push([key,label+': '+(key==='states'||unit?values.join(', '):values.length+' selected')]);}
  for(const [key,label]of chips)active.append(button(label+' ×',()=>{state[key]=[];page=0;selectedRecord=null;renderData();},'map-chip'));
  const unplaced=k.unmappedRegistrations||0;active.append(el('span',unplaced?fmt(unplaced)+' matching registrations cannot be placed on the map':'Counts reflect delivered, filtered records.','map-muted'));
  const byCountry=new Map(result.countries.map(c=>[String(c.id),c])),counts=result.countries.map(c=>c.count).filter(n=>n>0).sort((a,b)=>a-b),bounds=[...new Set([.2,.4,.6,.8,1].map(q=>counts[Math.max(0,Math.ceil(counts.length*q)-1)]).filter(Boolean))];
  const colors=theme==='dark'?['#467b7c','#499b92','#52bba7','#6ed6b4','#acf1c9']:['#c4e8e1','#8cd2c3','#4eb4a1','#238d7c','#116859'];
  for(const [id,{p,dot,c}]of shapes){const count=byCountry.get(id)?.count||0,index=count?bounds.findIndex(b=>count<=b):-1,color=palette?(count?palette.foreground:palette.background):count?colors[Math.max(0,index)]:theme==='dark'?'#273a50':'#e1e8ed';p.style.fill=color;p.classList.toggle('is-selected',selectedCountry===id);p.setAttribute('aria-label',c.name+': '+fmt(count)+' matching registrations');if(dot){dot.style.fill=color;dot.classList.toggle('is-selected',selectedCountry===id);dot.setAttribute('aria-label',p.getAttribute('aria-label'));}}
  legend.replaceChildren(el('span','Registrations per country','map-legend-title'));const zero=el('span',null,'map-legend-item'),swatch=el('i');swatch.style.background=palette?palette.background:theme==='dark'?'#273a50':'#e1e8ed';zero.append(swatch,el('span','No matching records'));legend.append(zero);let previous=0;bounds.forEach((b,i)=>{const item=el('span',null,'map-legend-item'),sw=el('i');sw.style.background=palette?palette.foreground:colors[i];item.append(sw,el('span',previous+1===b?fmt(b):fmt(previous+1)+'–'+fmt(b)));legend.append(item);previous=b;});
  renderSide();
 }
 return {
  update(rows,options={}){if(disposed)return;
   // Empty/partial deliveries retain the unit choice, even before ID arrives.
   // A populated table without the field mapped cannot apply this restriction.
   if(rows.length&&!new Set(options.mappedFields||rows.flatMap(row=>Object.keys(row))).has('BusinessUnit'))state.units=[];
   model=analyze(rows,{countries:geography.countries,now:options.now});palette=options.highContrast||null;notice.textContent=[options.notice,...(options.missing||[]).map(f=>'Map '+f+' to use registration coverage.')].filter(Boolean).join(' ');notice.hidden=!notice.textContent;applyTheme();selectedRecord=null;renderData();for(const [key,ui]of filterUIs)if(ui.d.open)drawChoices(key);},
  resize(width,height){app.style.width=Math.max(0,width)+'px';app.style.height=Math.max(0,height)+'px';app.classList.toggle('map-narrow',width<850);app.style.setProperty('--map-font',Math.max(13,Math.min(16,width/95))+'px');},
  setHighContrast(value){palette=value;applyTheme();renderData();},
  destroy(){disposed=true;clearTimeout(searchTimer);clearTimeout(suppressTimer);app.remove();},
  getState(){return {filters:JSON.parse(JSON.stringify(state)),selectedCountry,scope,selectedId:selectedRecord?.id||null,zoom};}
 };
}
