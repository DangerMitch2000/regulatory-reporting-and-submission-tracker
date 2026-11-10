import fields from './fields.json' with {type:'json'};
import dateFormat from './tracker/date-format.js';
import responses from './tracker/assessment-responses.js';
import dispatchFlags from './tracker/dispatch-required.js';
import {compare,filterRows,dueOrder} from './table-tools.mjs';
export const roles=fields.map(f=>f.name),names=Object.fromEntries(fields.map(f=>[f.name,f.displayName]));
export const dates=fields.filter(f=>f.description.startsWith('Date column')).map(f=>f.name);
export const text=v=>v==null?'':String(v).trim(),norm=v=>text(v).toLowerCase(),unique=v=>[...new Set(v.filter(x=>x!==null&&x!==undefined&&x!==''))];
const DAY=86400000,vals=(rs,f)=>unique(rs.map(r=>text(r[f]))),key=(...xs)=>JSON.stringify(xs);
const inactive=new Set(['inactive','archived','withdrawn','canceled','cancelled','deferred','cancelled state','inactive state']);
const approvedStates=new Set(['health authority approved','conditionally approved']);
const submittedStates=new Set(['completed','ha received','sent to health authority','rejected']);
export const GROUPINGS={change:{field:'ChangeID',state:'ChangeStatus',label:'Change ID',singular:'change',plural:'changes',created:'ChangeCreated'},event:{field:'EventName',state:'EventState',label:'Event',singular:'event',plural:'events',created:null},application:{field:'AppID',state:'AppStatus',label:'Application',singular:'application',plural:'applications',created:'AppCreated'}};
export const DEFAULT_STATE={groupBy:'event',site:'all',product:'all',unit:'all',country:'all',status:'all',view:'attention',queue:'all',includeInactive:false,sort:'due',direction:'desc',columnFilters:{}};
export const RECORD_FIELDS={change:'ChangeID',event:'EventName',application:'AppID',ro:'ROID',submission:'SubID',registration:'RegistrationID'};
export function recordCounts(rows){return Object.fromEntries(Object.entries(RECORD_FIELDS).map(([k,f])=>[k,vals(rows,f).length]));}
export function previousDay(now=new Date()) {const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return Date.UTC(+parts.year,+parts.month-1,+parts.day)-DAY;}
export function formatDate(value){return Number.isFinite(value)?dateFormat.format(value):'Not recorded';}
export function dateField(rs,f,asOf,actual=false){
 const raw=vals(rs,f);if(!raw.length)return {kind:'missing',value:null,label:'Not recorded',raw};
 const parsed=raw.map(v=>dateFormat.parse(v));
 if(parsed.some(v=>!Number.isFinite(v)||new Date(v).getUTCFullYear()>2100||new Date(v).getUTCFullYear()<1900))return {kind:'invalid',value:null,label:'Invalid / outside 1900–2100',raw};
 if(unique(parsed).length>1)return {kind:'conflict',value:null,label:'Conflicting dates',raw};
 if(actual&&parsed[0]>asOf)return {kind:'future',value:null,label:'After the as-of day',raw};
 return {kind:'dated',value:parsed[0],label:formatDate(parsed[0]),raw};
}
export function safeURL(v){try{const s=text(v);if(!s||/[\s\\\u0000-\u001f]/.test(s))return null;const u=new URL(s);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function mapTable(table){const mapped=new Map();for(const [i,c]of (table?.columns||[]).entries())for(const r of roles)if(c.roles?.[r]){if(mapped.has(r))throw Error('Map only one field to '+r);mapped.set(r,i);}const rows=(table?.rows||[]).map(v=>Object.fromEntries([...mapped].map(([r,i])=>[r,v[i] instanceof Date?(Number.isFinite(v[i].valueOf())?v[i].toISOString():'Invalid Date'):v[i]])));return {rows,mappedFields:[...mapped.keys()],missing:Object.values(GROUPINGS).some(g=>mapped.has(g.field))?[]:['EventName, AppID or ChangeID']};}
function group(rs,field){const out=new Map();for(const r of rs){const id=text(r[field]);if(!id)continue;if(!out.has(id))out.set(id,[]);out.get(id).push(r);}return out;}
function scalar(rs,f){const values=vals(rs,f),normalized=unique(values.map(norm));return {values,value:normalized.length===1?normalized[0]:'',label:values.join(' / ')||'Not recorded',conflict:normalized.length>1};}
function target(rs,latest,original,asOf){const d=dateField(rs,latest,asOf);return {...(d.kind==='missing'?dateField(rs,original,asOf):d),field:d.kind==='missing'?original:latest};}
function submission(id,rs,model){
 const {asOf}=model,issues=[],add=s=>{if(!issues.includes(s))issues.push(s);};
 const s=scalar(rs,'SubStatus'),ro=scalar(rs,'ROStatus'),app=scalar(rs,'AppStatus'),country=scalar(rs,'Country');
 for(const [label,x]of [['Submission state',s],['RO state',ro],['Application state',app]])if(x.conflict)add(label+' has conflicting values');
 if(country.conflict||!country.value)add('Submission country missing or conflicting');
 if(vals(rs,'ROID').length>1||vals(rs,'AppID').length>1)add('Submission links to conflicting applications or ROs');
 const flag=dispatchFlags.resolve(rs.map(r=>r.DispatchRequired),model.mapped.has('DispatchRequired'));
 const actual={dispatch:dateField(rs,'ActualDispatch',asOf,true),submission:dateField(rs,'ActualSubmission',asOf,true),approval:dateField(rs,'ActualApproval',asOf,true)};
 const plans={dispatch:target(rs,'LatestDispatch','OriginalDispatch',asOf),submission:target(rs,'LatestSubmission','OriginalSubmission',asOf),approval:target(rs,'LatestApproval','OriginalApproval',asOf)};
 for(const [name,d]of Object.entries(actual))if(!['dated','missing'].includes(d.kind))add('Actual '+name+': '+d.label);
 for(const [name,d]of Object.entries(plans))if(!['dated','missing'].includes(d.kind))add('Planned '+name+': '+d.label);
 for(const [a,b]of [['dispatch','submission'],['submission','approval']])if(actual[a].kind==='dated'&&actual[b].kind==='dated'&&actual[a].value>actual[b].value)add('Actual '+a+' is later than actual '+b);
 const regIDs=vals(rs,'RegistrationID'),regEvidence=[];
 for(const rid of regIDs){const rr=model.registrations.get(rid)||[],state=scalar(rr,'RegistrationState'),rc=scalar(rr,'RegistrationCountry'),rro=vals(rr,'ROID');
  if(state.conflict){add('Registration '+rid+' has conflicting states');continue;}
  if(!['approved','conditionally approved'].includes(state.value))continue;
  if(rc.conflict||(rc.value&&country.value&&rc.value!==country.value)){add('Registration '+rid+' country does not match submission');continue;}
  if(rro.length!==1||!vals(rs,'ROID').includes(rro[0])){add('Registration '+rid+' needs RO link review');continue;}
  const ids=vals(rr,'SubID');if(ids.length!==1||ids[0]!==id){add('Registration '+rid+' has an ambiguous submission link');continue;}
  regEvidence.push(rid);
 }
 const excluded=[s.value,ro.value,app.value].some(v=>inactive.has(v));
 const linkIssue=model.groupBy==='change'&&rs.some(r=>text(r.ChangeQMS)&&text(r.EventQMS)&&norm(r.ChangeQMS)!==norm(r.EventQMS));if(linkIssue)add('Change and event QMS references do not match');
 const ambiguous=s.conflict||ro.conflict||app.conflict||country.conflict||!country.value||vals(rs,'ROID').length>1||vals(rs,'AppID').length>1||linkIssue;
 const approved=!ambiguous&&(actual.approval.kind==='dated'||approvedStates.has(ro.value)||regEvidence.length>0);
 const sent=!ambiguous&&(approved||actual.submission.kind==='dated'||submittedStates.has(s.value));
 const rejected=s.value==='rejected'||ro.value==='rejected';
 let stage='review',due=null,action='Review source data',evidence='';
 if(excluded){stage='excluded';action='Review inactive / withdrawn record';}
 else if(ambiguous){action='Resolve record links or country';}
 else if(rejected&&!approved){stage='rejected';action='Review health authority rejection';add('Health authority rejection requires follow-up');}
 else if(approved){stage='complete';action='Country approval evidence recorded';evidence=actual.approval.kind==='dated'?'Actual approval '+actual.approval.label:approvedStates.has(ro.value)?'RO state: '+ro.label:'Registration approved: '+regEvidence.join(', ');}
 else if(sent){stage='approval';due=plans.approval.value;action='Follow up authority approval';evidence=actual.submission.kind==='dated'?'Actual submission '+actual.submission.label:'Submission state: '+s.label;if(!Number.isFinite(due))add('Approval target not recorded or unusable');}
 else if(actual.submission.kind!=='missing'||actual.approval.kind!=='missing'){action='Review actual milestone dates';}
 else if(actual.dispatch.kind==='dated'||flag.value===false){stage='submission';due=plans.submission.value;action='Submit to health authority';evidence=actual.dispatch.kind==='dated'?'Internal dispatch '+actual.dispatch.label:'Dispatch explicitly not required';if(!Number.isFinite(due))add('Submission target not recorded or unusable');}
 else if(actual.dispatch.kind!=='missing'){action='Review actual dispatch date';}
 else if(flag.value===true){stage='dispatch';due=plans.dispatch.value;action='Complete internal dispatch';evidence='Dispatch required; no actual dispatch date';if(!Number.isFinite(due))add('Dispatch target not recorded or unusable');}
 else {action='Confirm dispatch requirement';add('Dispatch required: '+flag.label);}
 const overdue=Number.isFinite(due)&&due<asOf,daysLate=overdue?Math.round((asOf-due)/DAY):0;
 return {id,rows:rs,state:s.label,roState:ro.label,appState:app.label,country:country.value,countryLabel:country.label,flag,actual,plans,stage,due,overdue,daysLate,action,evidence,issues,excluded,approved,sent,regEvidence};
}
function makeCountry(name){return {key:norm(name)||'?',name:text(name)||'Country not recorded',requirements:[],submissions:[],roItems:[],roIDs:[],rows:[],issues:[],pending:false};}
function roWithoutSubmission(id,rows,model){
 const ro=scalar(rows,'ROStatus'),app=scalar(rows,'AppStatus'),country=scalar(rows,'Country'),issues=[];
 if(ro.conflict||app.conflict||country.conflict||!country.value||vals(rows,'AppID').length!==1)issues.push('RO country, application link or state needs review');
 const excluded=inactive.has(ro.value)||inactive.has(app.value),approved=!excluded&&!issues.length&&approvedStates.has(ro.value);
 if(!approved&&!excluded)issues.push('No linked submission delivered for RO '+id);
 return {id,approved,excluded,sent:approved,stage:excluded?'excluded':approved?'complete':'review',action:excluded?'Inactive / withdrawn RO':approved?'Country approval evidence recorded':'Review RO without a linked submission',evidence:approved?'RO state: '+ro.label:'RO '+id,issues,overdue:false,daysLate:0,due:null};
}
function finishCountry(c,change,model){
 const allSubs=[...c.submissions,...c.roItems];let usable=allSubs.filter(s=>!s.excluded);
 c.excluded=allSubs.length>0&&!usable.length;
 c.pending=c.requirements.some(e=>e.hasExpected&&!e.returned&&!e.issue);
 if(c.pending)usable=usable.filter(s=>!c.roItems.includes(s)||s.stage!=='review'||s.issues.some(i=>!i.startsWith('No linked submission delivered')));
 for(const e of c.requirements)if(e.issue)c.issues.push(e.issue);
 if(c.key==='?')c.issues.push('Country not recorded');
 if(!usable.length&&!c.pending&&!c.excluded)c.issues.push('No linked submission delivered for this country');
 const pending=c.requirements.filter(e=>e.hasExpected&&!e.returned&&!e.issue).map(e=>({...e,due:dateField(e.records,'ChangeResponseDue',model.asOf)}));
 if(pending.some(e=>e.due.kind!=='dated'))c.issues.push('Assessment response due date missing or unusable');
 if(c.pending&&usable.some(s=>s.sent||s.approved))c.issues.push('Submission evidence exists but expected assessment response is missing');
 c.complete=usable.length>0&&usable.every(s=>s.approved)&&!c.pending&&!c.issues.length&&!usable.some(s=>s.issues.length);
 c.candidates=usable.map(s=>({stage:s.stage,due:s.due,action:s.action,overdue:s.overdue,daysLate:s.daysLate,issues:s.issues,...(c.roItems.includes(s)?{ro:s}:{sub:s}),evidence:s.evidence}));
 for(const e of pending)c.candidates.push({stage:'assessment',due:e.due.value,action:'Follow up assessment response',overdue:e.due.value!==null&&e.due.value<model.asOf,daysLate:e.due.value!==null?Math.max(0,Math.round((model.asOf-e.due.value)/DAY)):0,issues:[],evidence:'Expected response '+(e.expectedID||e.country)+' for '+e.change+' has not been matched'});
 if(c.issues.length)c.candidates.push({stage:'review',due:null,action:c.issues[0],overdue:false,daysLate:0,issues:c.issues,evidence:''});
 if(!c.candidates.length)c.candidates.push({stage:c.excluded?'excluded':'review',due:null,action:c.excluded?'Inactive / withdrawn work':'Review source links',issues:c.issues,overdue:false,daysLate:0});
 c.issues=unique([...c.issues,...usable.flatMap(s=>s.issues)]);
 c.attention=c.issues.length>0||c.candidates.some(x=>x.overdue||x.stage==='rejected');
 c.requirementIDs=unique(c.requirements.map(e=>e.expectedID));return c;
}
export function analyze(rows,options={}){
 const groupBy=GROUPINGS[options.groupBy]?options.groupBy:'change',grouping=GROUPINGS[groupBy];
 const asOf=options.asOf??previousDay(),mapped=new Set(options.mappedFields||roles),model={asOf,mapped,rows,groupBy,grouping,missing:[],changes:[],submissions:new Map(),registrations:group(rows,'RegistrationID')};
 for(const [id,rs]of group(rows,'SubID'))model.submissions.set(id,submission(id,rs,model));
 const roGroups=group(rows,'ROID');
 for(const [id,rs]of group(rows,grouping.field)){
  const status=scalar(rs,grouping.state),change={id,groupBy,grouping,rows:rs,status:status.label,statusKey:status.value,closed:['completed','closed','canceled','cancelled','closed state','cancelled state','inactive state','inactive','archived','withdrawn'].includes(status.value),issues:[],countries:[],project:vals(rs,'ChangeProjectID'),qms:vals(rs,groupBy==='change'?'ChangeQMS':'EventQMS'),products:vals(rs,'Product'),sites:unique([...vals(rs,'Manufacturer'),...vals(rs,'RegistrationManufacturingSite')]),units:vals(rs,'BusinessUnit'),implementation:dateField(rs,'ChangePlannedImplementation',asOf),created:dateField(rs,grouping.created,asOf)};
  if(status.conflict)change.issues.push('Conflicting '+grouping.singular+' states');
  const countries=new Map(),get=name=>{const k=norm(name)||'?';if(!countries.has(k))countries.set(k,makeCountry(name));return countries.get(k);};
  for(const [sid,subRows] of group(rs,'SubID')){const sub=model.submissions.get(sid),c=get(sub.country?sub.countryLabel:'');c.submissions.push(sub);c.rows.push(...subRows);}
  for(const [rid,rr]of group(rs,'ROID')){const country=scalar(rr,'Country'),c=get(country.conflict?'':country.label==='Not recorded'?'':country.label);c.roIDs.push(rid);if(!vals(rr,'SubID').length)c.roItems.push(roWithoutSubmission(rid,roGroups.get(rid),model));}
  for(const r of rs)if(!text(r.SubID)){const name=groupBy==='change'?text(r.ExpectedResponseCountry)||text(r.AssessmentCountry)||text(r.Country)||text(r.RegistrationCountry):text(r.Country);get(name).rows.push(r);}
  for(const e0 of responses.resolve(rs)){const e={...e0};if(groupBy!=='change'&&!countries.has(e.countryKey))continue;const responseCountries=unique(e.responses.map(r=>norm(r.AssessmentCountry)).filter(Boolean));if(e.returned&&responseCountries.some(n=>n!==e.countryKey)){e.issue='Response country conflicts with expected country';e.returned=false;}const c=get(e.countryKey?e.country:'');c.requirements.push(e);}
  if(!countries.size)get('');
  const expectedCount=scalar(rs,'ChangeResponseCount');const n=Number(expectedCount.value);
  if(expectedCount.conflict||expectedCount.value&&(!Number.isInteger(n)||n<0))change.issues.push('Invalid / conflicting source response count');
  change.countries=[...countries.values()].map(c=>finishCountry(c,change,model));
  if(change.closed&&change.countries.some(c=>!c.complete&&!c.excluded))change.issues.push('Source '+grouping.singular+' is closed / inactive but linked country work is incomplete');
  model.changes.push(change);
 }
 model.missing=rows.filter(r=>!text(r[grouping.field]));
 model.coverage=recordCounts(rows);
 model.missingApplications=vals(model.missing,'AppID').length;
 model.options={sites:unique(model.changes.flatMap(c=>c.sites)).sort(),products:unique(model.changes.flatMap(c=>c.products)).sort(),units:unique(model.changes.flatMap(c=>c.units)).sort(),countries:unique(model.changes.flatMap(c=>c.countries.map(x=>x.name))).sort(),statuses:unique(model.changes.map(c=>c.status)).sort()};return model;
}
export const queueDefinitions=[['assessment','Awaiting assessment'],['dispatch','Overdue internal dispatch'],['submission','Overdue authority submission'],['approval','Awaiting approval']];
export const mainColumns=[
 {key:'record',value:c=>c.id,search:c=>[c.id,...c.products,...c.sites,c.status,...c.project,...c.qms].join(' ')},
 {key:'progress',value:c=>c.total?c.done/c.total:null,search:c=>`${c.done}/${c.total} ${c.done} / ${c.total} ${c.countries.map(x=>x.name).join(' ')}`},
 {key:'due',value:c=>c.next?.due??null,search:c=>c.next?.due!=null?formatDate(c.next.due)+(c.next.overdue?' overdue '+c.next.daysLate+' days':' upcoming'):'Not recorded'},
 {key:'action',value:c=>c.next?.action||'',search:c=>[c.next?.action,c.next?.country,...c.issues].join(' ')}
];
function queueMatch(c,q){if(q==='assessment')return c.pending&&!c.excluded;return c.candidates.some(x=>x.stage===q&&(['dispatch','submission'].includes(q)?x.overdue:true));}
export function derive(model,state={}){
 state={...DEFAULT_STATE,...state};
 const matched=model.changes.filter(c=>(state.status==='all'||c.status===state.status)&&c.rows.some(r=>(state.site==='all'||[text(r.Manufacturer),text(r.RegistrationManufacturingSite)].includes(state.site))&&(state.product==='all'||text(r.Product)===state.product)&&(state.unit==='all'||text(r.BusinessUnit)===state.unit)));
 const changes=filterRows(matched.map(c=>{
  const countries=c.countries.filter(x=>(state.country==='all'||x.name===state.country)&&(state.includeInactive||!x.excluded));
  const eligible=!c.closed||state.includeInactive,flags=Object.fromEntries(queueDefinitions.map(([k])=>[k,eligible&&countries.some(x=>queueMatch(x,k))]));
  const candidates=countries.flatMap(x=>x.candidates.map(a=>({...a,country:x.name,countryKey:x.key}))).filter(a=>state.queue==='all'||a.stage===state.queue);
  candidates.sort((a,b)=>dueOrder(a,b,state.sort==='due'?state.direction:'desc'));
  const next=candidates.find(x=>!['complete','excluded'].includes(x.stage))||candidates[0]||null;
  const attention=c.issues.length>0||countries.some(x=>x.attention),done=countries.filter(x=>x.complete).length;
  return {...c,countries,flags,next,attention,done,total:countries.length,scopeNote:'Country progress for the matching '+model.grouping.singular};
 }).filter(c=>c.total>0),mainColumns,state.columnFilters);
 const counts=Object.fromEntries(queueDefinitions.map(([k])=>[k,changes.filter(c=>c.flags[k]).length]));
 const shown=changes.filter(c=>(state.view==='all'||c.attention)&&(state.queue==='all'||c.flags[state.queue]));
 const column=mainColumns.find(c=>c.key===state.sort)||mainColumns[2];
 shown.sort((a,b)=>(state.sort==='due'?dueOrder(a.next||{due:null},b.next||{due:null},state.direction):compare(column.value(a),column.value(b),state.direction))||a.id.localeCompare(b.id));
 const countRows=shown.flatMap(c=>{const countryKeys=new Set(c.countries.map(x=>x.key));return c.rows.filter(r=>countryKeys.has(norm(r.Country)||(model.groupBy==='change'?norm(r.ExpectedResponseCountry)||norm(r.AssessmentCountry)||norm(r.RegistrationCountry):'')||'?')&&(state.includeInactive||![r.SubStatus,r.ROStatus,r.AppStatus].some(s=>inactive.has(norm(s)))));});
 return {changes,shown,counts,attention:changes.filter(c=>c.attention).length,active:changes.filter(c=>!c.closed).length,closed:changes.filter(c=>c.closed).length,visibleCoverage:recordCounts(countRows),missing:model.missing,options:model.options,state};
}
const csvCell=v=>'"'+(/^[=+@\-\t\r]/.test(text(v))?"'":'')+String(v??'').replaceAll('"','""')+'"';
export function toCsv(changes,groupBy=changes[0]?.groupBy||'change'){const grouping=GROUPINGS[groupBy]||GROUPINGS.change,header=[groupBy==='change'?'Change ID':grouping.label+' ID',grouping.label+' state','Country','Stage','Next action','Due date','Days overdue','Submission ID','Submission state','RO ID','Evidence','Review notes'];const lines=[header];for(const c of changes)for(const co of c.countries)for(const a of co.candidates)lines.push([c.id,c.status,co.name,a.stage,a.action,a.due===null?'':formatDate(a.due),a.daysLate,a.sub?.id||'',a.sub?.state||'',a.ro?.id||'',a.evidence||'',[...c.issues,...co.issues].join('; ')]);return lines.map(r=>r.map(csvCell).join(',')).join('\r\n');}
