export const DEFAULT_SITES = ['ABO', 'ADJ', 'ADK', 'AJG', 'ARDG', 'SCR'];
export const STATE_FIELDS = [{role:'SubStatus',label:'Submission state'}, {role:'ROStatus',label:'RO state'}, {role:'AppStatus',label:'Application state'}];
export const DISPATCH_ROLES = ['DispatchRequired', 'PlannedDispatch', 'ActualDispatch'];
export const REGISTRATION_ROLES = ['RegistrationID', 'RegistrationCountry', 'RegistrationStatus', 'RegistrationStart', 'RegistrationEnd'];
export const REGISTRATION_COMPLETE_STATES = ['Approved', 'Conditionally Approved'];
export const ROLES = ['SubID', 'Site', 'PlannedSubmission', 'ActualSubmission', 'BusinessUnit', ...STATE_FIELDS.map(f=>f.role), ...DISPATCH_ROLES, ...REGISTRATION_ROLES, 'FallbackCountry'];
export const REQUIRED = ROLES.slice(0, 4);
export const clean = value => String(value ?? '').trim();
export const siteKey = value => clean(value).toLocaleUpperCase('en-GB');
export function normalizeStateFilters(filters = {}) {
  return Object.fromEntries(STATE_FIELDS.map(({role}) => [role, Array.isArray(filters?.[role]) ? [...new Set(filters[role].filter(v=>typeof v==='string').map(clean))] : null]));
}
export const stateLabel = value => value || 'Not recorded';
export function formatStates(values) {
  if (!values) return 'Not mapped';
  return (values.length > 1 ? 'Multiple: ' : '') + values.map(stateLabel).join(' / ');
}
// Use all delivered state evidence for a submission, before local filter selections.
const hasState = (states, role, value) => Boolean(states[role]?.some(state => clean(state).replace(/\s+/g, ' ').toLocaleLowerCase('en-GB') === value));
export const SUBMITTED_STATES = ['Completed', 'HA Received', 'Sent To Health Authority', 'Rejected'];
export const submittedStateEvidence = states => SUBMITTED_STATES.filter(label => hasState(states, 'SubStatus', label.toLocaleLowerCase('en-GB')));
export function parseDay(value) {
  if (value == null || clean(value) === '') return {kind: 'blank'};
  let y, m, d;
  if (value instanceof Date) {
    if (!Number.isFinite(+value)) return {kind: 'invalid'};
    [y, m, d] = [value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()];
  } else {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (!match || (clean(value).includes('T') && !Number.isFinite(Date.parse(value)))) return {kind: 'invalid'};
    [y, m, d] = match.slice(1).map(Number);
  }
  const day = Date.UTC(y, m - 1, d), check = new Date(day);
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
    ? {kind: 'date', day} : {kind: 'invalid'};
}
export function resolveDate(values) {
  const parsed = values.map(parseDay), days = [...new Set(parsed.filter(x => x.kind === 'date').map(x => x.day))];
  if (parsed.some(x => x.kind === 'invalid')) return {kind: 'issue', reason: 'Invalid date'};
  if (days.length > 1) return {kind: 'issue', reason: 'Conflicting dates'};
  return days.length ? {kind: 'date', day: days[0]} : {kind: 'blank'};
}
// Keep each delivered registration's fields together: never borrow an ID, state or
// country from another joined row. Repeated joins must not inflate submissions.
export function registrationEvidence(rows, mapped = Object.fromEntries(REGISTRATION_ROLES.map(role=>[role,true]))) {
  const distinct = new Map();
  for (const row of rows) {
    const values = Object.fromEntries(REGISTRATION_ROLES.map(role=>[role,mapped[role] ? row[role] : null]));
    if (!Object.values(values).some(value=>clean(value))) continue;
    const key = JSON.stringify(REGISTRATION_ROLES.map(role=>values[role] instanceof Date && Number.isFinite(+values[role]) ? values[role].toISOString() : clean(values[role])));
    if (distinct.has(key)) continue;
    const id=clean(values.RegistrationID), country=clean(values.RegistrationCountry), state=clean(values.RegistrationStatus);
    const start=mapped.RegistrationStart?resolveDate([values.RegistrationStart]):{kind:'unmapped'}, end=mapped.RegistrationEnd?resolveDate([values.RegistrationEnd]):{kind:'unmapped'};
    const complete=Boolean(id && REGISTRATION_COMPLETE_STATES.some(value=>value.toLowerCase()===state.toLowerCase().replace(/\s+/g,' ')));
    const notes=[];
    if(start.kind==='issue')notes.push(`${start.reason}: registration start`);
    if(end.kind==='issue')notes.push(`${end.reason}: registration end`);
    if(start.kind==='date'&&end.kind==='date'&&end.day<start.day)notes.push('Registration end date is before its start date');
    if(!id && state)notes.push('Registration ID not recorded; state alone cannot identify the linked registration');
    distinct.set(key,{id,country,state,start,end,complete,notes,rawStart:clean(values.RegistrationStart),rawEnd:clean(values.RegistrationEnd)});
  }
  const records=[...distinct.values()].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})||a.country.localeCompare(b.country)||a.state.localeCompare(b.state)||a.rawStart.localeCompare(b.rawStart)||a.rawEnd.localeCompare(b.rawEnd));
  return {records, qualifying:records.filter(record=>record.complete), notes:[...new Set(records.flatMap(record=>record.notes.map(note=>`${record.id||'Registration without ID'}: ${note}`)))]};
}
export function resolveCountry(rows, registration, fallbackMapped = true) {
  const distinct=values=>[...new Map(values.map(clean).filter(Boolean).map(value=>[value.toLocaleLowerCase('en-GB'),value])).values()].sort((a,b)=>a.localeCompare(b));
  const primary=distinct(registration.records.map(record=>record.country));
  if(primary.length)return {values:primary,source:'Registration country'};
  const secondary=fallbackMapped?distinct(rows.map(row=>row.FallbackCountry)):[];
  return {values:secondary,source:secondary.length?'Secondary country':'Not recorded'};
}
export function resolveRequired(values, mapped = true) {
  if (!mapped) return {kind: 'unmapped', values: []};
  const recorded = [...new Set(values.map(clean).filter(Boolean))];
  if (!recorded.length) return {kind: 'blank', values: []};
  const normalized = recorded.map(value => {
    const text = value.toLowerCase().replace(/\s+/g, ' ');
    return ['yes', 'true', '1', 'required'].includes(text) ? true : ['no', 'false', '0', 'not required'].includes(text) ? false : null;
  });
  if (normalized.includes(null)) return {kind: 'issue', reason: 'Unrecognized dispatch requirement', values: recorded};
  if (new Set(normalized).size > 1) return {kind: 'issue', reason: 'Conflicting dispatch requirements', values: recorded};
  return {kind: 'value', required: normalized[0], values: recorded};
}
const overdueGroup = () => ({count: 0, internal: 0, authority: 0, unclassified: 0, rows: []});
const addOverdue = (group, record) => {group.count++; group[record.overdueStage]++; group.rows.push(record);};
function dispatchProgress(record, today) {
  const d = record.dispatch, notes = [], required = d.required, actual = d.actual, plan = d.planned;
  if (required.kind === 'issue') notes.push(required.reason);
  if (plan.kind === 'issue') notes.push(`${plan.reason}: planned dispatch`);
  if (actual.kind === 'issue') notes.push(`${actual.reason}: actual dispatch`);
  if (actual.kind === 'date' && actual.day > today) notes.push('Actual dispatch date is in the future');
  if (plan.kind === 'date' && record.plan.kind === 'date' && plan.day > record.plan.day) notes.push('Planned dispatch is after planned submission');
  if (actual.kind === 'date' && record.actual.kind === 'date' && actual.day > record.actual.day) notes.push('Actual dispatch is after actual submission');
  record.overdue = false;
  record.dispatchStage = record.status === 'Submitted' ? 'Submitted' : record.approved ? 'RO approved' : record.status === 'Check date' ? 'Check submission date' :
    (actual.kind === 'date' && actual.day <= today || required.kind === 'value' && !required.required) ? 'Awaiting authority submission' :
    required.kind === 'value' && required.required && actual.kind === 'blank' ? 'Pending internal dispatch' : 'Check dispatch data';
  if (record.dispatchStage === 'Pending internal dispatch' && plan.kind !== 'date') notes.push(plan.kind === 'unmapped' ? 'Planned dispatch date is not mapped' : plan.kind === 'blank' ? 'Planned dispatch date not recorded' : 'Dispatch due date needs review');
  if (record.dispatchStage === 'Check dispatch data') {
    if (required.kind === 'blank' || required.kind === 'unmapped') notes.push(`Dispatch required is ${required.kind === 'unmapped' ? 'not mapped' : 'not recorded'}`);
    if (actual.kind === 'unmapped') notes.push('Actual dispatch date is not mapped');
  }
  if (record.dispatchStage === 'Pending internal dispatch' && plan.kind === 'date') {
    if (plan.day < today) {record.overdue = true; record.overdueStage = 'internal'; record.overdueDate = plan.day;}
  } else if (['Pending internal dispatch', 'Awaiting authority submission', 'Check dispatch data'].includes(record.dispatchStage) && record.plan.kind === 'date' && record.plan.day < today) {
    record.overdue = true; record.overdueStage = record.dispatchStage === 'Awaiting authority submission' ? 'authority' : 'unclassified'; record.overdueDate = record.plan.day;
  }
  record.dispatchNotes = [...new Set(notes)].join('; ');
  if (record.dispatchNotes) record.reason = [record.reason, record.dispatchNotes].filter(Boolean).join('; ');
}
export function calendar(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  const today = Date.UTC(y, m, now.getDate());
  const months = [0, 1].map(offset => {
    const start = Date.UTC(y, m + offset, 1), end = Date.UTC(y, m + offset + 1, 1), date = new Date(start);
    return {start, end, key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('en-GB', {month: 'long', year: 'numeric', timeZone: 'UTC'}),
      short: date.toLocaleDateString('en-GB', {month: 'short', timeZone: 'UTC'})};
  });
  return {today, months, label: months[0].key.slice(0, 4) === months[1].key.slice(0, 4)
    ? `${months[0].label.replace(/ \d{4}$/, '')} & ${months[1].label}` : `${months[0].label} & ${months[1].label}`};
}
export function mapTable(table) {
  const columns = table?.columns || [], index = {}, missing = [];
  for (const role of ROLES) {
    const found = columns.flatMap((c, i) => c.roles?.[role] ? [i] : []);
    if (found.length > 1) throw Error(`Map only one column to ${role}.`);
    if (found.length) index[role] = found[0];
    else if (REQUIRED.includes(role)) missing.push(role);
  }
  return {missing, unitMapped: index.BusinessUnit !== undefined, fallbackCountryMapped:index.FallbackCountry!==undefined, registrationMapped: Object.fromEntries(REGISTRATION_ROLES.map(role=>[role,index[role] !== undefined])), dispatchMapped: Object.fromEntries(DISPATCH_ROLES.map(role=>[role,index[role] !== undefined])), stateMapped: Object.fromEntries(STATE_FIELDS.map(({role})=>[role,index[role] !== undefined])),
    rows: (table?.rows || []).map(row => Object.fromEntries(ROLES.map(role => [role, index[role] === undefined ? null : row[index[role]]])))};
}
export function normalizeSites(sites) {
  const result = [];
  for (const value of Array.isArray(sites) ? sites : DEFAULT_SITES) {
    const key = siteKey(value);
    if (key && !result.some(s => siteKey(s) === key)) result.push(clean(value));
    if (result.length === 6) break;
  }
  return result;
}
export function summarize(rows, {sites = DEFAULT_SITES, unit = '*', now = new Date(), stateFilters = {}, stateMapped, dispatchMapped, registrationMapped, fallbackCountryMapped} = {}) {
  const dates = calendar(now), selectedSites = normalizeSites(sites), grouped = new Map(), units = new Set(), availableSites = new Map();
  const mappings = stateMapped ?? Object.fromEntries(STATE_FIELDS.map(({role})=>[role,rows.some(r=>Object.prototype.hasOwnProperty.call(r,role))]));
  const dispatchMappings = dispatchMapped ?? Object.fromEntries(DISPATCH_ROLES.map(role=>[role,rows.some(r=>Object.prototype.hasOwnProperty.call(r,role))]));
  const dispatchEnabled = DISPATCH_ROLES.some(role=>dispatchMappings[role]);
  const registrationMappings=registrationMapped??Object.fromEntries(REGISTRATION_ROLES.map(role=>[role,rows.some(row=>Object.prototype.hasOwnProperty.call(row,role))]));
  const registrationEnabled=REGISTRATION_ROLES.some(role=>registrationMappings[role]);
  const fallbackMapped=fallbackCountryMapped??rows.some(row=>Object.prototype.hasOwnProperty.call(row,'FallbackCountry'));
  const filters = normalizeStateFilters(stateFilters), choices = Object.fromEntries(STATE_FIELDS.map(({role})=>[role,new Set()]));
  const coverage = {outsideSites: [], outsideMonths: [], missingIds: []};
  const matches = row => (unit === '*' || clean(row.BusinessUnit) === unit) && STATE_FIELDS.every(({role}) => !mappings[role] || filters[role] === null || filters[role].includes(clean(row[role])));
  let missingIds = 0;
  for (const row of rows) {
    const bu = clean(row.BusinessUnit), site = clean(row.Site), id = clean(row.SubID);
    units.add(bu);
    STATE_FIELDS.forEach(({role})=>{if(mappings[role])choices[role].add(clean(row[role]));});
    if (site && !availableSites.has(siteKey(site))) availableSites.set(siteKey(site), site);
    if (!id) {
      if (matches(row)) {
        missingIds++;
        const registration=registrationEvidence([row],registrationMappings);
        coverage.missingIds.push({id:'', site:site || 'Unassigned', plan:resolveDate([row.PlannedSubmission]), actual:resolveDate([row.ActualSubmission]), status:'Not counted', reason:'Submission ID not recorded; this source row cannot be counted as a distinct submission',
          states:Object.fromEntries(STATE_FIELDS.map(({role})=>[role,mappings[role]?[clean(row[role])]:null])), registration, country:resolveCountry([row],registration,fallbackMapped),
          dispatch:{required:resolveRequired([row.DispatchRequired],dispatchMappings.DispatchRequired),planned:dispatchMappings.PlannedDispatch?resolveDate([row.PlannedDispatch]):{kind:'unmapped'},actual:dispatchMappings.ActualDispatch?resolveDate([row.ActualDispatch]):{kind:'unmapped'}}});
      }
      continue;
    }
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  const backlog = {cutoff: dates.months[0].start, ...overdueGroup()}, overdue = overdueGroup();
  const buckets = selectedSites.map(site => ({site, key: siteKey(site), delivered: 0, backlog: overdueGroup(), overdue: overdueGroup(), months: dates.months.map(month => ({
    ...month, site, planned: 0, inProcess: 0, submitted: 0, review: 0, overdue: 0, rows: []}))}));
  const lookup = new Map(buckets.map(b => [b.key, b]));
  const issues = [], checks = {missingIds, outsideSites: 0, unassignedSite: 0, multipleSites: 0, missingPlan: 0, planIssues: 0, actualIssues: 0, dispatchIssues: 0, registrationIssues: 0, outsideMonths: 0};
  let scopedRecords = 0;
  for (const [id, list] of grouped) {
    if (!list.some(matches)) continue;
    scopedRecords++;
    const names = [...new Set(list.map(row => siteKey(row.Site)).filter(Boolean))];
    const plan = resolveDate(list.map(row => row.PlannedSubmission));
    const actual = resolveDate(list.map(row => row.ActualSubmission));
    const states = Object.fromEntries(STATE_FIELDS.map(({role})=>[role,mappings[role] ? [...new Set(list.map(row=>clean(row[role])))].sort() : null]));
    const submittedStates = submittedStateEvidence(states);
    const record = {id, site: names.join(' / ') || 'Unassigned', plan, actual, states, submittedStates, status: 'In process', reason: ''};
    record.approved = hasState(states, 'ROStatus', 'health authority approved');
    record.registration=registrationEvidence(list,registrationMappings);
    record.registrationComplete=record.registration.qualifying.length>0;
    record.country=resolveCountry(list,record.registration,fallbackMapped);
    record.dispatch = {required: resolveRequired(list.map(row=>row.DispatchRequired), dispatchMappings.DispatchRequired),
      planned: dispatchMappings.PlannedDispatch ? resolveDate(list.map(row=>row.PlannedDispatch)) : {kind:'unmapped'},
      actual: dispatchMappings.ActualDispatch ? resolveDate(list.map(row=>row.ActualDispatch)) : {kind:'unmapped'}};
    if (names.length !== 1) {
      const reason = names.length ? 'Multiple sites: not allocated' : 'Site not recorded';
      checks[names.length ? 'multipleSites' : 'unassignedSite']++;
      issues.push({...record, reason}); continue;
    }
    const bucket = lookup.get(names[0]);
    if (!bucket) {
      checks.outsideSites++;
      if (actual.kind === 'date' && actual.day <= dates.today || submittedStates.length || record.registrationComplete) {record.status='Submitted';record.submittedByState=!(actual.kind==='date'&&actual.day<=dates.today)&&submittedStates.length>0;record.submittedByRegistration=!(actual.kind==='date'&&actual.day<=dates.today)&&!submittedStates.length&&record.registrationComplete;}
      else if (actual.kind==='issue'||actual.kind==='date'&&actual.day>dates.today) record.status='Check date';
      dispatchProgress(record,dates.today);
      coverage.outsideSites.push(record);continue;
    }
    bucket.delivered++;
    record.site = bucket.site;
    const actualIssue = actual.kind === 'issue' || actual.kind === 'date' && actual.day > dates.today;
    if (actualIssue) {
      record.status = 'Check date'; record.reason = actual.kind === 'issue' ? `${actual.reason}: actual submission` : 'Actual submission date is in the future';
      checks.actualIssues++;
    }
    const actualSubmitted = actual.kind === 'date' && !actualIssue;
    if (actualSubmitted || submittedStates.length || record.registrationComplete) {
      record.status = 'Submitted';
      record.submittedByState = !actualSubmitted && submittedStates.length>0;
      record.submittedByRegistration = !actualSubmitted && !submittedStates.length && record.registrationComplete;
    }
    const registrationIssue=record.registration.notes.length>0;
    if(registrationIssue){checks.registrationIssues++;record.reason=[record.reason,...record.registration.notes].filter(Boolean).join('; ');}
    dispatchProgress(record, dates.today);
    const dispatchIssue = Boolean(record.dispatchNotes && (record.dispatch.required.values.length || [record.dispatch.planned,record.dispatch.actual].some(date=>date.kind!=='blank'&&date.kind!=='unmapped')));
    if (dispatchIssue) checks.dispatchIssues++;
    // All overdue work is independent of the monthly cohort; an early dispatch can be due
    // even when submission is planned later, or its submission plan is still missing.
    if (record.overdue) {addOverdue(overdue, record); addOverdue(bucket.overdue, record);}
    if (plan.kind !== 'date') {
      checks[plan.kind === 'blank' ? 'missingPlan' : 'planIssues']++;
      issues.push({...record, reason: [plan.kind === 'blank' ? 'Planned submission date not recorded' : `${plan.reason}: planned submission`, record.reason].filter(Boolean).join('; ')});
      continue;
    }
    if (actualIssue || dispatchIssue || registrationIssue) issues.push({...record});
    const month = bucket.months.find(m => plan.day >= m.start && plan.day < m.end);
    if (!month) {
      if (plan.day < backlog.cutoff && record.overdue) {
        addOverdue(bucket.backlog, record); addOverdue(backlog, record);
      } else {checks.outsideMonths++;coverage.outsideMonths.push(record);}
      continue;
    }
    month.planned++;
    month[record.status === 'Submitted' ? 'submitted' : record.status === 'Check date' ? 'review' : 'inProcess']++;
    if (record.overdue) month.overdue++;
    month.rows.push(record);
  }
  const totals = {planned: 0, inProcess: 0, submitted: 0, review: 0, overdue: 0};
  const monthTotals = dates.months.map(m => ({...m, ...totals}));
  const oldestFirst = (a, b) => a.plan.day - b.plan.day || a.id.localeCompare(b.id, undefined, {numeric: true});
  const overdueFirst = (a,b) => a.overdueDate - b.overdueDate || a.id.localeCompare(b.id, undefined, {numeric:true});
  overdue.rows.sort(overdueFirst);
  backlog.rows.sort(oldestFirst);
  for (const site of buckets) {
    site.backlog.rows.sort(oldestFirst);
    site.overdue.rows.sort(overdueFirst);
    site.months.forEach((m, i) => {
      Object.keys(totals).forEach(key => {totals[key] += m[key]; monthTotals[i][key] += m[key];});
      m.rows.sort(oldestFirst);
    });
  }
  const peak = Math.max(1, ...buckets.flatMap(site => site.months.map(m => m.planned)));
  const rawStep = peak / 5, magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(1, ([1, 2, 5, 10].find(s => s * magnitude >= rawStep) || 10) * magnitude);
  const axisMax = Math.max(5, Math.ceil(peak / step) * step);
  return {...dates, buckets, totals, monthTotals, backlog, overdue, checks, issues, coverage, axisMax, step, scopedRecords, dispatchMapped: dispatchMappings, dispatchEnabled, registrationMapped:registrationMappings, registrationEnabled, countryEnabled:Boolean(registrationMappings.RegistrationCountry||fallbackMapped), fallbackCountryMapped:fallbackMapped,
    stateMapped: mappings, stateFilters: filters, stateChoices: Object.fromEntries(STATE_FIELDS.map(({role})=>[role,[...choices[role]].sort((a,b)=>stateLabel(a).localeCompare(stateLabel(b)))])),
    units: [...units].sort(), availableSites: [...availableSites.values()].sort(),
    issueCount: issues.length + missingIds, completion: totals.planned ? Math.round(totals.submitted / totals.planned * 100) : 0};
}

export function formatDate(resolved) {
  return resolved?.kind === 'date' ? new Date(resolved.day).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'})
    : resolved?.kind === 'issue' ? resolved.reason : resolved?.kind === 'unmapped' ? 'Not mapped' : 'Not recorded';
}

// Explanations use only delivered dates/states; they never change the counting rules
// or infer that a particular document, person or team caused a delay.
export function attentionFor(record) {
  const note=(key,tone,title,reason,action)=>({key,tone,title,reason,action});
  const states=record.states||{}, d=record.dispatch||{}, reason=record.reason||'', dispatchNotes=record.dispatchNotes||'';
  if(!record.id)return note('data','review','Submission ID missing','This source row has no submission ID.','Map or correct the source submission ID.');
  if(/Multiple sites|Site not recorded/.test(reason))return note('data','review','Check site assignment',reason,'Confirm the submission’s site before allocating it.');
  if(record.actual?.kind==='issue'||record.status==='Check date'||/Actual submission date is in the future/.test(reason))return note('data','review','Check actual submission date',record.actual?.kind==='issue'?`${record.actual.reason}: actual submission.`:'The recorded actual submission date is in the future.','Verify the recorded filing date; no date is inferred.');
  if(record.plan?.kind==='issue')return note('data','review','Check planned submission date',`${record.plan.reason}: planned submission.`,'Confirm the applicable planned submission date.');
  if(record.registration?.notes.length)return note('registrationReview','review','Check registration details',record.registration.notes.join('; '),record.registrationComplete?'Registration approval still establishes Submitted. Verify the recorded registration details.':'Verify the linked registration ID, state and dates.');
  if(record.registrationComplete)return note('registration','complete','Registration approval recorded',record.registration.qualifying.map(r=>`${r.id}${r.country?' · '+r.country:''}: ${r.state}`).join('; '),'Counted as Submitted and excluded from overdue work. Review any outdated submission, RO or application states.');
  if(d.required?.kind==='issue')return note('dispatchReview','review','Check dispatch requirement',d.required.reason,'Confirm whether internal dispatch is required.');
  if(d.actual?.kind==='issue'||/Actual dispatch date is in the future|Actual dispatch is after actual submission/.test(dispatchNotes))return note('dispatchReview','review','Check actual dispatch date',dispatchNotes,'Verify the dispatch date before relying on its stage.');
  if(d.planned?.kind==='issue'||/Planned dispatch is after planned submission/.test(dispatchNotes))return note('dispatchReview','review','Check planned dispatch date',dispatchNotes,'Confirm the dispatch deadline and sequence of dates.');
  if(hasState(states,'SubStatus','rejected'))return note('rejection','urgent','Health authority rejection','Submission state is Rejected: filing occurred, but the authority rejected it.','Review the authority’s response and the next regulatory action.');
  if(hasState(states,'ROStatus','rejected'))return note('rejection','urgent','Review rejected RO','The related regulatory objective is recorded as Rejected.','Review the recorded outcome and required follow-up.');
  if(record.approved)return note('complete','complete','Health authority approved','The related RO is Health Authority Approved.','Excluded from overdue follow-up.');
  const paused=STATE_FIELDS.flatMap(({role,label})=>(states[role]||[]).filter(value=>['cancelled','canceled','inactive','archived','withdrawn','deferred'].includes(clean(value).toLowerCase().replace(/\s+/g,' '))).map(value=>`${label}: ${value}`));
  if(paused.length)return note('status','review','Review inactive or paused status',paused.join('; '),'Confirm whether this record should remain in active follow-up.');
  const holds=STATE_FIELDS.flatMap(({role,label})=>(states[role]||[]).filter(value=>/^on hold(?:\s|$)/i.test(clean(value))).map(value=>`${label}: ${value}`));
  if(holds.length)return note('hold','review','On hold',holds.join('; '),'Check the recorded hold reason before progressing the filing.');
  if(record.status==='Submitted')return note('complete','complete','Submitted',record.submittedByState?`Filing is established by Submission state ${record.submittedStates.join(' / ')}.`:`Actual submission: ${formatDate(record.actual)}.`,'No unsubmitted backlog action.');
  if(record.overdueStage==='internal')return note('internal','dispatch','Internal dispatch overdue',`Dispatch is required; no actual dispatch is recorded. Planned dispatch: ${formatDate(d.planned)}.`,'Complete internal dispatch or confirm and record its actual date.');
  if(record.overdueStage==='authority')return note('authority','urgent','Authority submission overdue',`${d.actual?.kind==='date'?`Actual dispatch: ${formatDate(d.actual)}`:'Internal dispatch is not required'}. Planned submission: ${formatDate(record.plan)}. No qualifying filing evidence is recorded.`,'Check authority filing progress and record the actual submission date or state.');
  if(record.overdueStage==='unclassified'||record.dispatchStage==='Check dispatch data')return note('dispatchReview','review','Confirm dispatch information',dispatchNotes||'The dispatch stage cannot be established from the mapped data.','Confirm the dispatch requirement and planned/actual dispatch dates.');
  if(record.plan?.kind==='blank')return note('data','review','Planned submission date missing','This record has no usable submission plan.','Confirm and record the planned submission date.');
  if(record.dispatchStage==='Pending internal dispatch')return note('next','info','Awaiting internal dispatch',`Planned dispatch: ${formatDate(d.planned)}.`,'Complete dispatch before progressing to authority submission.');
  if(record.dispatchStage==='Awaiting authority submission')return note('next','info','Awaiting authority submission',`Planned submission: ${formatDate(record.plan)}.`,'Progress the filing to its planned submission date.');
  return note('data','review','Review source record',reason||'The next action cannot be established from the delivered record.','Review its dates, status and field mappings.');
}
