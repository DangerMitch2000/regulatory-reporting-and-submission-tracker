# Roadmap 1.3.0

Separate from Regulatory Tracker. The release workflow publishes the installable preview only after calculation tests, host lifecycle tests, browser checks, type checking and Microsoft's package build succeed. Actual Power BI Desktop/Service import and tenant compatibility still require verification.

[Interactive synthetic demo](https://DangerMitch2000.github.io/regulatory-timeline-demo/roadmap-preview.html) · [Roadmap 1.3.0 release](https://github.com/DangerMitch2000/regulatory-timeline-demo/releases/tag/roadmap-2026-v1.3.0)

Import `roadmap-2026-1.3.0.0.pbiviz` through **Visualizations → … → Import a visual from a file**. The visual GUID matches Roadmap 1.0 so it retains upgrade identity. Existing field mappings remain valid.

Version 1.3.0 adds a Status review view with a status-coloured bar chart and optional submission and RO status fields. Use it to investigate dispatch-date gaps alongside recorded workflow states. The Overview's dispatch categories and counting rules remain unchanged, and the visible Unconfirmed and Inferred definitions remain available in both interactive and screenshot layouts.

## Fields

Map existing source columns to these field wells; renaming source columns is unnecessary. Use raw dates, not date hierarchies.

| Role | Meaning |
|---|---|
| SubID | Unique submission identifier; required |
| OriginalDispatch | Baseline planned dispatch |
| LatestDispatch | Latest planned dispatch |
| ActualDispatch | Recorded actual dispatch |
| ActualSubmission | Recorded actual submission; inference evidence |
| ActualApproval | Recorded actual approval; inference evidence |
| Site | Explicit site association; confirm the correct source with the data owner |
| BusinessUnit | Business unit column; source name must be confirmed |
| SubStatus | Optional submission status; map the submission's `state__v` field, e.g. `Submission[state__v]` |
| ROStatus | Optional regulatory objective status; map the regulatory objective's `state__v` field from the corresponding table in your model |

The new status fields are optional. Existing mappings continue to work after upgrading. Select the status column from the correct table: several source tables can contain a column named `state__v`. The RO status must describe the objective associated with each submission; do not substitute application state. Field-well labels may display **Submission status** and **RO status** rather than the role names above. No source columns need to be renamed.

Site is not automatically legal manufacturer. Business unit options come from delivered data, not a hardcoded list. All is the default. Blank units appear as Unassigned. A selected unit matches submissions with that membership, and all delivered rows for those matched SubIDs are retained so other site associations or contradictory dates are not silently lost. Each submission counts once. A submission belonging to multiple units can appear in each separate unit view; those views must not be added together. Report filters apply before this local filter. Inference, unit selection and expanded sites survive ordinary updates/resizing, but are not saved as report settings across reloads.

## Counting rules

- Current year and as-of date follow the viewer's local calendar. The title, chart and annual total roll forward together. The date is checked every minute while open and on update. No extra data refresh scheduler is added.
- Actual dispatch has priority. Otherwise use latest plan, falling back to original plan only if latest is blank.
- Blue: Dispatched. Orange: In Progress / Expected, planned today or later. Green: Unconfirmed, plan in the past without an actual dispatch.
- **Include inferred dispatches** is off initially. When enabled, a blank actual dispatch plus valid actual submission or approval evidence moves the record into purple Inferred. Its month still comes from the planned dispatch, including future plans. It is not added a second time. Evidence dates appear in a collapsible list and the bar tooltip explains their use.
- Inferred records without a usable plan remain outside the chart and annual total. Their separate undated count spans all filtered years.
- **Missing Dates — current year** counts distinct submissions with blank actual dispatch and no usable plan, where actual submission OR actual approval falls in the current year. OR counts once. Creation dates are not used. This count is independent of the inference toggle. It may overlap undated inferred records and date issues; do not add these counts.
- Percentages use the annual total; monthly average uses annual total / 12, including zero months.
- Site table totals reconcile with the chart. Multiple nonblank sites are counted once under Multiple sites (unallocated); no site is Unassigned. Expand a site to show all twelve months. Ambiguous memberships are listed in Data checks.
- Invalid or contradictory dates are flagged. A problem in a date needed for classification excludes the submission rather than guessing. An actual date can still classify a record with an issue in an unused planned field. Invalid/conflicting actual dispatch is not treated as blank for inference.
- Dates use calendar days: ISO text uses its written date; Power BI Date values use UTC calendar parts. Only delivered rows are counted; incomplete delivery produces a warning.

## Understanding the categories

**Unconfirmed** means the planned dispatch date has passed and no actual dispatch date is recorded. It does not establish that the submission is unfinished: the dispatch may have happened without its date being entered, or the plan may need updating. With inference enabled, valid actual submission or approval evidence moves the record to Inferred instead.

**Inferred** means an actual submission or actual approval date is recorded while the actual dispatch date is missing. It is evidence that later work has been recorded, not a confirmed dispatch date. The record remains in its planned dispatch month; the evidence date does not establish the dispatch month. Evidence can be outside the chart year, and inference can apply to a future planned dispatch. Inspect the evidence list if those dates disagree with the plan.

**Missing Dates — current year** is a separate count outside the chart total: no actual dispatch date or usable planned dispatch date, with actual submission or approval evidence in the current year. Dividing this count by the chart total does not give the percentage of chart records missing actual dispatch dates. Expected future dispatches also legitimately have no actual dispatch date.

The chart reports dispatch-date evidence, not workflow completion. The new Status review shows recorded submission and RO states separately from the dispatch classification. RO status describes the parent objective and does not automatically mark its child submissions complete. Neither status supplies a missing dispatch date, and status labels do not reclassify records as Dispatched or Inferred.

## Status review

Choose **Status review** to inspect the source statuses and date evidence behind the counts. It initially focuses on **Unconfirmed** records. Other scopes cover Inferred records, all chart records missing an actual dispatch date, Missing Dates records outside the chart, or all chart records. The selected Business unit and inference setting still apply; enable **Include inferred dispatches** to populate the Inferred scope. Missing Dates remains independent of that checkbox. Changing a status-review scope or filter does not change the Overview's counting rules.

Use the Site, Submission status and RO status filters together, or search for a record. The summaries and worklist reflect the same filtered records. Both status summaries count **distinct submissions**, including the summary grouped by RO status; they are not counts of distinct ROs. A submission is counted once even when multiple product or membership rows were delivered.

The Status review bar chart shows those same filtered submissions, split by recorded status. **Colour bars by** switches between Submission status (the default) and RO status. For chart-record scopes, monthly stacked bars use the existing dispatch month: actual dispatch when recorded, otherwise the selected latest/original dispatch plan. The status field determines the colour only; a Completed or approved status does not supply an actual dispatch date or move a record to a different month. The view initially shows Unconfirmed records coloured by submission status.

**Missing Dates — outside chart** has no usable dispatch month. In that scope, horizontal bars compare status counts without assigning records to a month. The chart, both status summaries and paged worklist use the same scope and filters. Both chart colour modes count submissions, including when grouped by RO status.

The worklist shows 25 records per page, with the submission ID, site, recorded submission and RO statuses, and planned/actual date evidence. Invalid or conflicting dates are marked **Date issue**, with the affected fields listed under **Check dates**; hover over that note to inspect the delivered values. Pagination changes the visible rows only; the summaries cover every match. This makes it possible to find submissions marked Completed whose dispatch dates still need checking, while retaining the actual source evidence.

Unmapped status fields, mapped fields with blank values, and conflicting status values are separate cases. An unmapped field is not presented as a blank source value. Different nonblank status values across delivered rows for a submission are shown as a conflict rather than choosing one status. Differences in letter case or spacing are grouped together; blank association rows do not override a recorded status. Source status labels are retained rather than converted into a new completion classification. Report filters and data-delivery limits can hide source rows; review warnings before treating the result as a complete remediation list.

## Local review and build

Open `roadmap-preview.html` in a browser for synthetic data only. `node test-next.cjs` runs calculation tests. `node test-render.cjs` runs DOM construction and event-callback tests (not a real browser).

Run `node roadmap-2026.build.cjs` and `node roadmap-2026.verify.cjs` to generate the Power BI project, tests and browser harness. In the generated `roadmap-2026` folder: `npm install`, `npm test`, `npx tsc --noEmit`, then `npm run package`. Compile the harness with `npx esbuild verify/harness.ts --bundle --outfile=verify/harness.js --loader:.less=css`. Once Playwright Chromium is installed, run `node verify/run.cjs`. The browser suite includes `roadmap-status.verify.cjs`, copied into the generated harness as `verify/status-tests.cjs`, to check the optional status mappings and existing reports without those mappings. The GitHub workflow also compiles the actual Visual and runs `test-host.cjs` to verify update/resize state handling. With pnpm, use the hoisted dependency layout required by Microsoft's packager (`--shamefully-hoist`).

The package version is 1.3.0.0. No work records or screenshots are embedded in the demo. Regulatory Tracker's files and release remain unchanged. The standalone demo exercises the shared UI; it is not a substitute for Power BI import testing. Local filter choices are not persisted across reopening and do not cross-filter other report visuals.

## PowerPoint screenshot layout

Choose your filters, then **Screenshot mode** at the bottom of the visual. The slide layout uses large labels and counts and scales proportionally with the visual. Both tables use collapsed site totals in this mode; your interactive expansion state is restored on exit. The selected filters, inference setting, as-of date, category definitions and partial-data warnings remain visible. The definitions travel with your screenshot so slide readers can interpret Unconfirmed and Inferred without hovering. Press **Escape** while focused to restore controls. Capture the white chart area and resize proportionally in PowerPoint. Review at final slide size; many sites or long names need more slide space. Calculations are unchanged.

From **Status review**, Screenshot mode presents the status-coloured chart and both status summary tables with the selected scope, Business unit, Site, status filters, colour-by choice and search context. It omits the 25-row worklist to keep the slide readable. The chart and both tables count submissions, not ROs. Missing Dates uses status-count bars without months in this layout too. Exit Screenshot mode to return to the paged evidence list and its filters.
