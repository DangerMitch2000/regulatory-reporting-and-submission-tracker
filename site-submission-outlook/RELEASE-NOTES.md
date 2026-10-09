# Site Submission Outlook 1.5.0

Identify records without Submission IDs or Registration IDs using two new optional mappings: RO ID and Application ID.

- Details shows each source RO/application pairing and includes these IDs in search.
- Every delivered missing-Submission-ID source row remains in Details, including repeated rows and rows sharing the same parent identifiers. These rows are not counted as distinct submissions and parent IDs never substitute for Submission IDs.
- Copy RO IDs and Copy application IDs produce separate distinct ID lists across all matching pages. Copy IDs still contains Submission IDs only. Individual selection and the clipboard fallback support each ID type.
- Existing submission counts, registration completion, country fallback, overdue groups, filters and visual identity are preserved. Keep Submission ID mapped; its values may be blank.

Only rows delivered by Power BI can be preserved. Review report filters and model relationships if expected parent records are absent from both the visual and a standard table.

Calculation, browser and actual-package tests cover missing identifiers, source pairs, duplicates, optional mappings, filtered search/copy, clipboard restrictions, both themes and 10,000 submissions plus 1,000 unidentified source rows. All public demonstration records are fictional.
