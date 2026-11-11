# Site Submission Outlook 1.6.1

This patch fixes the spacing seen on larger Power BI visuals:

- The chart uses the available height instead of leaving a blank panel below it.
- Month bars widen with each site's column, reducing excessive gaps between sites.
- Each site's backlog box aligns with its three month bars.
- Smaller visuals retain readable labels, clear click targets and horizontal chart scrolling.

The three-month plan, yesterday reference, calculations, field mappings and visual identity are unchanged. Import `site-submission-outlook-1.6.1.0.pbiviz` to replace the existing Site Submission Outlook.

Source and packaged browser checks cover wide/tall and narrow layouts, Screenshot mode, filter controls and count drill-through. The preview uses fictional data.
