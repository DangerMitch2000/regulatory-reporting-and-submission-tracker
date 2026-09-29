import {compare,viewingDay,categories,dispatchRequiredOptions} from './ivdr-comparison.logic.js';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const percent=n=>n.toFixed(1)+'%';
export function render(root,rows,{now=new Date(),state={},onChange=(patch)=>{},expanded=new Set(),onExpansion=(key)=>{},notice='',projectMapped=true,dispatchRequiredMapped=true,synthetic=false}={}){
 const r=compare(projectMapped?rows:[],viewingDay(now),{...state,dispatchRequiredMapped});root.replaceChildren();root.className='ivdrOverview';const opts={now,state,onChange,expanded,onExpansion,notice,projectMapped,dispatchRequiredMapped,synthetic};const redraw=()=>render(root,rows,opts);if(root._slide&&projectMapped)return ivdrSlide(root,r,opts,redraw);root.onkeydown=null;
 const header=el('header'),titles=el('div');titles.append(el('h1','IVDR Registration Overview'),el('p',r.year+' · '+(r.month<0?'Full year':months[r.month])+' · distinct submissions','subtitle'));header.append(titles,el('span','As of '+now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),'asof'));root.append(header);
 if(synthetic)root.append(el('p','Fictional demonstration data','demoNote'));
 if(notice)root.append(el('p',notice,'notice'));
 if(!projectMapped){root.append(el('p','Add the Regulatory Objective project field to Project before viewing this comparison. A missing field is not the same as a blank value.','notice'));return r;}
 const controls=el('div',undefined,'controls');
 function dropdown(label,key,options,value){const field=el('label',label),select=el('select');select.setAttribute('aria-label',label);if(!options.some(o=>JSON.stringify(o.value)===JSON.stringify(value)))options.push({value,label:String(value??'Unassigned')+' (no matching records)'});
  options.forEach(o=>{const option=el('option',o.label);option.value=JSON.stringify(o.value);select.append(option)});select.value=JSON.stringify(value);select.onchange=()=>onChange({[key]:JSON.parse(select.value)});field.append(select);controls.append(field);}
 dropdown('Business unit','businessUnit',[{value:'*',label:'All business units'},...r.units.map(value=>({value,label:value===null?'Unassigned':value}))],state.businessUnit===undefined?'*':state.businessUnit);
 dropdown('Site','site',[{value:'*',label:'All sites'},...r.siteChoices.map(s=>({value:s.key,label:s.label}))],state.site??'*');
 dropdown('Month','month',[{value:-1,label:'All months'},...months.map((label,value)=>({value,label}))],r.month);
 dropdown('Registration group','classification',[{value:'*',label:'IVDR + Non-IVDR'},{value:'ivdr',label:'IVDR'},{value:'non',label:'Non-IVDR'}],state.classification??'*');
 dropdown('Dispatch required','dispatchRequired',dispatchRequiredOptions.map(({key,label})=>({value:key,label})),r.dispatchRequired);
 const checkLabel=el('label',undefined,'check'),check=el('input');check.type='checkbox';check.checked=!!state.includeInferred;check.onchange=()=>onChange({includeInferred:check.checked});checkLabel.append(check,document.createTextNode('Include inferred dispatches'));controls.append(checkLabel);root.append(controls);
 if(!dispatchRequiredMapped)root.append(el('p','Dispatch required field not mapped. Existing dispatch rules apply; blank is not the same as False.','mappingNote'));
 const summary=el('div',undefined,'summary');for(const [label,value,cls]of [['Total submissions',r.total,''],['IVDR',r.ivdr,'ivdr'],['Non-IVDR',r.non,'non'],['IVDR share',percent(r.share),'']]){const card=el('div',undefined,'metric '+cls);card.append(el('span',label),el('strong',String(value)));summary.append(card)}root.append(summary);
 const legend=el('div',undefined,'legend');for(const [name,cls]of [['IVDR','ivdr'],['Non-IVDR','non']]){const label=el('span');label.append(el('i',undefined,cls),document.createTextNode(name));legend.append(label)}legend.append(el('span','Blank project values count as Non-IVDR.','muted'));root.append(legend);
 const layout=el('div',undefined,'comparisonLayout'),tablePanel=el('section',undefined,'tablePanel'),chartPanel=el('section',undefined,'chartPanel');layout.append(tablePanel,chartPanel);root.append(layout);
 tablePanel.append(el('h2','Site and progress'),el('p','Expand a site to see dispatch progress.','hint'));
 const table=el('table'),thead=el('thead'),head=el('tr');['Site / Progress','IVDR','Non-IVDR','Total'].forEach(name=>head.append(el('th',name)));thead.append(head);table.append(thead);const tbody=el('tbody');
 function counts(row,s){row.append(el('td',String(s.ivdr),'ivdrText'),el('td',String(s.non),'nonText'),el('td',String(s.total),'totalNumber'));}
 r.sites.forEach(s=>{const row=el('tr',undefined,'siteRow'),name=el('td'),button=el('button',(expanded.has(s.key)?'▾ ':'▸ ')+s.label,'expand');button.setAttribute('aria-expanded',String(expanded.has(s.key)));button.onclick=()=>onExpansion(s.key);name.append(button);row.append(name);counts(row,s);tbody.append(row);
  if(expanded.has(s.key))s.progress.forEach((p,i)=>{if(i===3&&!state.includeInferred)return;const sub=el('tr',undefined,'progressRow');sub.append(el('td',categories[i]));counts(sub,p);tbody.append(sub)});
 });
 const total=el('tr',undefined,'grandTotal');total.append(el('td','Grand total'));counts(total,r);tbody.append(total);table.append(tbody);tablePanel.append(table);
 chartPanel.append(el('h2','IVDR mix by site'),el('p','Bar length shows volume · labels show the IVDR share.','hint'));
 const max=Math.max(1,...r.sites.map(s=>s.total)),chart=el('div',undefined,'siteChart');chart.setAttribute('role','list');chartPanel.append(chart);
 r.sites.forEach(s=>{const row=el('div',undefined,'chartRow');row.setAttribute('role','listitem');const title=el('div',undefined,'barHeading');title.append(el('strong',s.label),el('span',s.total+' total · '+percent(s.ivdr/s.total*100)+' IVDR'));row.append(title);
  const bar=el('button',undefined,'stack');bar.setAttribute('aria-label',s.label+': '+s.ivdr+' IVDR, '+s.non+' Non-IVDR, '+s.total+' total. '+percent(s.ivdr/s.total*100)+' IVDR. Expand progress.');bar.setAttribute('aria-expanded',String(expanded.has(s.key)));bar.title=s.label+'\nIVDR: '+s.ivdr+'\nNon-IVDR: '+s.non+'\nTotal: '+s.total+'\n'+(r.month<0?'Full year':months[r.month])+' '+r.year;bar.onclick=()=>onExpansion(s.key);
  for(const [field,cls]of [['ivdr','ivdr'],['non','non']]){const segment=el('span',s[field]/max>=.07?String(s[field]):'',cls);segment.style.width=(s[field]/max*100)+'%';bar.append(segment)}row.append(bar);chart.append(row);
 });
 if(!r.total)chart.append(el('p','No submissions match this selection.','empty'));
 const totals=el('details',undefined,'progressTotals');totals.append(el('summary','Progress totals for this selection'));const text=categories.map((c,i)=>i===3&&!state.includeInferred?'':c+': '+r.progress[i].total).filter(Boolean).join(' · ');totals.append(el('p',text));root.append(totals);
 const notRequired=el('div',undefined,'notRequired');notRequired.append(el('strong','Dispatch not required: '+r.progress[4].total+' in the dated comparison'),el('p',r.notRequiredOutside.length+' additional '+r.year+' submissions without a usable dispatch date: '+r.notRequiredOutsideIVDR+' IVDR / '+r.notRequiredOutsideNon+' Non-IVDR. Outside dated totals; all months within selected filters.'));root.append(notRequired);
 const cleanup=el('div',undefined,'cleanup');cleanup.append(el('strong','Missing Dates — '+r.year+': '+r.missing.length),el('p','No usable dispatch date, but actual submission or approval occurred this year. Excludes Dispatch required = False. Scoped to all selected filters; all months, since no dispatch month is known.'));if(state.includeInferred)cleanup.append(el('p','Undated inferred: '+r.undatedInferred.length+' across all filtered years. Outside chart totals; may overlap Missing Dates.'));root.append(cleanup);
 const checks=el('details',undefined,'checks');checks.append(el('summary','Counting and data checks'),el('p','Each submission counts once. IVDR plus rebranding or UDI counts as IVDR; blanks and labels without IVDR count as Non-IVDR. Multiple sites are counted once as unallocated. Dispatch month and inference rules match the Roadmap.'));
 checks.append(el('p','Dispatch required preserves True, False and Blank. Only explicit False is Dispatch not required. Conflicting or unrecognised values remain review items and follow existing date rules. Dated False records remain in the IVDR / Non-IVDR totals.'));
 checks.append(el('p',r.excluded.length+' excluded for required-date issues · '+r.issues.length+' records with date issues (all filtered years) · '+r.ambiguousSites.length+' multi-site records (full year) · '+r.missingIdRows+' rows without an identifier (business-unit scope).'));
 const list=el('ul');r.issues.forEach(x=>list.append(el('li',x.id+': '+x.fields.join(', '))));r.ambiguousSites.forEach(x=>list.append(el('li',x.id+': '+x.sites.join(', '))));checks.append(list);root.append(checks);
 slideButton(root,redraw);return r;
}

