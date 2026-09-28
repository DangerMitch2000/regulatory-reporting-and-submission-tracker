import {summarize,viewingDay,categories,selectStatusReview} from './roadmap-2026.logic.js';
const colours=['#2875d9','#ed922d','#269968','#8159bd'],months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const svg=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const dispatchDefinitions=[
 ['Unconfirmed','Planned dispatch date has passed, but no actual dispatch date is recorded. This can be a missing update, not necessarily a delay.'],
 ['Inferred','No actual dispatch date is recorded, but an actual submission or approval date provides evidence of progress. Counted in the planned dispatch month when inference is enabled.']
];
function definitions(parent){const box=el('section');box.className='definitions';box.setAttribute('aria-label','Dispatch category definitions');dispatchDefinitions.forEach(([name,meaning],i)=>{const p=el('p'),label=el('strong',name+': ');label.style.color=colours[i+2];p.append(label,document.createTextNode(meaning));box.append(p);});box.append(el('p','These categories describe dispatch evidence, not submission completion status.'));parent.append(box);}
export function render(root,rows,{now=new Date(),notice='',synthetic=false,includeInferred=false,onInference=(value)=>{},businessUnit='*',onBusinessUnit=(value)=>{},expanded=new Set(),onExpansion=(key)=>{},mappedRoles=undefined}={}){
 const r=summarize(rows,viewingDay(now),includeInferred,businessUnit,{mappedRoles});root.replaceChildren();root.className='roadmap2026';const opts={now,notice,synthetic,includeInferred,onInference,businessUnit,onBusinessUnit,expanded,onExpansion,mappedRoles};const redraw=()=>render(root,rows,opts);const review=root._statusReview||(root._statusReview={view:'overview',scope:'unconfirmed',site:'*',subStatus:'*',roStatus:'*',query:'',page:0});if(root._slide)return review.view==='status'?statusSlide(root,r,opts,review,redraw):roadSlide(root,r,opts,redraw);root.onkeydown=null;
 const header=el('header'),h=el('h1',r.year+' Roadmap'),asof=el('p','As of '+now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}));header.append(h,asof);root.append(header);
 if(synthetic)root.append(el('p','Synthetic example data'));
 if(notice){const n=el('p',notice);n.className='notice';n.setAttribute('role','status');root.append(n);}
 const controls=el('div');controls.className='controls';
 const unitLabel=el('label','Business unit '),select=el('select');select.setAttribute('aria-label','Business unit');
 const option=(value,label)=>{const o=el('option',label);o.value=value;select.append(o);};option('*','All');
 r.units.forEach(u=>option(JSON.stringify(u),u===null?'Unassigned':u));
 if(businessUnit!=='*'&&!r.units.includes(businessUnit))option(JSON.stringify(businessUnit),String(businessUnit??'Unassigned')+' (no matching records)');
 select.value=businessUnit==='*'?'*':JSON.stringify(businessUnit);select.onchange=()=>onBusinessUnit(select.value==='*'?'*':JSON.parse(select.value));unitLabel.append(select);
 const labelCheck=el('label'),check=el('input');check.type='checkbox';check.checked=includeInferred;check.onchange=()=>onInference(check.checked);labelCheck.append(check,document.createTextNode('Include inferred dispatches'));controls.append(unitLabel,labelCheck);
 const viewLabel=el('label','View '),viewSelect=el('select');viewSelect.setAttribute('aria-label','View');[['overview','Overview'],['status','Status review']].forEach(([value,label])=>{const option=el('option',label);option.value=value;viewSelect.append(option);});viewSelect.value=review.view;viewSelect.onchange=()=>{review.view=viewSelect.value;redraw();};viewLabel.append(viewSelect);controls.append(viewLabel);root.append(controls);
 if(review.view==='status'){statusReview(root,r,review,redraw);slideButton(root,redraw);return r;}
 const inspect=el('button','Review Unconfirmed ('+r.totals[2]+')');inspect.className='reviewShortcut';inspect.onclick=()=>{Object.assign(review,{view:'status',scope:'unconfirmed',site:'*',subStatus:'*',roStatus:'*',query:'',page:0});redraw();};root.append(inspect);
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

