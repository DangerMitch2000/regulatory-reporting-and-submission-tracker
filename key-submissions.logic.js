import * as dispatchRequired from './dispatch-required.js';
const dispatch=dispatchRequired.default||dispatchRequired;
export const dispatchOptions=dispatch.options;
export const roles=['SubID','ROID','KeySubmission','BusinessUnit','Product','Country','Site','SubStatus','OriginalDispatch','LatestDispatch','ActualDispatch','LatestSubmission','ActualSubmission','LatestApproval','ActualApproval','DispatchRequired'];
export const dateRoles=roles.slice(8,15);
const clean=v=>String(v??'').trim();
export const isKey=v=>/^key submissions?$/.test(clean(v).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' '));
export function day(v){if(v==null||v==='')return null;let y,m,d;if(v instanceof Date){if(!Number.isFinite(+v))return NaN;y=v.getUTCFullYear();m=v.getUTCMonth()+1;d=v.getUTCDate();}else {const s=clean(v),a=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);if(!a||s.includes('T')&&!Number.isFinite(Date.parse(s)))return NaN;[,y,m,d]=a.map(Number);}const n=Date.UTC(y,m-1,d),dt=new Date(n);return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?n:NaN;}
export function mapTable(table){const indices={},missing=[];for(const role of roles){const matches=(table?.columns||[]).flatMap((c,i)=>c.roles?.[role]?[i]:[]);if(matches.length>1)throw Error('Map only one column to '+role);if(matches.length)indices[role]=matches[0];}for(const k of ['SubID','KeySubmission','BusinessUnit'])if(indices[k]===undefined)missing.push(k);if(!dateRoles.some(k=>indices[k]!==undefined))missing.push('a dispatch, submission or approval date');return {missing,dispatchMapped:indices.DispatchRequired!==undefined,rows:(table?.rows||[]).map(row=>Object.fromEntries(roles.map(k=>[k,indices[k]===undefined?null:row[indices[k]]])))};}
export function collect(rows,{dispatchFilter='all',dispatchMapped=true}={}){
 const groups=new Map();let unidentified=0;for(const r of rows){const id=clean(r.SubID);if(!id){if(isKey(r.KeySubmission)&&clean(r.BusinessUnit).toUpperCase()==='ID')unidentified++;continue;}if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
 const records=[],excluded=[],undated=[],outside=[],qualifying=[];
 for(const [id,list]of groups){if(!list.some(r=>isKey(r.KeySubmission))||!list.some(r=>clean(r.BusinessUnit).toUpperCase()==='ID'))continue;const required=dispatch.resolve(list.map(r=>r.DispatchRequired),dispatchMapped);if(!dispatch.matches(required,dispatchFilter))continue;qualifying.push(id);
  const values=k=>[...new Set(list.map(r=>clean(r[k])).filter(Boolean))].sort();const dates={},issues=[];
  for(const k of dateRoles){const vals=list.map(r=>day(r[k])),valid=[...new Set(vals.filter(v=>v!==null&&Number.isFinite(v)))];const issue=vals.some(Number.isNaN)||valid.length>1;dates[k]={value:issue?null:valid[0]??null,issue};if(issue)issues.push(k);}
  let chosen,source;for(const k of ['ActualDispatch','LatestDispatch','OriginalDispatch']){if(dates[k].issue||dates[k].value!==null){chosen=dates[k];source=k;break;}}
  let alternativeScope=false;if(!chosen&&required.value===false){for(const k of ['ActualSubmission','LatestSubmission','ActualApproval','LatestApproval'])if(dates[k].issue||dates[k].value!==null){chosen=dates[k];source=k;alternativeScope=true;break;}}
  if(chosen?.issue){excluded.push({id,reason:'Conflicting or invalid '+source});continue;}if(!chosen){undated.push(id);continue;}if(new Date(chosen.value).getUTCFullYear()!==2026){outside.push(id);continue;}
  let next='Dispatch',target=dates.LatestDispatch.value??dates.OriginalDispatch.value,complete=false;
  if(required.value===false||dates.ActualDispatch.value!==null){next='Submission';target=dates.LatestSubmission.value;if(dates.ActualSubmission.value!==null){next='Approval';target=dates.LatestApproval.value;}}
  if(dates.ActualApproval.value!==null){next='Approved';target=dates.ActualApproval.value;complete=true;}
  if(dates.ActualDispatch.issue||dates.ActualSubmission.issue||dates.ActualApproval.issue){next='Check dates';target=null;}
  if(next==='Dispatch'&&dates.LatestDispatch.issue)target=null;
  const statuses=values('SubStatus'),status=statuses.length===1?statuses[0]:statuses.length?'Multiple statuses':'Not provided';
  records.push({id,ros:values('ROID'),products:values('Product'),countries:values('Country'),sites:values('Site'),status,statuses,next,target,complete,dates,issues,scopeDate:chosen.value,scopeSource:source,alternativeScope,dispatchRequired:required});
 }
 records.sort((a,b)=>Number(a.complete)-Number(b.complete)||(a.target??Infinity)-(b.target??Infinity)||a.id.localeCompare(b.id));
 return {records,excluded,undated,outside,qualifying,unidentified};
}
export function selectPage(records,{query='',page=0,size=10}={}){const q=query.trim().toLowerCase(),matches=records.filter(r=>[r.id,...r.ros,...r.products,...r.countries,...r.sites,r.status].join(' ').toLowerCase().includes(q)),pages=Math.max(1,Math.ceil(matches.length/size)),index=Math.min(Math.max(0,page),pages-1);return {matches,page:index,pages,rows:matches.slice(index*size,(index+1)*size)};}
