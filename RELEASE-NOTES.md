# Regulatory Tracker 1.18.0

The tracker now opens centred on today in a 90-day window. Use **Today** to return after panning, or **Fit all** to fit the workflow dates. Data refresh and resizing keep your chosen window, and registration validity dates remain excluded from Fit all.

- **Compact, adjustable columns:** product names use up to two lines, countries one, and manufacturing sites two lines total. Drag a column boundary to resize it; double-click a boundary to reset the widths. Full values remain in hover and Details.
- **Clickable hierarchy counts:** click RO, Sub or Reg counts to reveal the matching children in that branch. A single result opens Details; multiple results are shown as a list.
- **Consistent dates:** full dates display as `DD MMM YYYY`, such as `23 Oct 2026`, in Details, tooltips, copied text, date filters and data-quality views. Axis labels stay compact and raw diagnostic values remain available.
- **Parent-bar navigation:** clicking a parent bar, including its continuation arrow, expands or collapses its children and opens Details. Record names and childless bars open Details.

Verification covers compact layouts, browser scaling, drag/pan separation, filtered count navigation, data refresh, all workflow dates, and synthetic scenarios with 10,000 submissions and 10,000 registrations. These checks run in a local/browser Power BI visual host; they do not measure your report's model or network queries.

## Install the update

Download **regulatory-tracker-1.18.0.0.pbiviz** from this release. In Power BI Desktop, use the Visualizations menu to import the visual from the downloaded file and accept the update to the existing visual. Save the report and republish it to update the browser report.

The visual keeps its existing identity and field mappings. No additional fields or relationship changes are required for this update. This remains an uncertified preview release.
