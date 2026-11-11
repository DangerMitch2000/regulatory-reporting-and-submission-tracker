# Site Submission Outlook 1.6.0

The plan now shows last month, this month and next month across the six sites. The chart fills the available width, with compact summary counts above it and the longer explanation collapsed below it.

- Use yesterday consistently for the As of label, actual-date checks and overdue calculations. Month selection still follows the current calendar month.
- Move the earlier backlog cutoff before the first displayed month, keeping the monthly plan and backlog separate.
- Add optional Product and Commercial region filters; Country uses the existing Registration country / Secondary country mappings.
- Inspect Submitted evidence as actual date, Submission state or Registration approval, counting each submission once.
- Use compact sortable/filterable Details with Days overdue and expandable secondary source fields. Copy IDs still includes all matching pages.
- Accept strict day/month/year dates and timestamps; flag conflicting registration states or RO/application links while preserving the agreed completion policy.

Import `site-submission-outlook-1.6.0.0.pbiviz` to replace the existing Site Submission Outlook. Its identity and previous field mappings are unchanged. Product and Commercial region are new optional field wells, not additional required columns.

Previous-month bars show the latest delivered progress, not historical month-end snapshots. The As of label is a reporting reference, not a verified data-refresh timestamp. Partial-delivery notices remain visible. Validate your report against a standard Power BI table using the same mappings and filters.

The release is published only after source, interaction and actual PBIVIZ runtime checks pass. The downloadable HTML preview contains fictional data.
