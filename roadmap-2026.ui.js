import {summarize,viewingDay,categories} from './roadmap-2026.logic.js';
const colours=['#2875d9','#ed922d','#269968','#8159bd'],months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const svg=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const dispatchDefinitions=[
 ['Unconfirmed','Planned dispatch date has passed, but no actual dispatch date is recorded. This can be a missing update, not necessarily a delay.'],
 ['Inferred','No actual dispatch date is recorded, but an actual submission or approval date provides evidence of progress. Counted in the planned dispatch month when inference is enabled.']
];
function definitions(parent){const box=el('section');box.className='definitions';box.setAttribute('aria-label','Dispatch category definitions');dispatchDefinitions.forEach(([name,meaning],i)=>{const p=el('p'),label=el('strong',name+': ');label.style.color=colours[i+2];p.append(label,document.createTextNode(meaning));box.append(p);});box.append(el('p','These categories describe dispatch evidence, not submission completion status.'));parent.append(box);}
export function render(root,rows,{now=new Date(),notice='',synthetic=false,includeInferred=false,onInference=(value)=>{},businessUnit='*',onBusinessUnit=(value)=>{},expanded=new Set(),onExpansion=(key)=>{}}={}){
 const r=summarize(rows,viewingDay(now),includeInferred,businessUnit);root.replaceChildren();root.className='roadmap2026';const opts={now,notice,synthetic,includeInferred,onInference,businessUnit,onBusinessUnit,expanded,onExpansion};const redraw=()=>render(root,rows,opts);if(root._slide)return roadSlide(root,r,opts,redraw);root.onkeydown=null;
 const header=el('header'),h=el('h1',r.year+' Roadmap'),asof=el('p','As of '+now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}));header.append(h,asof);root.append(header);
 if(synthetic)root.append(el('p','Synthetic example data'));
 if(notice){const n=el('p',notice);n.className='notice';n.setAttribute('role','status');root.append(n);}
 const controls=el('div');controls.className='controls';
 const unitLabel=el('label','Business unit '),select=el('select');select.setAttribute('aria-label','Business unit');
 const option=(value,label)=>{const o=el('option',label);o.value=value;select.append(o);};option('*','All');
 r.units.forEach(u=>option(JSON.stringify(u),u===null?'Unassigned':u));
 if(businessUnit!=='*'&&!r.units.includes(businessUnit))option(JSON.stringify(businessUnit),String(businessUnit??'Unassigned')+' (no matching records)');
 select.value=businessUnit==='*'?'*':JSON.stringify(businessUnit);select.onchange=()=>onBusinessUnit(select.value==='*'?'*':JSON.parse(select.value));unitLabel.append(select);
 const labelCheck=el('label'),check=el('input');check.type='checkbox';check.checked=includeInferred;check.onchange=()=>onInference(check.checked);labelCheck.append(check,document.createTextNode('Include inferred dispatches'));controls.append(unitLabel,labelCheck);root.append(controls);
 const activeCategories=categories.map((c,i)=>({c,i})).filter(x=>includeInferred||x.i!==3);
 const legend=el('div');legend.className='legend';activeCategories.forEach(({c,i})=>{const label=el('span'),dot=el('i');dot.style.background=colours[i];label.append(dot,document.createTextNode(c));legend.append(label);});root.append(legend);
 const layout=el('div');layout.className='layout';const main=el('section'),side=el('section');side.className='sites';layout.append(main,side);root.append(layout);const chart=el('div');chart.className='chart';main.append(chart);
 const width=Math.max(520,main.clientWidth),height=300,left=46,right=14,top=30,bottom=32,plotW=width-left-right,plotH=height-top-bottom;
 const max=Math.max(1,...r.months.map(m=>m.reduce((a,b)=>a+b,0))),step=Math.max(1,Math.ceil(max/5)),ceiling=step*5,y=n=>top+plotH*(1-n/ceiling),band=plotW/12;
 const canvas=svg('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':`${r.year} monthly dispatch counts. ${r.total} submissions. Average ${r.average.toFixed(1)} per month.`});chart.append(canvas);
 if(now.getFullYear()===r.year)canvas.append(svg('rect',{x:left+now.getMonth()*band,y:top,width:band,height:plotH,fill:'#edf4fc'}));
 for(let n=0;n<=ceiling;n+=step){canvas.append(svg('line',{x1:left,x2:width-right,y1:y(n),y2:y(n),stroke:'#dde4ec'}));const t=svg('text',{x:left-8,y:y(n)+4,'text-anchor':'end'});t.textContent=n;canvas.append(t);}
 const label=svg('text',{x:left,y:16});label.textContent='Submissions';canvas.append(label);
 const tip=el('div');tip.className='tip';tip.hidden=true;tip.setAttribute('role','tooltip');chart.append(tip);
 r.months.forEach((values,m)=>{let base=0;values.forEach((count,c)=>{if(!count)return;const bar=svg('rect',{x:left+m*band+band*.2,y:y(base+count),width:band*.6,height:plotH*count/ceiling,fill:colours[c],tabindex:0,role:'graphics-symbol','aria-label':`${months[m]}: ${categories[c]}, ${count}`});const text=`${months[m]} ${r.year} · ${categories[c]}: ${count}`+(c===2?'\nPlanned dispatch date has passed; actual dispatch date not recorded.':'');const evidence=r.records.filter(x=>x.month===m&&x.category===3);const evidenceText=c===3?'\nActual dispatch missing. Month comes from planned dispatch.\nActual submission evidence: '+evidence.filter(x=>x.evidence.some(e=>e.field==='ActualSubmission')).length+'; actual approval evidence: '+evidence.filter(x=>x.evidence.some(e=>e.field==='ActualApproval')).length+' (may overlap).':'';const tooltipText=text+evidenceText;const title=svg('title',{});title.textContent=tooltipText;bar.append(title);const show=()=>{tip.textContent=tooltipText;tip.hidden=false;tip.style.left=Math.min(width-280,Math.max(8,left+m*band))+'px';tip.style.top='12px';};bar.addEventListener('pointerenter',show);bar.addEventListener('focus',show);bar.addEventListener('click',show);bar.addEventListener('pointerleave',()=>tip.hidden=true);bar.addEventListener('blur',()=>tip.hidden=true);canvas.append(bar);base+=count;});
 const t=svg('text',{x:left+(m+.5)*band,y:height-10,'text-anchor':'middle'});t.textContent=months[m];canvas.append(t);});
 canvas.append(svg('line',{x1:left,x2:width-right,y1:y(r.average),y2:y(r.average),stroke:'#586779','stroke-width':1.5,'stroke-dasharray':'6 4'}));
 const avg=el('p',`Monthly average: ${r.average.toFixed(1)} (${r.total} ÷ 12)`);avg.className='average';main.append(avg);
 const table=el('table'),thead=el('thead'),tr=el('tr');[r.year+' dispatch outlook','Count','Share'].forEach(x=>tr.append(el('th',x)));thead.append(tr);table.append(thead);const body=el('tbody');activeCategories.forEach(({c,i})=>{const row=el('tr');[c,String(r.totals[i]),r.percentages[i].toFixed(1)+'%'].forEach(v=>row.append(el('td',v)));body.append(row);});const total=el('tr');total.className='total';[r.year+' total',String(r.total),r.total?'100%':'0%'].forEach(v=>total.append(el('td',v)));body.append(total);table.append(body);main.append(table);
 side.append(el('h2','Site breakdown'));
 const st=el('table'),sh=el('tr');['Site',...activeCategories.map(x=>x.c),'Total'].forEach(t=>sh.append(el('th',t)));const head=el('thead');head.append(sh);st.append(head);const sb=el('tbody');
 const cells=(row,counts,total)=>{activeCategories.forEach(({i})=>row.append(el('td',String(counts[i]))));row.append(el('td',String(total)));};
 r.sites.forEach(site=>{const row=el('tr'),name=el('td'),button=el('button',(expanded.has(site.key)?'▾ ':'▸ ')+site.label);button.setAttribute('aria-expanded',String(expanded.has(site.key)));button.onclick=()=>onExpansion(site.key);name.append(button);row.append(name);cells(row,site.totals,site.total);sb.append(row);
 if(expanded.has(site.key))site.months.forEach((counts,m)=>{const mr=el('tr');mr.className='monthRow';mr.append(el('td',months[m]));cells(mr,counts,counts.reduce((a,b)=>a+b,0));sb.append(mr);});});
 const sr=el('tr');sr.className='total';sr.append(el('td','Total'));cells(sr,r.totals,r.total);sb.append(sr);st.append(sb);side.append(st);
 definitions(root);
 if(r.ambiguousSites.length)side.append(el('small',r.ambiguousSites.length+' submissions have multiple sites and are counted once in the unallocated bucket.'));
 const cleanup=el('p','Missing Dates — '+r.year+': '+r.missing.length);cleanup.className='cleanup';root.append(cleanup);
 root.append(el('small','Outside the chart total: no actual dispatch or usable planned dispatch date, with actual submission or approval in '+r.year+'. Each submission counted once. Independent of the inference checkbox.'));
 if(includeInferred)root.append(el('small','Undated inferred: '+r.undatedInferred.length+' across all filtered years; outside the chart total. May overlap Missing Dates — do not add these counts.'));
 const inferred=r.records.filter(x=>x.category===3);
 if(inferred.length){const d=el('details');d.append(el('summary','Inferred evidence — '+inferred.length+' records'));const list=el('ul');inferred.forEach(x=>list.append(el('li',x.id+' · planned dispatch '+new Date(x.plannedDay).toISOString().slice(0,10)+' · actual dispatch missing · '+x.evidence.map(e=>e.field+': '+new Date(e.day).toISOString().slice(0,10)).join('; '))));d.append(list);root.append(d);}
 if(r.issues.length||r.missingIdRows||r.ambiguousSites.length){const d=el('details');d.append(el('summary','Data checks: '+r.excluded.length+' excluded · '+r.issues.length+' date issues · '+r.ambiguousSites.length+' multiple-site records · '+r.missingIdRows+' rows without SubID'));
 d.append(el('p','Checks cover the filtered records across all years; multi-site checks cover the chart year. Conflicting dates are not guessed. Missing Dates and date issues may overlap.'));const list=el('ul');r.issues.forEach(x=>list.append(el('li',x.id+': '+x.fields.join(', '))));r.ambiguousSites.forEach(x=>list.append(el('li',x.id+': '+x.sites.join(', '))));d.append(list);root.append(d);}
 slideButton(root,redraw);return r;
}

