import * as dispatchModule from './dispatch-required.js';
const dispatchRequired=dispatchModule.default||dispatchModule;
export const dateRoles=['OriginalDispatch','LatestDispatch','ActualDispatch','ActualSubmission','ActualApproval'];
export const statusRoles=['SubStatus','ROStatus'];
export const roles=['SubID',...dateRoles,'Site','BusinessUnit',...statusRoles,'DispatchRequired'];
export const categories=['Dispatched','In Progress / Expected','Unconfirmed','Inferred','Dispatch not required'];
export function viewingDay(now=new Date()){return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());}
// Date fields are calendar dates. ISO timestamps use their written YYYY-MM-DD,
// never the viewer's timezone. Power BI Date objects use their UTC calendar parts.
export function parseDay(value){
 if(value===null||value===undefined||value==='')return {kind:'blank'};
 let y,m,d;
 if(value instanceof Date){if(!Number.isFinite(+value))return {kind:'invalid'};y=value.getUTCFullYear();m=value.getUTCMonth()+1;d=value.getUTCDate();}
 else if(typeof value==='string'){
  const match=value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  if(!match)return {kind:'invalid'};[,y,m,d]=match.map(Number);
  if(value.includes('T')&&!Number.isFinite(Date.parse(value)))return {kind:'invalid'};
 }else return {kind:'invalid'};
 const n=Date.UTC(y,m-1,d),date=new Date(n);
 return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?{kind:'date',day:n}:{kind:'invalid'};
}
function resolve(values){const valid=new Set();let invalid=false;for(const value of values){const p=parseDay(value);if(p.kind==='invalid')invalid=true;if(p.kind==='date')valid.add(p.day);}
 return invalid||valid.size>1?{kind:'issue'}:valid.size?{kind:'date',day:[...valid][0]}:{kind:'blank'};}
