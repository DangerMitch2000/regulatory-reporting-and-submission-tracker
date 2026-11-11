# Change Dashboard 1.6.1 — bug-fix preview

- Fix country rows painting over sticky column titles while scrolling.
- Keep the selected Details record on the visible worklist page; preserve scrolling and keyboard focus after row selection, sorting and paging.
- Preserve Diagram/List focus, search caret and List scrolling; reveal country matches in List view.
- Prevent selected or searched event paths from leaking through a shared application into another event's ROs and submissions.
- Keep missing/conflicting-country records visible for review, with accurate related counts. Retain both sides of lifecycle-state conflicts under inactive filtering; remove phantom country buckets.
- Preserve unknown-country records under commercial-region filtering, apply inactive filtering to application-only records, and unify equivalent country-filter values.
- Clear detail-table filters with **Clear filters**, and preserve country scope after capitalisation-only refreshes.

Import **change-dashboard-1.6.1.0.pbiviz** and replace Change Dashboard. The visual identity and all **70 existing mappings** are unchanged; no new fields are required.

Validation: logic and graph regressions, 13 focused graph browser checks, sticky-header hit tests, full source and packaged Visual interaction/lifecycle checks, 10,000 submissions, 20,000 graph rows and 64,000 delivered rows. No source data is modified. This is an uncertified preview; test/demo data is fictional and live Velocity reconciliation remains a separate check.
