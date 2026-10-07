export const DEFAULT_SITES = ['ABO', 'ADJ', 'ADK', 'AJG', 'ARDG', 'SCR'];
export const STATE_FIELDS = [{role:'SubStatus',label:'Submission state'}, {role:'ROStatus',label:'RO state'}, {role:'AppStatus',label:'Application state'}];
export const ROLES = ['SubID', 'Site', 'PlannedSubmission', 'ActualSubmission', 'BusinessUnit', ...STATE_FIELDS.map(f=>f.role)];
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
  return {missing, unitMapped: index.BusinessUnit !== undefined, stateMapped: Object.fromEntries(STATE_FIELDS.map(({role})=>[role,index[role] !== undefined])),
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
export function summarize(rows, {sites = DEFAULT_SITES, unit = '*', now = new Date(), stateFilters = {}, stateMapped} = {}) {
  const dates = calendar(now), selectedSites = normalizeSites(sites), grouped = new Map(), units = new Set(), availableSites = new Map();
  const mappings = stateMapped ?? Object.fromEntries(STATE_FIELDS.map(({role})=>[role,rows.some(r=>Object.prototype.hasOwnProperty.call(r,role))]));
  const filters = normalizeStateFilters(stateFilters), choices = Object.fromEntries(STATE_FIELDS.map(({role})=>[role,new Set()]));
  const matches = row => (unit === '*' || clean(row.BusinessUnit) === unit) && STATE_FIELDS.every(({role}) => !mappings[role] || filters[role] === null || filters[role].includes(clean(row[role])));
  let missingIds = 0;
  for (const row of rows) {
    const bu = clean(row.BusinessUnit), site = clean(row.Site), id = clean(row.SubID);
    units.add(bu);
    STATE_FIELDS.forEach(({role})=>{if(mappings[role])choices[role].add(clean(row[role]));});
    if (site && !availableSites.has(siteKey(site))) availableSites.set(siteKey(site), site);
    if (!id) { if (matches(row)) missingIds++; continue; }
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  const backlog = {cutoff: dates.months[0].start, count: 0, rows: []};
  const buckets = selectedSites.map(site => ({site, key: siteKey(site), delivered: 0, backlog: {count: 0, rows: []}, months: dates.months.map(month => ({
    ...month, site, planned: 0, inProcess: 0, submitted: 0, review: 0, overdue: 0, rows: []}))}));
  const lookup = new Map(buckets.map(b => [b.key, b]));
  const issues = [], checks = {missingIds, outsideSites: 0, unassignedSite: 0, multipleSites: 0, missingPlan: 0, planIssues: 0, actualIssues: 0, outsideMonths: 0};
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
    if (names.length !== 1) {
      const reason = names.length ? 'Multiple sites: not allocated' : 'Site not recorded';
      checks[names.length ? 'multipleSites' : 'unassignedSite']++;
      issues.push({...record, reason}); continue;
    }
    const bucket = lookup.get(names[0]);
    if (!bucket) { checks.outsideSites++; continue; }
    bucket.delivered++;
    record.site = bucket.site;
    const actualIssue = actual.kind === 'issue' || actual.kind === 'date' && actual.day > dates.today;
    if (actualIssue) {
      record.status = 'Check date'; record.reason = actual.kind === 'issue' ? `${actual.reason}: actual submission` : 'Actual submission date is in the future';
      checks.actualIssues++;
    }
    const actualSubmitted = actual.kind === 'date' && !actualIssue;
    if (actualSubmitted || submittedStates.length) {
      record.status = 'Submitted';
      record.submittedByState = !actualSubmitted;
    }
    if (plan.kind !== 'date') {
      checks[plan.kind === 'blank' ? 'missingPlan' : 'planIssues']++;
      issues.push({...record, reason: [plan.kind === 'blank' ? 'Planned submission date not recorded' : `${plan.reason}: planned submission`, record.reason].filter(Boolean).join('; ')});
      continue;
    }
    if (actualIssue) issues.push({...record});
    const month = bucket.months.find(m => plan.day >= m.start && plan.day < m.end);
    if (!month) {
      if (plan.day < backlog.cutoff && actual.kind === 'blank' && !submittedStates.length && !hasState(states, 'ROStatus', 'health authority approved')) {
        record.overdue = true;
        bucket.backlog.count++; bucket.backlog.rows.push(record);
        backlog.count++; backlog.rows.push(record);
      } else checks.outsideMonths++;
      continue;
    }
    month.planned++;
    month[record.status === 'Submitted' ? 'submitted' : record.status === 'Check date' ? 'review' : 'inProcess']++;
    record.overdue = record.status === 'In process' && plan.day < dates.today;
    if (record.overdue) month.overdue++;
    month.rows.push(record);
  }
  const totals = {planned: 0, inProcess: 0, submitted: 0, review: 0, overdue: 0};
  const monthTotals = dates.months.map(m => ({...m, ...totals}));
  const oldestFirst = (a, b) => a.plan.day - b.plan.day || a.id.localeCompare(b.id, undefined, {numeric: true});
  backlog.rows.sort(oldestFirst);
  for (const site of buckets) {
    site.backlog.rows.sort(oldestFirst);
    site.months.forEach((m, i) => {
      Object.keys(totals).forEach(key => {totals[key] += m[key]; monthTotals[i][key] += m[key];});
      m.rows.sort(oldestFirst);
    });
  }
  const peak = Math.max(1, ...buckets.flatMap(site => site.months.map(m => m.planned)));
  const rawStep = peak / 5, magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(1, ([1, 2, 5, 10].find(s => s * magnitude >= rawStep) || 10) * magnitude);
  const axisMax = Math.max(5, Math.ceil(peak / step) * step);
  return {...dates, buckets, totals, monthTotals, backlog, checks, issues, axisMax, step, scopedRecords,
    stateMapped: mappings, stateFilters: filters, stateChoices: Object.fromEntries(STATE_FIELDS.map(({role})=>[role,[...choices[role]].sort((a,b)=>stateLabel(a).localeCompare(stateLabel(b)))])),
    units: [...units].sort(), availableSites: [...availableSites.values()].sort(),
    issueCount: issues.length + missingIds, completion: totals.planned ? Math.round(totals.submitted / totals.planned * 100) : 0};
}

export function formatDate(resolved) {
  return resolved?.kind === 'date' ? new Date(resolved.day).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'})
    : resolved?.kind === 'issue' ? resolved.reason : 'Not recorded';
}
