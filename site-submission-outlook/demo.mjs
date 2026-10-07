import {DEFAULT_SITES} from './submissions.logic.mjs';
export function sample(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), currentDay = now.getDate(), iso = (offset, day) => new Date(Date.UTC(y, m + offset, day)).toISOString().slice(0, 10);
  const planned = [[16, 8], [10, 6], [26, 20], [14, 6], [5, 4], [24, 12]], submitted = [[7, 0], [0, 1], [11, 2], [0, 0], [1, 0], [2, 1]], rows = [];
  DEFAULT_SITES.forEach((site, si) => planned[si].forEach((n, mi) => {
    for (let i = 0; i < n; i++) {
      const row = {SubID: `DEMO-${site}-${mi+1}-${String(i+1).padStart(3,'0')}`, Site: site, PlannedSubmission: iso(mi, i%27+1), ActualSubmission: i < submitted[si][mi] ? iso(0, Math.min(3,currentDay)) : null, BusinessUnit: i%7 ? 'ID' : 'CMI'};
      rows.push(row); if (i%9===0) rows.push({...row});
    }
  }));
  return rows;
}
