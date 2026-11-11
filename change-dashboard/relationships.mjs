import trackerStates from './tracker/states.js';
/** Delivered associations only. A line is never inferred from parallel ID lists. */
export const GRAPH_KINDS=Object.freeze([
 {kind:'change',field:'ChangeID',label:'Change IDs',state:'ChangeStatus',index:0},
 {kind:'event',field:'EventName',label:'Events',state:'EventState',index:1},
 {kind:'application',field:'AppID',label:'Applications',state:'AppStatus',index:2},
 {kind:'ro',field:'ROID',label:'ROs',state:'ROStatus',index:3},
 {kind:'submission',field:'SubID',label:'Submissions',state:'SubStatus',index:4},
 {kind:'registration',field:'RegistrationID',label:'Registrations',state:'RegistrationState',index:5}
].map(Object.freeze));
const text=v=>v==null?'':String(v).trim();
const natural=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
const order=(a,b)=>natural.compare(a,b)||(a<b?-1:a>b?1:0);
export const graphKey=(kind,id)=>JSON.stringify([kind,text(id)]);
/** Empty is an explicit missing-country bucket, not a wildcard. */
export const graphCountryKey=value=>text(value).replace(/\s+/g,' ').toLocaleLowerCase('en');
const edgeKey=(source,target)=>JSON.stringify([source,target]);

/** Each node uses only its own delivered lifecycle state; colours never imply completion. */
export function nodeState(node){
 const values=[...new Set((node?.states||[]).map(text).filter(Boolean))].sort(order);
 const normalize=value=>text(value).replace(/\s+/g,' ').toLowerCase();
 const keys=[...new Set(values.map(normalize))];
 const key=keys.length>1?'conflicting values':keys[0]||'not recorded';
 const field=GRAPH_KINDS.find(column=>column.kind===node?.kind)?.state;
 const canonical=(trackerStates.catalogs[field]||[]).find(value=>normalize(value)===key);
 const label=keys.length>1?'Conflicting states':key==='not recorded'?'Not recorded':canonical||values[0];
 const validColour=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 const known=Object.hasOwn(trackerStates.colours,key)&&validColour(trackerStates.colours[key]);
 const colour=known?trackerStates.colours[key]:trackerStates.colours['not recorded'];
 const dark=validColour(trackerStates.dark[colour])?trackerStates.dark[colour]:colour;
 const light=validColour(trackerStates.light[colour])?trackerStates.light[colour]:colour;
 return {key,label,colour,dark,light,values,known};
}

export function buildGraph(rows=[],{countryForRow=row=>row.Country}={}){
 const byKey=new Map(),edgeMap=new Map(),pathMap=new Map();
 for(const row of rows||[]){
  if(!row||typeof row!=='object')continue;
  const country=text(countryForRow(row)),countryKey=graphCountryKey(country);
  const keys=GRAPH_KINDS.map(column=>{
   const id=text(row[column.field]);if(!id)return null;
   const key=graphKey(column.kind,id);let node=byKey.get(key);
   if(!node){node={key,kind:column.kind,id,column:column.index,countries:new Set(),countryKeys:new Set(),states:new Set()};byKey.set(key,node);}
   const state=text(row[column.state]);
   node.countryKeys.add(countryKey);if(country)node.countries.add(country);if(state)node.states.add(state);
   return key;
  });
  for(let i=0;i<keys.length-1;i++){
   const source=keys[i],target=keys[i+1];if(!source||!target)continue;
   const key=edgeKey(source,target);if(!edgeMap.has(key))edgeMap.set(key,{key,source,target,countryKeys:new Set()});
   edgeMap.get(key).countryKeys.add(countryKey);
  }
  // Preserve contiguous source-row paths. Aggregate adjacent edges alone can
  // falsely cross from Event A to Event B's RO through a shared application.
  // A missing intermediate ID starts a new segment, never an inferred link.
  let segment=[];
  for(const key of [...keys,null]){
   if(key){segment.push(key);continue;}
   if(segment.length){const id=JSON.stringify(segment);if(!pathMap.has(id))pathMap.set(id,{nodeKeys:segment,edgeKeys:segment.slice(1).map((target,i)=>edgeMap.get(edgeKey(segment[i],target)).key)});segment=[];}
  }
 }
 const nodes=[...byKey.values()].sort((a,b)=>a.column-b.column||order(a.id,b.id));
 for(const node of nodes){node.countries=[...node.countries].sort(order);node.countryKeys=[...node.countryKeys].sort(order);node.states=[...node.states].sort(order);}
 const rank=new Map(nodes.map((n,i)=>[n.key,i]));
 const edges=[...edgeMap.values()].sort((a,b)=>rank.get(a.source)-rank.get(b.source)||rank.get(a.target)-rank.get(b.target));
 for(const edge of edges)edge.countryKeys=[...edge.countryKeys].sort(order);
 const incoming=new Map(nodes.map(n=>[n.key,[]])),outgoing=new Map(nodes.map(n=>[n.key,[]]));
 for(const edge of edges){incoming.get(edge.target).push(edge);outgoing.get(edge.source).push(edge);}
 const columns=GRAPH_KINDS.map(column=>({...column,nodes:nodes.filter(n=>n.kind===column.kind)}));
 const paths=[...pathMap.values()],pathsByNode=new Map(nodes.map(n=>[n.key,[]]));
 for(const path of paths)for(const key of path.nodeKeys)pathsByNode.get(key).push(path);
 return {nodes,edges,columns,byKey,incoming,outgoing,paths,pathsByNode};
}

