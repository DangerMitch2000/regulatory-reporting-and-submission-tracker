# Change Dashboard 1.0.0 — preview

New separate Power BI visual using the Regulatory Tracker's existing 69 field roles. One row per Change ID, clickable assessment/dispatch/submission/approval queues, country-level next actions and the evidence behind them.

- Manufacturing-site, product, business-unit, country and change-state filters.
- Distinct change counts, deduplicated filing evidence and expected-country visibility.
- Internal dispatch overdue separately from authority submission; source states can supply completion evidence without inventing actual dates.
- Missing dates, ambiguous links, mismatched countries and HA rejection remain visible for review.
- Linked source fields and platform links, copyable IDs and CSV export with selectable-text fallback.
- Compact responsive layout, Dark/Light themes, high contrast and paginated worklists.
- All full dates use DD MMM YYYY; previous-day as-of reference is explicit.

Download **change-dashboard-1.0.0.0.pbiviz**, import as a new visual, and map the existing tracker columns. The tracker and registration map remain separate. See **CHANGE-DASHBOARD-INSTALL.md** for mapping and counting rules. Demo data is fictional. This is an uncertified preview; validate representative changes against Velocity before operational use.
