# Change Dashboard 1.7.0 — dual planning dates preview

- Show **Change implementation** and **Event planned completion** as two labelled values in the same main-list column, across all three grouping modes.
- Keep either date available when the other is blank. Sort by a usable change implementation date first, otherwise the usable event completion date; filter both source values.
- Support the verified day/month/year planning-source format, with optional time, alongside ISO and native Power BI dates. Display valid dates consistently as **DD MMM YYYY**.
- Keep multiple/invalid source values explicit, expose them in hover and **Planning dates** Details, and distinguish format errors from dates outside 1900–2100.
- Append a separate event-completion column to CSV exports. Dispatch/submission/approval queues and their date parsing are unchanged.

Import **change-dashboard-1.7.0.0.pbiviz**, replacing Change Dashboard. The visual identity and all **70 existing roles** are preserved.

Map your event's **planned_completion_date__rim** field to **Event planned completion**. Keep **planned_change_implementation_date__c** mapped to **Planned Implementation Date**. Use raw Date columns, not Date hierarchies; do not summarize.

Validation covers both source formats, blank/invalid/multiple dates, fallback ordering, filters, separate exports, grouped applications and the source/packaged browser runtime. This is an uncertified preview; demonstration data is fictional.
