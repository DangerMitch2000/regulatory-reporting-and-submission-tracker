import {summarize,viewingDay,roles as roadmapRoles,categories} from './ivdr-roadmap.logic.js';
import * as dispatchModule from './dispatch-required.js';
const dispatchRequired=dispatchModule.default||dispatchModule;
export const dispatchRequiredOptions=dispatchRequired.options;
export {viewingDay,categories};
export const roles=[...roadmapRoles.filter(role=>!['SubStatus','ROStatus'].includes(role)),'Project'];
const clean=v=>String(v??'').trim();
export function isIVDR(value){
 const text=Array.isArray(value)?value.join(' '):clean(value);
 // Explicit Non-IVDR is negative; combination labels with a positive IVDR token are positive.
 return /\bivdr\b/i.test(text.replace(/\bnon[\s_-]*ivdr\b/gi,''));
}
export function mapTable(table){const indices={};for(const role of roles){const matches=(table?.columns||[]).flatMap((c,i)=>c.roles?.[role]?[i]:[]);if(matches.length>1)throw Error('Map only one column to '+role);if(matches.length)indices[role]=matches[0];}
 return {missing:indices.SubID===undefined,missingProject:indices.Project===undefined,mappedRoles:Object.keys(indices),rows:(table?.rows||[]).map(row=>Object.fromEntries(roles.map(role=>[role,indices[role]===undefined?null:row[indices[role]]])))};
}
export function compare(rows,today=viewingDay(),state={}){
 const businessUnit=state.businessUnit===undefined?'*':state.businessUnit,siteFilter=state.site??'*',classification=state.classification??'*',month=Number.isInteger(state.month)?state.month:-1,includeInferred=!!state.includeInferred;
 const dispatchRequiredMapped=state.dispatchRequiredMapped!==false,dispatchFilter=state.dispatchRequired??'all',dispatchFlags=dispatchRequired.bySubmission(rows,dispatchRequiredMapped);
 const groups=new Map();for(const row of rows){const id=clean(row.SubID);if(id){if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}}
 const meta=new Map(),siteChoices=new Map();let missingIdRows=0;
 const units=[...new Set(rows.map(r=>clean(r.BusinessUnit)||null))].sort((a,b)=>String(a).localeCompare(String(b)));
 for(const [id,list]of groups){const names=[...new Set(list.map(r=>clean(r.Site)).filter(Boolean))].sort(),key=names.length>1?'ambiguous':names.length?'site:'+names[0]:'unassigned',label=names.length>1?'Multiple sites (unallocated)':names[0]||'Unassigned';
  const ivdr=list.some(r=>isIVDR(r.Project)),unitMatch=businessUnit==='*'||list.some(r=>(clean(r.BusinessUnit)||null)===businessUnit);
  meta.set(id,{key,label,ivdr,unitMatch});if(unitMatch)siteChoices.set(key,label);
 }
 const selected=new Set([...meta].filter(([id,m])=>m.unitMatch&&(siteFilter==='*'||m.key===siteFilter)&&(classification==='*'||m.ivdr===(classification==='ivdr'))&&dispatchRequired.matches(dispatchFlags.get(id),dispatchFilter)).map(([id])=>id));
 const scoped=rows.filter(r=>selected.has(clean(r.SubID)));
 // Rows without identifiers cannot be safely classified/associated as submissions.
 missingIdRows=rows.filter(r=>!clean(r.SubID)&&(businessUnit==='*'||(clean(r.BusinessUnit)||null)===businessUnit)).length;
 const base=summarize(scoped,today,includeInferred,'*',{mappedRoles:roles.filter(role=>dispatchRequiredMapped||role!=='DispatchRequired')}),records=base.records.filter(r=>month===-1||r.month===month),sites=new Map();
 for(const record of records){const m=meta.get(record.id);if(!sites.has(m.key))sites.set(m.key,{key:m.key,label:m.label,ivdr:0,non:0,total:0,progress:categories.map(()=>({ivdr:0,non:0,total:0}))});
  const s=sites.get(m.key),field=m.ivdr?'ivdr':'non';s[field]++;s.total++;s.progress[record.category][field]++;s.progress[record.category].total++;
 }
 const sorted=[...sites.values()].sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label)),ivdr=sorted.reduce((n,s)=>n+s.ivdr,0),non=records.length-ivdr;
 const progress=categories.map((_,i)=>({ivdr:sorted.reduce((n,s)=>n+s.progress[i].ivdr,0),non:sorted.reduce((n,s)=>n+s.progress[i].non,0),total:sorted.reduce((n,s)=>n+s.progress[i].total,0)}));
 const outside=base.notRequiredOutsideRecords||[],outsideIVDR=outside.filter(record=>meta.get(record.id)?.ivdr).length;
 return {...base,records,sites:sorted,total:records.length,ivdr,non,share:records.length?ivdr/records.length*100:0,progress,units,siteChoices:[...siteChoices].map(([key,label])=>({key,label})).sort((a,b)=>a.label.localeCompare(b.label)),month,classification,missingIdRows,baseAnnualTotal:base.total,dispatchRequired:dispatchFilter,dispatchRequiredMapped,notRequiredOutsideIVDR:outsideIVDR,notRequiredOutsideNon:outside.length-outsideIVDR};
}
