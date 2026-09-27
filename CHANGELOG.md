# Changelog

## 1.6.2 — 2026-09-27

- Clarified comparison headings, day units and current-stage waiting time; moved the abbreviated variance row out of the table while retaining its full Details comparison.

- Made Today a compact badge and blended the row-navigation background into the chart.
- Removed the top-right legal-manufacturer explanation.
- Registration end dates after 2100 no longer expand the time axis or plot expiry markers. Invalid values are withheld and flagged in Details; normal future expiry dates and source data are preserved.

## 1.6.1 — 2026-09-27

- Moved state-filter, comparison and prediction guidance into short footer notes; Clear pins remains alongside the comparison controls.

- Added distinct regulatory objective (RO) totals beside the submission and application counts in the top filter area. Removed the duplicated totals inside the timeline and reclaimed its extra header row. Counts follow the same filtered records; repeated submission/product memberships do not inflate the RO total.

## 1.6 — 2026-09-27

- Added the Business Unit multiselect filter. Map source `business_unit__c` to the `BusinessUnit` field well; source renaming is not required.
- Replaced the full product checkbox list with search after two characters, at most 50 matching options, accessible selected products and options narrowed by Business Unit/Site.
- Kept a single “Regulatory Tracker” title and moved the public demo’s fictional-data note to the footer; the Power BI visual does not label source records as fictional.
- Added distinct amber approval-estimate markers and empirical middle-50% historical ranges on eligible submission rows, plus selectable approval/history cards and exclusion reasons in Details. Original/latest/actual dates and parent summary bars are unchanged.
- Predictions require all three approval fields to be genuinely blank and a valid actual submission date. Unmapped required prediction fields, invalid or conflicting values, and unavailable country history suppress estimates without blocking ordinary chart data.
- Country medians use at least 10 distinct completed submissions whose actual submission and approval dates fall from January 2020 through today, with approval on or after submission. Membership joins count once; missing, invalid, future, pre-2020, reversed, conflicting and multi-country history is excluded from country models.
- Anchored predictions to actual submission plus the historical median. The range is the empirical interquartile range, not a confidence interval. Valid unusually long durations remain included and flagged; already-passed estimates are not shifted into the future.
- Documented that history uses only Power BI-delivered rows before local visual filters. Report filters and data limits may restrict the sample, and valid-looking source dates can still be incorrect. Historical Deneb files and companion-table guidance remain available.

## 1.5 — Regulatory Tracker

- Larger readable labels and milestones, tighter table/timeline split.
- Health Authority Approved uses green. Tick state legend boxes to control record visibility, retaining parent context. Parent summaries retain membership/search-filtered children.
- Bars and milestone tooltips include full calendar dates, including in elapsed comparison mode.
- Ctrl+wheel pans dates without zooming. Existing time buttons retained; no Pan dates slider.
- Public demo and installable Power BI visual updated; Deneb 1.3 files remain historical.

## 1.3 — 2026-09-23

- Own-state colours at Application/RO/Submission levels, distinct RO counts and visible submission type.
- Comparison levels, pinning, actual-dispatch Day 0, valid durations/variances and sort controls.
- Optional registration-end marker and range inclusion; excluded from processing durations.
- Real input bindings, top search and additional country/type multiselect filters.
- Collapsed structured browser details with selectable text/full-copy buttons and full searchable membership lists.
- Native Power BI companion-table setup/helper with explicit manual selection linkage and honest host limits.
- Preserved v1.2 anchor/scroll fixes; isolated pin index dependencies from expansion.



## 1.2 — 2026-09-23

- Replaced row paging with anchored scrolling, fixed headers and a draggable scrollbar.
- Bottom-row expansion reveals the first child without jumping to the top.
- Added selected-row highlighting and persistent searchable, paged details below the chart.
- Added optional Country membership, compact product/country counts and short hover content.
- Retained separate real membership sets, missing-value disclosure, date-quality handling and existing filters/calendar controls.
- Documented Power BI rebuild limits and current/legacy host variants.

Validated locally and in the browser with fictional data; no installed Power BI verification.

## 1.1 — 2026-09-22

- Compact fixed dark theme with purple, amber, teal and pink lifecycle tracks.
- Indented Hierarchy, Site and Product columns with truthful distinct-membership summaries and full hover details.
- Expand/collapse through labels, boxed controls or group summary bars.
- Responsive real Vega layout, bounded row paging and graceful narrow-screen overflow.
- Dynamic Fit all, Year, Quarter, Month, earlier/later navigation, Ctrl+wheel zoom, adaptive calendar headers/grid and Today indicator.
- Searchable multi-select Site and Product filters with membership-row intersection, clear/reset and keyboard Escape.
- Preserved no-date rows, duplicate/conflicting-date behavior and registration-start-only scope.
- Added generic pasteable Deneb specifications for current and legacy container signals.

Validated with synthetic data and browser interaction/resize checks. No live Power BI report verification.

## 1.0 — 2026-09-17

Initial fictional Vega timeline with expandable hierarchy, milestone tracks and pagination.
