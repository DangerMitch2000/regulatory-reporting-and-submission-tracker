Site Submission Outlook 1.2.1 counts **Submission state Completed as Submitted**, even without an actual submission date. Monthly segments, completion percentage and details follow this rule. A valid actual submission date on or before today independently establishes Submitted; each ID still counts once.

Technically complete submissions also leave **overdue backlog** when **Submission state is Completed OR RO state is Health Authority Approved**, even with a blank actual submission date. Either condition is enough. Site counts, the total and the backlog details list use the same rule.

Completion is checked across every delivered row for each distinct Submission ID before local filters can hide evidence. Labels ignore case and extra whitespace. Other states such as Conditionally Approved, Cancelled, Archived or an Application state do not automatically establish completion. Invalid or conflicting date/site data remains available in Data checks.

**Import `site-submission-outlook-1.2.1.0.pbiviz` over the existing visual.** No new fields are introduced. Ensure the existing **Submission state** and **RO state** fields are mapped so both conditions can apply. If only one is mapped, its condition still works; blanks and unmapped values cannot establish completion. The stable visual identity is unchanged.

Details identify **Submitted · Completed state** when no qualifying actual date exists. No date is invented. Invalid, future or conflicting actual dates remain in Data checks even when Completed establishes progress. RO Health Authority Approved alone supplies the backlog exclusion, not monthly Submitted progress. Keep older rows included in report/page/visual filters. See `SITE-SUBMISSION-OUTLOOK-INSTALL.md` for the full rules.

Regression checks cover each completion condition independently, both together, blank actual dates, duplicate evidence, case/whitespace, optional mappings, refreshes, monthly counts, backlog details, filters and 10,000 distinct submissions with 30,000 source rows. The demo includes three old plans completed by state without actual dates; they are correctly absent from backlog. Demonstration data and the preview image are fictional.