function slideCanvas(root,title,subtitle,height,exit){
 root.replaceChildren();root.className+=' slideCapture';root.tabIndex=0;root.onkeydown=e=>{if(e.key==='Escape'){root._slide=false;exit()}};
 const canvas=document.createElementNS('http://www.w3.org/2000/svg','svg');canvas.setAttribute('viewBox','0 0 1200 '+height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title+'. '+subtitle+'. Press Escape to return to controls.');canvas.setAttribute('preserveAspectRatio','xMidYMid meet');root.append(canvas);
 const shape=(tag,a={},value)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(a))n.setAttribute(k,String(v));if(value!==undefined)n.textContent=String(value);if(a['font-size'])n.style.fontSize=a['font-size']+'px';if(a.fill)n.style.fill=a.fill;if(a['font-weight'])n.style.fontWeight=String(a['font-weight']);canvas.append(n);return n};
 const text=(x,y,t,size=22,fill='#24364b',anchor='start',weight=400)=>shape('text',{x,y,'font-size':size,fill,'text-anchor':anchor,'font-weight':weight},t);
 const rect=(x,y,w,h,fill)=>shape('rect',{x,y,width:w,height:h,fill});
 rect(0,0,1200,height,'white');text(24,44,title,34,'#122c49','start',650);text(24,79,subtitle,20);
 return {text,rect,shape};
}
function slideButton(root,draw){const b=el('button','Screenshot mode');b.className='captureButton';b.title='Slide-ready layout. Press Escape to return to controls.';b.onclick=()=>{root._slide=true;draw();root.focus?.()};root.append(b)}

