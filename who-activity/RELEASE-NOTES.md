# Submissions & Approvals 1.1.2

Removes the optional Data as-of date field from the Power BI field wells and data mapping.

- Yesterday is always the reference date, clearly labelled as a reference rather than a source refresh timestamp.
- Removed extract-date checks and field-coverage entries. Data checks continue to cover the six milestone date fields and three current states.
- Legacy as-of values cannot override the cutoff. Actual dates after yesterday remain excluded; valid future Initial and LBE plans remain eligible.
- Other field wells, the visual identity, filtering and distinct Submission/RO counting rules remain unchanged.

Import this package to replace the existing visual. The removed field no longer needs to be mapped. The README explains the reference-date behavior.

The demo uses fictional data. This remains an uncertified preview; screenshot mode does not enable native Power BI PowerPoint/PDF export.
