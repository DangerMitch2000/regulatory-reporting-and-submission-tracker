import assert from 'node:assert/strict';
import {GRAPH_KINDS,graphKey,graphCountryKey,buildGraph,traceGraph,traceCountries,graphWindow,nodeState} from './relationships.mjs';
const row={ChangeID:'CHG-1',EventName:'EVT-1',AppID:'APP-1',ROID:'RO-1',SubID:'SUB-1',RegistrationID:'REG-1',Country:'France',SubStatus:'Completed'};
const pair=(graph,sourceKind,sourceID,targetKind,targetID)=>graph.edges.some(e=>e.source===graphKey(sourceKind,sourceID)&&e.target===graphKey(targetKind,targetID));
const graph=buildGraph([row,{...row,CatalogNumber:'CAT-2'},{...row,Country:'Germany',AppID:'APP-2',ROID:'RO-2',SubID:'SUB-2',RegistrationID:'REG-2'}]);
assert.equal(GRAPH_KINDS.length,6);assert.equal(graph.nodes.length,10);assert.equal(graph.edges.length,9);
assert(pair(graph,'application','APP-1','ro','RO-1'));assert(pair(graph,'ro','RO-1','submission','SUB-1'));assert(pair(graph,'submission','SUB-1','registration','REG-1'));
assert(!pair(graph,'application','APP-1','ro','RO-2'));assert(!pair(graph,'submission','SUB-1','registration','REG-2'));
assert.deepEqual(graph.byKey.get(graphKey('event','EVT-1')).countries,['France','Germany']);
assert.deepEqual(graph.byKey.get(graphKey('submission','SUB-1')).states,['Completed']);
const focused=traceGraph(graph,graphKey('submission','SUB-1'));
assert.equal(focused.nodeKeys.size,6);assert.equal(focused.edgeKeys.size,5);
for(const kind of ['application','ro','submission','registration'])assert(!focused.nodeKeys.has(graphKey(kind,{application:'APP-2',ro:'RO-2',submission:'SUB-2',registration:'REG-2'}[kind])),'shared parent must not highlight siblings');
assert.equal(traceGraph(graph,'missing key').nodeKeys.size,0);

// A marketing application can have ROs for several events in the same country.
// Its aggregate links must not imply that every event owns every one of its ROs.
const sharedApplication=buildGraph([
 {ChangeID:'CHANGE',EventName:'EVENT-A',AppID:'APP-SHARED',ROID:'RO-A',SubID:'SUB-A',RegistrationID:'REG-A',Country:'France'},
 {ChangeID:'CHANGE',EventName:'EVENT-B',AppID:'APP-SHARED',ROID:'RO-B',SubID:'SUB-B',RegistrationID:'REG-B',Country:'France'},
 {ChangeID:'CHANGE',EventName:'EVENT-B',AppID:'APP-OTHER',ROID:'RO-OTHER',SubID:'SUB-OTHER',Country:'Germany'},
 {ChangeID:'CHANGE',EventName:'EVENT-A',AppID:'APP-SHARED',ROID:'RO-A',SubID:'SUB-A',RegistrationID:'REG-A',Country:'France',CatalogNumber:'CAT-2'}
]);
const eventATrace=traceGraph(sharedApplication,graphKey('event','EVENT-A'));
assert.deepEqual(sharedApplication.nodes.filter(n=>eventATrace.nodeKeys.has(n.key)).map(n=>n.id).sort(),['CHANGE','EVENT-A','APP-SHARED','RO-A','SUB-A','REG-A'].sort());
assert.equal(eventATrace.edgeKeys.size,5);
const roATrace=traceGraph(sharedApplication,graphKey('ro','RO-A'));
assert(!roATrace.nodeKeys.has(graphKey('event','EVENT-B')),'RO selection cannot acquire another event through its shared application');
const appTrace=traceGraph(sharedApplication,graphKey('application','APP-SHARED'));
assert(appTrace.nodeKeys.has(graphKey('event','EVENT-A'))&&appTrace.nodeKeys.has(graphKey('event','EVENT-B')));
assert(appTrace.nodeKeys.has(graphKey('ro','RO-A'))&&appTrace.nodeKeys.has(graphKey('ro','RO-B')));
assert(!appTrace.nodeKeys.has(graphKey('application','APP-OTHER')),'shared event does not add sibling applications');
assert.equal(sharedApplication.paths.length,3,'duplicate catalogue memberships reuse the same source path');
const searchA=graphWindow(sharedApplication,{query:'EVENT-A'});assert.equal(searchA.nodes.length,6);assert.equal(searchA.edges.length,5);assert(!searchA.nodes.some(n=>n.id==='RO-B'));
const splitPath=buildGraph([{EventName:'EVENT-A',AppID:'APP-SHARED'},{AppID:'APP-SHARED',ROID:'RO-B',SubID:'SUB-B'},{EventName:'EVENT-A',AppID:'APP-SHARED',ROID:'',SubID:'SUB-DISCONNECTED'}]);
const splitTrace=traceGraph(splitPath,graphKey('event','EVENT-A'));assert.equal(splitTrace.nodeKeys.size,2);assert.equal(splitTrace.edgeKeys.size,1);assert(!splitTrace.nodeKeys.has(graphKey('submission','SUB-DISCONNECTED')),'missing RO breaks the source-row path');
// Two search matches can retain both endpoints of an unrelated edge; the edge
// itself must also have search-path provenance before it is drawn.
const crossSearch=buildGraph([{EventName:'MATCH-E1',AppID:'APP-A',ROID:'RO-A'},{EventName:'MATCH-E2',AppID:'APP-B',ROID:'RO-B'},{EventName:'OTHER',AppID:'APP-A',ROID:'RO-B'}]);
const crossWindow=graphWindow(crossSearch,{query:'MATCH'});assert(crossWindow.nodes.some(n=>n.id==='APP-A')&&crossWindow.nodes.some(n=>n.id==='RO-B'));assert(!crossWindow.edges.some(e=>e.source===graphKey('application','APP-A')&&e.target===graphKey('ro','RO-B')),'search cannot include unrelated edges merely because their endpoints are visible');
console.log('PASS anchored paths: shared applications/events, reverse selection, same-country memberships, duplicate paths, missing intermediates and search edge provenance.');

