import * as dispatchRequired from './dispatch-required.js';
const dispatch=dispatchRequired.default||dispatchRequired;
export const dispatchOptions=dispatch.options;
export const roles=['SubID','Site','BusinessUnit','OriginalDispatch','LatestDispatch','OriginalSubmission','LatestSubmission','OriginalApproval','LatestApproval','DispatchRequired'];
export const dateRoles=roles.slice(3,9);
export const milestones=['Dispatches','Submissions','Approvals'];
const clean=v=>String(v??'').trim();
export function parseDay(v){if(v==null||v==='')return {kind:'blank'};let y,m,d;if(v instanceof Date){if(!Number.isFinite(+v))return {kind:'invalid'};y=v.getUTCFullYear();m=v.getUTCMonth()+1;d=v.getUTCDate();}else{const s=clean(v),a=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);if(!a||s.includes('T')&&!Number.isFinite(Date.parse(s)))return {kind:'invalid'};[,y,m,d]=a.map(Number);}const day=Date.UTC(y,m-1,d),dt=new Date(day);return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?{kind:'date',day}:{kind:'invalid'};}
function resolve(list,role){const parsed=list.map(r=>parseDay(r[role])),days=[...new Set(parsed.filter(d=>d.kind==='date').map(d=>d.day))];return parsed.some(d=>d.kind==='invalid')||days.length>1?{kind:'issue'}:days.length?{kind:'date',day:days[0]}:{kind:'blank'};}
export function mapTable(table){const index={},missing=[];for(const role of roles){const cols=(table?.columns||[]).flatMap((c,i)=>c.roles?.[role]?[i]:[]);if(cols.length>1)throw Error('Map only one field to '+role);if(cols.length)index[role]=cols[0];}for(const k of ['SubID','Site',...dateRoles])if(index[k]===undefined)missing.push(k);return {missing,dispatchMapped:index.DispatchRequired!==undefined,rows:(table?.rows||[]).map(row=>Object.fromEntries(roles.map(k=>[k,index[k]===undefined?null:row[index[k]]])))};}
export function summarize(rows,{unit='*',site=null,dispatchFilter='all',dispatchMapped=true}={}){
 const groups=new Map(),units=[...new Set(rows.map(r=>clean(r.BusinessUnit)||null))].sort((a,b)=>String(a).localeCompare(String(b)));let missingIds=0;
 for(const r of rows){const id=clean(r.SubID);if(!id){if(unit==='*'||(clean(r.BusinessUnit)||null)===unit)missingIds++;continue;}if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
 const sites=new Map();
 for(const [id,list]of groups){const required=dispatch.resolve(list.map(r=>r.DispatchRequired),dispatchMapped);if(!dispatch.matches(required,dispatchFilter)||unit!=='*'&&!list.some(r=>(clean(r.BusinessUnit)||null)===unit))continue;const names=[...new Set(list.map(r=>clean(r.Site)).filter(Boolean))].sort(),key=names.length>1?'multiple':names.length?'site:'+names[0]:'unassigned',label=names.length>1?'Multiple sites (unallocated)':names[0]||'Unassigned';
  if(!sites.has(key))sites.set(key,{key,label,records:0,counts:Array.from({length:2},()=>milestones.map(()=>({original:0,latest:0}))),issues:[],missing:0,fallback:0,outside:0,notRequired2026:0,dispatchReview:[]});const bucket=sites.get(key);bucket.records++;
  const dates=Object.fromEntries(dateRoles.map(role=>[role,resolve(list,role)]));if(required.value===false&&Object.values(dates).some(d=>d.kind==='date'&&new Date(d.day).getUTCFullYear()===2026))bucket.notRequired2026++;if(required.key==='review')bucket.dispatchReview.push({id,label:required.label,values:required.values});
  ['Dispatch','Submission','Approval'].forEach((name,i)=>{const original=dates['Original'+name],latest=dates['Latest'+name];if(original.kind==='issue'||latest.kind==='issue')bucket.issues.push({id,milestone:name,fields:[original.kind==='issue'?'Original'+name:null,latest.kind==='issue'?'Latest'+name:null].filter(Boolean)});if(name==='Dispatch'&&required.value===false)return;const chosen=latest.kind==='blank'?original:latest;
   if(latest.kind==='blank'&&original.kind==='date')bucket.fallback++;if(chosen.kind==='blank')bucket.missing++;
   for(const [kind,date]of [['original',original],['latest',chosen]]){if(date.kind!=='date')continue;const d=new Date(date.day);if(d.getUTCFullYear()!==2026){bucket.outside++;continue;}bucket.counts[d.getUTCMonth()<6?0:1][i][kind]++;}
  });
 }
 const choices=[...sites.values()].sort((a,b)=>a.label.localeCompare(b.label)),selectedKey=site===null?(choices.find(s=>s.key.startsWith('site:'))?.key??choices[0]?.key??null):site,selected=sites.get(selectedKey)||{key:selectedKey,label:selectedKey?.startsWith('site:')?selectedKey.slice(5):'No matching site',records:0,counts:Array.from({length:2},()=>milestones.map(()=>({original:0,latest:0}))),issues:[],missing:0,fallback:0,outside:0,notRequired2026:0,dispatchReview:[]};
 const peak=Math.max(1,...selected.counts.flatMap(h=>h.flatMap(c=>[c.original,c.latest]))),step=Math.pow(10,Math.floor(Math.log10(peak)))/2,axisMax=Math.max(2,Math.ceil(peak/step)*step);
 return {units,choices,selected,axisMax,missingIds};
}
