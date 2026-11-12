# Regulatory Tracker 1.18.2

New visual instances and the browser demo start with **Business Unit = ID**.

- Select another business unit, clear the selection to All, or use **Reset filters** to show all units. Your choice survives ordinary refresh, resize and grouping changes within the visual instance.
- Keep ID selected during empty or partial deliveries. When BusinessUnit is mapped but no ID records are delivered, retain the visible ID selection and an empty chart.
- Use All for a nonempty delivery without a BusinessUnit mapping, keeping those records accessible.
- Preserve the visual GUID, all 69 field roles, source identities, counting rules and date calculations. No field remapping is required.

Focused browser and actual-host regression checks cover startup, mixed and missing ID data, partial deliveries, explicit selections, Reset filters and unmapped data alongside the existing tracker suites.

## Install the update

Download **regulatory-tracker-1.18.2.0.pbiviz** from this release. In Power BI Desktop, import the file through the Visualizations menu and accept replacement of the existing visual. Save the report and republish it to update the browser report.

This remains an uncertified preview release. Power BI Desktop/Service import remains subject to the report's model and tenant settings.
