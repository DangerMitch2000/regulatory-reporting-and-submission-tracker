# Regulatory Tracker 1.18.1

The estimated LM dossier preparation window now ends at a valid **actual dispatch date**. Its start is calculated backwards using the existing application standard duration. This is an estimated window, not a recorded preparation start or measured time spent.

- If actual dispatch is blank or unmapped, use latest planned dispatch, then original planned dispatch only when latest is also blank or unmapped.
- Invalid or conflicting higher-priority dates withhold the estimate. A future actual dispatch date also withholds it without plan fallback; future planned dates remain eligible. A valid actual dispatch date can still anchor it when dispatch plans are missing, invalid or conflicting; source-plan diagnostics remain available.
- Keep one month equal to 30 calendar days and one week equal to 7 days. Invalid or conflicting preparation durations still withhold estimates. Dispatch required=False still suppresses the preparation bar.
- Restore milestone dates correctly when switching Calendar → Elapsed days → Calendar, including repeated switches. Elapsed positions are recalculated from preserved source dates.
- Keep all navigation and layout improvements from 1.18.0, with no new fields or field remapping.

The release workflow includes the preparation source tests and actual-visual browser checks before packaging. Power BI Desktop/Service import remains subject to the report's model and tenant settings.

## Install the update

Download **regulatory-tracker-1.18.1.0.pbiviz** from this release. In Power BI Desktop, import the file through the Visualizations menu and accept replacement of the existing visual. Save the report and republish it to update the browser report.

The visual keeps its existing GUID and field roles. This remains an uncertified preview release.