const reviewScopes=[['unconfirmed','Unconfirmed'],['inferred','Inferred'],['missing-dispatch','Chart records missing actual dispatch'],['missing-dates','Missing Dates — outside chart'],['all','All chart submissions']];
const scopeLabel=scope=>reviewScopes.find(x=>x[0]===scope)?.[1]||'Unconfirmed';
const dateLabel=day=>day===null||day===undefined?'—':new Date(day).toISOString().slice(0,10);
const statusDetail=status=>status.kind==='conflict'?status.label+': '+status.values.join(' / '):status.label;
const completedMissing=record=>record.missingActual&&record.subStatus.kind==='value'&&record.subStatus.values.some(value=>value.toLowerCase()==='completed');
function missingStatusRoles(r){return ['SubStatus','ROStatus'].filter(role=>!(r.mappedRoles||[]).includes(role));}
function mappingText(r){const absent=missingStatusRoles(r);return absent.length?'To see recorded statuses, map '+absent.map(role=>role==='SubStatus'?'Submission status (SubStatus)':'RO status (ROStatus)').join(' and ')+' in the visual fields. These fields are optional; dispatch counts stay unchanged.':'';}
function reviewSelect(parent,{label,aria=label,value,options,onChange,all=false}){
 const wrap=el('label'),caption=el('span',label),select=el('select');select.setAttribute('aria-label',aria);
 const add=(key,text)=>{const option=el('option',text);option.value=key;select.append(option);};if(all)add('*','All');options.forEach(item=>add(item.key,item.label));
 if(value!=='*'&&!options.some(item=>item.key===value))add(value,'Selected value (no matching records)');select.value=value;select.onchange=()=>onChange(select.value);wrap.append(caption,select);parent.append(wrap);return select;
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
 return {field,label:field==='roStatus'?'RO status':'Submission status',buckets,monthly,undated:review.scope==='missing-dates',total:review.total};
}
function chartDateNote(model){return model.undated?'No usable dispatch date — shown by status without assigning a month.':'Month uses dispatch date: actual if recorded, otherwise plan. It is not the status completion month.';}
function horizontalRows(model,width,font){const labelWidth=Math.min(width*.37,345),chars=Math.max(16,Math.floor(labelWidth/(font*.58)));return {labelWidth,rows:model.buckets.map(bucket=>({bucket,lines:wrappedText(bucket.label,chars),height:Math.max(font*2.4,wrappedText(bucket.label,chars).length*(font+4)+14)}))};}
function statusPlotHeight(model,width,font=15){return model.undated?Math.max(165,horizontalRows(model,width,font).rows.reduce((sum,row)=>sum+row.height,0)+font*3):font>=20?272:270;}
function drawStatusPlot(canvas,model,{x=0,y=0,width=1000,height=270,font=15,year,showTip}={}){
 const kind=model.undated?'status-undated':'status-monthly',group=svg('g',{'data-chart':kind});canvas.append(group);
 const draw=(tag,attrs,text)=>{const item=svg(tag,attrs);if(text!==undefined)item.textContent=String(text);if(tag==='text'){item.style.fontSize=(attrs['font-size']||font)+'px';item.style.fill=attrs.fill||'#33475c';item.style.fontWeight=String(attrs['font-weight']||400);}group.append(item);return item;};
 const text=(xx,yy,value,anchor='start',weight=400)=>draw('text',{x:xx,y:yy,'font-size':font,'text-anchor':anchor,'font-weight':weight},value);
 const bar=(attrs,bucket,count,description)=>{const item=draw('rect',{...attrs,fill:statusColour(bucket),tabindex:0,role:'graphics-symbol','data-status-key':bucket.key,'data-count':count,'aria-label':description});const title=svg('title',{});title.textContent=description;item.append(title);if(showTip){const show=()=>showTip(description,true),hide=()=>showTip('',false);item.addEventListener('pointerenter',show);item.addEventListener('focus',show);item.addEventListener('click',show);item.addEventListener('pointerleave',hide);item.addEventListener('blur',hide);}return item;};
 if(model.undated){const layout=horizontalRows(model,width,font),left=x+layout.labelWidth+18,right=x+width-50,plotW=right-left,max=Math.max(1,...model.buckets.map(bucket=>bucket.count));let rowY=y+font;
  for(const {bucket,lines,height:rowHeight}of layout.rows){lines.forEach((line,i)=>text(x,rowY+i*(font+4),line));const barY=rowY-font+3;draw('rect',{x:left,y:barY,width:plotW,height:font+7,fill:'#f0f3f7'});const length=plotW*bucket.count/max;bar({x:left,y:barY,width:length,height:font+7},bucket,bucket.count,`${bucket.label}: ${bucket.count} submissions. Missing Dates — outside chart; no usable dispatch month.`);text(left+length+10,rowY+3,bucket.count,'start',650);rowY+=rowHeight;}
  if(!model.total)text(x+20,y+60,'No matching submissions');return group;
 }
 const left=x+font*2.9,right=x+width-14,top=y+font*1.8,bottom=y+height-font*2,plotH=bottom-top,plotW=right-left,totals=model.monthly.map(month=>[...month.values()].reduce((sum,count)=>sum+count,0)),max=Math.max(1,...totals),step=Math.max(1,Math.ceil(max/4)),ceiling=step*4,scale=count=>bottom-plotH*count/ceiling,band=plotW/12;
 for(let count=0;count<=ceiling;count+=step){draw('line',{x1:left,x2:right,y1:scale(count),y2:scale(count),stroke:'#dbe3ec'});text(left-10,scale(count)+font*.33,count,'end');}
 model.monthly.forEach((counts,month)=>{let base=0;for(const bucket of model.buckets){const count=counts.get(bucket.key)||0;if(!count)continue;const description=`${months[month]} ${year} · ${model.label}: ${bucket.label} · ${count} submissions. Month follows dispatch actual/plan, not completion status.`;bar({x:left+(month+.2)*band,y:scale(base+count),width:band*.6,height:plotH*count/ceiling,'data-month':month},bucket,count,description);base+=count;}text(left+(month+.5)*band,scale(totals[month])-8,totals[month],'middle',650);text(left+(month+.5)*band,bottom+font*1.5,months[month],'middle');});
 return group;
}
function statusChart(parent,r,review,state,redraw){
 if(state.chartBy!=='roStatus')state.chartBy='subStatus';const model=statusChartModel(review,state),section=el('section');section.className='status-chart';parent.append(section);const controls=el('div');controls.className='status-chart-heading';controls.append(el('h3',model.undated?'Missing Dates by recorded status':'Monthly dispatch records by status'));reviewSelect(controls,{label:'Colour bars by',value:state.chartBy,options:[{key:'subStatus',label:'Submission status'},{key:'roStatus',label:'RO status'}],onChange:value=>{state.chartBy=value;redraw();}});section.append(controls);
 const legend=el('div');legend.className='legend status-legend';model.buckets.forEach(bucket=>{const label=el('span'),dot=el('i');dot.style.background=statusColour(bucket);label.append(dot,document.createTextNode(bucket.label));legend.append(label);});section.append(legend);
 const holder=el('div');holder.className='status-chart-canvas';section.append(holder);const width=Math.max(680,holder.clientWidth||900),height=statusPlotHeight(model,width),canvas=svg('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':`${scopeLabel(state.scope)}: ${model.total} submissions by ${model.label.toLowerCase()}${model.undated?', no dispatch month':', across all 12 dispatch months'}.`});holder.append(canvas);const tip=el('div');tip.className='tip';tip.hidden=true;tip.setAttribute('role','tooltip');holder.append(tip);drawStatusPlot(canvas,model,{width,height,year:r.year,showTip:(description,visible)=>{tip.textContent=description;tip.hidden=!visible;tip.style.left='55px';tip.style.top='8px';}});
 const note=el('p',chartDateNote(model));note.className='status-chart-note';section.append(note);if(!model.total&&!model.undated)section.append(el('p','No matching submissions.'));
}
function statusReview(root,r,state,redraw){
 const review=selectStatusReview(r,state),panel=el('section');panel.className='status-review';root.append(panel);const heading=el('div');heading.className='review-heading';heading.append(el('h2','Dispatch status review'));const count=el('p',review.total+' matching submissions');count.className='review-count';count.setAttribute('role','status');heading.append(count);panel.append(heading);
 const context=el('p','Inspect recorded submission and RO statuses alongside dispatch evidence. Review filters affect this panel only; the Overview counts stay unchanged.');context.className='review-context';panel.append(context);
 const mapping=mappingText(r);if(mapping){const message=el('p',mapping);message.className='mapping-notice';message.setAttribute('role','status');panel.append(message);}
 const controls=el('div');controls.className='review-filters';const update=(key,value)=>{state[key]=value;state.page=0;redraw();};
 reviewSelect(controls,{label:'Records to review',aria:'Status review scope',value:state.scope,options:reviewScopes.map(([key,label])=>({key,label})),onChange:value=>update('scope',value)});
 reviewSelect(controls,{label:'Site',aria:'Review site',value:state.site,options:review.sites,all:true,onChange:value=>update('site',value)});
 reviewSelect(controls,{label:'Submission status',value:state.subStatus,options:review.submissionStatuses,all:true,onChange:value=>update('subStatus',value)});
 reviewSelect(controls,{label:'RO status',value:state.roStatus,options:review.roStatuses,all:true,onChange:value=>update('roStatus',value)});
 const searchLabel=el('label'),caption=el('span','Search'),search=el('input');search.type='search';search.value=state.query;search.placeholder='Submission ID, site or status';search.setAttribute('aria-label','Search status records');search.oninput=()=>{const position=search.selectionStart;update('query',search.value);const fresh=root.querySelector('[aria-label="Search status records"]');fresh?.focus();if(position!==null)fresh?.setSelectionRange(position,position);};searchLabel.append(caption,search);controls.append(searchLabel);
 const reset=el('button','Clear review filters');reset.onclick=()=>{Object.assign(state,{site:'*',subStatus:'*',roStatus:'*',query:'',page:0});redraw();};controls.append(reset);panel.append(controls);
 const scopeNote=el('p',state.scope==='missing-dates'?r.year+' Missing Dates is outside the chart total and independent of the inference checkbox.':state.scope==='inferred'&&!r.includeInferred?'Enable Include inferred dispatches to inspect records classified as Inferred.':'Showing '+review.total+' of '+review.scopeTotal+' submissions in '+scopeLabel(state.scope)+'.');scopeNote.className='review-scope-note';panel.append(scopeNote);
 statusChart(panel,r,review,state,redraw);
 const counts=el('div');counts.className='status-summary';statusCountTable(counts,'By submission status','submission-status-summary',review.counts.submissionStatuses,review.total);statusCountTable(counts,'By RO status','ro-status-summary',review.counts.roStatuses,review.total);panel.append(counts);
 const caution=el('p','Both tables count submissions, not ROs. A Completed status does not supply a missing dispatch date. An RO status does not mark its submissions completed.');caution.className='review-explanation';panel.append(caution);
 const listHeading=el('h3','Submission worklist');panel.append(listHeading);const frame=el('div');frame.className='worklist-frame';const table=el('table');table.className='status-worklist';table.setAttribute('aria-label','Status review submission worklist');const thead=el('thead'),header=el('tr');['Submission / context','Site','Dispatch group','Submission status','RO status','Planned dispatch','Actual submission','Actual approval'].forEach(text=>header.append(el('th',text)));thead.append(header);table.append(thead);const body=el('tbody');
 const pageSize=25,pages=Math.max(1,Math.ceil(review.total/pageSize));state.page=Math.min(Math.max(0,state.page||0),pages-1);const start=state.page*pageSize;
 for(const record of review.records.slice(start,start+pageSize)){const row=el('tr');row.dataset.submissionId=record.id;const id=el('td'),name=el('strong',record.id);id.append(name);if(completedMissing(record)){const note=el('small','Completed — dispatch date missing');note.className='completed-missing';id.append(note);}else if(record.missingActual)id.append(el('small','Actual dispatch date missing'));if(record.dateIssues?.length){const dateIssue=el('small','Check dates: '+record.dateIssues.join(', '));dateIssue.title=record.dateIssues.map(field=>field+': '+(record.dateValues?.[field]||[]).join(' / ')).join('; ');id.append(dateIssue);}const group=el('td',record.category===null?'Missing Dates — outside chart':categories[record.category]);if(record.actualDay!==null&&record.actualDay!==undefined)group.append(el('small','Actual dispatch: '+dateLabel(record.actualDay)));row.append(id,el('td',record.site),group);for(const field of ['subStatus','roStatus']){const cell=el('td',statusDetail(record[field]));cell.dataset.statusKind=record[field].kind;row.append(cell);}const planned=record.planState==='issue'?'Date issue':dateLabel(record.reviewPlannedDay??record.plannedDay);const actualEvidence=field=>record.dateIssues?.includes(field)?'Date issue':dateLabel(record.evidence.find(e=>e.field===field)?.day);row.append(el('td',planned),el('td',actualEvidence('ActualSubmission')),el('td',actualEvidence('ActualApproval')));body.append(row);}
 if(!review.total){const row=el('tr'),cell=el('td','No submissions match these review filters.');cell.colSpan=8;row.append(cell);body.append(row);}table.append(body);frame.append(table);panel.append(frame);
 const paging=el('div');paging.className='review-paging';const previous=el('button','Previous records'),next=el('button','Next records'),page=el('span',review.total?`${start+1}–${Math.min(start+pageSize,review.total)} of ${review.total} · Page ${state.page+1} of ${pages}`:'0 records');previous.disabled=state.page===0;next.disabled=state.page>=pages-1;previous.onclick=()=>{state.page--;redraw();};next.onclick=()=>{state.page++;redraw();};paging.append(previous,page,next);panel.append(paging);
 panel.append(el('small','Blank, unmapped and conflicting statuses stay separate. Conflicting values are shown in the worklist. Dates marked — have no usable resolved value.'));
 definitions(panel);
}
function wrappedText(value,max=46){const lines=[];let line='';for(const word of String(value).split(/\s+/)){if(line&&(line+' '+word).length>max){lines.push(line);line='';}if(word.length>max){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines.length?lines:[''];}
function statusSlide(root,r,o,state,exit){
 const review=selectStatusReview(r,state),model=statusChartModel(review,state),facetLabel=(items,key)=>key==='*'?'All':items.find(item=>item.key===key)?.label||'Selected value (no matches)';
 const context='Scope: '+scopeLabel(state.scope)+' · Site: '+facetLabel(review.sites,state.site)+' · Submission status: '+facetLabel(review.submissionStatuses,state.subStatus)+' · RO status: '+facetLabel(review.roStatuses,state.roStatus)+' · Colour bars by: '+model.label+(state.query?' · Search: '+state.query:'');
 const contextLines=wrappedText(context,105),warnings=[o.synthetic?'Fictional demonstration data':'',o.notice,mappingText(r)].filter(Boolean).flatMap(value=>wrappedText(value,107));
 const rowsHeight=buckets=>buckets.reduce((height,bucket)=>height+Math.max(46,wrappedText(bucket.label,35).length*26+15),0);
 const chartTop=190+(contextLines.length-1)*26+warnings.length*24,legendRows=[];for(let index=0;index<model.buckets.length;index+=3){const items=model.buckets.slice(index,index+3).map(bucket=>({bucket,lines:wrappedText(bucket.label,28)}));legendRows.push({items,height:Math.max(...items.map(item=>item.lines.length))*25+12});}
 const legendHeight=legendRows.reduce((sum,row)=>sum+row.height,0),plotY=chartTop+69+legendHeight,plotHeight=statusPlotHeight(model,1152,20),tableTop=plotY+plotHeight+68,height=Math.max(960,tableTop+94+Math.max(rowsHeight(review.counts.submissionStatuses),rowsHeight(review.counts.roStatuses))+145);
 const {text,rect,shape}=slideCanvas(root,r.year+' Dispatch status review','Business unit: '+(o.businessUnit==='*'?'All':o.businessUnit??'Unassigned')+' · Inferred dispatches '+(o.includeInferred?'included':'excluded')+' · As of '+o.now.toLocaleDateString('en-GB'),height,exit);let contextY=115;contextLines.forEach(line=>{text(24,contextY,line,20);contextY+=26;});warnings.forEach(line=>{text(24,contextY,line,20,'#8a4b00');contextY+=24;});text(24,chartTop-20,review.total+' matching submissions',29,'#122c49','start',700);
 text(24,chartTop+20,model.undated?'Missing Dates by recorded status':'Monthly dispatch records by '+model.label.toLowerCase(),26,'#122c49','start',650);let legendY=chartTop+56;
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
