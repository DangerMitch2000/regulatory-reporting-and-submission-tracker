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
  DEFAULT_SITES.forEach((site, si) => {
    for (let i = 0; i < [5,3,12,4,2,8][si]; i++) {
      const row = {SubID: `DEMO-${site}-BACKLOG-${String(i+1).padStart(3,'0')}`, Site: site, PlannedSubmission: iso(i%2 ? -3 : -1, i%27+1), ActualSubmission: null, BusinessUnit: i%4 ? 'ID' : 'CMI'};
      rows.push(row); if (i%3===0) rows.push({...row});
    }
    rows.push({SubID: `DEMO-${site}-PRIOR-SUBMITTED`, Site: site, PlannedSubmission: iso(-1,15), ActualSubmission: iso(0,Math.min(3,currentDay)), BusinessUnit: 'ID'});
  });
  const states = new Map();
  const enriched = rows.map(row => {
    if (!states.has(row.SubID)) {
      const i = states.size;
      states.set(row.SubID, {
        SubStatus: row.ActualSubmission ? 'Completed' : ['In Progress','Planned','Ready For Submission','Cancelled','Withdrawn','Inactive',null][i%7],
        ROStatus: row.ActualSubmission ? 'Health Authority Approved' : ['In Progress','Planned','Archived','Rejected','On Hold By Health Authority'][i%5],
        AppStatus: i%6 ? 'Active' : 'Inactive',
        DispatchRequired: i%3 === 0 ? 'No' : 'Yes',
        PlannedDispatch: new Date(Date.parse(row.PlannedSubmission)-14*86400000).toISOString().slice(0,10),
        ActualDispatch: row.ActualSubmission ? row.ActualSubmission : i%3===2 ? iso(-1,1) : null
      });
    }
    const registration=row.SubID==='DEMO-ABO-1-001'?{RegistrationID:'DEMO-REG-001',RegistrationCountry:'Ireland',RegistrationStatus:'Approved',RegistrationStart:iso(-1,1),RegistrationEnd:iso(12,1)}:row.SubID==='DEMO-ADJ-2-001'?{RegistrationID:'DEMO-REG-002',RegistrationCountry:'Germany',RegistrationStatus:'Conditionally Approved',RegistrationStart:iso(0,1),RegistrationEnd:iso(12,1)}:{};
    return {...row,...states.get(row.SubID),FallbackCountry:['France','Spain','Germany','Italy','Poland','Ireland'][DEFAULT_SITES.indexOf(row.Site)],...registration};
  });
  // These old plans have no actual date but are complete for backlog purposes.
  return [...enriched,
    {SubID:'DEMO-CLOSED-BY-SUB',Site:'ABO',PlannedSubmission:iso(-1,1),ActualSubmission:null,BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'In Progress',AppStatus:'Active'},
    {SubID:'DEMO-CLOSED-BY-RO',Site:'ADJ',PlannedSubmission:iso(-1,1),ActualSubmission:null,BusinessUnit:'ID',SubStatus:'In Progress',ROStatus:'Health Authority Approved',AppStatus:'Active'},
    {SubID:'DEMO-CLOSED-BY-BOTH',Site:'ADK',PlannedSubmission:iso(-1,1),ActualSubmission:null,BusinessUnit:'ID',SubStatus:'Completed',ROStatus:'Health Authority Approved',AppStatus:'Active'}
  ];
}
