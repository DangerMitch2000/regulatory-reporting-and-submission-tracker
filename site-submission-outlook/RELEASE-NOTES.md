# Site Submission Outlook 1.6.5

Opens with a clean chart for PDF exports and presentation captures, makes **Abbott Diagnostics Scarborough, Inc.** one of the default sites, and fits its full name in the chart.

- A newly loaded visual starts in **Screenshot mode** with controls hidden. Click inside the visual, such as a blank chart area, and press **Escape** to restore them; clicking a chart count or summary statistic exits the mode and opens Details.
- Preserves the chosen mode during data updates and resizing. Revisiting a report page may preserve the existing visual instance and its chosen mode. Loading and partial-data notices stay visible.
- Replaces the literal **SCR** value in the six-site default with the full Scarborough manufacturer name.
- Wraps the chart label across up to three measured lines; keeps the full name in the tooltip, filter and Details.
- Upgrades saved selections containing exactly the old main six values to the new preset when loaded.
- Preserves other custom selections, including an empty selection or **SCR** on its own.
- **Use main six sites** restores the updated default.

Source matching remains exact apart from case and surrounding spaces. **SCR** and **Abbott Diagnostics Scarborough, Inc.** are separate values, not aliases. The full name must be present in the mapped field's delivered data to contribute records. If the source contains only **SCR**, select it manually in **Site / manufacturer**.

The Screenshot mode default prepares the visual's layout; end-to-end Power BI PDF export has not been tested.

Import `site-submission-outlook-1.6.5.0.pbiviz` to replace the existing Site Submission Outlook. The visual identity and all 21 field roles are unchanged. The searchable site filter, calendar-year statistics, Wallace Sans typography and Details scroll-position fix are retained.
