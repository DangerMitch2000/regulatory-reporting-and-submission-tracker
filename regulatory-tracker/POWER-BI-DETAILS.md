# Power BI: usable search and copy details for 1.3

The chart uses real Vega HTML input bindings for search, level, axis, sort, pins and registration end. These are supported by current Deneb documentation. The installed report/Deneb version has not been tested here. Vega marks are drawn text: they are not a dependable copy surface. Use the native companion tables below when copying real report values.

## Linkage contract

Chart selection remains internal. Clicking the chart does **not** filter these companion tables, and automatic aggregate-row drillthrough is not implemented. Use a searchable native submission selector to choose the same App/RO/Sub. This explicit fallback avoids claiming a link that does not exist. It also works if the installed host does not expose the input bindings.

The chart displays filtered memberships. Companion tables below show the full stored membership sets for the selected submission, as of model refresh. They do not invent product–country pairs. Native Site/Product/Country filters can restrict eligible submission choices using the measure below; full companion context deliberately stays available after a choice.

## Existing live semantic model: copy without changing the model

Use this option first when the report connects to a shared/live semantic model. It needs permission to edit the report, not permission to alter the shared model. Do not add Power Query tables merely to copy values.

1. Add a report page called Submission details. Add native searchable slicers using the **existing** Application ID, RO ID and Submission ID fields from their respective entity tables. Use single selection; choose App, then RO, then Sub. If Submission ID is globally unique, one submission slicer is enough. If it is not, keep all three identifiers so the record is unambiguous. Search narrows the slicer's list; select the matching entry to apply the filter.
2. Add a native Table with the existing Submission ID, submission state, submission type, dispatch/submission/approval date columns, and registration start/end. Use the actual Date column, not Date Hierarchy, and Don't summarize. Keep App and RO identifiers visible in a separate small Table or in the same table when their existing relationship is legitimate. Wide milestone tables can be split into three native tables labelled Original, Latest, Actual; use the same selector to filter each.
3. Add **separate** native tables for product names, country names and legal manufacturer names, using the existing legitimate relationships/bridges. Do not place independent product and country dimensions together in one table. Show full names with word wrap and adequate row height. Existing Site and Product slicers can remain and must be configured with Edit interactions → Filter for the applicable visuals.
4. In Format → Edit interactions, set the submission selector to Filter each native table and the Deneb visual. On a live model, report interaction settings cannot repair missing model relationships. Select a known submission and confirm its own IDs/dates and the expected memberships in each table; if an unrelated table stays unchanged, use the existing supported drillthrough/detail page or ask the model owner to provide the missing relationship. Do not enable bidirectional filtering or modify the shared model as a prerequisite to copying.
5. Right-click a native table cell → **Copy → Copy value**, or Copy selection where available. Test a long product name and date. The chart's internal selected row does not drive these tables: choose the same submission in the native selector. Chart text search also does not filter other visuals. Native App/RO/Sub and existing Product/Country/Type slicer search is the reliable model-preserving fallback.

This route uses available model fields directly. Distinct-date conflicts may show multiple rows; do not sum dates or interpret the first one as authoritative. It does not add automatic duration calculations or change the semantic model. If a native field or valid relationship is absent, that specific table needs the model owner's support; other copyable tables still work.

## Optional companion queries for a model you can edit

The helper below is optional. It is unavailable in many live-connection reports unless the model owner creates the tables or the report supports an authorized local model. Use the existing-model route above when model editing is not available.

1. In Power Query, **reference** the existing legitimate membership-grain query and name the reference `TimelineSource`. Rename columns in this reference to the generic aliases used by the chart. Do not modify source files or join independent country/product tables. Include AppID, ROID, SubID, SubStatus, SubmissionType, Manufacturer, Product, Country, nine processing milestone dates and RegistrationStart/RegistrationEnd. Other chart aliases can stay in the reference.
2. Set native date types using your source's correct locale. Keep conversion failures visible for correction; do not silently replace errors with invented dates. The helper accepts native dates or date text parsed with `en-IE`; adapt this single locale if necessary. Numeric date values are deliberately rejected by the helper. If you already have a SubmissionKey column, remove it from the reference before invoking the helper.
3. Create a blank query named `BuildTimelineCompanion`, open Advanced Editor and paste `CompanionTables.pq`. This is a reusable function. Create another blank query `Companion` with `= BuildTimelineCompanion(TimelineSource)` and disable load for this record query and the function.
4. Create five blank queries:

| Query name | Formula |
|---|---|
| TimelineInput | `= Companion[Input]` |
| TimelineSubmissions | `= Companion[Submissions]` |
| TimelineDates | `= Companion[Dates]` |
| TimelineMembers | `= Companion[Members]` |
| TimelineIssues | `= Companion[Issues]` |

