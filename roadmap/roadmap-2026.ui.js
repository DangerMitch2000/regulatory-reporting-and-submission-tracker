import {summarize,viewingDay,categories,selectStatusReview,formatDay,dateRoles} from './roadmap-2026.logic.js';
import * as dispatchUI from '../shared/dispatch-required.js';
const dispatchOptions=(dispatchUI.default||dispatchUI).options;
const dispatchLabel=value=>dispatchOptions.find(item=>item.key===value)?.label||'All';
const colours=['#23845b','#2875d9','#c36a12','#8159bd','#6b7280'],months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const svg=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
// Resolve SVG paint as well as CSS surfaces so screenshots use the chosen theme.
const darkPaints={'white':'#1f252a','#fff':'#1f252a','#ffffff':'#1f252a','#edf4fc':'#2e4354','#edf3fa':'#2e4354','#f3f6fa':'#26333d','#f0f3f7':'#31414e','#dde4ec':'#617582','#dbe3ec':'#617582','#cbd5e1':'#617582','#586779':'#a5bacb','#34475b':'#a5bacb','#24364b':'#dce5ec','#122c49':'#e4ebf1','#33475c':'#c5d0da','#43536a':'#c5d0da','#8a4b00':'#e5b679','#23845b':'#5ba887','#2875d9':'#759fc9','#c36a12':'#dba35c','#8159bd':'#ab91ce','#6b7280':'#9aa7b2'};
function darkPaint(value){
 let key=String(value).trim().toLowerCase();const rgb=key.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);if(rgb)key='#'+rgb.slice(1,4).map(part=>Number(part).toString(16).padStart(2,'0')).join('');
 if(darkPaints[key])return darkPaints[key];if(!/^#[0-9a-f]{6}$/.test(key))return value;
 return '#'+[1,3,5].map(index=>Math.round(parseInt(key.slice(index,index+2),16)*.75+255*.25).toString(16).padStart(2,'0')).join('');
}
function paintRenderedTheme(root){
 if(root._roadmapTheme!=='dark')return;
 for(const node of root.querySelectorAll?.('svg [fill],svg [stroke],svg text')||[]){const fill=node.getAttribute('fill')||node.style.fill||(node.tagName?.toLowerCase()==='text'?'#43536a':null),stroke=node.getAttribute('stroke');if(fill)node.style.fill=darkPaint(fill);if(stroke)node.style.stroke=darkPaint(stroke);}
 for(const node of root.querySelectorAll?.('.legend i,.status-dot,.definitions strong,.dispatch-group')||[]){for(const property of ['color','backgroundColor','borderLeftColor'])if(node.style[property])node.style[property]=darkPaint(node.style[property]);}
}
function themeControl(parent,root,redraw){const wrap=el('div');wrap.className='theme-control';reviewSelect(wrap,{label:'Theme',value:root._roadmapTheme,options:[{key:'dark',label:'Dark'},{key:'light',label:'Light'}],onChange:value=>{root._roadmapTheme=value;redraw();}});parent.append(wrap);}
const dispatchDefinitions=[
 ['Unconfirmed','Planned dispatch date has passed, but no actual dispatch date is recorded. This can be a missing update, not necessarily a delay.'],
 ['Dispatch not required','Explicit False. Excluded from missing-dispatch checks. When a dispatch reference date exists, the chart retains its recorded month.'],
 ['Inferred','No actual dispatch date is recorded, but an actual submission or approval date provides evidence of progress. Counted in the planned dispatch month when inference is enabled.']
];
function definitions(parent){
 const box=el('details');box.className='definitions';box.setAttribute('data-disclosure','definitions');box.append(el('summary','How counts work'));
 const content=el('div');dispatchDefinitions.forEach(([name,meaning])=>{const p=el('p'),label=el('strong',name+': ');label.style.color=colours[name==='Unconfirmed'?2:name==='Inferred'?3:4];p.append(label,document.createTextNode(meaning));content.append(p);});
 content.append(el('p','Each SubID counts once. Chart, outside selected year, undated and excluded are separate coverage groups and add up to loaded submissions. Missing Dates and date issues are checks that can overlap these groups; do not add them to coverage.'));
 content.append(el('p','These categories describe dispatch evidence, not submission completion status. Status values are taken from the source; blank, unmapped and conflicting values remain separate.'));box.append(content);parent.append(box);
}
// Rebuilding a host visual must not move its reader or interrupt text entry.
function captureView(root){
 const doc=root.ownerDocument||document,active=doc.activeElement,inside=active&&root.contains?.(active),ancestors=[];
 for(let node=root;node;node=node.parentElement)ancestors.push({node,top:node.scrollTop||0,left:node.scrollLeft||0});
 const frames=[...(root.querySelectorAll?.('[data-scroll-key]')||[])].map(node=>({key:node.getAttribute('data-scroll-key'),top:node.scrollTop,left:node.scrollLeft}));
 const disclosures=[...(root.querySelectorAll?.('details[data-disclosure]')||[])].map(node=>[node.getAttribute('data-disclosure'),node.open]);
 let caret=null;if(inside&&typeof active.selectionStart==='number')caret=[active.selectionStart,active.selectionEnd,active.selectionDirection];
 return {ancestors,frames,disclosures,key:inside?active.getAttribute('data-focus-key'):null,caret,window:typeof window==='undefined'?null:{x:window.scrollX||0,y:window.scrollY||0}};
}
function restoreView(root,snapshot){
 const keys=new Map();for(const node of root.querySelectorAll?.('button,input,select,textarea,summary,[tabindex]')||[]){
  let key=node.getAttribute('data-focus-key');if(!key){const basis=node.getAttribute('aria-label')||node.getAttribute('name')||node.textContent||node.tagName;const count=keys.get(basis)||0;keys.set(basis,count+1);key=basis+'#'+count;node.setAttribute('data-focus-key',key);}
 }
 for(const [key,open]of snapshot.disclosures){const node=[...(root.querySelectorAll?.('details[data-disclosure]')||[])].find(item=>item.getAttribute('data-disclosure')===key);if(node)node.open=open;}
 const target=snapshot.key&&[...(root.querySelectorAll?.('[data-focus-key]')||[])].find(node=>node.getAttribute('data-focus-key')===snapshot.key);
 if(target){target.focus?.({preventScroll:true});if(snapshot.caret&&target.setSelectionRange)try{target.setSelectionRange(...snapshot.caret);}catch{}}
 for(const frame of snapshot.frames){const node=[...(root.querySelectorAll?.('[data-scroll-key]')||[])].find(item=>item.getAttribute('data-scroll-key')===frame.key);if(node){node.scrollTop=frame.top;node.scrollLeft=frame.left;}}
 for(const entry of snapshot.ancestors){entry.node.scrollTop=entry.top;entry.node.scrollLeft=entry.left;}
 if(snapshot.window&&typeof window.scrollTo==='function')window.scrollTo(snapshot.window.x,snapshot.window.y);
}
export function render(root,rows,options={}){const snapshot=captureView(root);try{const result=renderContents(root,rows,options);paintRenderedTheme(root);return result;}finally{restoreView(root,snapshot);}}
function renderContents(root,rows,{now=new Date(),notice='',synthetic=false,includeInferred=false,onInference=()=>{},businessUnit='ID',onBusinessUnit=()=>{},expanded=new Set(),onExpansion=()=>{},mappedRoles=undefined,dispatchRequired='all',onDispatchRequired=()=>{},year=null,site='*',onYear=null,onSite=null}={}){
 const r=summarize(rows,viewingDay(now),includeInferred,businessUnit,{mappedRoles,dispatchRequired,year,site});root._roadmapTheme=root._roadmapTheme==='light'?'light':'dark';root.replaceChildren();root.className='roadmap2026 roadmap-theme-'+root._roadmapTheme;root.setAttribute('data-theme',root._roadmapTheme);
 const opts={now,notice,synthetic,includeInferred,onInference,businessUnit,onBusinessUnit,expanded,onExpansion,mappedRoles,dispatchRequired,onDispatchRequired,year,site,onYear,onSite};const redraw=()=>render(root,rows,opts);
 const review=root._statusReview||(root._statusReview={view:'overview',scope:'all',site:'*',month:'*',category:'*',subStatus:'*',roStatus:'*',query:'',page:0,worklistOpen:false,sort:{column:'id',direction:'asc'}});
 review.expandedRows=review.expandedRows||new Set();if(review.month===undefined)review.month='*';if(review.category===undefined)review.category='*';
 if(root._slide)return review.view==='status'?statusSlide(root,r,opts,review,redraw):roadSlide(root,r,opts,redraw);root.onkeydown=null;
 const drill=(selection={})=>{Object.assign(review,{worklistOpen:true,scope:'all',month:'*',category:'*',site:'*',subStatus:'*',roStatus:'*',query:'',page:0},selection);redraw();};
 const header=el('header'),title=el('div'),actions=el('div');actions.className='header-actions';title.append(el('h1',r.year+' Roadmap'),el('p','As of '+formatDay(viewingDay(now))));header.append(title);themeControl(actions,root,redraw);slideButton(actions,redraw,root);header.append(actions);root.append(header);
 if(synthetic){const label=el('small','Synthetic example data');label.className='synthetic-label';root.append(label);}if(notice){const n=el('p',notice);n.className='notice';n.setAttribute('role','status');root.append(n);}
 const controls=el('div');controls.className='controls shared-controls';
 const units=r.units.map(u=>({key:JSON.stringify(u),label:u===null?'Unassigned':u}));reviewSelect(controls,{label:'Business unit',value:businessUnit==='*'?'*':JSON.stringify(businessUnit),options:units,all:true,onChange:value=>{resetDrill();onBusinessUnit(value==='*'?'*':JSON.parse(value));}});
 const resetDrill=()=>Object.assign(review,{month:'*',category:'*',site:'*',page:0});
 reviewSelect(controls,{label:'Year',value:year===null||year===undefined?'':String(year),options:[{key:'',label:'Current year ('+now.getFullYear()+')'},...(r.years||[r.year]).map(y=>({key:String(y),label:String(y)}))],onChange:value=>{resetDrill();opts.year=value===''?null:Number(value);if(onYear)onYear(opts.year);else redraw();}});
 reviewSelect(controls,{label:'Site',value:site,options:r.siteOptions||r.sites,all:true,onChange:value=>{resetDrill();opts.site=value;if(onSite)onSite(value);else redraw();}});
 reviewSelect(controls,{label:'Dispatch required',value:dispatchRequired,options:dispatchOptions,onChange:value=>{resetDrill();onDispatchRequired(value);}});
 const labelCheck=el('label'),check=el('input');labelCheck.className='inference-control';check.type='checkbox';check.checked=includeInferred;check.setAttribute('aria-label','Include inferred dispatches');check.onchange=()=>{resetDrill();onInference(check.checked);};labelCheck.append(check,document.createTextNode('Include inferred dispatches'));controls.append(labelCheck);
 reviewSelect(controls,{label:'View',value:review.view,options:[{key:'overview',label:'Overview'},{key:'status',label:'Status review'}],onChange:value=>{review.view=value;redraw();}});root.append(controls);
 coverage(root,r,drill);
 if(review.view==='status'){statusReview(root,r,review,redraw);definitions(root);return r;}
 const main=el('section');main.className='overview-chart';main.setAttribute('aria-label','Dispatch overview');root.append(main);const heading=el('div');heading.className='chart-heading';heading.append(el('h2','Monthly dispatch outlook'));const inspect=el('button','Review Unconfirmed ('+r.totals[2]+')');inspect.className='reviewShortcut';inspect.onclick=()=>drill({scope:'unconfirmed'});heading.append(inspect);main.append(heading);
 overviewChart(main,r,now,drill);
 const activeCategories=categories.map((c,i)=>({c,i})).filter(x=>(includeInferred||x.i!==3)&&(x.i!==4||r.mappedRoles.includes('DispatchRequired')));
 const legend=el('div');legend.className='legend category-summary';activeCategories.forEach(({c,i})=>{const button=el('button'),dot=el('i');dot.style.background=colours[i];button.setAttribute('data-category',i);button.setAttribute('data-month','*');button.setAttribute('aria-label',c+': '+r.totals[i]+'. Review submissions');button.append(dot,el('span',c),el('strong',r.totals[i]),el('small',r.percentages[i].toFixed(1)+'%'));button.onclick=()=>drill({category:i});legend.append(button);});main.append(legend);
 if(review.worklistOpen)worklist(root,r,review,redraw,{compact:true});
 siteBreakdown(root,r,activeCategories,expanded,onExpansion,drill);
 const checks=el('details');checks.className='data-checks';checks.setAttribute('data-disclosure','checks');checks.append(el('summary','Data checks · '+r.issues.length+' date issues · '+r.missing.length+' Missing Dates'));
 const cleanup=el('p','Missing Dates — '+r.year+': '+r.missing.length+'. No usable dispatch date, with actual submission or approval in the selected year. Independent of inference.');cleanup.className='cleanup';checks.append(cleanup);
 const missingButton=el('button','Review Missing Dates');missingButton.onclick=()=>drill({scope:'missing-dates'});checks.append(missingButton);
 const notRequired=el('p','Dispatch not required — '+r.year+': '+r.notRequiredOutside.length+' outside chart (no dispatch month).');notRequired.className='not-required-outside';checks.append(notRequired);const notRequiredButton=el('button','Review dispatch not required outside chart');notRequiredButton.onclick=()=>drill({scope:'not-required-outside'});checks.append(notRequiredButton);
 if(includeInferred)checks.append(el('p','Undated inferred: '+r.undatedInferred.length+' across all filtered years; may overlap Missing Dates.'));
 checks.append(el('p','Date issues are retained for review; conflicting dates are not guessed. '+r.missingIdRows+' rows without SubID cannot be counted as distinct submissions.'));
 if(r.issues.length){const list=el('ul');r.issues.forEach(x=>list.append(el('li',x.id+': '+x.fields.join(', '))));checks.append(list);}root.append(checks);definitions(root);
 if(!r.mappedRoles.includes('DispatchRequired'))root.append(el('small','Dispatch required is not mapped. Existing dispatch rules apply; blank is not treated as False.'));return r;
}
function coverage(parent,r,drill){
 const counts=r.coverage||{loadedDistinct:r.distinct,chart:r.total,outsideYear:r.outsideYear,undated:Math.max(0,r.distinct-r.total-r.outsideYear-r.excluded.length),excluded:r.excluded.length};
 const strip=el('div');strip.className='coverage';strip.setAttribute('aria-label','Distinct submission coverage');
 for(const [key,label]of [['loadedDistinct','Loaded submissions'],['chart','In '+r.year+' chart'],['outsideYear','Outside '+r.year],['undated','Undated'],['excluded','Excluded: date issue']]){const item=key==='chart'?el('button'):el('div');item.className='coverage-item'+(key==='chart'?' chart-total':'');item.setAttribute('data-coverage',key);item.append(el('strong',counts[key]),el('span',label));if(key==='chart'){item.setAttribute('data-category','*');item.setAttribute('data-month','*');item.setAttribute('aria-label','Review all '+counts[key]+' chart submissions');item.onclick=()=>drill();}strip.append(item);}parent.append(strip);
}
function activate(node,handler){node.setAttribute('role','button');node.setAttribute('tabindex',0);node.addEventListener('click',handler);node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();handler();}});}
function overviewChart(parent,r,now,drill){
 const chart=el('div');chart.className='chart';chart.setAttribute('data-scroll-key','overview-chart');parent.append(chart);
 const width=Math.max(560,parent.clientWidth||900),height=280,left=46,right=14,top=30,bottom=32,plotW=width-left-right,plotH=height-top-bottom;
 const max=Math.max(1,...r.months.map(m=>m.reduce((a,b)=>a+b,0))),step=Math.max(1,Math.ceil(max/5)),ceiling=step*5,y=n=>top+plotH*(1-n/ceiling),band=plotW/12;
 const canvas=svg('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'group','aria-label':`${r.year} monthly dispatch counts. ${r.total} submissions. Select a bar to review submissions.`});chart.append(canvas);
 if(now.getFullYear()===r.year)canvas.append(svg('rect',{x:left+now.getMonth()*band,y:top,width:band,height:plotH,fill:'#edf4fc'}));
 for(let n=0;n<=ceiling;n+=step){canvas.append(svg('line',{x1:left,x2:width-right,y1:y(n),y2:y(n),stroke:'#dde4ec'}));const t=svg('text',{x:left-8,y:y(n)+4,'text-anchor':'end'});t.textContent=n;canvas.append(t);}
 const label=svg('text',{x:left,y:16});label.textContent='Submissions';canvas.append(label);const tip=el('div');tip.className='tip';tip.hidden=true;tip.setAttribute('role','tooltip');chart.append(tip);
 r.months.forEach((values,m)=>{let base=0;values.forEach((count,c)=>{if(!count)return;const bar=svg('rect',{x:left+m*band+band*.2,y:y(base+count),width:band*.6,height:plotH*count/ceiling,fill:colours[c],'data-month':m,'data-category':c,'data-count':count,'data-focus-key':'overview-bar-'+m+'-'+c,'aria-label':`${months[m]} ${r.year}: ${categories[c]}, ${count}. Review submissions`});
 const evidence=r.records.filter(x=>x.month===m&&x.category===3);const text=`${months[m]} ${r.year} · ${categories[c]}: ${count}`+(c===2?'\nPlanned dispatch date has passed; actual dispatch date not recorded.':'')+(c===3?'\nActual dispatch missing. Month comes from planned dispatch.\nActual submission evidence: '+evidence.filter(x=>x.evidence.some(e=>e.field==='ActualSubmission')).length+'; actual approval evidence: '+evidence.filter(x=>x.evidence.some(e=>e.field==='ActualApproval')).length+' (may overlap).':'')+(c===4?'\nDispatch not required. Stored dispatch reference month, not evidence that dispatch was required.':'');
 const title=svg('title',{});title.textContent=text;bar.append(title);const show=()=>{tip.textContent=text;tip.hidden=false;tip.style.left=Math.max(8,Math.min(width-280,left+m*band))+'px';tip.style.top='12px';};bar.addEventListener('pointerenter',show);bar.addEventListener('focus',show);bar.addEventListener('pointerleave',()=>tip.hidden=true);bar.addEventListener('blur',()=>tip.hidden=true);activate(bar,()=>drill({month:m,category:c}));canvas.append(bar);base+=count;});
 const count=svg('text',{x:left+(m+.5)*band,y:y(base)-7,'text-anchor':'middle','data-month':m,'data-category':'*','data-count':base,'data-focus-key':'month-total-'+m,'aria-label':months[m]+' '+r.year+': '+base+'. Review month'});count.textContent=base;activate(count,()=>drill({month:m}));canvas.append(count);
 const t=svg('text',{x:left+(m+.5)*band,y:height-10,'text-anchor':'middle'});t.textContent=months[m];canvas.append(t);});
 canvas.append(svg('line',{x1:left,x2:width-right,y1:y(r.average),y2:y(r.average),stroke:'#586779','stroke-width':1.5,'stroke-dasharray':'6 4'}));const avg=el('p',`Average per calendar month: ${r.average.toFixed(1)} (${r.total} ÷ 12). Select a bar, month total or category to open its worklist.`);avg.className='average';parent.append(avg);
}
function siteBreakdown(parent,r,cats,expanded,onExpansion,drill){
 const side=el('details');side.className='sites';side.setAttribute('data-disclosure','sites');side.append(el('summary','Site breakdown · '+r.sites.length+' chart buckets'));const frame=el('div');frame.className='site-table-frame';frame.setAttribute('data-scroll-key','sites');side.append(frame);parent.append(side);
 const table=el('table'),head=el('thead'),headers=el('tr');['Site',...cats.map(x=>x.c),'Total'].forEach(t=>headers.append(el('th',t)));head.append(headers);table.append(head);const body=el('tbody');
 const cells=(row,counts,total,site,month='*')=>{[...cats.map(({i})=>({category:i,count:counts[i]})),{category:'*',count:total}].forEach(({category,count})=>{const cell=el('td'),button=el('button',String(count));button.className='count-link';button.setAttribute('data-site',site);button.setAttribute('data-month',month);button.setAttribute('data-category',category);button.setAttribute('aria-label',(site==='*'?'All sites':r.sites.find(s=>s.key===site)?.label||site)+' · '+(month==='*'?'All months':months[month])+' · '+(category==='*'?'Total':categories[category])+': '+count+'. Review submissions');button.onclick=()=>drill({site,month,category});cell.append(button);row.append(cell);});};
 r.sites.forEach(site=>{const row=el('tr'),name=el('td'),button=el('button',(expanded.has(site.key)?'▾ ':'▸ ')+site.label);button.setAttribute('aria-expanded',String(expanded.has(site.key)));button.setAttribute('data-focus-key','site-expand-'+site.key);button.onclick=()=>onExpansion(site.key);name.append(button);row.append(name);cells(row,site.totals,site.total,site.key);body.append(row);if(expanded.has(site.key))site.months.forEach((counts,m)=>{const row=el('tr');row.className='monthRow';row.append(el('td',months[m]));cells(row,counts,counts.reduce((a,b)=>a+b,0),site.key,m);body.append(row);});});
 const total=el('tr');total.className='total';total.append(el('td','Total'));cells(total,r.totals,r.total,'*');body.append(total);table.append(body);frame.append(table);if(r.ambiguousSites.length)side.append(el('small',r.ambiguousSites.length+' submissions have multiple sites and are counted once in the unallocated bucket. Shared Site filtering matches all recorded site associations.'));
}
const reviewScopes=[['unconfirmed','Unconfirmed'],['inferred','Inferred'],['missing-dispatch','Chart records missing actual dispatch'],['missing-dates','Missing Dates — outside chart'],['not-required','Dispatch not required — chart'],['not-required-outside','Dispatch not required — outside chart'],['all','All chart submissions']];
const scopeLabel=scope=>reviewScopes.find(x=>x[0]===scope)?.[1]||'Unconfirmed';
const dateLabel=day=>formatDay(day);
const statusDetail=status=>status.kind==='conflict'?status.label+': '+status.values.join(' / '):status.label;
const completedMissing=record=>record.missingActual&&record.subStatus.kind==='value'&&record.subStatus.values.some(value=>value.toLowerCase()==='completed');
function missingStatusRoles(r){return ['SubStatus','ROStatus'].filter(role=>!(r.mappedRoles||[]).includes(role));}
function mappingText(r){const absent=missingStatusRoles(r);return absent.length?'To see recorded statuses, map '+absent.map(role=>role==='SubStatus'?'Submission status (SubStatus)':'RO status (ROStatus)').join(' and ')+' in the visual fields. These fields are optional; dispatch counts stay unchanged.':'';}
function reviewSelect(parent,{label,aria=label,value,options,onChange,all=false}){
 const wrap=el('label'),caption=el('span',label),select=el('select');select.setAttribute('aria-label',aria);
 const add=(key,text)=>{const option=el('option',text);option.value=key;select.append(option);};if(all)add('*','All');options.forEach(item=>add(item.key,item.label));
 if(value!=='*'&&!options.some(item=>item.key===value)){let selected=String(value);if(label==='Business unit')try{selected=JSON.parse(value)??'Unassigned';}catch{}add(value,selected+' (no matching records)');}select.value=value;select.onchange=()=>onChange(select.value);wrap.append(caption,select);parent.append(wrap);return select;
}
function statusCountTable(parent,title,className,buckets,total){
 const section=el('section');section.append(el('h3',title));const table=el('table');table.className=className;table.setAttribute('aria-label',title);const head=el('thead'),headers=el('tr');['Recorded status','Submissions','Share'].forEach(label=>headers.append(el('th',label)));head.append(headers);table.append(head);const body=el('tbody');
 if(!buckets.length){const row=el('tr'),cell=el('td','No matching submissions');cell.colSpan=3;row.append(cell);body.append(row);}
 for(const bucket of buckets){const row=el('tr');row.dataset.statusKind=bucket.kind;row.append(el('td',bucket.label),el('td',String(bucket.count)),el('td',(total?bucket.count/total*100:0).toFixed(1)+'%'));body.append(row);}
 const sum=el('tr');sum.className='total';sum.append(el('td','Total submissions'),el('td',String(total)),el('td',total?'100%':'0%'));body.append(sum);table.append(body);section.append(table);parent.append(section);
}
function statusColour(bucket){
 if(bucket.kind==='conflict')return '#ba3440';if(bucket.kind==='blank')return '#8893a0';if(bucket.kind==='unmapped')return '#adb7c2';
 const key=bucket.label.trim().toLowerCase(),known={'completed':'#23845b','health authority approved':'#23845b','approved':'#23845b','in progress':'#dc8320','planned':'#3278c5','withdrawn':'#66717e','inactive':'#87909b','archived':'#66717e','deferred':'#b47531','on hold by mah':'#b47531','ha received':'#237f91','sent to health authority':'#6658b4','ready for submission':'#8b56a7','distributed':'#318a81','rejected':'#b85458'};
 if(known[key])return known[key];const palette=['#436ba5','#8853a3','#327f87','#a96b30','#4c7f55','#9a526b','#6667a4','#547b8b'];let hash=0;for(const char of key)hash=(hash*31+char.charCodeAt(0))>>>0;return palette[hash%palette.length];
}
function statusChartModel(review,state){
 const field=state.chartBy==='roStatus'?'roStatus':'subStatus',buckets=review.counts[field==='roStatus'?'roStatuses':'submissionStatuses'],monthly=Array.from({length:12},()=>new Map());
 for(const record of review.records)if(Number.isInteger(record.month)&&record.month>=0&&record.month<12){const month=monthly[record.month],key=record[field].key;month.set(key,(month.get(key)||0)+1);}
 return {field,label:field==='roStatus'?'RO status':'Submission status',buckets,monthly,undated:['missing-dates','not-required-outside'].includes(review.scope),undatedTitle:review.scope==='not-required-outside'?'Dispatch not required by status':'Missing Dates by recorded status',total:review.total};
}
function chartDateNote(model){return model.undated?'No usable dispatch date — shown by status without assigning a month.':'Month uses dispatch date: actual if recorded, otherwise plan. It is not the status completion month.';}
function horizontalRows(model,width,font){const labelWidth=Math.min(width*.37,345),chars=Math.max(16,Math.floor(labelWidth/(font*.58)));return {labelWidth,rows:model.buckets.map(bucket=>({bucket,lines:wrappedText(bucket.label,chars),height:Math.max(font*2.4,wrappedText(bucket.label,chars).length*(font+4)+14)}))};}
function statusPlotHeight(model,width,font=15){return model.undated?Math.max(165,horizontalRows(model,width,font).rows.reduce((sum,row)=>sum+row.height,0)+font*3):font>=20?272:270;}
function drawStatusPlot(canvas,model,{x=0,y=0,width=1000,height=270,font=15,year,showTip,onSelect}={}){
 const kind=model.undated?'status-undated':'status-monthly',group=svg('g',{'data-chart':kind});canvas.append(group);
 const draw=(tag,attrs,text)=>{const item=svg(tag,attrs);if(text!==undefined)item.textContent=String(text);if(tag==='text'){item.style.fontSize=(attrs['font-size']||font)+'px';item.style.fill=attrs.fill||'#33475c';item.style.fontWeight=String(attrs['font-weight']||400);}group.append(item);return item;};
 const text=(xx,yy,value,anchor='start',weight=400)=>draw('text',{x:xx,y:yy,'font-size':font,'text-anchor':anchor,'font-weight':weight},value);
 const bar=(attrs,bucket,count,description)=>{const item=draw('rect',{...attrs,fill:statusColour(bucket),tabindex:0,role:'graphics-symbol','data-status-key':bucket.key,'data-count':count,'data-focus-key':'status-bar-'+model.field+'-'+(attrs['data-month']??'*')+'-'+bucket.key,'aria-label':description});const title=svg('title',{});title.textContent=description;item.append(title);if(showTip){const show=()=>showTip(description,true),hide=()=>showTip('',false);item.addEventListener('pointerenter',show);item.addEventListener('focus',show);item.addEventListener('pointerleave',hide);item.addEventListener('blur',hide);}if(onSelect)activate(item,()=>onSelect(bucket,attrs['data-month']??'*'));return item;};
 if(model.undated){const layout=horizontalRows(model,width,font),left=x+layout.labelWidth+18,right=x+width-50,plotW=right-left,max=Math.max(1,...model.buckets.map(bucket=>bucket.count));let rowY=y+font;
  for(const {bucket,lines,height:rowHeight}of layout.rows){lines.forEach((line,i)=>text(x,rowY+i*(font+4),line));const barY=rowY-font+3;draw('rect',{x:left,y:barY,width:plotW,height:font+7,fill:'#f0f3f7'});const length=plotW*bucket.count/max;bar({x:left,y:barY,width:length,height:font+7},bucket,bucket.count,`${bucket.label}: ${bucket.count} submissions. Outside chart; no usable dispatch month.`);text(left+length+10,rowY+3,bucket.count,'start',650);rowY+=rowHeight;}
  if(!model.total)text(x+20,y+60,'No matching submissions');return group;
 }
 const left=x+font*2.9,right=x+width-14,top=y+font*1.8,bottom=y+height-font*2,plotH=bottom-top,plotW=right-left,totals=model.monthly.map(month=>[...month.values()].reduce((sum,count)=>sum+count,0)),max=Math.max(1,...totals),step=Math.max(1,Math.ceil(max/4)),ceiling=step*4,scale=count=>bottom-plotH*count/ceiling,band=plotW/12;
 for(let count=0;count<=ceiling;count+=step){draw('line',{x1:left,x2:right,y1:scale(count),y2:scale(count),stroke:'#dbe3ec'});text(left-10,scale(count)+font*.33,count,'end');}
 model.monthly.forEach((counts,month)=>{let base=0;for(const bucket of model.buckets){const count=counts.get(bucket.key)||0;if(!count)continue;const description=`${months[month]} ${year} · ${model.label}: ${bucket.label} · ${count} submissions. Month follows dispatch actual/plan, not completion status.`;bar({x:left+(month+.2)*band,y:scale(base+count),width:band*.6,height:plotH*count/ceiling,'data-month':month},bucket,count,description);base+=count;}text(left+(month+.5)*band,scale(totals[month])-8,totals[month],'middle',650);text(left+(month+.5)*band,bottom+font*1.5,months[month],'middle');});
 return group;
}
function statusChart(parent,r,review,state,redraw){
 if(state.chartBy!=='roStatus')state.chartBy='subStatus';const model=statusChartModel(review,state),section=el('section');section.className='status-chart';parent.append(section);const controls=el('div');controls.className='status-chart-heading';controls.append(el('h3',model.undated?model.undatedTitle:'Monthly dispatch records by status'));reviewSelect(controls,{label:'Colour bars by',value:state.chartBy,options:[{key:'subStatus',label:'Submission status'},{key:'roStatus',label:'RO status'}],onChange:value=>{state.chartBy=value;redraw();}});section.append(controls);
 const select=(bucket,month='*')=>{state[model.field]=bucket.key;state.month=month;state.page=0;redraw();};
 const legend=el('div');legend.className='legend status-legend';model.buckets.forEach(bucket=>{const label=el('button'),dot=el('i');dot.style.background=statusColour(bucket);label.setAttribute('data-focus-key','status-legend-'+model.field+'-'+bucket.key);label.setAttribute('aria-label','Review '+model.label+': '+bucket.label);label.append(dot,document.createTextNode(bucket.label));label.onclick=()=>select(bucket);legend.append(label);});section.append(legend);
 const holder=el('div');holder.className='status-chart-canvas';holder.setAttribute('data-scroll-key','status-chart');section.append(holder);const width=Math.max(560,holder.clientWidth||900),height=statusPlotHeight(model,width),canvas=svg('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'group','aria-label':`${scopeLabel(state.scope)}: ${model.total} submissions by ${model.label.toLowerCase()}${model.undated?', no dispatch month':', across all 12 dispatch months'}.`});holder.append(canvas);const tip=el('div');tip.className='tip';tip.hidden=true;tip.setAttribute('role','tooltip');holder.append(tip);drawStatusPlot(canvas,model,{width,height,year:r.year,onSelect:select,showTip:(description,visible)=>{tip.textContent=description;tip.hidden=!visible;tip.style.left='55px';tip.style.top='8px';}});
 const note=el('p',chartDateNote(model));note.className='status-chart-note';section.append(note);if(!model.total&&!model.undated)section.append(el('p','No matching submissions.'));
}
function reviewFilters(parent,r,state,redraw){
 const controls=el('div');controls.className='review-filters';const review=selectStatusReview(r,state),update=(key,value)=>{state[key]=value;state.page=0;redraw();};
 reviewSelect(controls,{label:'Records to review',aria:'Status review scope',value:state.scope,options:reviewScopes.map(([key,label])=>({key,label})),onChange:value=>{state.month='*';state.category='*';update('scope',value);}});
 reviewSelect(controls,{label:'Submission status',value:state.subStatus,options:review.submissionStatuses,all:true,onChange:value=>update('subStatus',value)});
 reviewSelect(controls,{label:'RO status',value:state.roStatus,options:review.roStatuses,all:true,onChange:value=>update('roStatus',value)});
 const label=el('label'),search=el('input');search.type='search';search.value=state.query;search.placeholder='Submission ID, site or status';search.setAttribute('aria-label','Search status records');search.oninput=()=>update('query',search.value);label.append(el('span','Search'),search);controls.append(label);
 const reset=el('button','Clear review filters');reset.onclick=()=>{Object.assign(state,{site:'*',month:'*',category:'*',subStatus:'*',roStatus:'*',query:'',page:0});redraw();};controls.append(reset);parent.append(controls);
 if(state.month!=='*'||state.category!=='*'||state.site!=='*'){
  const context=el('div');context.className='drill-context';const selected=[state.month!=='*'?months[Number(state.month)]+' '+r.year:'',state.category!=='*'?categories[Number(state.category)]:'',state.site!=='*'?(r.sites.find(site=>site.key===state.site)?.label||state.site)+' (chart bucket)':''].filter(Boolean);context.append(el('span','Selected: '+selected.join(' · ')));const clear=el('button','Clear drill selection');clear.onclick=()=>{Object.assign(state,{site:'*',month:'*',category:'*',page:0});redraw();};context.append(clear);parent.append(context);
 }
}
function statusReview(root,r,state,redraw){
 const panel=el('section');panel.className='status-review';root.append(panel);const heading=el('div');heading.className='review-heading';heading.append(el('h2','Dispatch status review'));panel.append(heading);
 const context=el('p','Recorded submission and RO statuses alongside dispatch evidence. Year, Site, Business unit and Dispatch required apply to both views.');context.className='review-context';panel.append(context);
 const mapping=mappingText(r);if(mapping){const message=el('p',mapping);message.className='mapping-notice';message.setAttribute('role','status');panel.append(message);}
 reviewFilters(panel,r,state,redraw);const review=selectStatusReview(r,state);
 const scopeNote=el('p',state.scope==='not-required-outside'?'Dispatch not required: actual submission or approval in '+r.year+'; no dispatch month assigned.':state.scope==='missing-dates'?r.year+' Missing Dates is outside the chart total and independent of the inference checkbox.':state.scope==='inferred'&&!r.includeInferred?'Enable Include inferred dispatches to inspect records classified as Inferred.':'Showing '+review.total+' of '+review.scopeTotal+' submissions in '+scopeLabel(state.scope)+'.');scopeNote.className='review-scope-note';panel.append(scopeNote);
 statusChart(panel,r,review,state,redraw);worklist(panel,r,state,redraw,{showFilters:false});
 const disclosure=el('details');disclosure.className='status-count-details';disclosure.setAttribute('data-disclosure','status-counts');disclosure.append(el('summary','Recorded status counts'));
 const counts=el('div');counts.className='status-summary';statusCountTable(counts,'By submission status','submission-status-summary',review.counts.submissionStatuses,review.total);statusCountTable(counts,'By RO status','ro-status-summary',review.counts.roStatuses,review.total);disclosure.append(counts);
 const caution=el('p','Both tables count submissions, not ROs. A Completed status does not supply a missing dispatch date. An RO status does not mark its submissions completed.');caution.className='review-explanation';disclosure.append(caution);panel.append(disclosure);
}
const worklistColumns=[['id','Submission ID'],['site','Site'],['category','Dispatch group'],['dispatchRequired','Dispatch required'],['subStatus','Submission status'],['roStatus','RO status'],['plannedDay','Planned dispatch'],['actualDay','Actual dispatch']];
const dateNames={OriginalDispatch:'Original dispatch',LatestDispatch:'Latest dispatch',ActualDispatch:'Actual dispatch',ActualSubmission:'Actual submission',ActualApproval:'Actual approval'};
function recordDetails(record){
 const box=el('div');box.className='record-details';box.append(el('h4','Recorded evidence for '+record.id));
 const context=el('p','Sites: '+(record.sites.length?record.sites.join(' · '):'Unassigned')+'. '+(record.chosenField?'Chart date: '+dateNames[record.chosenField]+' · '+formatDay(record.chosenDay)+'.':record.outsideChart?'No dispatch month assigned.':'No usable dispatch reference.'));box.append(context);
 const status=el('dl');status.className='record-statuses';for(const [label,value]of [['Submission status',record.subStatus],['RO status',record.roStatus],['Dispatch required',record.dispatchRequired]]){status.append(el('dt',label),el('dd',value.label+(['conflict','invalid'].includes(value.kind)&&value.values?.length?' · Recorded values: '+value.values.join(' / '):'')));}box.append(status);
 const dates=el('dl');dates.className='record-dates';for(const field of dateRoles){
  const term=el('dt',dateNames[field]),value=el('dd'),raw=record.dateValues?.[field]||[],resolved=record.dates?.[field];term.title=field;value.setAttribute('data-date-field',field);
  if(record.dateIssues?.includes(field)){const warning=el('strong','Date issue — invalid or conflicting recorded values.');warning.className='date-issue';value.append(warning);}else value.append(el('strong',resolved?.kind==='date'?formatDay(resolved.day):raw.length?formatDay(raw[0],'No usable resolved date'):'Not recorded'));
  if(raw.length&&record.dateIssues?.includes(field)){const list=el('ul');raw.forEach(source=>{const formatted=formatDay(source,'Invalid date');list.append(el('li',formatted+' · Source: '+source));});value.append(list);}dates.append(term,value);
 }box.append(dates);
 if(record.missingActual&&record.evidence.length)box.append(el('p','Progress evidence: '+record.evidence.map(item=>dateNames[item.field]+' '+formatDay(item.day)).join('; ')+'. This does not supply a missing actual dispatch date.'));
 if(completedMissing(record))box.append(el('p','Completed — dispatch date missing. Recorded submission status does not supply a dispatch milestone.'));return box;
}
function worklist(parent,r,state,redraw,{compact=false,showFilters=true}={}){
 const review=selectStatusReview(r,state),panel=el('section');panel.className='submission-worklist';panel.setAttribute('aria-label','Submission worklist');parent.append(panel);
 const heading=el('div');heading.className='worklist-heading';heading.append(el('h3','Submission worklist'));const count=el('span',review.total+' matching submissions');count.className='review-count';count.setAttribute('role','status');heading.append(count);
 const copy=el('button','Copy IDs');copy.className='copy-ids';copy.disabled=!review.total;copy.setAttribute('aria-label','Copy IDs');heading.append(copy);
 if(compact){const close=el('button','Close worklist');close.className='close-worklist';close.onclick=()=>{state.worklistOpen=false;redraw();};heading.append(close);}panel.append(heading);
 const feedback=el('span');feedback.className='copy-status';feedback.setAttribute('role','status');panel.append(feedback);
 copy.onclick=async()=>{const ids=review.records.map(record=>record.id).join('\n');try{if(!globalThis.navigator?.clipboard?.writeText)throw new Error('Clipboard unavailable');await globalThis.navigator.clipboard.writeText(ids);feedback.textContent=review.total+' submission IDs copied.';}catch{feedback.textContent='Clipboard access is unavailable. Press Ctrl+C (or Command+C) to copy the selected IDs manually.';let fallback=panel.querySelector?.('[aria-label="Submission IDs to copy"]');if(!fallback){fallback=el('textarea');fallback.className='copy-fallback';fallback.setAttribute('aria-label','Submission IDs to copy');fallback.readOnly=true;fallback.rows=4;feedback.append(fallback);}fallback.value=ids;fallback.focus?.({preventScroll:true});fallback.select?.();}};
 if(showFilters)reviewFilters(panel,r,state,redraw);
 const frame=el('div');frame.className='worklist-frame';frame.setAttribute('data-scroll-key','worklist');frame.setAttribute('tabindex',0);frame.setAttribute('aria-label','Scrollable submission worklist');const table=el('table');table.className='status-worklist';table.setAttribute('aria-label','Status review submission worklist');const thead=el('thead'),header=el('tr');
 worklistColumns.forEach(([key,label])=>{const th=el('th'),button=el('button',label);th.scope='col';const active=(state.sort?.column||'site')===key;th.setAttribute('aria-sort',active?(state.sort?.direction==='desc'?'descending':'ascending'):'none');button.setAttribute('aria-label','Sort by '+label);button.setAttribute('data-sort-column',key);button.setAttribute('data-focus-key','sort-'+key);if(active)button.append(el('span',state.sort?.direction==='desc'?' ↓':' ↑'));button.onclick=()=>{state.sort={column:key,direction:active&&state.sort?.direction!=='desc'?'desc':'asc'};state.page=0;redraw();};th.append(button);header.append(th);});thead.append(header);table.append(thead);const body=el('tbody');
 const pageSize=25,pages=Math.max(1,Math.ceil(review.total/pageSize));state.page=Math.min(Math.max(0,state.page||0),pages-1);const start=state.page*pageSize;
 for(const record of review.records.slice(start,start+pageSize)){
  const row=el('tr');row.setAttribute('data-submission-id',record.id);const id=el('td'),expanded=state.expandedRows.has(record.id),toggle=el('button',(expanded?'▾ ':'▸ ')+record.id);toggle.className='record-toggle';toggle.setAttribute('aria-label',(expanded?'Hide':'Show')+' details for '+record.id);toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('data-focus-key','record-'+record.id);toggle.onclick=()=>{if(expanded)state.expandedRows.delete(record.id);else state.expandedRows.add(record.id);redraw();};id.append(toggle);
  if(completedMissing(record)){const note=el('small','Completed — dispatch date missing');note.className='completed-missing';id.append(note);}else if(record.missingActual)id.append(el('small','Actual dispatch date missing'));
  if(record.dateIssues?.length){const note=el('small','Date issue · expand for evidence');note.className='date-issue';id.append(note);}
  const group=el('td',record.outsideChart?(record.category===4?'Dispatch not required — outside chart':'Missing Dates — outside chart'):categories[record.category]);group.className='dispatch-group';group.style.borderLeft='3px solid '+(colours[record.category]||'#94a3b8');
  const flag=el('td',record.dispatchRequired.label);if(record.dispatchRequired.kind==='conflict'||record.dispatchRequired.kind==='invalid')flag.append(el('small',record.dispatchRequired.values.join(' / ')));row.append(id,el('td',record.site),group,flag);
  for(const field of ['subStatus','roStatus']){const value=record[field],cell=el('td'),label=el('span',statusDetail(value)),dot=el('i');cell.setAttribute('data-status-kind',value.kind);dot.className='status-dot';dot.style.background=statusColour(value);cell.append(dot,label);row.append(cell);}
  row.append(el('td',record.planState==='issue'?'Date issue':formatDay(record.reviewPlannedDay??record.plannedDay)),el('td',record.dateIssues?.includes('ActualDispatch')?'Date issue':formatDay(record.actualDispatchDay??record.actualDay)));body.append(row);
  if(expanded){const detail=el('tr'),cell=el('td');detail.className='record-detail';detail.setAttribute('data-detail-for',record.id);cell.colSpan=worklistColumns.length;cell.append(recordDetails(record));detail.append(cell);body.append(detail);}
 }
 if(!review.total){const row=el('tr'),cell=el('td','No submissions match these review filters.');cell.colSpan=worklistColumns.length;row.append(cell);body.append(row);}table.append(body);frame.append(table);panel.append(frame);
 const paging=el('div');paging.className='review-paging';const previous=el('button','Previous records'),next=el('button','Next records'),page=el('span',review.total?`${start+1}–${Math.min(start+pageSize,review.total)} of ${review.total} · Page ${state.page+1} of ${pages}`:'0 records');previous.setAttribute('aria-label','Previous records');next.setAttribute('aria-label','Next records');previous.setAttribute('aria-disabled',String(state.page===0));next.setAttribute('aria-disabled',String(state.page>=pages-1));previous.onclick=()=>{if(state.page===0)return;state.page--;redraw();};next.onclick=()=>{if(state.page>=pages-1)return;state.page++;redraw();};paging.append(previous,page,next);panel.append(paging);
 panel.append(el('small','Expand a submission for all five recorded dates, statuses and source evidence for date issues. A dash means no usable resolved date.'));
}
function wrappedText(value,max=46){const lines=[];let line='';for(const word of String(value).split(/\s+/)){if(line&&(line+' '+word).length>max){lines.push(line);line='';}if(word.length>max){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines.length?lines:[''];}
function statusSlide(root,r,o,state,exit){
 const review=selectStatusReview(r,state),model=statusChartModel(review,state),facetLabel=(items,key)=>key==='*'?'All':items.find(item=>item.key===key)?.label||'Selected value (no matches)';
 const context='Site: '+(o.site==='*'?'All':r.siteOptions.find(item=>item.key===o.site)?.label||o.site)+' · Scope: '+scopeLabel(state.scope)+(state.site!=='*'?' · Chart site bucket: '+facetLabel(review.sites,state.site):'')+(state.month!=='*'?' · Dispatch month: '+months[Number(state.month)]+' '+r.year:'')+(state.category!=='*'?' · Dispatch category: '+categories[Number(state.category)]:'')+' · Submission status: '+facetLabel(review.submissionStatuses,state.subStatus)+' · RO status: '+facetLabel(review.roStatuses,state.roStatus)+' · Colour bars by: '+model.label+(state.query?' · Search: '+state.query:'');
 const contextLines=wrappedText(context,105),warnings=[o.synthetic?'Fictional demonstration data':'',o.notice,mappingText(r)].filter(Boolean).flatMap(value=>wrappedText(value,107));
 const rowsHeight=buckets=>buckets.reduce((height,bucket)=>height+Math.max(46,wrappedText(bucket.label,35).length*26+15),0);
 const chartTop=190+(contextLines.length-1)*26+warnings.length*24,legendRows=[];for(let index=0;index<model.buckets.length;index+=3){const items=model.buckets.slice(index,index+3).map(bucket=>({bucket,lines:wrappedText(bucket.label,28)}));legendRows.push({items,height:Math.max(...items.map(item=>item.lines.length))*25+12});}
 const legendHeight=legendRows.reduce((sum,row)=>sum+row.height,0),plotY=chartTop+69+legendHeight,plotHeight=statusPlotHeight(model,1152,20),tableTop=plotY+plotHeight+68,height=Math.max(960,tableTop+94+Math.max(rowsHeight(review.counts.submissionStatuses),rowsHeight(review.counts.roStatuses))+145);
 const {text,rect,shape}=slideCanvas(root,r.year+' Dispatch status review','Business unit: '+(o.businessUnit==='*'?'All':o.businessUnit??'Unassigned')+' · Dispatch required: '+dispatchLabel(o.dispatchRequired)+' · Inferred '+(o.includeInferred?'included':'excluded')+' · As of '+formatDay(viewingDay(o.now)),height,exit);let contextY=115;contextLines.forEach(line=>{text(24,contextY,line,20);contextY+=26;});warnings.forEach(line=>{text(24,contextY,line,20,'#8a4b00');contextY+=24;});text(24,chartTop-20,review.total+' matching submissions',29,'#122c49','start',700);
 text(24,chartTop+20,model.undated?model.undatedTitle:'Monthly dispatch records by '+model.label.toLowerCase(),26,'#122c49','start',650);let legendY=chartTop+56;
 for(const row of legendRows){row.items.forEach(({bucket,lines},index)=>{const x=24+index*389;rect(x,legendY-15,16,16,statusColour(bucket));lines.forEach((line,j)=>text(x+26,legendY+j*25,line,20));});legendY+=row.height;}
 drawStatusPlot(root.querySelector('svg'),model,{x:24,y:plotY,width:1152,height:plotHeight,font:20,year:r.year});text(24,plotY+plotHeight+23,chartDateNote(model),20);
 const drawTable=(x,title,buckets)=>{text(x,tableTop+20,title,26,'#122c49','start',650);text(x,tableTop+57,'Recorded status',20);text(x+531,tableTop+57,'Submissions',20,'#33475c','end');shape('line',{x1:x,x2:x+536,y1:tableTop+72,y2:tableTop+72,stroke:'#cbd5e1'});let y=tableTop+108;
  if(!buckets.length){text(x,y,'No matching submissions',23);y+=46;}for(const bucket of buckets){const lines=wrappedText(bucket.label,35),rowHeight=Math.max(46,lines.length*26+15);lines.forEach((line,i)=>text(x,y+i*26,line,23));text(x+531,y,bucket.count,27,'#122c49','end',650);y+=rowHeight;}rect(x-5,y-26,546,44,'#edf3fa');text(x,y+3,'Total submissions',23,'#122c49','start',650);text(x+531,y+3,review.total,28,'#122c49','end',700);};
 drawTable(24,'By submission status',review.counts.submissionStatuses);drawTable(640,'By RO status',review.counts.roStatuses);
 text(24,height-89,'Both tables count submissions. A Completed status does not supply a missing dispatch date.',20);
 text(24,height-59,'RO status describes the parent objective; it does not confirm submission completion.',20);
 text(24,height-29,state.scope==='missing-dates'?'Missing Dates records are outside the chart total.':'Status review filters do not change the Overview dispatch counts.',20);
 return r;
}

function slideCanvas(root,title,subtitle,height,exit){
 root.replaceChildren();root.className+=' slideCapture';root.tabIndex=0;const returnToControls=()=>{const previous=root._normalViewSnapshot;root._normalViewSnapshot=null;root._slide=false;exit();if(previous)restoreView(root,previous);else root.querySelector?.('.captureButton')?.focus?.({preventScroll:true});};root.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();returnToControls();}};
 const canvas=document.createElementNS('http://www.w3.org/2000/svg','svg');canvas.setAttribute('viewBox','0 0 1200 '+height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title+'. '+subtitle+'. Press Escape to return to controls.');canvas.setAttribute('preserveAspectRatio','xMidYMid meet');const toolbar=el('div');toolbar.className='capture-toolbar';themeControl(toolbar,root,exit);const close=el('button','Exit screenshot mode');close.className='capture-exit';close.onclick=returnToControls;toolbar.append(close);root.append(toolbar,canvas);
 const shape=(tag,a={},value)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(a))n.setAttribute(k,String(v));if(value!==undefined)n.textContent=String(value);if(a['font-size'])n.style.fontSize=a['font-size']+'px';if(a.fill)n.style.fill=a.fill;if(a['font-weight'])n.style.fontWeight=String(a['font-weight']);canvas.append(n);return n};
 const text=(x,y,t,size=22,fill='#24364b',anchor='start',weight=400)=>shape('text',{x,y,'font-size':size,fill,'text-anchor':anchor,'font-weight':weight},t);
 const rect=(x,y,w,h,fill)=>shape('rect',{x,y,width:w,height:h,fill});
 rect(0,0,1200,height,'white');text(24,44,title,34,'#122c49','start',650);text(24,79,subtitle,20);
 return {text,rect,shape};
}
function slideButton(parent,draw,root=parent){const b=el('button','Screenshot mode');b.className='captureButton';b.title='Slide-ready layout. Press Escape to return to controls.';b.onpointerdown=()=>{root._normalViewSnapshot=captureView(root);};b.onclick=()=>{root._normalViewSnapshot=root._normalViewSnapshot||captureView(root);root._slide=true;draw();root.focus?.({preventScroll:true})};parent.append(b)}

