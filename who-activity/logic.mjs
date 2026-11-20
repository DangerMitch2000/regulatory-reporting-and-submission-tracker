// Historical WHO activity: a submission belongs to SubID; an approval belongs to ROID.
// Resolve identity dates before local filters, and allocate each activity only once.
export const DEFAULT_SITES = Object.freeze(['ABO', 'ADJ', 'ADK', 'AJG', 'ARDG', 'Abbott Diagnostics Scarborough, Inc.']);
export const ROLES = Object.freeze(['SubID', 'ROID', 'AppID', 'RegistrationID', 'Site', 'BusinessUnit', 'CommercialRegion', 'Product', 'SubmissionType', 'ActualSubmission', 'ActualApproval', 'AsOfDate', 'SubmissionURL', 'RegulatoryObjectiveURL', 'RegistrationURL', 'AppStatus', 'ROStatus', 'SubStatus', 'OriginalSubmission', 'LatestSubmission', 'OriginalApproval', 'LatestApproval', 'Country']);
export const REQUIRED = Object.freeze(['CommercialRegion', 'Site']);
export const STATE_ROLES = Object.freeze(['AppStatus', 'ROStatus', 'SubStatus']);
const STATE_IDS = Object.freeze({AppStatus:'AppID', ROStatus:'ROID', SubStatus:'SubID'});
const STATE_LABELS = Object.freeze({AppStatus:'Application state', ROStatus:'RO state', SubStatus:'Submission state'});
const DATE_BASES = Object.freeze({
  actual:{label:'Actual',submissions:'ActualSubmission',approvals:'ActualApproval'},
  initial:{label:'Initial plan',submissions:'OriginalSubmission',approvals:'OriginalApproval'},
  lbe:{label:'LBE plan',submissions:'LatestSubmission',approvals:'LatestApproval'}
});
export const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const norm = value => clean(value).toLocaleLowerCase('en-GB');
const DAY = 86400000;
const WHO_VALUES = new Set(['who', 'who (multi-country)', 'world health organization', 'world health organization (who)']);
export const isWHO = value => WHO_VALUES.has(norm(value));
const unique = values => [...new Set(values.map(clean).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'en-GB', {numeric:true}));
const uniqueLabels = values => [...new Map(values.map(clean).map(value => [norm(value), value])).values()].sort((a,b) => a.localeCompare(b, 'en-GB', {numeric:true}));

export function parseDay(value) {
  if (value == null || clean(value) === '') return {kind:'blank'};
  let y, m, d;
  if (value instanceof Date) {
    if (!Number.isFinite(+value)) return {kind:'invalid'};
    [y,m,d] = [value.getUTCFullYear(), value.getUTCMonth()+1, value.getUTCDate()];
  } else {
    const text=clean(value), iso=text.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/), local=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
    if (!iso && !local) return {kind:'invalid'};
    const match=iso||local;
    [y,m,d]=iso?match.slice(1,4).map(Number):[Number(match[3]),Number(match[2]),Number(match[1])];
    if (match[4]) {
      const time=match[4].match(/^[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/);
      if(!time || Number(time[1])>23 || Number(time[2])>59 || Number(time[3]||0)>59) return {kind:'invalid'};
      if(time[5] && time[5]!=='Z') {
        const offset=time[5].replace(':','');
        if(Number(offset.slice(1,3))>23 || Number(offset.slice(3))>59) return {kind:'invalid'};
      }
    }
  }
  const check=new Date(0); check.setUTCFullYear(y,m-1,d); check.setUTCHours(0,0,0,0);
  return y>=1900 && y<=2100 && check.getUTCFullYear()===y && check.getUTCMonth()===m-1 && check.getUTCDate()===d
    ? {kind:'date',day:+check} : {kind:'invalid'};
}