function traceMany(graph,keys){
 const seeds=[...new Set(keys)].filter(key=>graph.byKey.has(key)),nodeKeys=new Set(seeds),edgeKeys=new Set();
 const paths=new Set(seeds.flatMap(key=>graph.pathsByNode.get(key)||[]));
 for(const path of paths){for(const key of path.nodeKeys)nodeKeys.add(key);for(const key of path.edgeKeys)edgeKeys.add(key);}
 return {nodeKeys,edgeKeys};
}

/** Upstream/downstream paths delivered with this item, without shared-record leakage. */
export function traceGraph(graph,key){return traceMany(graph,[key]);}

/** Highlight only associations delivered for these countries, including disconnected records. */
export function traceCountries(graph,countries=[]){
 const wanted=new Set(Array.from(countries,graphCountryKey)),matches=item=>item.countryKeys.some(key=>wanted.has(key));
 return {nodeKeys:new Set(graph.nodes.filter(matches).map(node=>node.key)),edgeKeys:new Set(graph.edges.filter(matches).map(edge=>edge.key))};
}

/**
 * Bound DOM work while keeping the full graph available for lookup/highlighting.
 * Search retains each match's actual upstream/downstream paths. Pagination never
 * creates links to an arbitrary item in the next visible column.
 */
export function graphWindow(graph,{query='',selectedKey='',revealKeys=null,limitPerColumn=60,pageByKind={}}={}){
 const limit=Number.isFinite(limitPerColumn)?Math.max(1,Math.min(200,Math.floor(limitPerColumn))):60;
 const q=text(query).toLocaleLowerCase('en');
 const matches=q?graph.nodes.filter(n=>n.id.toLocaleLowerCase('en').includes(q)):[];
 const matchedPaths=q?traceMany(graph,matches.map(n=>n.key)):null,allowed=matchedPaths?.nodeKeys||null;
 const columns=graph.columns.map(column=>{
  const all=allowed?column.nodes.filter(n=>allowed.has(n.key)):column.nodes;
  const pageCount=Math.max(1,Math.ceil(all.length/limit));
  const requested=Number(pageByKind[column.kind]);
  let page=Math.max(0,Math.min(pageCount-1,Number.isFinite(requested)?Math.floor(requested):0));
  // Only use this option when intentionally revealing a new selection; ordinary
  // paging can omit it so a user is not forced back to the selected item's page.
  const selectedIndex=selectedKey?all.findIndex(n=>n.key===selectedKey):-1;
  const revealIndex=selectedIndex>=0?selectedIndex:revealKeys?all.findIndex(n=>revealKeys.has(n.key)):-1;
  if(revealIndex>=0)page=Math.floor(revealIndex/limit);
  const nodes=all.slice(page*limit,(page+1)*limit);
  return {...column,nodes,total:all.length,page,pageCount,hidden:all.length-nodes.length};
 });
 const nodes=columns.flatMap(c=>c.nodes),shown=new Set(nodes.map(n=>n.key));
 const eligibleEdges=matchedPaths?graph.edges.filter(e=>matchedPaths.edgeKeys.has(e.key)):graph.edges;
 const edges=eligibleEdges.filter(e=>shown.has(e.source)&&shown.has(e.target));
 const omittedEdgeCounts=new Map(nodes.map(n=>[n.key,{incoming:0,outgoing:0,total:0}]));
 for(const edge of eligibleEdges){
  if(shown.has(edge.source)&&!shown.has(edge.target)){const count=omittedEdgeCounts.get(edge.source);count.outgoing++;count.total++;}
  if(shown.has(edge.target)&&!shown.has(edge.source)){const count=omittedEdgeCounts.get(edge.target);count.incoming++;count.total++;}
 }
 const totalNodes=columns.reduce((sum,c)=>sum+c.total,0);
 return {nodes,edges,columns,omittedEdgeCounts,hiddenNodeCount:totalNodes-nodes.length,hiddenEdgeCount:eligibleEdges.length-edges.length,totalNodes,totalEdges:eligibleEdges.length,sourceNodeCount:graph.nodes.length,sourceEdgeCount:graph.edges.length,matchCount:matches.length,query:q};
}
