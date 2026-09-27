(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.regulatoryQualityUI=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const norm=v=>v==null?'':String(v).trim(),labels={error:'Error',review:'Review needed',missing:'Missing information'};
 // Filter membership rows together, then preserve every known issue for matching submissions.
 function worklist(analysis,matchingRows,{category='',query=''}={}){
  const membership=new Map();for(const row of matchingRows){const id=norm(row.SubID);if(!id)continue;if(!membership.has(id))membership.set(id,new Set());membership.get(id).add(norm(row.Manufacturer)||'Unassigned');}
  const q=query.trim().toLowerCase(),entries=[];
  for(const issue of analysis?.issues||[]){const sites=membership.get(issue.subID);if(!sites||category&&issue.category!==category)continue;
   const haystack=[issue.subID,...issue.roIDs,...issue.appIDs,issue.fieldLabel,issue.value,issue.reason,...sites].join(' ').toLowerCase();if(q&&!haystack.includes(q))continue;
   for(const site of sites)entries.push({site,issue,key:JSON.stringify([site,issue.id])});
  }
  const rank={error:0,review:1,missing:2};entries.sort((a,b)=>a.site.localeCompare(b.site)||rank[a.issue.category]-rank[b.issue.category]||a.issue.subID.localeCompare(b.issue.subID)||a.issue.fieldLabel.localeCompare(b.issue.fieldLabel)||a.issue.id.localeCompare(b.issue.id));
  return entries;
 }
 function csvCell(v){let s=v==null?'':String(v);if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function toCsv(entries){const headers=['Site','Business unit','Submission ID','RO IDs','Application IDs','Category','Field','Recorded value','Reason','Suggested check'];const values=entries.map(({site,issue:i})=>[site,i.businessUnits.join(' | '),i.subID,i.roIDs.join(' | '),i.appIDs.join(' | '),labels[i.category],i.fieldLabel,i.value,i.reason,i.suggestion]);return '\uFEFF'+[headers,...values].map(row=>row.map(csvCell).join(',')).join('\r\n');}
 function mount(container,{exportWorklist}={}){
  const doc=container.ownerDocument,el=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let analysis={issues:[]},matching=[],page=0,selected='',entries=[],disposed=false,searchTimer;const pageSize=12;
  const title=el('div',undefined,'quality-title'),heading=el('div'),tools=el('div',undefined,'quality-actions'),exportButton=el('button','Export worklist');exportButton.id='quality-export';heading.append(el('h2','Data quality'),el('p','Flagged records grouped by site.','muted'));tools.append(exportButton);title.append(heading,tools);
  const controls=el('div',undefined,'quality-controls'),catLabel=el('label','Issue category '),category=el('select');category.id='quality-category';category.setAttribute('aria-label','Issue category');for(const [value,label]of [['','All issues'],...Object.entries(labels)]){const o=el('option',label);o.value=value;category.append(o);}catLabel.append(category);
  const searchLabel=el('label','Search worklist '),search=el('input');search.type='search';search.id='quality-search';search.placeholder='Submission, RO, field or reason';searchLabel.append(search);controls.append(catLabel,searchLabel);
  const counts=el('div',undefined,'quality-counts');counts.id='quality-counts';counts.setAttribute('aria-live','polite');
  const layout=el('div',undefined,'quality-layout'),list=el('section',undefined,'quality-list'),tableWrap=el('div',undefined,'quality-table-wrap'),table=el('table'),thead=el('thead'),tr=el('tr'),tbody=el('tbody');table.id='quality-table';table.setAttribute('aria-label','Site remediation worklist');for(const h of ['Site / Record','Flag','Field / Recorded value','Reason'])tr.append(el('th',h));thead.append(tr);table.append(thead,tbody);tableWrap.append(table);
  const pager=el('div',undefined,'quality-pager'),previous=el('button','Previous'),next=el('button','Next'),pageLabel=el('span');previous.id='quality-prev';next.id='quality-next';pageLabel.id='quality-page';pager.append(previous,pageLabel,next);list.append(tableWrap,pager);
  const detail=el('aside',undefined,'quality-detail');detail.id='quality-detail';detail.setAttribute('aria-label','Selected issue');layout.append(list,detail);
  const note=el('p','Checks cover mapped fields in loaded records. All known issues for matching submissions are retained. Multi-site issues appear under each matching site; totals count distinct issues and submissions. State and timeline search controls apply only to the timeline.','quality-note');
  const message=el('p',undefined,'quality-message');message.id='quality-message';message.setAttribute('role','status');
  const fallback=el('details',undefined,'quality-fallback'),summary=el('summary','Copy the filtered worklist'),textarea=el('textarea'),copyCsv=el('button','Copy worklist');textarea.readOnly=true;textarea.setAttribute('aria-label','Filtered worklist CSV');textarea.rows=7;fallback.append(summary,textarea,copyCsv);fallback.hidden=true;
  const demoNote=el('p','All examples are fictional. ','quality-note');container.replaceChildren(title,controls,counts,layout,note,message,fallback,demoNote);
  function issueText(entry){const i=entry.issue;return ['Site: '+entry.site,'Submission: '+i.subID,'RO: '+i.roIDs.join(', '),'Application: '+i.appIDs.join(', '),'Category: '+labels[i.category],'Field: '+i.fieldLabel,'Recorded value: '+i.value,'Reason: '+i.reason,'Suggested check: '+i.suggestion].join('\n');}
  async function copy(text){try{await navigator.clipboard.writeText(text);message.textContent='Copied.';}catch{message.textContent='Clipboard unavailable. Select the text and use Copy.';}}
  function showDetail(){detail.replaceChildren();const entry=entries.find(e=>e.key===selected);if(!entry){detail.append(el('h3','Review issue'),el('p','Select a record to see its source value and suggested check.'));return;}const i=entry.issue;
   detail.append(el('span',labels[i.category],'quality-badge '+i.category),el('h3',i.subID),el('p',entry.site+' · '+(i.roIDs.join(', ')||'RO not recorded')));
   const dl=el('dl');for(const [label,value]of [['Application',i.appIDs.join(', ')||'Not recorded'],['Field',i.fieldLabel],['Recorded value',i.value],['Why it is flagged',i.reason],['What to check',i.suggestion]])dl.append(el('dt',label),el('dd',value));detail.append(dl);
   const buttons=el('div',undefined,'quality-actions'),copyId=el('button','Copy ID'),copyIssue=el('button','Copy issue');copyId.onclick=()=>copy(i.subID);copyIssue.onclick=()=>copy(issueText(entry));buttons.append(copyId,copyIssue);detail.append(buttons,el('p','Source data is unchanged.','muted'));
  }
  function render(){if(disposed)return;entries=worklist(analysis,matching,{category:category.value,query:search.value});const unique=new Map(entries.map(e=>[e.issue.id,e.issue])),subs=new Set([...unique.values()].map(i=>i.subID));counts.replaceChildren();
   for(const [value,label]of [[subs.size,'Affected submissions'],[unique.size,'Individual issues'],...[['error','Errors'],['review','Review needed'],['missing','Missing information']].map(([key,label])=>[[...unique.values()].filter(i=>i.category===key).length,label])]){const item=el('div');item.append(el('strong',String(value)),el('span',label));counts.append(item);}
   const pages=Math.max(1,Math.ceil(entries.length/pageSize));page=Math.min(page,pages-1);const visible=entries.slice(page*pageSize,(page+1)*pageSize);if(!entries.some(e=>e.key===selected))selected=visible[0]?.key||'';
   tbody.replaceChildren();let lastSite='';for(const entry of visible){const i=entry.issue;if(lastSite!==entry.site){const group=el('tr',undefined,'quality-site-group'),cell=el('th',entry.site);cell.colSpan=4;cell.scope='rowgroup';group.append(cell);tbody.append(group);lastSite=entry.site;}
    const row=el('tr',undefined,entry.key===selected?'quality-selected':'');row.dataset.issueId=i.id;const record=el('td'),recordButton=el('button',i.subID,'quality-record');recordButton.onclick=()=>{selected=entry.key;render();};recordButton.setAttribute('aria-pressed',String(entry.key===selected));record.append(recordButton,el('span',i.roIDs.join(', ')||'RO not recorded','quality-secondary'));const flag=el('td');flag.append(el('span',labels[i.category],'quality-badge '+i.category));const field=el('td');field.append(el('strong',i.fieldLabel),el('span',i.value,'quality-secondary'));row.append(record,flag,field,el('td',i.reason));tbody.append(row);
   }
   if(!entries.length){const row=el('tr'),cell=el('td',matching.length?'No issues match these filters.':'No records match the membership filters.');cell.colSpan=4;row.append(cell);tbody.append(row);}
   pageLabel.textContent=entries.length?((page*pageSize+1)+'–'+Math.min((page+1)*pageSize,entries.length)+' of '+entries.length+' site entries · Page '+(page+1)+' / '+pages):'0 site entries';previous.disabled=page===0;next.disabled=page>=pages-1;exportButton.disabled=!entries.length;showDetail();
   if(!fallback.hidden)textarea.value=toCsv(entries);
  }
  category.onchange=()=>{page=0;render();};search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;render();},140);};previous.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};copyCsv.onclick=()=>copy(textarea.value);
  exportButton.onclick=async()=>{clearTimeout(searchTimer);render();const csv=toCsv(entries),sites=[...new Set(entries.map(e=>e.site))],suffix=sites.length===1?sites[0]:'selected-sites',filename='regulatory-data-quality-'+suffix.replace(/[^a-z0-9_-]/gi,'-')+'.csv';message.textContent='Preparing filtered worklist…';
   try{if(exportWorklist){if(!await exportWorklist(csv,filename))throw Error('host declined');message.textContent='Worklist sent to the Power BI download service.';}else{const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download=filename;container.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message.textContent='Filtered worklist downloaded.';}}
   catch{if(disposed)return;fallback.hidden=false;fallback.open=true;textarea.value=csv;message.textContent='Download unavailable here. Copy the filtered CSV below instead.';}
  };
  render();return {update(next,rows){analysis=next;matching=rows;render();},reset(){category.value='';search.value='';page=0;selected='';message.textContent='';fallback.hidden=true;render();},destroy(){disposed=true;clearTimeout(searchTimer);}};
 }
 return {mount,worklist,toCsv};
});
