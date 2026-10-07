import assert from 'node:assert/strict';
import {calendar, parseDay, mapTable, summarize, DEFAULT_SITES, ROLES, normalizeSites} from './submissions.logic.mjs';
const now = new Date(2026, 9, 7, 12), base = {Site: 'ABO', PlannedSubmission: '2026-10-15', ActualSubmission: null, BusinessUnit: 'ID'};
const row = (id, patch = {}) => ({...base, SubID: id, ...patch});
const data = [row('A'), row('A'), row('B', {ActualSubmission: '2026-09-20'}), row('C', {PlannedSubmission: '2026-11-03', ActualSubmission: '2026-10-01'}),
  row('D', {PlannedSubmission: '2026-11-05'}), row('E', {PlannedSubmission: '2026-09-30', ActualSubmission: '2026-10-05'}),
  row('F', {PlannedSubmission: '2026-10-01'}), row('G', {Site: 'OTHER'}), row('H', {Site: null}),
  row('I', {Site: 'ABO'}), row('I', {Site: 'ADK'}), row('', {}), row('J', {ActualSubmission: '2026-10-20'}),
  row('K', {ActualSubmission: '2026-10-02'}), row('K', {ActualSubmission: '2026-10-03'}),
  row('L', {PlannedSubmission: null}), row('M', {PlannedSubmission: '07/10/2026'}), row('N'), row('N', {PlannedSubmission: '2026-11-15'}),
  row('O', {ActualSubmission: 'bad'}), row('P', {Site: 'adj', BusinessUnit: 'CMI', ActualSubmission: '2026-10-07'})];
const r = summarize(data, {now});
assert.deepEqual(r.totals, {planned: 9, inProcess: 3, submitted: 3, review: 3, overdue: 1});
assert.equal(r.buckets.length, 6); assert.equal(r.buckets[1].site, 'ADJ'); assert.equal(r.buckets[1].months[0].submitted, 1);
assert.deepEqual(r.buckets[0].months.map(m => [m.planned, m.inProcess, m.submitted, m.review]), [[6,2,1,3],[2,1,1,0]]);
assert.equal(r.checks.multipleSites, 1); assert.equal(r.checks.unassignedSite, 1); assert.equal(r.checks.outsideSites, 1);
assert.equal(r.checks.missingIds, 1); assert.equal(r.checks.missingPlan, 1); assert.equal(r.checks.planIssues, 2); assert.equal(r.checks.outsideMonths, 1);
assert.equal(summarize(data, {now, unit: 'CMI'}).totals.planned, 1);
assert.equal(summarize(data, {now, sites: []}).totals.planned, 0);
assert.equal(summarize([row('T'), row('T', {BusinessUnit: 'CMI', PlannedSubmission: '2026-11-02'})], {now, unit: 'ID'}).checks.planIssues, 1);
assert.equal(summarize([row('T'), row('T', {ActualSubmission: '2026-10-06'})], {now}).totals.submitted, 1);
assert.equal(summarize([row('T', {Site: '  abo '})], {now}).totals.planned, 1);
assert.equal(summarize([row('T', {Site: 'ABON'})], {now}).totals.planned, 0);
assert.deepEqual(calendar(new Date(2026, 11, 31)).months.map(m => m.key), ['2026-12', '2027-01']);
assert.deepEqual(calendar(new Date(2027, 0, 1)).months.map(m => m.key), ['2027-01', '2027-02']);
assert.equal(summarize([row('T', {PlannedSubmission: '2026-11-01'})], {now: new Date(2026, 10, 1)}).totals.overdue, 0);
assert.equal(summarize([row('T', {PlannedSubmission: '2026-10-31'})], {now: new Date(2026, 10, 1)}).totals.planned, 0);
assert.equal(parseDay('2026-02-29').kind, 'invalid'); assert.equal(parseDay('2028-02-29').kind, 'date');
assert.equal(parseDay('2026-13-01').kind, 'invalid'); assert.equal(parseDay('2026-10-01Tgarbage').kind, 'invalid');
assert.equal(parseDay('2026-10-01T23:45:00-05:00').day, Date.UTC(2026,9,1));
assert.equal(parseDay(new Date('2026-10-01T00:00:00Z')).day, Date.UTC(2026,9,1));
assert.deepEqual(normalizeSites(['ABO','abo','ADJ','ADK','AJG','ARDG','SCR','OTHER']), DEFAULT_SITES);
const columns = ROLES.map(k => ({roles: {[k]: true}}));
assert.deepEqual(mapTable({columns, rows: [['A','ABO','2026-10-01',null,'ID']]}).missing, []);
assert.equal(mapTable({columns: columns.slice(0,4), rows: []}).unitMapped, false);
assert.deepEqual(mapTable({columns: columns.slice(0,3), rows: []}).missing, ['ActualSubmission']);
assert.throws(() => mapTable({columns: [...columns, columns[0]], rows: []}), /only one/);
const old = (id, patch = {}) => row(id, {PlannedSubmission:'2026-09-30', ...patch});
const historical = [old('OLD', {PlannedSubmission:'2024-01-01'}), old('SEP'), old('SEP'),
  old('CMI', {Site:'ADJ',BusinessUnit:'CMI'}), row('OCT-BOUNDARY',{PlannedSubmission:'2026-10-01'}), row('NOV',{PlannedSubmission:'2026-11-01'}),
  old('LATE-SUBMITTED', {ActualSubmission:'2026-10-05'}), old('ALREADY-SUBMITTED',{ActualSubmission:'2026-09-20'}),
  old('BLANK-AND-RECORDED'), old('BLANK-AND-RECORDED',{ActualSubmission:'2026-10-01'}),
  old('FUTURE-ACTUAL',{ActualSubmission:'2026-10-20'}), old('BAD-ACTUAL',{ActualSubmission:'bad'}),
  old('CONFLICT-ACTUAL',{ActualSubmission:'2026-09-25'}), old('CONFLICT-ACTUAL',{ActualSubmission:'2026-09-26'}),
  old('CONFLICT-PLAN'), row('CONFLICT-PLAN'), old('MISSING-PLAN',{PlannedSubmission:null}), old('BAD-PLAN',{PlannedSubmission:'bad'}),
  old('MULTISITE'), old('MULTISITE',{Site:'ADK'}), old('OUTSIDE',{Site:'OTHER'}), old('NOSITE',{Site:null}), old(''),
  old('FUTURE-PLAN',{PlannedSubmission:'2026-12-01'})];