export function resolveDate(values, mapped=true, label='actual') {
  if (!mapped) return {kind:'unmapped'};
  const parsed=values.map(parseDay), days=[...new Set(parsed.filter(value=>value.kind==='date').map(value=>value.day))];
  if (parsed.some(value=>value.kind==='invalid')) return {kind:'issue',reason:'Invalid / outside 1900–2100'};
  if (days.length>1) return {kind:'issue',reason:`Conflicting ${label} dates`};
  return days.length ? {kind:'date',day:days[0]} : {kind:'blank'};
}

export function formatDate(value) {
  if (value && typeof value==='object') {
    if (value.kind==='date') value=value.day;
    else if (value.kind==='multiple') return `${value.days.length} dates`;
    else return value.kind==='issue' ? value.reason : value.kind==='unmapped' ? 'Field not mapped' : 'Not recorded';
  }
  if(!Number.isFinite(value)) return 'Not recorded';
  const date=new Date(value),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(date.getUTCDate()).padStart(2,'0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function validNow(now) { const result=now instanceof Date ? now : now==null ? new Date() : new Date(now); return Number.isFinite(+result)?result:new Date(); }
export function defaultState(now) {
  const year=validNow(now).getFullYear();
  return {sites:[...DEFAULT_SITES,''],unit:'ID',product:'*',region:'*',country:'*',submissionType:'*',whoValue:'@who',approvalBasis:'ro',dateBasis:'actual',stateFilters:Object.fromEntries(STATE_ROLES.map(role=>[role,'*'])),groupBy:'site',years:[year-1,year],theme:'dark',capture:false};
}
export function normalizeState(saved={},now) {
  const defaults=defaultState(now), state=saved&&typeof saved==='object'?saved:{};
  const years=Array.isArray(state.years)?[...new Set(state.years.map(Number).filter(year=>Number.isInteger(year)&&year>=1900&&year<=2100))].sort((a,b)=>a-b):[];
  return {...defaults,...state,
    sites:state.sites==='*'?'*':Array.isArray(state.sites)?uniqueLabels(state.sites.filter(value=>typeof value==='string')):defaults.sites,
    ...Object.fromEntries(['unit','product','region','country','submissionType','whoValue'].map(key=>[key,typeof state[key]==='string'?clean(state[key]):defaults[key]])),
    dateBasis:Object.hasOwn(DATE_BASES,state.dateBasis)?state.dateBasis:'actual',
    stateFilters:Object.fromEntries(STATE_ROLES.map(role=>[role,Array.isArray(state.stateFilters?.[role])?uniqueLabels(state.stateFilters[role].filter(value=>typeof value==='string')):'*'])),
    years:years.length===2?years:defaults.years, approvalBasis:'ro', groupBy:state.groupBy==='region'?'region':'site',
    theme:state.theme==='light'?'light':'dark', capture:state.capture===true};
}

export function mapTable(table) {
  const columns=Array.isArray(table?.columns)?table.columns:[], mapped={}, labels={}, indices={};
  for (const role of ROLES) {
    const matches=columns.map((column,index)=>column?.roles?.[role]?index:-1).filter(index=>index>=0);
    if(matches.length>1) throw new Error(`Map only one field to ${role}.`);
    mapped[role]=matches.length===1; indices[role]=matches[0]??-1;
    labels[role]=mapped[role]?clean(columns[indices[role]].displayName||columns[indices[role]].queryName||role):'';
  }
  return {rows:(Array.isArray(table?.rows)?table.rows:[]).map(values=>Object.fromEntries(ROLES.map(role=>[role,mapped[role]?values[indices[role]]:null]))),missing:REQUIRED.filter(role=>!mapped[role]),mapped,labels};
}

function allocation(rows,role,dimension) {
  const values=uniqueLabels(rows.map(row=>row[role])).filter(Boolean);
  if(!values.length) return {key:`${dimension}:blank`,label:dimension==='site'?'Unassigned site':'Not recorded',values:[],kind:'blank'};
  if(values.length>1) return {key:`${dimension}:multiple`,label:`Multiple ${dimension==='site'?'sites':'regions'} — review`,values,kind:'multiple'};
  return {key:`${dimension}:value:${encodeURIComponent(norm(values[0]))}`,label:values[0],values,kind:'value'};
}
function safeURL(rows,role) {
  const urls=unique(rows.map(row=>row[role]));
  if(urls.length!==1) return '';
  try { const url=new URL(urls[0]); return url.protocol==='https:' && !url.username && !url.password?url.href:''; } catch { return ''; }
}
function companionSubmissionDates(rows,mapped) {
  if(!mapped.ActualSubmission) return {kind:'unmapped'};
  const parsed=rows.map(row=>parseDay(row.ActualSubmission));
  const days=[...new Set(parsed.filter(value=>value.kind==='date').map(value=>value.day))].sort((a,b)=>a-b);
  if(days.length>1) return {kind:'multiple',days,reason:'Multiple linked submission dates'};
  return resolveDate(rows.map(row=>row.ActualSubmission));
}
const predicateValue=(row,role,value,mapped)=>!mapped[role] || value==='*' || norm(row[role])===norm(value);

// States belong to their own IDs, not to a flattened join row. A blank repeat
// cannot hide a known state, and different child states are not parent conflicts.
function stateIndex(rows,mapped) {
  const indices=Object.fromEntries(STATE_ROLES.map(role=>[role,new Map()]));
  for(const role of STATE_ROLES) {
    if(!mapped[role]) continue;
    for(const row of rows) {
      const id=clean(row[STATE_IDS[role]]);
      if(!id) continue;
      if(!indices[role].has(id)) indices[role].set(id,new Map());
      const value=clean(row[role]);
      if(value) indices[role].get(id).set(norm(value),value);
    }
    for(const [id,values] of indices[role]) indices[role].set(id,{id,values:uniqueLabels([...values.values()])});
  }
  const record=(row,role)=>indices[role].get(clean(row[STATE_IDS[role]]))||{id:'',values:clean(row[role])?[clean(row[role])]:[]};
  const matches=(row,role,selection)=>{
    if(!mapped[role]||selection==='*') return true;
    const values=record(row,role).values;
    return selection.some(selected=>selected===''?!values.length:values.some(value=>norm(value)===norm(selected)));
  };
  const aggregate=(identityRows,role)=>{
    if(!mapped[role]) return {kind:'unmapped',values:[],label:'Field not mapped',records:[]};
    const records=[...new Map(identityRows.map(row=>{
      const item=record(row,role);
      // Anonymous states remain evidence from that row, never a fabricated ID.
      return [item.id?`id:${item.id}`:`anonymous:${item.values.map(norm).join('|')}`,item];
    })).values()];
    const values=uniqueLabels(records.flatMap(item=>item.values)),conflicting=records.some(item=>item.id&&item.values.length>1),hasBlank=records.some(item=>!item.values.length);
    const kind=conflicting?'issue':values.length>1||(values.length&&hasBlank)?'multiple':values.length?'value':'blank';
    const labels=[...values,...(hasBlank?['Not recorded']:[])];
    return {kind,values,label:conflicting?`Conflicting states: ${labels.join(' / ')}`:labels.join(' · ')||'Not recorded',records};
  };
  return {matches,aggregate};
}

function rawDates(rows,role) {
  return unique(rows.map(row=>row[role] instanceof Date?Number.isFinite(+row[role])?row[role].toISOString():'Invalid Date':row[role]));
}

export function summarize(inputRows,options={}) {
  const rows=Array.isArray(inputRows)?inputRows:[], now=validNow(options.now), state=normalizeState(options,now);
  const mapped=Object.fromEntries(ROLES.map(role=>[role,options.mapped instanceof Set?options.mapped.has(role):Array.isArray(options.mapped)?options.mapped.includes(role):options.mapped&&Object.hasOwn(options.mapped,role)?options.mapped[role]===true:rows.some(row=>Object.hasOwn(row,role))]));
  const notices=[],issues=[],events=[],issueKeys=new Map(), years=state.years;
  const dateBasis=state.dateBasis,dateBasisLabel=DATE_BASES[dateBasis].label;
  const basisDateRoles={submissions:DATE_BASES[dateBasis].submissions,approvals:DATE_BASES[dateBasis].approvals};
  const resolvedStates=stateIndex(rows,mapped);
  const addIssue=(issue,key=JSON.stringify([issue.kind,issue.metric,issue.id,issue.sourceRow]))=>{
    const existing=issueKeys.get(key);
    if(!existing){issueKeys.set(key,issue);issues.push(issue);return;}
    if(issue.sourceRows) {
      existing.sourceRows=(existing.sourceRows||0)+issue.sourceRows;
      if(existing.sourceRowExamples.length<20) existing.sourceRowExamples.push(...issue.sourceRowExamples.slice(0,20-existing.sourceRowExamples.length));
      for(const field of ['subIds','roIds','appIds','registrationIds','products','sites','regions']) existing[field]=unique([...(existing[field]||[]),...(issue[field]||[])]);
    }
  };
  const sourceReview=(row,sourceRow,kind,message,metric)=>{
    const subId=clean(row.SubID),roId=clean(row.ROID),id=subId||roId||`Source row ${sourceRow+1}`;
    const key=(subId||roId)?JSON.stringify([kind,metric,subId,roId]):JSON.stringify([kind,metric,'anonymous',sourceRow]);
    addIssue({id,kind,message,...(metric?{metric}:{}),sourceRow,sourceRows:1,sourceRowExamples:[sourceRow+1],
      subIds:unique([row.SubID]),roIds:unique([row.ROID]),appIds:unique([row.AppID]),registrationIds:unique([row.RegistrationID]),products:unique([row.Product]),sites:unique([row.Site]),regions:unique([row.CommercialRegion]),
      site:clean(row.Site)||'Unassigned site',region:clean(row.CommercialRegion)||'Not recorded',rawSite:clean(row.Site),rawCommercialRegion:clean(row.CommercialRegion)},key);
  };
  const previousDay=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-DAY;
  const suppliedAsOf=resolveDate(rows.map(row=>row.AsOfDate),mapped.AsOfDate);
  const asOf=suppliedAsOf.kind==='date'?suppliedAsOf.day:previousDay;
  const referenceSource=suppliedAsOf.kind==='date'?'Supplied extract date':'Previous-day reference (not source refresh time)';
  if(suppliedAsOf.kind==='issue') notices.push('The supplied as-of field has invalid or conflicting dates. Using yesterday as a reference, not an extract date.');
  else if(suppliedAsOf.kind==='blank'||suppliedAsOf.kind==='unmapped') notices.push('No usable extract date supplied. As of yesterday is a reference, not source refresh time.');
  const unavailableMetrics={submissions:!mapped.SubID||!mapped[basisDateRoles.submissions],approvals:!mapped.ROID||!mapped[basisDateRoles.approvals]};
  const dateLabel=metric=>`${dateBasisLabel} ${metric==='submissions'?'submission':'RO approval'} date`;
  if(unavailableMetrics.submissions) notices.push(`Submissions unavailable: map Submission ID and ${dateLabel('submissions')} (${basisDateRoles.submissions}).`);
  if(unavailableMetrics.approvals) notices.push(`Approvals unavailable: map RO ID and ${dateLabel('approvals')} (${basisDateRoles.approvals}).`);
  const scopeUnavailable=REQUIRED.some(role=>!mapped[role]);
  if(!mapped.CommercialRegion) notices.push('Map Commercial region. WHO is identified by its explicit commercial-region value; missing regions are not inferred to be WHO.');
  if(!mapped.Site) notices.push('Map the manufacturing site field before viewing activity by the six sites.');
  if(!mapped.BusinessUnit&&state.unit!=='*') notices.push('Business unit is not mapped. The ID/unit filter cannot be applied; counts include all delivered business units.');
  if(!mapped.Country&&state.country!=='*') notices.push('Country is not mapped. The country filter cannot be applied; counts include all delivered countries.');
  for(const role of STATE_ROLES) if(!mapped[role]&&state.stateFilters[role]!=='*') notices.push(`${STATE_LABELS[role]} is not mapped. Its state filter cannot be applied; counts include all delivered states.`);
  const choices={sites:uniqueLabels(rows.map(row=>row.Site)),units:uniqueLabels(rows.map(row=>row.BusinessUnit)),products:uniqueLabels(rows.map(row=>row.Product)),regions:uniqueLabels(rows.map(row=>row.CommercialRegion)),countries:uniqueLabels(rows.map(row=>row.Country)),whoValues:uniqueLabels(rows.map(row=>row.CommercialRegion)),submissionTypes:uniqueLabels(rows.map(row=>row.SubmissionType)),stateFilters:Object.fromEntries(STATE_ROLES.map(role=>[role,uniqueLabels(rows.map(row=>row[role]))])),years:[...new Set([...years,...rows.flatMap(row=>Object.values(DATE_BASES).flatMap(basis=>[row[basis.submissions],row[basis.approvals]])).map(parseDay).filter(value=>value.kind==='date').map(value=>new Date(value.day).getUTCFullYear())])].sort((a,b)=>a-b)};
  const whoMatch=row=>state.whoValue==='*'||(state.whoValue==='@who'?isWHO(row.CommercialRegion):norm(row.CommercialRegion)===norm(state.whoValue));
  const dimensionMatch=row=>predicateValue(row,'BusinessUnit',state.unit,mapped) && predicateValue(row,'Product',state.product,mapped) && predicateValue(row,'SubmissionType',state.submissionType,mapped) && predicateValue(row,'Country',state.country,mapped) && STATE_ROLES.every(role=>resolvedStates.matches(row,role,state.stateFilters[role]));
  const baseMatch=row=>whoMatch(row) && dimensionMatch(row);
  const siteMatch=(row,site)=>state.sites==='*'||state.sites.some(value=>value===''?!clean(row.Site)&&(!site||site.kind==='blank'):norm(value)===norm(row.Site));
  const regionMatch=(row,region)=>!mapped.CommercialRegion||state.region==='*'||(state.region===''?region.kind==='blank':norm(row.CommercialRegion)===norm(state.region));
  const allMatch=(row,region,site,countries)=>baseMatch(row)&&(state.whoValue!==''||region.kind==='blank')&&siteMatch(row,site)&&regionMatch(row,region)&&(!mapped.Country||state.country!==''||!countries.length);
  if(mapped.CommercialRegion && rows.length && !rows.some(whoMatch)) notices.push('No rows match the selected commercial region. Select the exact WHO region value supplied in your source.');
  if(mapped.BusinessUnit && rows.length && !rows.some(row=>predicateValue(row,'BusinessUnit',state.unit,mapped))) notices.push(`No delivered rows match business unit ${state.unit || 'Not recorded'}.`);
  if(scopeUnavailable) unavailableMetrics.submissions=unavailableMetrics.approvals=true;

  if(!scopeUnavailable) {
    // Missing IDs are source rows, never made-up distinct records. Approval ownership
    // is independent, so a missing submission ID does not remove a valid RO approval.
    rows.forEach((row,sourceRow)=>{
      // Blank regions cannot establish WHO membership. Keep their source rows
      // reviewable even while the default WHO-only totals exclude them.
      if(!clean(row.CommercialRegion) && !whoMatch(row) && dimensionMatch(row) && siteMatch(row)) sourceReview(row,sourceRow,'unclassifiedRegion','Commercial region not recorded. WHO membership is unknown, so this source row is excluded from the selected region totals.');
      if(!clean(row.Site)&&dimensionMatch(row)&&(whoMatch(row)||!clean(row.CommercialRegion))) sourceReview(row,sourceRow,'missingSite','Manufacturing site is blank on this source row. A recorded site on the same identity is retained where available; otherwise activity uses Unassigned site. No site is inferred.');
      if(!baseMatch(row)) return;
      const region=allocation([row],'CommercialRegion','region');
      if(!regionMatch(row,region)) return;
      if(!siteMatch(row)) return;
      if(mapped.SubID&&!clean(row.SubID)) sourceReview(row,sourceRow,'missingID','Submission ID not recorded. This source row cannot identify a distinct submission.','submissions');
      if(mapped.ROID&&!clean(row.ROID)) sourceReview(row,sourceRow,'missingID','RO ID not recorded. This source row cannot identify a distinct RO approval.','approvals');
    });
    for(const metric of ['submissions','approvals']) {
      if(unavailableMetrics[metric]) continue;
      const idRole=metric==='submissions'?'SubID':'ROID',dateRole=basisDateRoles[metric], byID=new Map();
      for(const row of rows) { const id=clean(row[idRole]); if(id){if(!byID.has(id))byID.set(id,[]);byID.get(id).push(row);} }
      for(const [id,identityRows] of byID) {
        const dates=Object.fromEntries(Object.entries(DATE_BASES).map(([basis,roles])=>[basis,resolveDate(identityRows.map(row=>row[roles[metric]]),mapped[roles[metric]],basis==='actual'?'actual':roles.label.toLowerCase())]));
        const date=dates[dateBasis];
        const site=allocation(identityRows,'Site','site'), region=allocation(identityRows,'CommercialRegion','region');
        const countries=uniqueLabels(identityRows.map(row=>row.Country)).filter(Boolean);
        // All scope dimensions must coexist in a delivered row. Identity dates and
        // allocation still use all joins, so filtering cannot conceal conflicts.
        if(!identityRows.some(row=>allMatch(row,region,site,countries))) continue;
        const states=Object.fromEntries(STATE_ROLES.map(role=>[role,resolvedStates.aggregate(identityRows,role)]));
        const metadata={id,metric,subIds:unique(identityRows.map(row=>row.SubID)),roIds:unique(identityRows.map(row=>row.ROID)),appIds:unique(identityRows.map(row=>row.AppID)),registrationIds:unique(identityRows.map(row=>row.RegistrationID)),products:unique(identityRows.map(row=>row.Product)),site:site.label,region:region.label,sites:site.values,regions:region.values,countries,country:countries.join(' · ')||'Not recorded'};
        if(site.kind==='multiple') addIssue({...metadata,kind:'multipleSites',message:'This record has multiple manufacturing sites. It is counted once in Multiple sites — review, not once per site.'});
        if(region.kind==='multiple') addIssue({...metadata,kind:'multipleRegions',message:'This record has multiple commercial regions. It is counted once in Multiple regions — review, not once per region.'});
        if(region.kind==='blank'&&mapped.CommercialRegion) addIssue({...metadata,kind:'missingRegion',message:'Commercial region not recorded. The record remains included.'});
        for(const role of STATE_ROLES) for(const record of states[role].records) if(record.id&&record.values.length>1) {
          addIssue({...metadata,id:record.id,kind:'conflictingState',field:role,rawValues:record.values,rawValueCount:record.values.length,message:`Conflicting ${STATE_LABELS[role].toLowerCase()} values for the same ${STATE_IDS[role]}. Date-based activity remains counted; review the source state.`},JSON.stringify(['conflictingState',role,record.id]));
        }
        for(const basis of ['initial','lbe']) if(basis!==dateBasis&&dates[basis].kind==='issue') {
          const field=DATE_BASES[basis][metric],rawValues=rawDates(identityRows,field);
          addIssue({...metadata,kind:'invalidPlanDate',field,rawValues:rawValues.slice(0,20),rawValueCount:rawValues.length,message:`${dates[basis].reason}: ${DATE_BASES[basis].label.toLowerCase()} ${metric==='submissions'?'submission':'RO approval'} date. This does not change the selected ${dateBasisLabel.toLowerCase()} count.`},JSON.stringify(['invalidPlanDate',metric,id,field]));
        }
        if(date.kind!=='date') {
          const rawValues=rawDates(identityRows,dateRole);
          addIssue({...metadata,kind:date.kind==='issue'?'invalidDate':'missingDate',rawValues:rawValues.slice(0,20),rawValueCount:rawValues.length,field:dateRole,message:date.kind==='issue'?`${date.reason}: ${dateLabel(metric).toLowerCase()}. Excluded from this metric.`:`${dateLabel(metric)} not recorded; year cannot be assigned. No other date basis is substituted.`});
          continue;
        }
        if(dateBasis==='actual'&&date.day>asOf) {addIssue({...metadata,kind:'futureDate',date:date.day,message:'Actual date is after the as-of reference. Excluded from this metric.'});continue;}
        const year=new Date(date.day).getUTCFullYear();
        if(!years.includes(year)) continue;
        const group=state.groupBy==='region'?region:site;
        events.push({...metadata,key:`${metric}:${encodeURIComponent(id)}`,date:date.day,year,dateBasis,initialDate:dates.initial,lbeDate:dates.lbe,actualDate:dates.actual,states,groupKey:group.key,groupLabel:group.label,siteKey:site.key,regionKey:region.key,submissionDate:metric==='submissions'?dates.actual:companionSubmissionDates(identityRows,mapped),approvalDate:metric==='approvals'?dates.actual:resolveDate(identityRows.map(row=>row.ActualApproval),mapped.ActualApproval),url:safeURL(identityRows,metric==='submissions'?'SubmissionURL':'RegulatoryObjectiveURL'),source:'Velocity'});
      }
    }
  }
  const totals={submissions:[0,0],approvals:[0,0]},groupsByKey=new Map();
  for(const event of events) {
    const yearIndex=years.indexOf(event.year); totals[event.metric][yearIndex]++;
    if(!groupsByKey.has(event.groupKey)) groupsByKey.set(event.groupKey,{key:event.groupKey,label:event.groupLabel,submissions:[0,0],approvals:[0,0]});
    groupsByKey.get(event.groupKey)[event.metric][yearIndex]++;
  }
  const defaultOrder=DEFAULT_SITES.map(norm), rank=group=>state.groupBy==='site'&&defaultOrder.includes(norm(group.label))?defaultOrder.indexOf(norm(group.label)):group.key.endsWith(':blank')?10001:group.key.endsWith(':multiple')?10002:1000;
  const groups=[...groupsByKey.values()].sort((a,b)=>rank(a)-rank(b)||a.label.localeCompare(b.label,'en-GB',{numeric:true}));
  events.sort((a,b)=>b.date-a.date||a.metric.localeCompare(b.metric)||a.id.localeCompare(b.id,'en-GB',{numeric:true}));
  const activeSites=uniqueLabels(events.flatMap(event=>event.sites));
  const unassignedSiteActivity={submissions:[0,0],approvals:[0,0]};
  for(const event of events) if(event.siteKey==='site:blank') unassignedSiteActivity[event.metric][years.indexOf(event.year)]++;
  const scopeLabel=state.whoValue==='@who'?'WHO':state.whoValue==='*'?'All commercial regions':state.whoValue||'Commercial region not recorded';
  const approvalBasisLabel=dateBasis==='actual'?'Distinct ROs with actual approval dates':`Distinct ROs with ${dateBasisLabel.toLowerCase()} approval dates`;
  return {years,asOf,asOfLabel:formatDate(asOf),referenceSource,dateBasis,dateBasisLabel,basisDateRoles,totals,groups,events,issues,choices,notices,unavailableMetrics,scopeUnavailable,mapped,scopeLabel,visibleSites:activeSites.filter(site=>defaultOrder.includes(norm(site))).length,visibleSiteLabels:activeSites,unassignedSiteActivity,totalDefaultSites:DEFAULT_SITES.length,approvalBasisLabel,source:'Velocity',sourceRowCount:rows.length,state};
}
