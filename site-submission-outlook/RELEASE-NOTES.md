Site Submission Outlook 1.3.0 adds **Dispatch required**, **Planned dispatch date** and **Actual dispatch date** as optional mappings.

**Overdue by next action** separates internal dispatch delays from late authority submissions:

- **Internal dispatch:** required, mapped actual dispatch date blank, planned dispatch before today.
- **Authority submission:** dispatched on/before today, or dispatch not required, and planned submission before today.
- **Check dispatch data:** submission plan already past due but the dispatch stage or dispatch due date cannot be established.

Each submission counts once in **Total overdue**. Recording dispatch removes it from the internal group; it becomes an authority delay only after the submission deadline passes. Due today is not overdue. Submitted records and Health Authority Approved ROs are excluded from all overdue groups. Existing monthly In process/Submitted calculations are retained.

The total includes all delivered dates, including earlier plans and dispatch due for later/missing submission plans. The earlier-plan backlog and the two-month overdue count are subsets of the total. Required dispatch planned for the future is not yet overdue; reversed dates are flagged for review. Missing or conflicting values are never silently converted to No or a fabricated date.

Click an overdue card for its IDs, oldest applicable due date first. Details include the dispatch stage, requirement and both dispatch dates. Site, stage and search filters work with **Copy IDs** across all pages. Monthly, backlog and Data checks lists also retain ID copying. Dispatch alone, including internal Distributed state, does not establish authority submission.

**Import site-submission-outlook-1.3.0.0.pbiviz over the existing visual**, then map the three optional dispatch columns from your submission data. Existing mappings and visual identity are unchanged. Business-unit and separate lifecycle-state filters, previous-day As of label and light/dark/screenshot views are retained. Keep all relevant dates in report/page/visual filters: the visual can only count delivered records.

Release checks cover separate dispatch/submission due dates, no double counting, optional mappings, blank/future/invalid/conflicting data, completion and approval evidence across duplicate rows, filters, dispatch transitions, ID copying across pages, both themes, compact layout, and 10,000 submissions / 30,000 source rows. The actual packaged runtime runs the dispatch interaction checks. Demo and screenshots use fictional records.