function roadSlide(root,r,o,exit){
 const cats=categories.map((c,i)=>({c,i})).filter(x=>(o.includeInferred||x.i!==3)&&(x.i!==4||r.mappedRoles.includes('DispatchRequired')));
 const context='Business unit: '+(o.businessUnit==='*'?'All':o.businessUnit??'Unassigned')+' · Site: '+(o.site==='*'?'All':r.siteOptions.find(item=>item.key===o.site)?.label||o.site)+' · Dispatch required: '+dispatchLabel(o.dispatchRequired)+' · Inferred '+(o.includeInferred?'included':'excluded')+' · As of '+formatDay(viewingDay(o.now));
 const contextLines=wrappedText(context,100),warnings=[o.synthetic?'Fictional demonstration data':'',o.notice].filter(Boolean).flatMap(value=>wrappedText(value,110));
 const plotTop=160+(contextLines.length-1)*25+warnings.length*23,plotH=250,summaryY=plotTop+plotH+96,siteTitleY=summaryY+108,headerY=siteTitleY+39;
 const siteRows=[...r.sites,{label:'Total',totals:r.totals,total:r.total}].map(site=>({site,lines:wrappedText(site.label,30)}));
 const tableHeight=siteRows.reduce((sum,row)=>sum+Math.max(50,row.lines.length*26+16),0),definitionsY=headerY+64+tableHeight+22,height=Math.max(960,definitionsY+205);
 const {text,rect,shape}=slideCanvas(root,r.year+' Roadmap',contextLines[0],height,exit);let contextY=104;contextLines.slice(1).forEach(line=>{text(24,contextY,line,20);contextY+=25;});warnings.forEach(line=>{text(24,contextY,line,18,'#8a4b00');contextY+=23;});
 text(24,plotTop-22,'Monthly dispatch outlook',25,'#122c49','start',650);
 const left=62,plotW=1110,max=Math.max(1,...r.months.map(m=>m.reduce((a,b)=>a+b,0))),step=Math.max(1,Math.ceil(max/5)),ceiling=step*5,y=n=>plotTop+plotH*(1-n/ceiling),band=plotW/12;
 for(let n=0;n<=ceiling;n+=step){shape('line',{x1:left,x2:left+plotW,y1:y(n),y2:y(n),stroke:'#dbe3ec'});text(left-10,y(n)+6,n,20,'#33475c','end');}
 r.months.forEach((values,m)=>{let base=0;values.forEach((n,i)=>{if(n)rect(left+m*band+band*.2,y(base+n),band*.6,plotH*n/ceiling,colours[i]);base+=n;});text(left+(m+.5)*band,y(base)-8,base,19,'#24364b','middle',600);text(left+(m+.5)*band,plotTop+plotH+30,months[m],20,'#24364b','middle');});
 shape('line',{x1:left,x2:left+plotW,y1:y(r.average),y2:y(r.average),stroke:'#34475b','stroke-dasharray':'6 4'});text(24,plotTop+plotH+66,'Average per calendar month: '+r.average.toFixed(1)+' ('+r.total+' ÷ 12)',20);
 cats.forEach(({c,i},j)=>{const x=24+j*(1152/cats.length);rect(x,summaryY-14,13,13,colours[i]);wrappedText(c,22).forEach((line,k)=>text(x+22,summaryY+k*23,line,18,'#24364b'));text(x+22,summaryY+55,r.totals[i]+'  ·  '+r.percentages[i].toFixed(1)+'%',25,'#122c49','start',650);});
 text(24,siteTitleY,'Site breakdown',25,'#122c49','start',650);text(24,headerY,'Site',20);const positions=cats.map((_,index)=>450+index*(724/cats.length)).concat(1174),headerLines=[['Dispatched'],['In progress','/ expected'],['Unconfirmed'],['Inferred'],['Dispatch not','required']];[...cats.map(({i})=>headerLines[i]),['Total']].forEach((lines,index)=>lines.forEach((line,j)=>text(positions[index],headerY+j*22,line,16,'#33475c','end')));
 let rowY=headerY+64;siteRows.forEach(({site,lines},index)=>{const rowHeight=Math.max(50,lines.length*26+16),total=index===siteRows.length-1;if(total)rect(20,rowY-25,1160,rowHeight,'#edf3fa');lines.forEach((line,j)=>text(24,rowY+j*26,line,22,'#122c49','start',total?700:500));cats.forEach(({i},j)=>text(positions[j],rowY,site.totals[i],23,'#24364b','end',600));text(1174,rowY,site.total,25,'#122c49','end',700);rowY+=rowHeight;});
 const definitionBox=shape('g',{'data-definitions':'dispatch'});definitionBox.append(rect(20,definitionsY-18,1160,122,'#f3f6fa'),text(32,definitionsY+6,'Unconfirmed: Past planned dispatch date; actual dispatch date missing.',19,'#24364b','start',600),text(32,definitionsY+33,'Inferred: Actual submission or approval evidence, but dispatch missing. Uses the planned month.',19),text(32,definitionsY+60,'Dispatch not required: Explicit False; a recorded dispatch reference month is retained.',19),text(32,definitionsY+87,'Dispatch evidence, not submission completion status. Each SubID is counted once.',19));
 const c=r.coverage;text(24,height-66,'Coverage: '+c.loadedDistinct+' loaded · '+c.chart+' in chart · '+c.outsideYear+' outside '+r.year+' · '+c.undated+' undated · '+c.excluded+' excluded',19);text(24,height-37,'Missing Dates: '+r.missing.length+' · Dispatch not required without dispatch month: '+r.notRequiredOutside.length+' · Checks may overlap coverage.',18);return r;
}
