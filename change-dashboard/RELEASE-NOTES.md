# Change Dashboard 1.2.0 — preview

- Hide the Awaiting assessment summary card for now; retain its existing fields and detailed evidence.
- Default Next due to most recently overdue first; click the header for oldest overdue first. Upcoming work follows overdue work and missing dates stay last.
- Sort and filter every column in the worklist, country breakdown and missing-parent review. Reset table clears table controls while keeping the selected view and top scope filters.
- Restore top-right distinct counts for Changes, Events, Applications, ROs, Submissions and Registrations. Worklist counts follow the current worklist across all pages; Loaded counts show the complete delivered population.
- Match the Regulatory Tracker's darker charcoal and muted blue palette, retaining Light and high-contrast modes.

Event, Change ID and Application views, country/RO evidence and all 69 field mappings are preserved. Import **change-dashboard-1.2.0.0.pbiviz** and confirm replacement of Change Dashboard. No remapping is required.

Logic and packaged browser checks cover newest/oldest ordering, missing dates, combined filters, all table controls, record-count deduplication, 10,000 submissions and 64,000 delivered rows. This is an uncertified preview; demo data is fictional. See CHANGE-DASHBOARD-INSTALL.md for exact counting and filtering rules.