function roadSlide(root,r,o,exit){
 const cats=categories.map((c,i)=>({c,i})).filter(x=>o.includeInferred||x.i!==3),definitionsY=287+r.sites.length*49+34,height=Math.max(830,definitionsY+158);
 const {text,rect,shape}=slideCanvas(root,r.year+' Registration Overview','Business unit: '+(o.businessUnit==='*'?'All':o.businessUnit??'Unassigned')+' · Inferred dispatches '+(o.includeInferred?'included':'excluded')+' · As of '+o.now.toLocaleDateString('en-GB'),height,exit);
 const warnings=[o.synthetic?'Fictional demonstration data':'',o.notice].filter(Boolean).join(' · ');if(warnings)text(24,110,warnings,18,'#8a4b00');
 cats.forEach(({c,i},j)=>{const x=24+j*292;rect(x,133,15,15,colours[i]);text(x+24,148,c,20)});
 const left=62,top=230,plotW=488,plotH=244,max=Math.max(1,...r.months.map(m=>m.reduce((a,b)=>a+b,0))),step=Math.max(1,Math.ceil(max/4)),ceiling=step*4,y=n=>top+plotH*(1-n/ceiling),band=plotW/12;
 text(24,187,'Monthly dispatch outlook',24,'#122c49','start',650);
 for(let n=0;n<=ceiling;n+=step){shape('line',{x1:left,x2:left+plotW,y1:y(n),y2:y(n),stroke:'#dbe3ec'});text(left-10,y(n)+6,n,20,'#33475c','end')}
 r.months.forEach((values,m)=>{let base=0;values.forEach((n,i)=>{if(n)rect(left+m*band+8,y(base+n),band-16,plotH*n/ceiling,colours[i]);base+=n});text(left+(m+.5)*band,y(base)-8,base,19,'#24364b','middle',600);text(left+(m+.5)*band,503,months[m],19,'#24364b','middle')});
 shape('line',{x1:left,x2:left+plotW,y1:y(r.average),y2:y(r.average),stroke:'#34475b','stroke-dasharray':'6 4'});text(24,539,'Monthly average: '+r.average.toFixed(1),22);
 text(24,582,'Dispatch outlook',24,'#122c49','start',650);text(454,582,'Count',20,'#24364b','end');text(552,582,'Share',20,'#24364b','end');
 cats.forEach(({c,i},j)=>{const yy=620+j*33;text(24,yy,c,21);text(454,yy,r.totals[i],24,'#122c49','end',650);text(552,yy,r.percentages[i].toFixed(1)+'%',22,'#24364b','end')});
 const yy=620+cats.length*33;rect(20,yy-25,543,35,'#edf3fa');text(24,yy,'Total',22,'#122c49','start',650);text(454,yy,r.total,25,'#122c49','end',700);text(552,yy,r.total?'100%':'0%',22,'#24364b','end');
 text(614,187,'Site breakdown',24,'#122c49','start',650);const positions=o.includeInferred?[778,880,982,1074,1174]:[810,939,1064,1174];
 text(614,226,'Site',20);const headers=[['Dispatched'],['In progress','/ expected'],['Unconfirmed'],...(o.includeInferred?[['Inferred']]:[]),['Total']];headers.forEach((lines,i)=>lines.forEach((s,j)=>text(positions[i],226+j*23,s,16,'#33475c','end')));
 const row=(site,i,total=false)=>{const y=287+i*49;if(total)rect(605,y-29,578,42,'#edf3fa');text(614,y,site.label.length>14?site.label.slice(0,13)+'…':site.label,22,'#122c49','start',total?700:500);cats.forEach(({i:c},j)=>text(positions[j],y,site.totals[c],24,'#24364b','end',600));text(1174,y,site.total,25,'#122c49','end',700)};
 r.sites.forEach((s,i)=>row(s,i));row({label:'Total',totals:r.totals,total:r.total},r.sites.length,true);
 const definitionBox=shape('g',{'data-definitions':'dispatch'});definitionBox.append(
 rect(605,definitionsY-5,578,119,'#f3f6fa'),
 text(614,definitionsY+17,'Unconfirmed: Past plan; actual dispatch date missing.',19,'#24364b','start',600),
 text(614,definitionsY+43,'Inferred: Actual submission/approval date recorded;',19),
 text(614,definitionsY+69,'dispatch missing. Uses planned month when enabled.',19),
 text(614,definitionsY+101,'Dispatch evidence, not submission completion status.',18,'#33475c'));
 text(24,height-28,'Missing Dates — '+r.year+': '+r.missing.length+' · Outside chart total',20);
 return r;
}