assert.equal(graphCountryKey('  UNITED   Kingdom\tOF   Great Britain '),'united kingdom of great britain');
assert.equal(graphCountryKey(null),'');
const france=traceCountries(graph,[' FRANCE ']);
assert.equal(france.nodeKeys.size,6);assert.equal(france.edgeKeys.size,5);
for(const kind of ['application','ro','submission','registration'])assert(!france.nodeKeys.has(graphKey(kind,{application:'APP-2',ro:'RO-2',submission:'SUB-2',registration:'REG-2'}[kind])),'country selection must not traverse a shared event into another country');
assert.equal(traceCountries(graph,['France','Germany']).nodeKeys.size,10);assert.equal(traceCountries(graph,['France','Germany']).edgeKeys.size,9);
assert.equal(traceCountries(graph,[]).nodeKeys.size,0);assert.equal(traceCountries(graph,['unknown']).nodeKeys.size,0);
const countryLinks=buildGraph([
 {...row,Country:'  New   Zealand  '},
 {...row,Country:'new zealand',CatalogNumber:'duplicate'},
 {...row,Country:'Germany',ROID:'RO-2',SubID:'SUB-2'},
 {Country:'New Zealand',ROID:'RO-2'},
 {EventName:'MISSING-EVENT',AppID:'MISSING-APP',Country:''},
 {EventName:'MISSING-EVENT',AppID:'KNOWN-APP',Country:'France'},
 {RegistrationID:'DISCONNECTED-REG',Country:'New Zealand'}
]);
const nz=traceCountries(countryLinks,['new zealand']);
assert(nz.nodeKeys.has(graphKey('ro','RO-2')));assert(nz.nodeKeys.has(graphKey('application','APP-1')));
const germanyOnly=countryLinks.edges.find(e=>e.source===graphKey('application','APP-1')&&e.target===graphKey('ro','RO-2'));
assert(!nz.edgeKeys.has(germanyOnly.key),'two highlighted endpoints do not invent a country association for their edge');
assert(nz.nodeKeys.has(graphKey('registration','DISCONNECTED-REG')),'country selection retains disconnected linked records');
assert.deepEqual(countryLinks.byKey.get(graphKey('submission','SUB-1')).countryKeys,['new zealand'],'country key normalization deduplicates case and whitespace variants');
const missingCountry=traceCountries(countryLinks,['']);
assert.equal(missingCountry.nodeKeys.size,2);assert.equal(missingCountry.edgeKeys.size,1);
assert(missingCountry.nodeKeys.has(graphKey('application','MISSING-APP')));assert(!missingCountry.nodeKeys.has(graphKey('application','KNOWN-APP')),'missing country does not act as all countries');
assert.deepEqual(countryLinks.byKey.get(graphKey('application','MISSING-APP')).countries,[],'missing country does not introduce a blank display label');
const assigned=buildGraph([{EventName:'EXPECTED-EVENT',ExpectedResponseCountry:'Spain'}],{countryForRow:r=>r.Country||r.ExpectedResponseCountry});
assert.equal(traceCountries(assigned,['spain']).nodeKeys.size,1,'caller can supply the current grouping country assignment without graph inference');
console.log('PASS graph countries: delivered node and edge membership, shared ancestors, mixed-country edges, normalized names, missing buckets, disconnected records and caller country assignment.');

