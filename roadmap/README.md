# Roadmap 1.5.0

A yearly dispatch outlook with shared filters and a submission worklist. This is a separate Power BI visual from Regulatory Tracker and Site Submission Outlook.

[Download the Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/roadmap-2026-v1.5.0/roadmap-2026-1.5.0.0.pbiviz) · [Interactive synthetic demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/roadmap/roadmap-preview.html) · [Release](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/roadmap-2026-v1.5.0)

## Install or update

Import **roadmap-2026-1.5.0.0.pbiviz** using Power BI's **Visualizations → … → Import a visual from a file**. Replace the existing Roadmap when prompted. The visual GUID and all eleven field roles are unchanged, so existing field mappings carry over. No additional fields are required.

**Business unit defaults to ID.** Choose All or another delivered unit when needed. If ID has no delivered records, the visual shows an empty result for ID; it does not silently switch to All. Selections survive ordinary updates, resizing and view changes within the same visual instance. They are not saved across reopening or report bookmarks.

**Dark is the default theme.** Use the Theme control to switch between Dark and Light. Theme changes preserve filters, expanded rows and scroll position. The selected theme remains in use through ordinary updates, resizing and Screenshot mode; reopening a new visual instance starts in Dark.

## What's new

- Dark and Light themes, with Dark selected initially to match the Regulatory Tracker.
- A full-width monthly chart, compact controls and collapsible site breakdown, status summaries and explanations.
- Click a month, category or site count to inspect the exact submissions behind it. Keyboard activation is supported.
- A sortable worklist with Copy IDs and expandable rows showing original/latest/actual dispatch, actual submission and actual approval evidence.
- Scroll position and control focus are retained when filtering, paging and expanding records.
- A Year selector and shared Site filter across Overview and Status review, alongside Business unit, Dispatch required and inferred-dispatch controls.
- Consistent dates such as **12 Nov 2026**, clearer category colours and readable site names in Screenshot mode.
- Coverage counts distinguish records in the selected year's chart from other years, undated records and records excluded because the date required for classification is invalid or conflicting.

These changes preserve dispatch classification. A workflow state does not invent a dispatch date, and an inferred dispatch remains distinct from a recorded actual dispatch.

## Field mappings

Map raw date columns, not date hierarchies. Source columns do not need renaming.

| Field role | Source / purpose |
| --- | --- |
| SubID | Unique submission identifier; required |
| OriginalDispatch | Original planned dispatch date |
| LatestDispatch | Latest planned dispatch date |
| ActualDispatch | Recorded actual dispatch date |
| ActualSubmission | Recorded actual submission date; optional inference evidence |
| ActualApproval | Recorded actual approval date; optional inference evidence |
| Site | Explicit site association; this is not automatically the legal manufacturer |
| BusinessUnit | Business unit membership; ID is the initial selection |
| SubStatus | Submission state from the Submission table |
| ROStatus | State of the regulatory objective linked to that submission |
| DispatchRequired | Submission Dispatch required: True, False or blank |

Select state fields from the correct source tables; several tables can contain a column named state__v. RO state must not be substituted with application state. Missing mappings, recorded blanks and conflicting values remain distinguishable.

## Year, date and filter behaviour

The automatic year follows the viewer's local calendar. Select a specific year to keep reviewing it after January or to inspect future plans. Available years come from valid delivered dates plus the current year. Switching the chart year does **not** move the reference date used to determine whether a dispatch plan has passed. The as-of label is the viewer's current calendar day, not the source refresh time. Unlike Site Submission Outlook's agreed previous-day checks, Roadmap keeps its existing current-day rule.

Dates remain calendar dates. ISO strings retain their written date and Power BI Date objects use UTC calendar components. Display formatting does not alter source values. Blank dates show a dash; invalid/conflicting dates show an issue and retain their source evidence in Details.

Business unit, Site and Dispatch required apply to both views. Site and Business unit select distinct submission IDs, then retain all delivered associations for those IDs so another membership row cannot hide conflicting dates. A selected site can therefore include submissions also associated with other sites. Such records remain allocated to **Multiple sites (unallocated)** in the breakdown, keeping site totals reconcilable. A blank site appears as Unassigned. Separate membership views must not be added together.

Status review's scope, month, category, recorded-status and search filters narrow its worklist only. Their context remains visible. Clear review filters does not change the shared filters. Report-level Power BI filters apply before data reaches this visual; these local controls do not cross-filter other report visuals.

## Counting rules

Each nonblank SubID counts once regardless of duplicate product or membership rows.

1. Recorded actual dispatch has priority. Otherwise use latest planned dispatch, falling back to original plan only when latest is blank.
2. Explicit **Dispatch required = False** is shown separately as **Dispatch not required**, retaining a usable recorded dispatch reference month. It is never classified as Unconfirmed, Inferred or Expected.
3. For other requirement values, an actual dispatch is **Dispatched**. A plan dated today or later is **In Progress / Expected**. A past plan with no actual dispatch is **Unconfirmed**.
4. **Include inferred dispatches** starts off. When enabled, a missing actual dispatch plus valid actual submission or approval evidence produces **Inferred**. Its month still comes from the dispatch plan, including future plans. The evidence does not establish the actual dispatch month.
5. If a date needed for classification is invalid or contradictory, the record is excluded instead of guessed. A valid actual dispatch can still classify a record with an issue in an unused planned field.

