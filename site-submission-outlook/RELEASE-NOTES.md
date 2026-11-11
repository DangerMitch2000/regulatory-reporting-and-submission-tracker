# Site Submission Outlook 1.6.2

Fixes the jump to the top when expanding or collapsing a submission in Details.

- Keeps the visual/page scroll position while the row updates.
- Preserves both vertical and horizontal table scrolling, plus horizontal chart scrolling.
- Returns keyboard focus to the same plus/minus control without scrolling it again.
- Selecting a new chart count still intentionally opens its matching Details.

The three-month plan, responsive spacing, yesterday reference, calculations, mappings and visual identity are unchanged. Import `site-submission-outlook-1.6.2.0.pbiviz` to replace the existing Site Submission Outlook.

Source and actual packaged-runtime browser checks cover expansion/collapse at a scrolled row, keyboard use and existing layout/count/filter/copy behavior. The preview uses fictional data.