const h=summarize(historical,{now});
assert.equal(h.backlog.count,3);assert.equal(h.backlog.cutoff,Date.UTC(2026,9,1));
assert.deepEqual(h.backlog.rows.map(r=>r.id),['OLD','CMI','SEP']);assert.ok(h.backlog.rows.every(r=>r.overdue&&r.actual.kind==='blank'));
assert.deepEqual(h.buckets.map(s=>s.backlog.count),[2,1,0,0,0,0]);assert.equal(h.totals.planned,2);assert.equal(h.totals.inProcess,2);
assert.ok(h.backlog.rows.every(r=>!h.buckets.some(s=>s.months.some(m=>m.rows.some(a=>a.id===r.id)))));
assert.equal(summarize(historical,{now,unit:'CMI'}).backlog.count,1);assert.equal(summarize(historical,{now,sites:['ADJ']}).backlog.count,1);
assert.equal(summarize(historical,{now,sites:[]}).backlog.count,0);
assert.equal(summarize([old('U'),old('U',{BusinessUnit:'CMI',ActualSubmission:'2026-10-01'})],{now,unit:'ID'}).backlog.count,0);
assert.equal(summarize([old('SITE'),old('SITE',{Site:'OTHER'})],{now,sites:['ABO']}).backlog.count,0);
assert.ok(h.issues.some(r=>r.id==='FUTURE-ACTUAL'));assert.ok(h.issues.some(r=>r.id==='BAD-ACTUAL'));
assert.ok(h.issues.some(r=>r.id==='CONFLICT-ACTUAL'));assert.ok(h.issues.some(r=>r.id==='CONFLICT-PLAN'));
const carry=[old('SEP'),row('OCT',{PlannedSubmission:'2026-10-01'}),row('NOV',{PlannedSubmission:'2026-11-01'})];
assert.equal(summarize(carry,{now}).backlog.count,1);assert.equal(summarize(carry,{now:new Date(2026,10,1)}).backlog.count,2);
assert.equal(summarize([old('DEC',{PlannedSubmission:'2026-12-31'})],{now:new Date(2027,0,1)}).backlog.count,1);
assert.equal(summarize([old('SEP',{ActualSubmission:'2026-10-07'})],{now}).backlog.count,0);
assert.equal(summarize([],{now}).backlog.count,0);
const big = Array.from({length:10000}, (_,i) => row('PERF-'+i, {Site: DEFAULT_SITES[i%6], ActualSubmission: i%2 ? null : '2026-10-01', PlannedSubmission: i%3 ? '2026-10-15' : '2026-11-15'}));
const start = performance.now(), stress = summarize(big.flatMap(r => [r,r,r]), {now});
const ms = performance.now() - start;
assert.equal(stress.totals.planned, 10000); assert.equal(stress.totals.submitted,5000); assert.equal(stress.totals.inProcess,5000);
assert.ok(ms < 5000, `30k-row calculation unexpectedly slow: ${ms}ms`);
const backlogStart=performance.now(),backlogStress=summarize(big.flatMap(r=>Array(3).fill({...r,PlannedSubmission:'2026-09-30'})),{now});
assert.equal(backlogStress.backlog.count,5000);assert.equal(backlogStress.totals.planned,0);assert.equal(backlogStress.checks.outsideMonths,5000);
assert.ok(performance.now()-backlogStart<5000);
console.log(`PASS: planned-month cohorts, separate historical backlog, exclusive date cutoff, late completion, duplicates, date/site conflicts, site/unit scope, month/year rollover and 10,000 distinct submissions in ${Math.round(ms)}ms.`);
