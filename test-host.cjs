// Exercises the compiled Power BI Visual lifecycle without launching a browser.
const assert=require('assert/strict');
class Element{constructor(tag){this.tag=tag;this.children=[];this.style={};this.attrs={};this.events={};this.clientWidth=700;this.clientHeight=800;}append(...nodes){this.children.push(...nodes)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,f){this.events[k]=f}remove(){this.removed=true}}
global.document={createElement:t=>new Element(t),createElementNS:(ns,t)=>new Element(t),createTextNode:t=>({textContent:t})};
const {Visual}=require('./roadmap-2026/verify/visual-host.cjs'),parent=new Element('main'),failures=[],year=new Date().getFullYear();let deliveries=0,finished=0;
const visual=new Visual({element:parent,host:{eventService:{renderingStarted(){},renderingFinished(){finished++},renderingFailed(o,e){failures.push(e)}},fetchMoreData(){deliveries++;return false;}}});
const root=parent.children[0],roles=['SubID','ActualDispatch','LatestDispatch','ActualSubmission','Site','BusinessUnit'];
function update(rows,segment=false){visual.update({type:2,viewport:{width:1320,height:800},dataViews:[{metadata:segment?{segment:{}}:{},table:{columns:roles.map(role=>({roles:{[role]:true}})),rows}}]});}
const rows=[['A',null,year+'-12-01',year+'-03-01','North','ID'],['B',year+'-01-02',null,null,'South','CMI']];
function all(node=root){return [node,...(node.children||[]).flatMap(all)]}const find=t=>all().find(n=>n.tag===t),count=()=>all().find(n=>n.className==='average').textContent;
try{update(rows);const check=find('input');check.checked=true;check.onchange();const select=find('select');select.value='"ID"';select.onchange();all().find(n=>n.tag==='button'&&n.attrs['aria-expanded']!==undefined).onclick();assert.match(count(),/1 ÷ 12/);visual.update({type:4,viewport:{width:650,height:750}});assert.equal(find('input').checked,true);assert.equal(find('select').value,'"ID"');assert.equal(all().filter(n=>n.className==='monthRow').length,12);
update(rows.slice(1));assert.match(count(),/0 ÷ 12/);assert.equal(find('select').value,'"ID"');update(rows,true);assert.equal(deliveries,1);assert.match(all().find(n=>n.className==='notice').textContent,/limited/);assert.equal(find('input').checked,true);
update([]);assert.match(count(),/0 ÷ 12/);assert.deepEqual(failures,[]);assert.ok(finished>=5);console.log('PASS: compiled Power BI Visual host lifecycle, role mapping, redraw/resize selection retention, disappearing unit, report filter, partial delivery warning and empty data. No browser layout assertion.');
}finally{visual.destroy();assert.equal(root.removed,true);}