const stateRows={...row,ChangeStatus:'Completed',EventState:'In Regulatory Assessment State',AppStatus:'Active',ROStatus:'Health Authority Approved',SubStatus:'Distributed',RegistrationState:'Conditionally Approved'};
const stateGraph=buildGraph([stateRows]);
const expectedStates={change:['completed','#70b85c'],event:['in regulatory assessment state','#c16ccb'],application:['active','#4d91e8'],ro:['health authority approved','#27ae78'],submission:['distributed','#e177b3'],registration:['conditionally approved','#a3bd45']};
for(const n of stateGraph.nodes){const resolved=nodeState(n),expected=expectedStates[n.kind];assert.equal(resolved.key,expected[0]);assert.equal(resolved.colour,expected[1]);assert.equal(resolved.known,true);assert.match(resolved.dark,/^#[0-9a-f]{6}$/i);assert.match(resolved.light,/^#[0-9a-f]{6}$/i);assert.equal(resolved.label,stateRows[GRAPH_KINDS[n.column].state]);}
assert.equal(nodeState(graph.byKey.get(graphKey('application','APP-1'))).colour,'#abb4c2','missing child state must not inherit completed submission or another parent state');
const normalized=nodeState({kind:'ro',states:['  HEALTH   AUTHORITY APPROVED ','Health Authority Approved','health authority approved']});assert.equal(normalized.key,'health authority approved');assert.equal(normalized.label,'Health Authority Approved');assert.equal(normalized.colour,'#27ae78');assert.equal(normalized.values.length,3);
const conflict=nodeState({kind:'submission',states:['Completed','Planned',' completed ']});assert.equal(conflict.key,'conflicting values');assert.equal(conflict.label,'Conflicting states');assert.equal(conflict.colour,'#e06ded');assert.deepEqual(conflict.values,['Completed','completed','Planned']);
for(const missing of [undefined,{kind:'registration',states:[]},{kind:'event',states:['','  ',null]}]){const resolved=nodeState(missing);assert.equal(resolved.key,'not recorded');assert.equal(resolved.label,'Not recorded');assert.equal(resolved.colour,'#abb4c2');}
for(const unknown of ['Custom phase','constructor','toString','__proto__','red; background:url(https://example.invalid)','<img src=x onerror=alert(1)>']){const resolved=nodeState({kind:'registration',states:[unknown]});assert.equal(resolved.label,unknown);assert.equal(resolved.colour,'#abb4c2');assert.equal(resolved.known,false);assert.match(resolved.dark,/^#[0-9a-f]{6}$/i);assert.match(resolved.light,/^#[0-9a-f]{6}$/i);}
assert.equal(nodeState({kind:'registration',states:['Cancelled']}).colour,'#e27c70','known tracker palette alias remains available');
const missingReg=buildGraph([{...stateRows,RegistrationState:''}]);assert.equal(nodeState(missingReg.byKey.get(graphKey('registration','REG-1'))).key,'not recorded');
console.log('PASS graph states: own-state colours for all six record kinds, canonical labels, case/space normalization, missing/unknown/conflicting states and trusted hex-only palette values.');

const incomplete=buildGraph([{...row,ChangeID:'',SubID:''}]);
assert.equal(incomplete.nodes.length,4);assert.equal(incomplete.edges.length,2);
assert.equal(incomplete.incoming.get(graphKey('registration','REG-1')).length,0,'no invented RO-registration edge across missing submission');
assert.equal(incomplete.outgoing.get(graphKey('ro','RO-1')).length,0);
assert.equal(graphWindow(incomplete).nodes.length,4,'disconnected registration remains visible');
const parallel=buildGraph([{AppID:'APP-A'},{ROID:'RO-A'},{SubID:'SUB-A'},{RegistrationID:'REG-A'}]);assert.equal(parallel.edges.length,0,'independent lists cannot generate links');
const duplicateText=buildGraph([{ChangeID:'SAME',EventName:'SAME',AppID:'SAME',ROID:'SAME',SubID:'SAME',RegistrationID:'SAME'}]);assert.equal(duplicateText.nodes.length,6);assert.equal(new Set(duplicateText.nodes.map(n=>n.key)).size,6);
const many=buildGraph([row,{...row,AppID:'APP-2'},{...row,ROID:'RO-2'},{...row,SubID:'SUB-2'}]);
assert.equal(many.incoming.get(graphKey('ro','RO-1')).length,2,'multiple delivered parents retained');
assert.equal(many.incoming.get(graphKey('submission','SUB-1')).length,2);assert.equal(many.incoming.get(graphKey('registration','REG-1')).length,2);
const hostile='<img src=x onerror=alert(1)>\" __proto__';const literal=buildGraph([{EventName:hostile,AppID:'constructor'}]);assert.equal(literal.nodes[0].id,hostile);assert.equal(literal.edges.length,1);assert.equal(literal.byKey.get(graphKey('application','constructor')).id,'constructor');
const reordered=buildGraph([{...row,AppID:'APP-10'},row,{...row,AppID:'APP-2'}]);assert.deepEqual(reordered.columns[2].nodes.map(n=>n.id),['APP-1','APP-2','APP-10']);
assert.deepEqual(buildGraph([row,{...row,AppID:'APP-2'}]).nodes,buildGraph([{...row,AppID:'APP-2'},row]).nodes,'input ordering does not change graph ordering');

const windowed=graphWindow(graph,{limitPerColumn:1});assert.equal(windowed.nodes.length,6);assert.equal(windowed.hiddenNodeCount,4);assert.equal(windowed.hiddenEdgeCount,4);
assert.equal(windowed.omittedEdgeCounts.get(graphKey('event','EVT-1')).outgoing,1);
const pageTwo=graphWindow(graph,{limitPerColumn:1,pageByKind:{application:1,ro:1,submission:1,registration:1}});assert(pageTwo.nodes.some(n=>n.id==='APP-2'));assert(!pageTwo.nodes.some(n=>n.id==='APP-1'));assert.equal(pageTwo.edges.length,5);
const revealed=graphWindow(graph,{limitPerColumn:1,selectedKey:graphKey('application','APP-2')});assert.equal(revealed.columns[2].page,1);
const countryRevealed=graphWindow(graph,{limitPerColumn:1,revealKeys:traceCountries(graph,['Germany']).nodeKeys});
assert(countryRevealed.nodes.some(n=>n.id==='APP-2'));assert(countryRevealed.nodes.some(n=>n.id==='SUB-2'));assert.equal(countryRevealed.columns[4].page,1);assert.equal(countryRevealed.edges.length,5);
const selectedPriority=graphWindow(graph,{limitPerColumn:1,selectedKey:graphKey('application','APP-1'),revealKeys:traceCountries(graph,['Germany']).nodeKeys});assert.equal(selectedPriority.columns[2].page,0,'explicit selected item wins over first country match');
const search=graphWindow(graph,{query:'sub-2'});assert.equal(search.nodes.length,6);assert.equal(search.edges.length,5);assert.equal(search.matchCount,1);assert(search.nodes.some(n=>n.id==='CHG-1'));assert(!search.nodes.some(n=>n.id==='SUB-1'));
const none=graphWindow(graph,{query:'absent'});assert.equal(none.nodes.length,0);assert.equal(none.edges.length,0);assert(none.columns.every(c=>c.page===0&&c.pageCount===1));
const multiSearch=graphWindow(graph,{query:'SUB-'});assert.equal(multiSearch.nodes.length,10);assert.equal(multiSearch.edges.length,9);
const sourceGraphCount=graph.nodes.length;graphWindow(graph,{query:'sub-2',limitPerColumn:1});assert.equal(graph.nodes.length,sourceGraphCount,'windowing does not mutate source graph');

const start=performance.now(),largeRows=Array.from({length:20000},(_,i)=>({ChangeID:'LOAD-CHG',EventName:'LOAD-EVENT',AppID:'APP-'+Math.floor(i/2),ROID:'RO-'+Math.floor(i/2),SubID:'SUB-'+Math.floor(i/2),RegistrationID:'REG-'+Math.floor(i/2),CatalogNumber:'CAT-'+i}));
const large=buildGraph(largeRows),limited=graphWindow(large),searched=graphWindow(large,{query:'SUB-'});
assert.equal(large.nodes.length,40002);assert.equal(large.edges.length,40001);assert(limited.nodes.length<=360);assert(searched.nodes.length<=360);
assert.equal(large.byKey.size,40002);assert.equal(limited.columns[2].total,10000);assert.equal(limited.columns[2].pageCount,167);
assert.equal(traceGraph(large,graphKey('submission','SUB-9999')).nodeKeys.size,6);
assert(performance.now()-start<15000,'large graph building, search and bounded windowing should complete promptly');
assert.deepEqual(buildGraph([]).nodes,[]);assert.deepEqual(graphWindow(buildGraph([])).edges,[]);
console.log('PASS relationships: delivered adjacent links, duplicate protection, disconnected records, exact typed IDs, ancestor/descendant tracing without siblings, search context, pagination and 20,000 source rows ('+Math.round(performance.now()-start)+' ms).');
