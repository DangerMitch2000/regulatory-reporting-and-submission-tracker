(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.regulatoryPredictions = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400000;
  const CUTOFF = Date.UTC(2020, 0, 1);
  const SUBMISSION_LIMIT = Date.UTC(2101, 0, 1);
  const SUBMISSION_FIELDS = ['ActualSubmission', 'LatestSubmission', 'OriginalSubmission'];
  const SUBMISSION_LABELS = Object.freeze({ ActualSubmission: 'Actual submission', LatestSubmission: 'Latest planned submission', OriginalSubmission: 'Original planned submission' });
  // Approval plans are deliberately independent of this historical estimate.
  // Their validation and warnings belong to Data Quality, not eligibility.
  const DATE_FIELDS = [...SUBMISSION_FIELDS, 'ActualApproval'];
  const reasonLabels = Object.freeze({
    missing_country: 'Country is missing',
    multiple_countries: 'More than one country; approval time cannot be attributed to one country',
    actual_submission_missing: 'Actual submission date is missing',
    actual_submission_invalid: 'Actual submission date is invalid',
    actual_submission_conflicting: 'Actual submission dates conflict across membership rows',
    actual_submission_before_2020: 'Actual submission date is before January 2020',
    actual_submission_future: 'Actual submission date is after today',
    actual_submission_unmapped: 'Actual submission field is not mapped; a lower-priority plan cannot safely replace it',
    latest_submission_unmapped: 'Latest submission plan field is not mapped; the original plan cannot safely replace it',
    original_submission_unmapped: 'Original submission plan field is not mapped',
    latest_submission_invalid: 'Latest submission plan is invalid or after 2100',
    latest_submission_conflicting: 'Latest submission plans conflict across membership rows',
    latest_submission_before_2020: 'Latest submission plan is before January 2020',
    original_submission_invalid: 'Original submission plan is invalid or after 2100',
    original_submission_conflicting: 'Original submission plans conflict across membership rows',
    original_submission_before_2020: 'Original submission plan is before January 2020',
    submission_date_missing: 'No actual or planned submission date was supplied',
    country_unmapped: 'Country field is not mapped',
    actual_approval_unmapped: 'Actual approval field is not mapped; approval status cannot be established',
    actual_approval_missing: 'Actual approval date is missing',
    actual_approval_invalid: 'Actual approval date is invalid',
    actual_approval_conflicting: 'Actual approval dates conflict across membership rows',
    actual_approval_before_2020: 'Actual approval date is before January 2020',
    actual_approval_future: 'Actual approval date is after today',
    approval_before_submission: 'Actual approval is before actual submission',
    original_approval_invalid: 'Original approval plan is populated but invalid',
    original_approval_conflicting: 'Original approval plans conflict across membership rows',
    latest_approval_invalid: 'Latest approval plan is populated but invalid',
    latest_approval_conflicting: 'Latest approval plans conflict across membership rows',
    approval_plan_present: 'An approval plan already exists',
    already_approved: 'An actual approval date already exists',
    insufficient_history: 'Too few qualifying completed submissions for this country',
    insufficient_benchmark_history: 'Too few other qualifying completed submissions for this country',
    self_excluded: 'Target submission excluded from its own benchmark'
  });

  function text(value) {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value).normalize('NFKC').trim().replace(/\s+/g, ' ')
      : '';
  }
  // Submission identity must match the tracker and Vega exactly: trim only.
  // Country labels may be normalized, but distinct source IDs must not merge.
  function subID(value) { return value == null ? '' : String(value).trim(); }

  function blank(value) {
    return value == null || (typeof value === 'string' && value.trim() === '');
  }

  // Accept dates, epoch milliseconds and unambiguous ISO dates only. Locale strings
  // are deliberately withheld: interpreting 03/04 as April or March is unsafe.
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
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) {
      return { state: 'invalid', day: null };
    }
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
      const instant = new Date(timestamp);
      return { state: 'valid', day: Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()) };
    }
    return { state: 'valid', day: result.getTime() };
  }

  function dateBucket() { return { days: new Set(), invalid: false, present: false }; }
  function collectDate(bucket, value) {
    const parsed = parseDate(value);
    if (parsed.state !== 'blank') bucket.present = true;
    if (parsed.state === 'invalid') bucket.invalid = true;
    if (parsed.state === 'valid') bucket.days.add(parsed.day);
  }
  function resolved(bucket) {
    if (bucket.invalid) return { state: 'invalid', day: null, present: true };
    if (bucket.days.size > 1) return { state: 'conflicting', day: null, present: true };
    if (!bucket.days.size) return { state: 'missing', day: null, present: false };
    return { state: 'valid', day: bucket.days.values().next().value, present: true };
  }
  function resolveField(bucket, field, mapped) {
    return mapped && !mapped.has(field) ? { state: 'unmapped', day: null, present: false } : resolved(bucket);
  }
  function anchorFromDates(dates) {
    for (const field of SUBMISSION_FIELDS) {
      const value = dates[field], label = SUBMISSION_LABELS[field];
      if (value.state === 'unmapped') return { date: null, field, label, state: 'unmapped', reason: label + ' is not mapped; lower-priority dates are withheld.' };
      if (!value.present) continue;
      if (value.state !== 'valid') return { date: null, field, label, state: value.state, reason: label + (value.state === 'conflicting' ? ' has conflicting dates across membership rows.' : ' contains an invalid date.') };
      if (value.day >= SUBMISSION_LIMIT) return { date: null, field, label, state: 'invalid', reason: label + ' is after 31 December 2100 and is withheld.' };
      return { date: value.day, field, label, state: 'valid', reason: 'Using ' + label.toLowerCase() + '.' };
    }
    return { date: null, field: null, label: 'Submission date', state: 'missing', reason: 'No actual or planned submission date was supplied.' };
  }
  // This date resolver is also used by the year/range filter. It intentionally has
  // no prediction-training cutoff: credible historical dates can still be filtered.
  function resolveSubmissionDates(rows, options) {
    const opts = options || {}, mapped = opts.mappedFields === undefined ? null : new Set(opts.mappedFields || []);
    const groups = new Map(), result = new Map();
    for (const row of rows || []) {
      const id = subID(row && row.SubID);
      if (!id) continue;
      let dates = groups.get(id);
      if (!dates) { dates = Object.fromEntries(SUBMISSION_FIELDS.map(field => [field, dateBucket()])); groups.set(id, dates); }
      for (const field of SUBMISSION_FIELDS) if (!mapped || mapped.has(field)) collectDate(dates[field], row[field]);
    }
    for (const [id, dates] of groups) result.set(id, anchorFromDates(Object.fromEntries(SUBMISSION_FIELDS.map(field => [field, resolveField(dates[field], field, mapped)]))));
    return result;
  }
  function anchorReasons(anchor, today) {
    if (!anchor.field) return ['submission_date_missing'];
    const prefix = anchor.field === 'ActualSubmission' ? 'actual_submission' : anchor.field === 'LatestSubmission' ? 'latest_submission' : 'original_submission';
    if (anchor.state !== 'valid') return [prefix + '_' + anchor.state];
    if (anchor.date < CUTOFF) return [prefix + '_before_2020'];
    if (anchor.field === 'ActualSubmission' && anchor.date > today) return ['actual_submission_future'];
    return [];
  }
  function dateReasons(date, prefix, today) {
    if (date.state !== 'valid') return [prefix + '_' + date.state];
    if (date.day < CUTOFF) return [prefix + '_before_2020'];
    if (date.day > today) return [prefix + '_future'];
    return [];
  }
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * q, lower = Math.floor(position), fraction = position - lower;
    return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
  }
  function lowerBound(sorted, value) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const middle = (lo + hi) >>> 1;
      if (sorted[middle] < value) lo = middle + 1;
      else hi = middle;
    }
    return lo;
  }
  function upperBound(sorted, value) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const middle = (lo + hi) >>> 1;
      if (sorted[middle] <= value) lo = middle + 1;
      else hi = middle;
    }
    return lo;
  }
  // Virtual removal avoids allocating/filtering a new country array for every
  // completed submission. Equal durations are interchangeable for quantiles.
  function supportingStats(sorted, omittedDuration) {
    const skip = omittedDuration === undefined ? -1 : lowerBound(sorted, omittedDuration);
    const removed = skip >= 0 && skip < sorted.length && sorted[skip] === omittedDuration;
    const count = sorted.length - (removed ? 1 : 0);
    const valueAt = index => sorted[index + (removed && index >= skip ? 1 : 0)];
    const percentile = q => {
      if (!count) return null;
      const position = (count - 1) * q, first = Math.floor(position), fraction = position - first;
      return valueAt(first) + (valueAt(Math.min(first + 1, count - 1)) - valueAt(first)) * fraction;
    };
    const medianDays = percentile(0.5), rangeLowDays = percentile(0.25), rangeHighDays = percentile(0.75);
    const fence = rangeHighDays + 1.5 * (rangeHighDays - rangeLowDays);
    const outlierCount = count >= 4
      ? sorted.length - upperBound(sorted, fence) - (removed && omittedDuration > fence ? 1 : 0)
      : 0;
    return { sampleCount: count, medianDays, rangeLowDays, rangeHighDays, outlierCount, selfExcluded: removed };
  }
  function exclusionRows(counts) {
    return Object.entries(counts).map(([code, count]) => ({ code, label: reasonLabels[code] || code, count }));
  }
  function countryValues(value) {
    if (Array.isArray(value)) return value.flatMap(countryValues);
    // Semicolon/pipe concatenations are treated as multiple countries. Commas
    // are retained because official country names can legitimately contain them.
    return text(value).split(/[;|]/).map(text).filter(Boolean);
  }
  function setStatus(entry, status, codes) {
    entry.status = status;
    entry.reasonCodes = codes;
    entry.reasons = codes.map(code => reasonLabels[code] || code);
    entry.reason = entry.reasons.join(' · ');
  }

  function analyze(rows, options) {
    const opts = options || {};
    const mapped = opts.mappedFields === undefined ? null : new Set(opts.mappedFields || []);
    const parsedNow = parseDate(opts.now === undefined ? new Date() : opts.now);
    if (parsedNow.state !== 'valid') throw new Error('Approval estimates require a valid current date.');
    const today = parsedNow.day;
    const minimumSamples = opts.minSamples === undefined ? 10 : opts.minSamples;
    if (!Number.isInteger(minimumSamples) || minimumSamples < 3) throw new Error('Minimum historical sample size must be an integer of at least three.');
    const groups = new Map(), byCountry = new Map(), bySubID = new Map(), sortedHistories = new Map();
    const summary = { inputRows: 0, distinctSubmissions: 0, missingIDRows: 0, qualifyingHistory: 0, excludedHistory: 0, estimated: 0, benchmark: 0, insufficient: 0, unavailable: 0, completed: 0, planned: 0, exclusions: [] };
    const globalExclusions = Object.create(null);

    for (const row of rows || []) {
      summary.inputRows++;
      const id = subID(row && row.SubID);
      if (!id) { summary.missingIDRows++; continue; }
      let group = groups.get(id);
      if (!group) {
        group = { id, countries: new Map(), fields: Object.fromEntries(DATE_FIELDS.map(field => [field, dateBucket()])) };
        groups.set(id, group);
      }
      for (const country of countryValues(!mapped || mapped.has('Country') ? row.Country : null)) {
        const key = country.toLowerCase();
        if (!group.countries.has(key)) group.countries.set(key, country);
      }
      for (const field of DATE_FIELDS) if (!mapped || mapped.has(field)) collectDate(group.fields[field], row[field]);
    }
    summary.distinctSubmissions = groups.size;

    for (const group of groups.values()) {
      group.dates = Object.fromEntries(DATE_FIELDS.map(field => [field, resolveField(group.fields[field], field, mapped)]));
      group.anchor = anchorFromDates(group.dates);
      group.countryKey = group.countries.size === 1 ? group.countries.keys().next().value : null;
      group.country = group.countryKey === null ? null : group.countries.get(group.countryKey);
      const a = group.dates.ActualSubmission, b = group.dates.ActualApproval;
      const issues = [];
      if (mapped && !mapped.has('Country')) issues.push('country_unmapped');
      else if (group.countries.size !== 1) issues.push(group.countries.size ? 'multiple_countries' : 'missing_country');
      issues.push(...dateReasons(a, 'actual_submission', today), ...dateReasons(b, 'actual_approval', today));
      if (a.state === 'valid' && b.state === 'valid' && b.day < a.day) issues.push('approval_before_submission');
      group.historyIssues = [...new Set(issues)];
      group.duration = group.historyIssues.length ? null : (b.day - a.day) / DAY;
      if (group.historyIssues.length) {
        summary.excludedHistory++;
        for (const code of group.historyIssues) globalExclusions[code] = (globalExclusions[code] || 0) + 1;
      } else summary.qualifyingHistory++;

      // A record with several countries contributes to no country model. Its
      // exclusions remain in the global audit rather than being attributed twice.
      if (group.countryKey === null) continue;
      let country = byCountry.get(group.countryKey);
      if (!country) {
        country = { country: group.country, countryKey: group.countryKey, sampleCount: 0, excludedCount: 0, consideredCount: 0, exclusions: [], exclusionCounts: Object.create(null), outlierCount: 0, medianDays: null, rangeLowDays: null, rangeHighDays: null, rangeLabel: 'Historical middle 50% (25th–75th percentiles)', scope: 'All delivered submissions for this country, before local filters', durations: [] };
        byCountry.set(group.countryKey, country);
      }
      country.consideredCount++;
      if (group.historyIssues.length) {
        country.excludedCount++;
        for (const code of group.historyIssues) country.exclusionCounts[code] = (country.exclusionCounts[code] || 0) + 1;
      } else country.durations.push(group.duration);
    }
    summary.exclusions = exclusionRows(globalExclusions);

    for (const country of byCountry.values()) {
      country.durations.sort((a, b) => a - b);
      sortedHistories.set(country.countryKey, country.durations);
      country.sampleCount = country.durations.length;
      country.medianDays = quantile(country.durations, 0.5);
      country.rangeLowDays = quantile(country.durations, 0.25);
      country.rangeHighDays = quantile(country.durations, 0.75);
      const fence = country.rangeHighDays + 1.5 * (country.rangeHighDays - country.rangeLowDays);
      country.outlierCount = country.sampleCount >= 4 ? country.durations.filter(days => days > fence).length : 0;
      country.exclusions = exclusionRows(country.exclusionCounts);
      delete country.durations;
      delete country.exclusionCounts;
    }

    for (const group of groups.values()) {
      const country = byCountry.get(group.countryKey);
      const actual = group.dates.ActualApproval;
      const anchor = actual.present ? {
        date: group.dates.ActualSubmission.day, field: 'ActualSubmission', label: SUBMISSION_LABELS.ActualSubmission,
        state: group.dates.ActualSubmission.state, reason: 'Completed benchmarks require an actual submission date.'
      } : group.anchor;
      const support = country && actual.present && group.historyIssues.length === 0
        ? supportingStats(sortedHistories.get(group.countryKey), group.duration)
        : country;
      const selfExcluded = Boolean(support && support.selfExcluded);
      const excludedCount = (country ? country.excludedCount : 0) + (selfExcluded ? 1 : 0);
      const exclusions = country ? country.exclusions.slice() : [];
      if (selfExcluded) exclusions.push({ code: 'self_excluded', label: reasonLabels.self_excluded, count: 1 });
      const entry = {
        subID: group.id, status: 'unavailable', reason: '', reasonCodes: [], reasons: [],
        country: group.country, countryKey: group.countryKey, grouping: 'Country only',
        sampleCount: support ? support.sampleCount : 0,
        excludedCount, exclusions,
        outlierCount: support ? support.outlierCount : 0,
        minimumSamples, medianDays: support ? support.medianDays : null,
        rangeLowDays: support ? support.rangeLowDays : null,
        rangeHighDays: support ? support.rangeHighDays : null,
        predictedDate: null, rangeStart: null, rangeEnd: null, overdue: false,
        rangeLabel: 'Historical middle 50% (25th–75th percentiles)',
        historyScope: selfExcluded ? 'Other delivered submissions for this country, before local filters; target excluded' : 'All delivered submissions for this country, before local filters',
        historyExclusionCodes: group.historyIssues,
        historyIncluded: group.historyIssues.length === 0,
        longHistoryFlag: false,
        actualSubmission: group.dates.ActualSubmission.day,
        actualApproval: actual.day,
        anchorDate: anchor.date, anchorField: anchor.field, anchorLabel: anchor.label,
        anchorState: anchor.state, anchorReason: anchor.reason,
        forecastFromPlan: !actual.present && anchor.state === 'valid' && anchor.field !== 'ActualSubmission',
        selfExcluded, selfExcludedCount: selfExcluded ? 1 : 0
      };
      if (entry.historyIncluded && country && country.sampleCount >= 4) {
        entry.longHistoryFlag = group.duration > country.rangeHighDays + 1.5 * (country.rangeHighDays - country.rangeLowDays);
      }
      const blockers = actual.present ? group.historyIssues : [...new Set([
        ...group.historyIssues.filter(code => !code.startsWith('actual_submission_') && code !== 'actual_approval_missing'),
        ...anchorReasons(anchor, today)
      ])];
      if (blockers.length) setStatus(entry, 'unavailable', blockers);
      else if (!support || support.sampleCount < minimumSamples) setStatus(entry, 'insufficient', [selfExcluded ? 'insufficient_benchmark_history' : 'insufficient_history']);
      else {
        setStatus(entry, actual.present ? 'benchmark' : 'estimated', []);
        entry.predictedDate = entry.anchorDate + Math.round(support.medianDays) * DAY;
        entry.rangeStart = entry.anchorDate + Math.floor(support.rangeLowDays) * DAY;
        entry.rangeEnd = entry.anchorDate + Math.ceil(support.rangeHighDays) * DAY;
        entry.overdue = !actual.present && entry.predictedDate < today;
        entry.reason = actual.present ? 'Historical benchmark from other submissions; this completed record is excluded from its own benchmark'
          : entry.overdue ? 'Historical estimate has already passed; no new future date has been invented' : 'Country median applied to ' + entry.anchorLabel.toLowerCase() + ' date';
      }
      summary[entry.status]++;
      bySubID.set(group.id, entry);
    }

    return { bySubID, byCountry, cutoff: CUTOFF, today, minimumSamples, summary };
  }

  return { analyze, resolveSubmissionDates, parseDate, reasonLabels, DAY, CUTOFF };
});
