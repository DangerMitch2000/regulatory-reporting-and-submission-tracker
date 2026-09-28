(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.regulatoryQuality = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const FIELD_LABELS = Object.freeze({
    AppID: 'Application ID', ROID: 'Regulatory objective ID', SubID: 'Submission ID',
    AppCreated: 'Application created', ROCreated: 'Regulatory objective created', SubCreated: 'Submission created',
    OriginalDispatch: 'Original dispatch plan', LatestDispatch: 'Latest dispatch plan', ActualDispatch: 'Actual dispatch',
    OriginalSubmission: 'Original submission plan', LatestSubmission: 'Latest submission plan', ActualSubmission: 'Actual submission',
    OriginalApproval: 'Original approval plan', LatestApproval: 'Latest approval plan', ActualApproval: 'Actual approval',
    RegistrationStart: 'Registration start', RegistrationEnd: 'Registration end',
    Country: 'Country', Manufacturer: 'Legal manufacturer', BusinessUnit: 'Business unit', SubStatus: 'Submission state'
  });
  const DATE_FIELDS = Object.freeze([
    'AppCreated', 'ROCreated', 'SubCreated',
    'OriginalDispatch', 'LatestDispatch', 'ActualDispatch',
    'OriginalSubmission', 'LatestSubmission', 'ActualSubmission',
    'OriginalApproval', 'LatestApproval', 'ActualApproval', 'RegistrationStart', 'RegistrationEnd'
  ]);
  const CLOSED_STATES = new Set(['completed', 'inactive', 'withdrawn', 'rejected', 'archived', 'cancelled', 'canceled']);
  const EXPIRY_LIMIT = Date.UTC(2101, 0, 1);
  const DAY = 86400000;
  const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  const blank = value => value == null || typeof value === 'string' && value.trim() === '';
  const lower = value => text(value).toLowerCase();
  const compare = (a, b) => {
    const left = String(a), right = String(b), l = left.toLowerCase(), r = right.toLowerCase();
    return l < r ? -1 : l > r ? 1 : left < right ? -1 : left > right ? 1 : 0;
  };

  // ISO calendar dates stay on their written day. Explicit Z/offset timestamps,
  // Date objects and epoch milliseconds use their UTC day, matching the timeline.
  // Validate the written calendar date before allowing timezone normalization.
  // No prediction history-window cutoff applies to general data quality checks.
  function parseDate(value) {
    if (blank(value)) return { state: 'blank', day: null };
    if (value instanceof Date || typeof value === 'number') {
      const date = new Date(value instanceof Date ? value.getTime() : value);
      return Number.isFinite(date.getTime())
        ? { state: 'valid', day: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) }
        : { state: 'invalid', day: null };
    }
    if (typeof value !== 'string') return { state: 'invalid', day: null };
    const raw = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(raw);
    const timestamp = Date.parse(raw);
    if (!match || !Number.isFinite(timestamp)) return { state: 'invalid', day: null };
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return { state: 'invalid', day: null };
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
      const instant = new Date(timestamp);
      return { state: 'valid', day: Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()) };
    }
    return { state: 'valid', day: date.getTime() };
  }

  function rawKey(value) {
    if (value instanceof Date) return 'date:' + (Number.isFinite(value.getTime()) ? value.toISOString() : 'invalid');
    if (value === undefined) return 'undefined';
    if (typeof value === 'number') return 'number:' + String(value);
    if (typeof value === 'string') return 'string:' + value;
    if (value === null) return 'null';
    try { return typeof value + ':' + JSON.stringify(value); } catch (_) { return typeof value + ':' + String(value); }
  }
  function rawValues(map) {
    return [...map.entries()].sort((a, b) => compare(a[0], b[0])).map(([, value]) => value instanceof Date ? new Date(value.getTime()) : value);
  }
  function displayValue(value) {
    if (value === undefined || value === null || typeof value === 'string' && value.trim() === '') return '(blank)';
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : 'Invalid Date';
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    return String(value);
  }
  function displayValues(values) { return values.length ? values.map(displayValue).join(' | ') : '(blank)'; }
  function addRaw(map, value) {
    const key = rawKey(value);
    if (!map.has(key)) map.set(key, value);
  }
  function members(value) {
    if (Array.isArray(value)) return value.flatMap(members);
    const normalized = text(value);
    return normalized ? [normalized] : [];
  }
  function dateBucket() {
    return { raw: new Map(), invalid: new Map(), days: new Set(), present: false };
  }
  function addDate(bucket, value, field) {
    const parsed = parseDate(value);
    if (parsed.state === 'blank') return;
    // Far-future registration expiry values are source-system open-ended sentinels.
    if (field === 'RegistrationEnd' && parsed.state === 'valid' && parsed.day >= EXPIRY_LIMIT) return;
    bucket.present = true;
    addRaw(bucket.raw, value);
    if (parsed.state === 'invalid') addRaw(bucket.invalid, value);
    else bucket.days.add(parsed.day);
  }
  function resolvedDate(bucket) {
    return bucket && bucket.invalid.size === 0 && bucket.days.size === 1 ? bucket.days.values().next().value : null;
  }
  function issueSort(a, b) {
    const siteA = a.sites[0] || '\uffff', siteB = b.sites[0] || '\uffff';
    const categoryOrder = { error: 0, review: 1, missing: 2 };
    return compare(siteA, siteB) || categoryOrder[a.category] - categoryOrder[b.category]
      || compare(a.subID, b.subID) || compare(a.field, b.field) || compare(a.rule, b.rule);
  }

  function analyze(rows, options) {
    const opts = options || {}, inputs = rows || [];
    const now = parseDate(opts.now === undefined ? new Date() : opts.now);
    if (now.state !== 'valid') throw new Error('Data Quality requires a valid current date.');
    const mapped = opts.mappedFields === undefined
      ? new Set(inputs.flatMap(row => row && typeof row === 'object' ? Object.keys(row) : []))
      : new Set(opts.mappedFields || []);
    const dateFields = DATE_FIELDS.filter(field => mapped.has(field));
    const membershipFields = ['AppID', 'ROID', 'Manufacturer', 'BusinessUnit', 'Country', 'SubStatus'].filter(field => mapped.has(field));
    const groups = new Map();
    let excludedRows = 0;
    for (const row of inputs) {
      const id = row && text(row.SubID);
      if (!id || !mapped.has('SubID')) { excludedRows++; continue; }
      let group = groups.get(id);
      if (!group) {
        group = {
          id, rows: 0,
          dates: Object.fromEntries(dateFields.map(field => [field, dateBucket()])),
          memberships: Object.fromEntries(membershipFields.map(field => [field, new Set()])),
          rawMembers: Object.fromEntries(membershipFields.map(field => [field, new Map()])),
          blankParents: { AppID: false, ROID: false }
        };
        groups.set(id, group);
      }
      group.rows++;
      for (const field of membershipFields) {
        for (const member of members(row[field])) group.memberships[field].add(member);
        addRaw(group.rawMembers[field], row[field]);
        if ((field === 'AppID' || field === 'ROID') && members(row[field]).length === 0) group.blankParents[field] = true;
      }
      for (const field of dateFields) addDate(group.dates[field], row[field], field);
    }

    const issues = [], affected = new Set();
    for (const group of groups.values()) {
      const values = field => group.memberships[field] ? [...group.memberships[field]].sort(compare) : [];
      const base = { subID: group.id, roIDs: values('ROID'), appIDs: values('AppID'), sites: values('Manufacturer'), businessUnits: values('BusinessUnit') };
      const addIssue = (rule, category, field, sourceValues, reason, suggestion, extra) => {
        const issue = {
          id: 'dq:' + JSON.stringify([group.id, rule, field]), rule, ...base,
          category, field, fieldLabel: FIELD_LABELS[field] || field,
          value: displayValues(sourceValues), sourceValues,
          reason, suggestion, ...(extra || {})
        };
        issues.push(issue);
        affected.add(group.id);
      };

      for (const field of ['AppID', 'ROID']) {
        if (!mapped.has(field) || !group.blankParents[field]) continue;
        const partlyMissing = group.memberships[field].size > 0;
        addIssue('missing_parent', 'missing', field, rawValues(group.rawMembers[field]),
          partlyMissing ? FIELD_LABELS[field] + ' is blank on some membership rows for this submission.' : FIELD_LABELS[field] + ' is missing for this submission.',
          'Check the submission relationship in the source system and populate the correct ' + FIELD_LABELS[field].toLowerCase() + '.');
      }
      for (const field of ['Country', 'Manufacturer']) {
        if (!mapped.has(field) || group.memberships[field].size > 0) continue;
        addIssue('missing_membership', 'missing', field, rawValues(group.rawMembers[field]),
          'No ' + FIELD_LABELS[field].toLowerCase() + ' was supplied for this submission.',
          'Check the source relationship and field mapping; add the ' + FIELD_LABELS[field].toLowerCase() + ' if known.');
      }

      for (const field of dateFields) {
        const bucket = group.dates[field];
        if (bucket.invalid.size) addIssue('invalid_date', 'error', field, rawValues(bucket.invalid),
          FIELD_LABELS[field] + ' contains an invalid or ambiguous date.',
          'Verify the original record and replace the value with a valid date; use a Date field or unambiguous ISO date.');
        if (bucket.days.size > 1) addIssue('conflicting_dates', 'error', field, rawValues(bucket.raw),
          'Different nonblank ' + FIELD_LABELS[field].toLowerCase() + ' dates were supplied for the same submission.',
          'Reconcile the source dates and relationships so the submission has one correct milestone date.');
        const resolved = resolvedDate(bucket);
        if (field.startsWith('Actual') && resolved !== null && resolved > now.day) addIssue('future_actual_date', 'review', field, rawValues(bucket.raw),
          FIELD_LABELS[field] + ' is after today, although it is recorded as an actual event.',
          'Confirm whether the event has happened; if this is a forecast, record it in the appropriate planned date field.');
      }

      for (const [earlierField, laterField] of [
        ['ActualDispatch', 'ActualSubmission'], ['ActualSubmission', 'ActualApproval'], ['RegistrationStart', 'RegistrationEnd']
      ]) {
        const earlier = resolvedDate(group.dates[earlierField]), later = resolvedDate(group.dates[laterField]);
        if (earlier === null || later === null || later >= earlier) continue;
        const currentValues = rawValues(group.dates[laterField].raw), relatedValues = rawValues(group.dates[earlierField].raw);
        addIssue('reversed_dates', 'error', laterField, currentValues,
          FIELD_LABELS[laterField] + ' is before ' + FIELD_LABELS[earlierField].toLowerCase() + '.',
          'Check both source dates and correct whichever is wrong; the expected order is ' + FIELD_LABELS[earlierField].toLowerCase() + ' followed by ' + FIELD_LABELS[laterField].toLowerCase() + '.',
          { relatedField: earlierField, relatedValues, value: FIELD_LABELS[laterField] + ': ' + displayValues(currentValues) + '; ' + FIELD_LABELS[earlierField] + ': ' + displayValues(relatedValues) });
      }

      const states = new Set(values('SubStatus').map(lower));
      const actualApproval = group.dates.ActualApproval;
      if (states.has('completed') && mapped.has('ActualApproval') && !actualApproval.present) addIssue('completed_without_approval', 'review', 'ActualApproval', [],
        'Submission state is Completed, but no actual approval date was supplied.',
        'Confirm whether this submission requires approval; enter the actual approval date if applicable, or verify that Completed is the appropriate state.');

      // Terminal records do not need overdue prompts. Conflicting or invalid
      // actual/plan dates already have specific flags, so do not guess through them.
      if ([...states].some(state => CLOSED_STATES.has(state))) continue;
      for (const stage of ['Dispatch', 'Submission', 'Approval']) {
        const actualField = 'Actual' + stage, latestField = 'Latest' + stage, originalField = 'Original' + stage;
        const actual = group.dates[actualField];
        if (!mapped.has(actualField) || actual.present) continue;
        const latest = group.dates[latestField], original = group.dates[originalField];
        const planField = latest && latest.present ? latestField : original && original.present ? originalField : null;
        if (!planField) continue;
        const planDate = resolvedDate(group.dates[planField]);
        if (planDate === null || planDate >= now.day) continue;
        addIssue('overdue_plan_without_actual', 'review', planField, rawValues(group.dates[planField].raw),
          FIELD_LABELS[planField] + ' has passed and no ' + FIELD_LABELS[actualField].toLowerCase() + ' date was supplied.',
          'Check whether the event occurred and update the actual date, or review the latest estimate with the record owner.',
          { relatedField: actualField, relatedValues: [], overdueDays: Math.floor((now.day - planDate) / DAY) });
      }
    }
    issues.sort(issueSort);
    const categoryCounts = { error: 0, review: 0, missing: 0 };
    for (const issue of issues) categoryCounts[issue.category]++;
    return {
      issues, affectedSubmissions: affected.size, excludedRows,
      inputRows: inputs.length, distinctSubmissions: groups.size,
      mappedFields: [...mapped].sort(compare), categoryCounts, today: now.day
    };
  }

  function membershipMatches(memberships, wanted) {
    if (wanted === '') return memberships.length === 0;
    return memberships.some(value => lower(value) === lower(wanted));
  }
  function worklist(resultOrIssues, options) {
    const issues = Array.isArray(resultOrIssues) ? resultOrIssues : resultOrIssues && resultOrIssues.issues || [];
    const opts = options || {}, query = lower(opts.query);
    const units = opts.businessUnits == null ? [] : typeof opts.businessUnits === 'string' ? [opts.businessUnits] : [...opts.businessUnits];
    return issues.filter(issue => {
      if (opts.site != null && opts.site !== '*' && !membershipMatches(issue.sites, text(opts.site))) return false;
      if (units.length && !units.includes('*') && !units.some(unit => membershipMatches(issue.businessUnits, text(unit)))) return false;
      if (opts.category && opts.category !== '*' && opts.category !== 'all' && issue.category !== opts.category) return false;
      if (query && !lower([
        issue.subID, ...issue.roIDs, ...issue.appIDs, ...issue.sites, ...issue.businessUnits,
        issue.fieldLabel, issue.value, issue.reason, issue.suggestion
      ].join(' ')).includes(query)) return false;
      return true;
    }).slice().sort(issueSort);
  }

  return { analyze, worklist, parseDate, FIELD_LABELS, DATE_FIELDS };
});