function slideCanvas(root,title,subtitle,height,exit){
 root.replaceChildren();root.className+=' slideCapture';root.tabIndex=0;root.onkeydown=e=>{if(e.key==='Escape'){root._slide=false;exit()}};
 const canvas=document.createElementNS('http://www.w3.org/2000/svg','svg');canvas.setAttribute('viewBox','0 0 1200 '+height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title+'. '+subtitle+'. Press Escape to return to controls.');canvas.setAttribute('preserveAspectRatio','xMidYMid meet');root.append(canvas);
 const shape=(tag,a={},value)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(a))n.setAttribute(k,String(v));if(value!==undefined)n.textContent=String(value);if(a['font-size'])n.style.fontSize=a['font-size']+'px';if(a.fill)n.style.fill=a.fill;canvas.append(n);return n};
 const text=(x,y,t,size=22,fill='#24364b',anchor='start',weight=400)=>shape('text',{x,y,'font-size':size,fill,'text-anchor':anchor,'font-weight':weight},t);
 const rect=(x,y,w,h,fill)=>shape('rect',{x,y,width:w,height:h,fill});
 rect(0,0,1200,height,'white');text(24,44,title,34,'#122c49','start',650);text(24,79,subtitle,20);
 return {text,rect,shape};
}
function slideButton(root,draw){const b=el('button','Screenshot mode');b.className='captureButton';b.title='Slide-ready layout. Press Escape to return to controls.';b.onclick=()=>{root._slide=true;draw();root.focus?.()};root.append(b)}

