# IVDR Registration Overview 1.2.0

A separate Power BI visual for a new report page named **IVDR Registration Overview**. It does not replace or modify the 2026 Roadmap or Regulatory Tracker. The new visual has its own GUID.

The left table shows sites with IVDR, Non-IVDR and Total columns. Expand a site (or click its bar) to show Dispatched, In Progress / Expected, Unconfirmed, optional Inferred, and Dispatch not required progress rows. Horizontal bars on the right show each site's volume split into IVDR and Non-IVDR, with its IVDR percentage. Text is larger and totals are emphasized. Narrow visuals stack the two panels.

## Import and field mapping

Import `ivdr-registration-overview-1.2.0.0.pbiviz` using **Visualizations → … → Import a visual from a file**, then add it to a new report page. This package cannot create report pages itself.

| Field well | Map to |
|---|---|
| SubID | Unique submission identifier |
| OriginalDispatch | Original planned dispatch date |
| LatestDispatch | Latest planned dispatch date |
| ActualDispatch | Actual dispatch date |
| ActualSubmission | Actual submission date |
| ActualApproval | Actual approval date |
| Site | Explicit site field; not assumed to be legal manufacturer |
| BusinessUnit | Business unit field |
| Project | Regulatory Objective project field |
| Dispatch required (DispatchRequired) | Optional Submission field “dispatch required c”, as identified in the model; use the existing source column without renaming it |

Source columns do not need renaming. Map raw date columns, not date hierarchies. **Project must be mapped**: an unmapped field does not silently classify every record as Non-IVDR. Blank values within a mapped Project field do count as Non-IVDR.

## Classification and reconciliation

- Any positive IVDR label across a submission's delivered project values classifies the submission as IVDR, including combinations with rebranding or UDI. Matching is case-insensitive. Explicit Non-IVDR labels are negative. Blanks, rebranding alone and UDI without IVDR count as Non-IVDR. Duplicate membership rows do not increase counts.
- Business unit, Site, Month, Registration group and Dispatch required controls update both views and totals. All is the default. Choices survive ordinary updates/resizing but not reopening the visual. These internal controls do not filter other visuals or synchronize across pages. Use Power BI report slicers and **Sync slicers** if cross-page Business unit filtering is required.
- Business unit matching retains all delivered rows of matched submissions. Multiple sites are counted once as **Multiple sites (unallocated)**; blanks are **Unassigned**. The Site selector uses these same exclusive buckets, so totals reconcile.
- Actual dispatch takes priority; otherwise use latest plan, falling back to original only when latest is blank. Current-year dispatch dates determine inclusion and month. The viewer's local calendar sets the year. The clock is checked every minute while open; normal model refresh still supplies data.
- Dispatch required preserves **True**, **False** and **Blank**; it accepts native Boolean values and case-insensitive True/False text. It does not interpret arbitrary text or numbers as False. Conflicting True/False values across a submission's delivered rows, or unrecognised values, are separately filterable for review. An unmapped field is distinct from a mapped blank and preserves legacy dispatch classifications. Every delivered association is checked before local filters, so BU or site filters cannot hide a conflict.
- Only explicit **False** becomes **Dispatch not required**. With a usable current-year dispatch date or plan, the record remains in the IVDR/Non-IVDR table, bars and totals, under that separate progress category. It is not Unconfirmed or Inferred. If no actual or usable planned dispatch exists but actual submission or approval is in the current year, it appears in the separate **Dispatch not required — without dispatch dates** count, with its IVDR/Non-IVDR split. It remains outside dated totals: no fake dispatch month is assigned. This separate annual count is stable across Month choices and follows the other filters.
- Include inferred dispatches is off by default. A blank actual dispatch plus valid actual submission or approval evidence classifies as Inferred when enabled; month still comes from the planned dispatch, never the evidence date. Future planned dates can be inferred. The toggle moves counts between progress categories, not between IVDR categories, and does not increase the total.
- Missing Dates is distinct submissions with no actual or usable planned dispatch date and an actual submission or approval in the current year (OR counted once), **excluding Dispatch required = False**. It follows Business unit, Site, Registration group and Dispatch required but remains **all months** because no dispatch month exists. Undated inferred also excludes False; it covers all filtered years and can overlap Missing Dates. Neither is part of the dated chart total.
- Invalid or conflicting dates are flagged, never guessed. Records without SubID cannot be counted distinctly; their row count is reported separately at business-unit scope. Counts reflect delivered rows; truncation is explicitly warned.
- With All sites, All months and both registration groups, the total matches the Roadmap given identical delivered records and Business unit scope. Extra Project relationships in Power BI can change which rows are delivered; verify model relationships if totals differ.

## Build and verification

Run `node ivdr-comparison.build.cjs` and `node ivdr-demo.cjs`. In the generated `ivdr-comparison` folder run `npm install`, `npx tsc --noEmit`, and `npm run package`. Run the calculation tests from the repository root with `node ivdr-test.cjs`. The workflow also runs compiled Visual host tests and browser tests before publishing the package. The synthetic standalone demo is `ivdr-preview.html`.

This is an uncertified preview. Real Power BI import, source mapping, report relationships and tenant compatibility require verification. No screenshots, work records or private source mappings are embedded in the public demo.

## PowerPoint screenshot layout

Choose your filters, then **Screenshot mode** at the bottom of the visual. The slide layout uses large labels and counts and scales proportionally with the visual. Both tables use collapsed site totals in this mode; your interactive expansion state is restored on exit. The selected filters (including Dispatch required), inference setting, as-of date and partial-data warnings remain visible. Dispatch not required counts are shown separately for dated and undated records. Press **Escape** while focused to restore controls. Capture the white chart area and resize proportionally in PowerPoint. Review at final slide size; many sites or long names need more slide space.
