(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.regulatoryPredictions = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400000;
  const CUTOFF = Date.UTC(2020, 0, 1);
  // Approval plans are deliberately independent of this historical estimate.
  // Their validation and warnings belong to Data Quality, not eligibility.
  const DATE_FIELDS = ['ActualSubmission', 'ActualApproval'];
  const reasonLabels = Object.freeze({
    missing_country: 'Country is missing',
    multiple_countries: 'More than one country; approval time cannot be attributed to one country',
    actual_submission_missing: 'Actual submission date is missing',
    actual_submission_invalid: 'Actual submission date is invalid',
    actual_submission_conflicting: 'Actual submission dates conflict across membership rows',
    actual_submission_before_2020: 'Actual submission date is before January 2020',
    actual_submission_future: 'Actual submission date is after today',
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
    if (!match || !Number.isFinite(Date.parse(raw))) return { state: 'invalid', day: null };
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) {
      return { state: 'invalid', day: null };
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
      const id = text(row && row.SubID);
      if (!id) { summary.missingIDRows++; continue; }
      let group = groups.get(id);
      if (!group) {
        group = { id, countries: new Map(), fields: Object.fromEntries(DATE_FIELDS.map(field => [field, dateBucket()])) };
        groups.set(id, group);
      }
      for (const country of countryValues(row.Country)) {
        const key = country.toLowerCase();
        if (!group.countries.has(key)) group.countries.set(key, country);
      }
      for (const field of DATE_FIELDS) collectDate(group.fields[field], row[field]);
    }
    summary.distinctSubmissions = groups.size;

    for (const group of groups.values()) {
      group.dates = Object.fromEntries(DATE_FIELDS.map(field => [field, resolved(group.fields[field])]));
      group.countryKey = group.countries.size === 1 ? group.countries.keys().next().value : null;
      group.country = group.countryKey === null ? null : group.countries.get(group.countryKey);
      const a = group.dates.ActualSubmission, b = group.dates.ActualApproval;
      const issues = [];
      if (group.countries.size !== 1) issues.push(group.countries.size ? 'multiple_countries' : 'missing_country');
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
        selfExcluded, selfExcludedCount: selfExcluded ? 1 : 0
      };
      if (entry.historyIncluded && country && country.sampleCount >= 4) {
        entry.longHistoryFlag = group.duration > country.rangeHighDays + 1.5 * (country.rangeHighDays - country.rangeLowDays);
      }
      const blockers = actual.present ? group.historyIssues : group.historyIssues.filter(code => code !== 'actual_approval_missing');
      if (blockers.length) setStatus(entry, 'unavailable', blockers);
      else if (!support || support.sampleCount < minimumSamples) setStatus(entry, 'insufficient', [selfExcluded ? 'insufficient_benchmark_history' : 'insufficient_history']);
      else {
        setStatus(entry, actual.present ? 'benchmark' : 'estimated', []);
        entry.predictedDate = entry.actualSubmission + Math.round(support.medianDays) * DAY;
        entry.rangeStart = entry.actualSubmission + Math.floor(support.rangeLowDays) * DAY;
        entry.rangeEnd = entry.actualSubmission + Math.ceil(support.rangeHighDays) * DAY;
        entry.overdue = !actual.present && entry.predictedDate < today;
        entry.reason = actual.present ? 'Historical benchmark from other submissions; this completed record is excluded from its own benchmark'
          : entry.overdue ? 'Historical estimate has already passed; no new future date has been invented' : 'Country median applied to actual submission date';
      }
      summary[entry.status]++;
      bySubID.set(group.id, entry);
    }

    return { bySubID, byCountry, cutoff: CUTOFF, today, minimumSamples, summary };
  }

  return { analyze, parseDate, reasonLabels, DAY, CUTOFF };
});
