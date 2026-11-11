# Change Dashboard 1.3.0 — preview

- Add a top **Commercial region** filter, using a new optional source-field mapping. Missing regions can be reviewed as Not recorded; no region is inferred from geography or registration data.
- Add **Related items** to the main event/change/application list: distinct App, RO, Sub and Reg counts plus available Change IDs. Click counts for the full selectable IDs in Details. Repeated source rows do not inflate the counts.
- Add **Implementation date**, using the existing Change Planned Implementation Date in DD MMM YYYY format. Missing/conflicting values are clearly labelled; event completion dates are never substituted.
- Both new columns support sorting and text filters. Region selections scope country work, cards, next actions, linked IDs, exports and Worklist counts; Loaded counts remain unchanged.

Import **change-dashboard-1.3.0.0.pbiviz** and replace Change Dashboard. The identity and 69 existing mappings are retained. Map your separate Commercial region column to the new **Commercial region** well to enable that filter.

The dark theme, newest-overdue ordering, Reset table and hidden assessment card are preserved. Automated logic/browser checks include duplicate memberships, region and country scope, optional fields, missing/conflicting dates, linked ID copying, sorting/filtering and large delivered datasets. This is an uncertified preview; demo data is fictional.
