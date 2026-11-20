// Entirely fictional fixtures. Dates stay fixed so preview screenshots are reproducible.
export const DEMO_NOW = '2026-11-20T12:00:00Z';
export const DEMO_AS_OF = '2026-11-18';
export const DEMO_YEARS = [2025, 2026];
export const SCARBOROUGH = 'Abbott Diagnostics Scarborough, Inc.';

function makeSite(site, code, submissions, approvals) {
  const rows = [];
  DEMO_YEARS.forEach((year, yi) => {
    const total = Math.max(submissions[yi], approvals[yi]);
    for (let i = 0; i < total; i++) {
      const suffix = `${code}-${year}-${String(i + 1).padStart(3, '0')}`;
      const month = String(1 + i % 9).padStart(2, '0');
      const row = {
        SubID: `DEMO-SUB-${suffix}`, ROID: `DEMO-RO-${suffix}`,
        AppID: `DEMO-APP-${code}-${String(1 + i % 4).padStart(2, '0')}`,
        RegistrationID: `DEMO-REG-${suffix}`,
        Site: site, BusinessUnit: 'ID', CommercialRegion: 'WHO',
        Product: ['Fictional assay Alpha', 'Fictional assay Beta', 'Fictional assay Gamma'][i % 3],
        SubmissionType: i % 3 ? 'Variation' : 'Initial application',
        ActualSubmission: i < submissions[yi] ? `${year}-${month}-05` : null,
        ActualApproval: i < approvals[yi] ? `${year}-${month}-21` : null,
        AsOfDate: DEMO_AS_OF,
        SubmissionURL: `https://example.com/fictional/submissions/${suffix}`,
        RegulatoryObjectiveURL: `https://example.com/fictional/ros/${suffix}`,
        RegistrationURL: `https://example.com/fictional/registrations/${suffix}`
      };
      rows.push(row);
      // Joined source rows must not multiply milestone counts.
      if (i % 7 === 0) rows.push({...row});
    }
  });
  return rows;
}

export function sample() {
  const active = [
    ...makeSite('ABO', 'ABO', [10, 14], [7, 9]),
    ...makeSite('ADK', 'ADK', [18, 26], [13, 21]),
    ...makeSite(SCARBOROUGH, 'SCR', [4, 6], [0, 4])
  ];
  const inactive = ['ADJ', 'AJG', 'ARDG'].map(site => ({
    SubID: `DEMO-SUB-${site}-UNDATED`, ROID: `DEMO-RO-${site}-UNDATED`,
    Site: site, BusinessUnit: 'ID', CommercialRegion: 'WHO',
    ActualSubmission: null, ActualApproval: null, AsOfDate: DEMO_AS_OF,
    Product: 'Fictional assay Alpha', SubmissionType: 'Initial application'
  }));
  // These remain in filter choices, but are outside the initial ID / WHO scope.
  return [...active, ...inactive,
    {...active[0], SubID: 'DEMO-NON-WHO', ROID: 'DEMO-NON-WHO-RO', CommercialRegion: 'EMEA'},
    {...active[0], SubID: 'DEMO-OTHER-BU', ROID: 'DEMO-OTHER-BU-RO', BusinessUnit: 'CMI'},
    {...active[0], SubID: 'DEMO-REGION-NOT-RECORDED', ROID: 'DEMO-REGION-NOT-RECORDED-RO', CommercialRegion: ''}
  ];
}

export function sixSiteSample() {
  return [...sample(),
    ...makeSite('ADJ', 'ADJ', [5, 8], [3, 6]),
    ...makeSite('AJG', 'AJG', [3, 5], [1, 3]),
    ...makeSite('ARDG', 'ARDG', [2, 4], [0, 2])
  ];
}