function ivdrSlide(root,r,o,exit){
 const height=Math.max(830,354+r.sites.length*58+150),unit=o.state.businessUnit===undefined||o.state.businessUnit==='*'?'All':o.state.businessUnit??'Unassigned',site=o.state.site&&o.state.site!=='*'?(r.siteChoices.find(s=>s.key===o.state.site)?.label||o.state.site):'All sites',group=o.state.classification==='ivdr'?'IVDR':o.state.classification==='non'?'Non-IVDR':'IVDR + Non-IVDR';
 const {text,rect}=slideCanvas(root,r.year+' Registration: IVDR vs Non-IVDR','Business unit: '+unit+' · '+site+' · '+(r.month<0?'Full year':months[r.month])+' · '+group,height,exit);
 text(24,111,'Inferred dispatches '+(o.state.includeInferred?'included':'excluded')+' · As of '+o.now.toLocaleDateString('en-GB')+(o.synthetic?' · Fictional demonstration data':''),19);text(24,140,'Dispatch required: '+(dispatchRequiredOptions.find(option=>option.key===r.dispatchRequired)?.label||'All')+(!o.dispatchRequiredMapped?' · Field not mapped':''),19);if(o.notice)text(24,height-90,o.notice,18,'#8a4b00');
 [['Total submissions',r.total],['IVDR',r.ivdr],['Non-IVDR',r.non],['IVDR share',percent(r.share)]].forEach(([label,value],i)=>{const x=24+i*294;rect(x,162,275,89,'#f1f5fa');text(x+14,190,label,21);text(x+14,233,value,35,'#122c49','start',700)});
 rect(24,274,17,17,'#7455c9');text(50,290,'IVDR',22);rect(155,274,17,17,'#16867e');text(181,290,'Non-IVDR',22);text(350,290,'Blank project values count as Non-IVDR',19);
 text(24,333,'Site',22);text(280,333,'IVDR',21,'#6945be','end');text(402,333,'Non-IVDR',21,'#116d66','end');text(509,333,'Total',21,'#24364b','end');text(558,333,'Volume by site',24,'#122c49','start',650);text(1174,333,'IVDR / Non-IVDR · IVDR %',19,'#24364b','end');
 const max=Math.max(1,...r.sites.map(s=>s.total));r.sites.forEach((s,i)=>{const y=378+i*58;rect(20,y-30,497,47,i%2?'#f2f5f9':'#fff');text(24,y,s.label.length>17?s.label.slice(0,16)+'…':s.label,22);text(280,y,s.ivdr,25,'#6945be','end',650);text(402,y,s.non,25,'#116d66','end',650);text(509,y,s.total,25,'#122c49','end',700);
 rect(558,y-16,356,22,'#edf2f7');rect(558,y-16,s.ivdr/max*356,22,'#7455c9');rect(558+s.ivdr/max*356,y-16,s.non/max*356,22,'#16867e');text(1174,y,s.ivdr+' / '+s.non+' · '+percent(s.total?s.ivdr/s.total*100:0),22,'#24364b','end',600)});
 const y=378+r.sites.length*58;rect(20,y-30,497,45,'#eaf0f8');text(24,y,'Grand total',22,'#122c49','start',700);text(280,y,r.ivdr,25,'#6945be','end',700);text(402,y,r.non,25,'#116d66','end',700);text(509,y,r.total,25,'#122c49','end',700);
 if(!r.total)text(558,392,'No submissions match this selection',23);
 text(24,height-60,'Dispatch not required: '+r.progress[4].total+' dated + '+r.notRequiredOutside.length+' without dispatch dates ('+r.notRequiredOutsideIVDR+' IVDR / '+r.notRequiredOutsideNon+' Non-IVDR)',19);
 text(24,height-30,'Missing Dates — '+r.year+': '+r.missing.length+' · All months within selected filters · Undated records outside totals',19);
 return r;
}