export function mapTable(table){const columns=table?.columns||[],indices={};for(const role of roles){const a=columns.map((c,i)=>c.roles?.[role]?i:-1).filter(i=>i>=0);if(a.length>1)throw Error('Map only one column to '+role);if(a.length)indices[role]=a[0];}
 return {missing:indices.SubID===undefined,mappedRoles:Object.keys(indices),rows:(table?.rows||[]).map(r=>Object.fromEntries(roles.map(k=>[k,indices[k]===undefined?null:r[indices[k]]])))};
}
// Statuses describe delivered source data. They do not establish a milestone date
// or a completed dispatch, and an RO status is never copied to its submissions.
function resolveStatus(values,mapped){
 if(!mapped)return {kind:'unmapped',key:'unmapped',label:'Field not mapped',values:[]};
 const labels=new Map();
 for(const raw of values){const label=String(raw??'').trim().replace(/\s+/g,' ');if(!label)continue;const normalized=label.toLowerCase();if(!labels.has(normalized))labels.set(normalized,new Set());labels.get(normalized).add(label);}
 const entries=[...labels].sort(([a],[b])=>a.localeCompare(b)).map(([normalized,variants])=>({normalized,label:[...variants].sort()[0]}));
 if(!entries.length)return {kind:'blank',key:'blank',label:'Not recorded',values:[]};
 if(entries.length>1)return {kind:'conflict',key:'conflict',label:'Conflicting values',values:entries.map(e=>e.label)};
 return {kind:'value',key:'value:'+JSON.stringify(entries[0].normalized),label:entries[0].label,values:[entries[0].label]};
}
export function summarize(rows,today=viewingDay(),includeInferred=false,businessUnit='*',options={}){
 const mappedRoles=options.mappedRoles===undefined?[...roles]:[...options.mappedRoles],mapped=new Set(mappedRoles);
 const dispatchFilter=options.dispatchRequired||'all',dispatchIndex=dispatchRequired.bySubmission(rows,mapped.has('DispatchRequired'));
 const unitKey=r=>String(r.BusinessUnit??'').trim()||null;
 const units=[...new Set(rows.map(unitKey))].sort((a,b)=>String(a).localeCompare(String(b)));
 // Select records by membership, then retain all delivered associations for those IDs.
 // This avoids hiding conflicting dates or multi-site membership in joined rows.
 const selected=new Set(rows.filter(r=>businessUnit==='*'||unitKey(r)===businessUnit).map(r=>String(r.SubID??'').trim()).filter(Boolean));
 rows=rows.filter(r=>{const id=String(r.SubID??'').trim();return (id?selected.has(id):businessUnit==='*'||unitKey(r)===businessUnit)&&dispatchRequired.matches(dispatchIndex.get(id)||dispatchRequired.resolve([r.DispatchRequired],mapped.has('DispatchRequired')),dispatchFilter);});
 const groups=new Map();let missingIdRows=0;
 for(const row of rows){const id=String(row.SubID??'').trim();if(!id){missingIdRows++;continue;}if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
 const year=new Date(today).getUTCFullYear(),zero=()=>categories.map(()=>0),months=Array.from({length:12},zero),totals=zero(),issues=[],excluded=[],missing=[],missingRecords=[],notRequiredOutside=[],notRequiredOutsideRecords=[],records=[],ambiguousSites=[],undatedInferred=[],sites=new Map();let outsideYear=0;
 for(const [id,list]of groups){const dates=Object.fromEntries(dateRoles.map(k=>[k,resolve(list.map(r=>r[k]))]));
  const bad=Object.entries(dates).filter(([,p])=>p.kind==='issue').map(([k])=>k);if(bad.length)issues.push({id,fields:bad});
  const evidence=['ActualSubmission','ActualApproval'].filter(k=>dates[k].kind==='date').map(k=>({field:k,day:dates[k].day}));
  const actualAbsent=dates.ActualDispatch.kind==='blank';
  const required=dispatchIndex.get(id),notRequired=required.value===false;
  const names=[...new Set(list.map(r=>String(r.Site??'').trim()).filter(Boolean))].sort();
  const siteKey=names.length>1?'ambiguous':names.length===1?'site:'+names[0]:'unassigned',site=names.length>1?'Multiple sites (unallocated)':names[0]||'Unassigned';
  const status={subStatus:resolveStatus(list.map(r=>r.SubStatus),mapped.has('SubStatus')),roStatus:resolveStatus(list.map(r=>r.ROStatus),mapped.has('ROStatus'))};
  const reviewPlan=dates.LatestDispatch.kind==='blank'?dates.OriginalDispatch:dates.LatestDispatch;
  const dateValues=Object.fromEntries(dateRoles.map(field=>[field,[...new Set(list.map(r=>r[field]).filter(value=>value!==null&&value!==undefined&&value!=='').map(value=>value instanceof Date&&Number.isFinite(+value)?value.toISOString():String(value)))].sort()]));
  const record={id,siteKey,site,sites:names,evidence,dateIssues:bad,dateValues,dispatchRequired:required,reviewPlannedDay:reviewPlan.kind==='date'?reviewPlan.day:null,planState:reviewPlan.kind,missingActual:actualAbsent&&!notRequired,...status};
  // Cleanup scope is independent of the inference toggle. Invalid/conflicting plans
  // are unusable but remain explicitly flagged. A valid plan in either field means
  // this is NOT a no-usable-dispatch-date record, even if a higher-priority field fails.
  const noPlan=dates.LatestDispatch.kind!=='date'&&dates.OriginalDispatch.kind!=='date';
  if(actualAbsent&&noPlan&&evidence.some(e=>new Date(e.day).getUTCFullYear()===year)){const outside={...record,month:null,category:notRequired?4:null,plannedDay:null,actualDay:null,outsideChart:true};if(notRequired){notRequiredOutside.push(id);notRequiredOutsideRecords.push(outside);}else{missing.push(id);missingRecords.push(outside);}}
  if(includeInferred&&!notRequired&&actualAbsent&&noPlan&&evidence.length)undatedInferred.push(id);
  let chosen=dates.ActualDispatch,cat=0;
  if(chosen.kind==='issue'){excluded.push(id);continue;}
  if(chosen.kind==='blank'){chosen=dates.LatestDispatch;cat=1;if(chosen.kind==='issue'){excluded.push(id);continue;}if(chosen.kind==='blank')chosen=dates.OriginalDispatch;if(chosen.kind==='issue'){excluded.push(id);continue;}if(chosen.kind==='blank')continue;if(chosen.day<today)cat=2;if(includeInferred&&evidence.length)cat=3;}
  if(notRequired)cat=4;
  const date=new Date(chosen.day);if(date.getUTCFullYear()!==year){outsideYear++;continue;}const month=date.getUTCMonth();months[month][cat]++;totals[cat]++;
  if(names.length>1)ambiguousSites.push({id,sites:names});
  if(!sites.has(siteKey))sites.set(siteKey,{key:siteKey,label:site,months:Array.from({length:12},zero),totals:zero(),total:0});
  const bucket=sites.get(siteKey);bucket.months[month][cat]++;bucket.totals[cat]++;bucket.total++;
  records.push({...record,month,category:cat,plannedDay:dates.ActualDispatch.kind==='date'?null:chosen.day,actualDay:dates.ActualDispatch.kind==='date'?chosen.day:null});
 }
 const total=totals.reduce((a,b)=>a+b,0);
 return {units,businessUnit,dispatchRequired:dispatchFilter,year,months,totals,total,average:total/12,percentages:totals.map(n=>total?n/total*100:0),missing,missingRecords,notRequiredOutside,notRequiredOutsideRecords,issues,excluded,outsideYear,missingIdRows,distinct:groups.size,today,records,sites:[...sites.values()].sort((a,b)=>a.label.localeCompare(b.label)),ambiguousSites,undatedInferred,includeInferred,mappedRoles};
}
function statusCounts(records,field){
 const buckets=new Map();
 for(const record of records){const state=record[field];if(!buckets.has(state.key))buckets.set(state.key,{key:state.key,label:state.label,kind:state.kind,count:0});const bucket=buckets.get(state.key);bucket.count++;if(state.label<bucket.label)bucket.label=state.label;}
 return [...buckets.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label));
}
// Facets are calculated before panel filters; the filtered counts remain a
// mutually exclusive count of submissions, including for the RO-status column.
export function selectStatusReview(summary,{scope='unconfirmed',site='*',subStatus='*',roStatus='*',query=''}={}){
 const predicates={unconfirmed:r=>r.category===2,inferred:r=>r.category===3,'missing-dispatch':r=>r.missingActual,'not-required':r=>r.category===4,all:()=>true};
 if(!['missing-dates','not-required-outside'].includes(scope)&&!predicates[scope])scope='unconfirmed';
 const source=scope==='missing-dates'?summary.missingRecords||[]:scope==='not-required-outside'?summary.notRequiredOutsideRecords||[]:(summary.records||[]).filter(predicates[scope]);
 const sites=[...new Map(source.map(r=>[r.siteKey,{key:r.siteKey,label:r.site}])).values()].sort((a,b)=>a.label.localeCompare(b.label));
 const normalized=String(query??'').trim().replace(/\s+/g,' ').toLowerCase();
 const records=source.filter(r=>(site==='*'||r.siteKey===site)&&(subStatus==='*'||r.subStatus.key===subStatus)&&(roStatus==='*'||r.roStatus.key===roStatus)&&(!normalized||[r.id,r.site,...r.sites,r.subStatus.label,...r.subStatus.values,r.roStatus.label,...r.roStatus.values].join(' ').replace(/\s+/g,' ').toLowerCase().includes(normalized))).sort((a,b)=>a.site.localeCompare(b.site)||a.id.localeCompare(b.id));
 return {scope,scopeTotal:source.length,total:records.length,records,sites,submissionStatuses:statusCounts(source,'subStatus'),roStatuses:statusCounts(source,'roStatus'),counts:{submissionStatuses:statusCounts(records,'subStatus'),roStatuses:statusCounts(records,'roStatus')}};
}