Unconfirmed means a past plan lacks a recorded actual dispatch. It may indicate an overdue action, a missing update or a plan that needs changing; it is not proof that work remains unfinished. Submission and RO statuses remain source evidence and do not change these categories.

Dispatch required accepts Boolean values and case-insensitive true/false text. Blank, unmapped, conflicting and unrecognised values never imply False. Numeric 0/1 or yes/no labels are not guessed. Blank association rows do not override a consistent recorded Boolean.

The annual total includes chart records only. Category percentages use that total. **Average per calendar month** is the annual total divided by twelve, including zero months; it is not an elapsed-year throughput measure.

## Coverage and records outside the chart

Coverage uses the shared filters and counts distinct identified submissions. These four buckets are mutually exclusive and sum to the loaded distinct count:

- **Chart:** the chosen dispatch date falls in the selected year.
- **Other years:** the chosen valid dispatch date belongs to another year.
- **Undated:** no actual or planned dispatch date establishes a chart month.
- **Excluded:** the date needed for classification is invalid or conflicting.

Rows without SubID are reported separately as rows, not submissions. Date issues and remediation lists can overlap coverage buckets and must not be added to them.

**Missing Dates — selected year** contains records without an actual dispatch or usable planned dispatch date, with actual submission or approval evidence in the selected year. Either evidence date qualifies; a record counts once. Explicit False is excluded from this missing-dispatch check. The count is independent of the inference toggle and outside the chart total.

**Dispatch not required — outside chart** contains explicit False records with no dispatch month but actual submission or approval evidence in the selected year. No fake dispatch month is assigned. False records with no dated evidence cannot be assigned to a year.

**Undated inferred** spans all filtered years and can overlap Missing Dates. Keep these diagnostic counts separate. Partial-delivery warnings mean only the rows Power BI delivered have been counted; source records omitted by report filters, permissions or delivery limits cannot be inferred.

## Worklist and Details

Select a chart segment, monthly total, category count or site total to open its matching submissions. Sort using the worklist headings; missing dates remain last in either direction. Search by submission ID, site or recorded state. Paging changes only the visible rows; counts and Copy IDs refer to the full matching worklist.

Expand a submission to inspect every date field, recorded states, dispatch requirement and date conflicts. Valid dates use day, three-letter month and four-digit year. Raw invalid or conflicting source evidence is retained for investigation.

Copy IDs copies newline-separated submission identifiers. Where clipboard access is unavailable, a selected text box provides the same IDs for manual copying. No data is sent to an external service.

Both status summaries count **submissions**, including the summary grouped by RO status. They are not counts of distinct ROs. Multiple nonblank statuses for one submission remain a conflict; differences only in case or spacing are grouped, and blank joined rows do not override a recorded state.

## Screenshot mode

Screenshot mode presents the selected view and filter context without interactive controls. The same filtered counts are used. Site names remain readable rather than being shortened to eight characters. Press Escape while focused to return. Capture at an appropriate size for the number of sites/statuses and review the final slide before sharing. The demo and published preview screenshots contain synthetic data only.

## Development and verification

The legacy test-host.cjs and test-render.cjs commands now invoke the shared browser suite against the actual Visual class after the harness is bundled.

From the repository or extracted source archive, run **cd roadmap**. Keep the sibling **shared/** directory alongside this folder: it contains the canonical dispatch requirement helper. All following commands start in **roadmap/** unless stated otherwise.

With Node 22, run **node roadmap-2026.build.cjs**, install the pinned dependencies with **npm install --prefix roadmap-2026**, then run **node roadmap-2026.verify.cjs** and **node make-standalone.cjs**. From the generated **roadmap-2026/** directory, run **npm test**, **npx tsc --noEmit**, **npx esbuild verify/harness.ts --bundle --outfile=verify/harness.js --loader:.less=css**, and **npx playwright install chromium**. Return to **roadmap/** and run **node roadmap-browser-run.cjs**.

Package from **roadmap/roadmap-2026/** using **npm run package -- --no-stats**. Extract the PBIVIZ into **roadmap/package-check/**, then run **node roadmap-browser-run.cjs --package** from **roadmap/**. This tests the actual packaged plugin using the same interaction suite. Locally, ROADMAP_BROWSER_CHANNEL=msedge selects installed Edge.

Checks cover existing classification regressions, selected year/reference-date separation, distinct counts and retained conflicting associations, coverage reconciliation, ID default, shared filters, chart drilldown, sorting/copy/expanded evidence, scroll/focus retention, empty/partial delivery, responsive layouts and synthetic volume. Pushes and ordinary manual workflow runs build and test artifacts only. Publishing requires a manual run with **publish** enabled and a new release version; that path stages a draft and verifies uploaded bytes before publishing. Existing public releases are never modified. Power BI Desktop/Service import and tenant-specific compatibility still require verification in the target environment.