5. Set SubmissionKey to Text everywhere. In TimelineDates set Original/Latest/Actual to Date; in TimelineSubmissions set both registration fields to Date and duration/variance fields to Whole Number. Load all five tables. The helper resolves duplicate matching dates, withholds conflicts/invalid dates, keeps partial blanks visible, and produces separate membership rows. A reversed actual date pair returns a blank duration; inspect the date matrix to correct the sequence. The helper has been reviewed but cannot be executed here without Power Query; validate its refresh on your report before adoption.
6. Create four **one-to-many, single direction** relationships from `TimelineSubmissions[SubmissionKey]` to the matching key in TimelineInput, TimelineDates, TimelineMembers and TimelineIssues. Do not add relationships between those four child tables. Disable conflicting auto-detected relationships. Use the same TimelineInput alias fields for the Deneb visual if adopting this companion model. Keep existing dimension slicer relationships only where they preserve the legitimate grain; do not turn on global bidirectional filtering to force a match.

## Build the detail page

- Add a native slicer on `TimelineSubmissions[SearchText]`, turn on Search and single selection. SearchText contains App/RO/Sub IDs, type, product and country. Searching narrows the options; selecting an option applies the filter. Include a second small native table with AppID, ROID, SubID and SubmissionType so the chosen identity is clear.
- Add a native Table using TimelineDates[Milestone], [Original], [Latest], [Actual]. Choose **Don't summarize** and format dates `dd MMM yyyy`. Missing dates are blank in native tables; use the TimelineIssues table to distinguish Not recorded from withheld conflicts/invalid values.
- Add another native Table for SubStatus, SubmissionType, LegalManufacturers, Countries, RegistrationStart, RegistrationEnd, DispatchDays, ApprovalDays, ApprovalOriginalVariance and ApprovalLatestVariance. Variance is actual approval minus plan: positive means later. Expiry never enters durations.
- Add a native Table with TimelineMembers[Kind], [Value]. Turn off totals. It contains every distinct product/country/legal manufacturer as separate rows. Add a native slicer on Kind if helpful. It is safe to copy full rows; no cross-product is made.
- Add a separate Table with TimelineIssues[Field], [Issue]. Set slicer interactions to **Filter** every detail table and Deneb. A selection here filters the chart to that submission; selecting the chart does not change this selector.
- To copy, right-click the desired native cell and choose **Copy → Copy value**, or use **Copy selection** for selected cells where available. Report permissions and host version can affect available copy/export commands. Test an actual long product name and a date.

If native Site/Product/Country slicers filter TimelineInput, restrict the submission selector to choices with delivered rows using this measure, added as a visual-level filter `is 1` on the selector:

```dax
HasVisibleTimelineRows = IF(COUNTROWS(TimelineInput) > 0, 1, 0)
```

This filters the *eligible selector choices*, without forcing fact-to-dimension bidirectional relationships. Companion memberships are the full selected submission, not reduced membership sets. Clear a selection that becomes ineligible after another filter changes.

## Fallback when bound HTML controls are unavailable

Use the existing native App/RO/Sub selectors above, or the optional native SearchText slicer, for reliable search and selection. For Site/Product/Country/SubmissionType use native searchable multi-select slicers with verified relationships and Edit interactions → Filter on Deneb. The standard chart spec still supplies its comparison controls through bindings; if your installed Deneb cannot display them, upgrade to a compatible supported version or use the fixed submission comparison preset with native slicers: **deneb-comparison.vega.json in the public ZIP**, **regulatory-gantt-comparison.vega.json in the private setup ZIP**. This preset starts in calendar comparison; change `axisMode.value` to `Elapsed days` only when actual dispatch is available. Its pin icons remain in-chart; set `pinsOnly.value` to true in the specification if the bound checkbox is unavailable and you want only pinned rows. Do not expect unsupported bound inputs to become usable by clicking drawn text.

## Required in-report verification

Choose a known submission via SearchText and confirm the same App/RO/Sub in the chart and all tables. Copy its ID and a long product, compare dates to the original record, check a conflict and a reversed pair, and test Site+Product together. Search for the same ID in the chart's bound text box using paste/caret editing. Check that expiry off/on changes only the calendar domain and never duration. Validate the installed host sizing and input layout. Neither the report relationships nor clipboard behaviour in actual Power BI can be verified by a standalone browser test.

State retention is internal to a running Vega view. An external Power BI rebuild can reset expansion, scroll, pins, query and zoom. Deneb's optional data patching has documented limits; do not promise retention for 30,000-row host recompilation.

Sources checked 23 September 2026: [Deneb input focus and bindings](https://deneb.guide/docs/changelog), [Vega input bindings](https://vega.github.io/vega/docs/signals/#bind), [Deneb advanced selection and aggregate identity](https://deneb.guide/docs/interactivity-selection-advanced), [Microsoft native table copy options](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-tables), [Deneb dataset and patching](https://deneb.guide/docs/dataset).
