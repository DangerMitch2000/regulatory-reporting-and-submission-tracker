import {buildGraph,traceGraph,GRAPH_KINDS,graphWindow,nodeState} from './relationships.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const stateStyle=s=>'--cd-state-colour:'+s.colour+';--cd-state-tint:'+s.colour+'18;--cd-state-text:light-dark('+s.light+','+s.dark+')';
const stateDescription=s=>s.label+(s.key==='conflicting values'?' — '+s.values.join(' / '):'');
const nodeButton=(n,selected)=>{const s=nodeState(n);return '<button type="button" data-node="'+esc(n.key)+'" data-state="'+esc(s.key)+'" style="'+stateStyle(s)+'" aria-pressed="'+(selected===n.key)+'" title="'+esc(n.id+'\nState: '+stateDescription(s))+'" aria-label="Select '+esc(n.kind)+' '+esc(n.id)+'" aria-description="'+esc('State: '+stateDescription(s))+'"><i class="cd-state-dot" aria-hidden="true"></i>'+esc(n.id)+'</button>';};

const GAP=28,TOP=48,LIMIT=40;

/** A scoped, lazy relationship view. Record IDs never become selectors or HTML. */
export function mountRelationships(host,rows,options={}){
 const details=host.closest('details');let graph=null,destroyed=false;
 let state={mode:'diagram',query:'',selectedKey:'',pageByKind:{},legendOpen:false,...options.state};
 const ensure=()=>graph||(graph=buildGraph(rows));
 function selectedInfo(){const n=graph.byKey.get(state.selectedKey),s=n?nodeState(n):null;return n?`<div class="cd-graph-selection"><div><strong>${esc(n.id)}</strong><span><b class="cd-state-label" style="${stateStyle(s)}"><i class="cd-state-dot" aria-hidden="true"></i>${esc(stateDescription(s))}</b> · ${esc(n.countries?.join(' · ')||'Country not recorded')}</span></div><button type="button" data-graph-action="copy">Copy ID</button><button type="button" data-graph-action="clear">Clear selection</button></div>`:'<div class="cd-graph-hint">Select an item to highlight its upstream and downstream links.</div>';}
 function legend(columns){return '<details class="cd-graph-legend" '+(state.legendOpen?'open':'')+'><summary>State colours</summary><div class="cd-state-legend-grid">'+columns.filter(c=>c.nodes.length).map(c=>{const states=[...new Map(c.nodes.map(n=>{const s=nodeState(n);return [s.key,s];})).values()];return '<section><strong>'+esc(c.label)+'</strong>'+states.map(s=>'<span class="cd-state-label" style="'+stateStyle(s)+'"><i class="cd-state-dot" aria-hidden="true"></i>'+esc(s.label)+'</span>').join('')+'</section>';}).join('')+'</div><p>States of the items currently shown. Each item uses its own source state; colour does not infer completion. The outline marks your selection.</p></details>';}
 function render(){
  if(destroyed||!details.open)return;ensure();
  if(state.selectedKey&&!graph.byKey.has(state.selectedKey))state.selectedKey='';
  const previous=host.querySelector('.cd-graph-scroll'),scroll={left:previous?.scrollLeft||0,top:previous?.scrollTop||0};
  const trace=state.selectedKey?traceGraph(graph,state.selectedKey):null;
  const win=graphWindow(graph,{query:state.query,limitPerColumn:LIMIT,pageByKind:state.pageByKind});
  const columns=win.columns;
  const visibleNodes=columns.flatMap(c=>c.nodes),visibleKeys=new Set(visibleNodes.map(n=>n.key));
  const eligibleEdges=win.edges,edges=(trace?[...eligibleEdges.filter(e=>trace.edgeKeys.has(e.key)),...eligibleEdges.filter(e=>!trace.edgeKeys.has(e.key))]:eligibleEdges).slice(0,1500),drawnEdgeKeys=new Set(edges.map(e=>e.key));
  const nodeHeight=host.ownerDocument.defaultView.matchMedia('(pointer: coarse)').matches?44:30,STEP=nodeHeight+12;
  const COL=Math.max(160,Math.min(200,Math.floor((host.clientWidth-26-5*GAP)/6)));
  const maxRows=Math.max(1,...columns.map(c=>c.nodes.length)),height=TOP+maxRows*STEP+12,width=GRAPH_KINDS.length*(COL+GAP)-GAP;
  const positions=new Map();columns.forEach((c,i)=>c.nodes.forEach((n,j)=>positions.set(n.key,{x:i*(COL+GAP),y:TOP+j*STEP+(maxRows-c.nodes.length)*STEP/2})));
  const pages=columns.map(c=>{const page=c.page||0,total=c.total??c.nodes.length,pageCount=c.pageCount||Math.max(1,Math.ceil(total/LIMIT));return `<div><strong>${esc(c.label)}</strong><span>${total?Math.min(page*LIMIT+1,total):0}–${Math.min((page+1)*LIMIT,total)} / ${total}</span>${pageCount>1?`<button type="button" data-graph-page="${c.kind}" data-page="${page-1}" aria-label="Previous ${esc(c.label)}" ${page===0?'disabled':''}>‹</button><button type="button" data-graph-page="${c.kind}" data-page="${page+1}" aria-label="Next ${esc(c.label)}" ${page>=pageCount-1?'disabled':''}>›</button>`:''}</div>`;}).join('');
  const svg=`<svg class="cd-graph-lines" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${edges.map(e=>{const a=positions.get(e.source),b=positions.get(e.target),x=a.x+COL,y=a.y+nodeHeight/2,xx=b.x,yy=b.y+nodeHeight/2,active=!trace||trace.edgeKeys.has(e.key);return `<path data-edge="${esc(e.key)}" data-from="${esc(e.source)}" data-to="${esc(e.target)}" data-active="${active}" d="M ${x} ${y} C ${x+GAP/2} ${y}, ${xx-GAP/2} ${yy}, ${xx} ${yy}"/>`;}).join('')}</svg>`;
  const diagram=`<div class="cd-graph-scroll" tabindex="0" role="region" aria-label="Related record diagram. Scroll to see all columns."><div class="cd-graph-canvas" style="width:${width}px;height:${height}px">${svg}${columns.map((c,i)=>`<section data-related-kind="${c.kind}" tabindex="-1" class="cd-graph-column" style="left:${i*(COL+GAP)}px;width:${COL}px;height:${height}px"><h3>${esc(c.label)} (${c.total??c.nodes.length})</h3>${c.nodes.length?c.nodes.map(n=>{const p=positions.get(n.key),hidden=(graph.incoming.get(n.key)||[]).concat(graph.outgoing.get(n.key)||[]).some(e=>!drawnEdgeKeys.has(e.key));return `<div class="cd-graph-node" data-selected="${state.selectedKey===n.key}" data-active="${!trace||trace.nodeKeys.has(n.key)}" style="top:${p.y}px;height:${nodeHeight}px">${nodeButton(n,state.selectedKey)}${hidden?'<span class="cd-graph-more" title="Additional links are outside this view">+</span>':''}</div>`;}).join(''):'<p class="cd-context">'+(state.query?'No matching items':'Not recorded')+'</p>'}</section>`).join('')}</div></div>`;
  const list=`<div class="cd-related-grid">${columns.map(c=>`<section data-related-kind="${c.kind}" tabindex="-1"><h3>${esc(c.label)} (${c.total??c.nodes.length})</h3><div class="cd-linked-ids">${c.nodes.length?c.nodes.map(n=>`<div data-active="${!trace||trace.nodeKeys.has(n.key)}">${nodeButton(n,state.selectedKey)}</div>`).join(''):(state.query?'No matching items':'Not recorded')}</div></section>`).join('')}</div>`;
  host.innerHTML=`<div class="cd-graph-toolbar"><div class="cd-graph-modes"><button type="button" data-graph-mode="diagram" aria-pressed="${state.mode==='diagram'}">Diagram</button><button type="button" data-graph-mode="list" aria-pressed="${state.mode==='list'}">List</button></div><label>Find ID<input type="search" data-graph-search value="${esc(state.query)}" placeholder="Application, RO, submission…"></label>${state.query?'<button type="button" data-graph-action="reset-search">Clear search</button>':''}</div>${selectedInfo()}${legend(columns)}${state.mode==='list'?list:diagram}<div class="cd-graph-pages">${pages}</div><p class="cd-graph-note">Lines show adjacent record IDs delivered together. Missing links stay unconnected.${eligibleEdges.length>edges.length?' Showing '+edges.length+' of '+eligibleEdges.length+' visible links; search for an ID to narrow the diagram.':''}${win.hiddenNodeCount?' Some items are on other column pages; + marks additional links.':''}${state.query?' Search includes matching records and their linked paths.':''}</p><div role="status" class="cd-graph-feedback"></div>`;
  const now=host.querySelector('.cd-graph-scroll');if(now){now.scrollLeft=scroll.left;now.scrollTop=scroll.top;}
 }
 async function click(event){
  const node=event.target.closest('[data-node]'),mode=event.target.closest('[data-graph-mode]'),page=event.target.closest('[data-graph-page]'),action=event.target.closest('[data-graph-action]');
  if(node){state.selectedKey=state.selectedKey===node.dataset.node?'':node.dataset.node;render();const focus=[...host.querySelectorAll('[data-node]')].find(n=>n.dataset.node===node.dataset.node);focus?.focus({preventScroll:true});return;}
  if(mode){state.mode=mode.dataset.graphMode;render();return;}
  if(page){state.pageByKind={...state.pageByKind,[page.dataset.graphPage]:Number(page.dataset.page)};render();return;}
  if(!action)return;
  if(action.dataset.graphAction==='copy'){const id=graph.byKey.get(state.selectedKey)?.id;if(id)await options.onCopy?.(id);return;}
  if(action.dataset.graphAction==='clear')state.selectedKey='';
  if(action.dataset.graphAction==='reset-search'){state.query='';state.pageByKind={};}
  render();
 }
 function input(event){if(!event.target.matches('[data-graph-search]'))return;const caret=event.target.selectionStart;state.query=event.target.value;state.selectedKey='';state.pageByKind={};render();const el=host.querySelector('[data-graph-search]');el.focus();el.setSelectionRange(caret,caret);}
 function toggle(){if(details.open)render();}
 function legendToggle(event){if(event.target.matches('.cd-graph-legend'))state.legendOpen=event.target.open;}
 host.addEventListener('click',click);host.addEventListener('input',input);host.addEventListener('toggle',legendToggle,true);details.addEventListener('toggle',toggle);render();
 return {getState:()=>({...state,pageByKind:{...state.pageByKind}}),resize:render,showKind(kind){details.open=true;render();const el=host.querySelector('[data-related-kind="'+kind+'"]');el?.scrollIntoView({block:'nearest',inline:'nearest'});el?.focus({preventScroll:true});},destroy(){destroyed=true;host.removeEventListener('click',click);host.removeEventListener('input',input);host.removeEventListener('toggle',legendToggle,true);details.removeEventListener('toggle',toggle);}};
}
