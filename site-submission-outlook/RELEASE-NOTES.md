# Site Submission Outlook 1.6.4

Makes the existing site filter searchable and adds compact statistics for the current calendar year's plan.

- Search full delivered names in **Site / manufacturer**, with up to six selections.
- See the mapped source column and selected values that have no delivered rows.
- Use **Clear sites** or restore the main six site codes.
- Search narrows the picker choices; chart counts change only when the site selection changes.
- A clickable annual summary shows Planned, In process, Submitted, Submitted percentage and Overdue in plan for January–December of the current calendar year.
- Annual statistics use the same filters, distinct Submission IDs and previous-day checks as the three-month chart.

`SCR` and `Abbott Diagnostics Scarborough, Inc.` are separate values. To select the full name, search **Scarborough**, remove **SCR** or clear the selection if six slots are occupied, then select the delivered manufacturer name. No alias or relationship is inferred. The picker cannot recover data excluded by report filters or correct an incorrect source field or model relationship.

Annual statistics are grouped by the mapped planned submission date. Submitted reflects the latest delivered completion evidence for that planned cohort, not actual authority filings made during the calendar year. The annual and three-month counts overlap.

Import `site-submission-outlook-1.6.4.0.pbiviz` to replace the existing Site Submission Outlook. The visual identity and all 21 field roles are unchanged. Wallace Sans typography from 1.6.3 and the Details scroll-position fix from 1.6.2 are retained.
