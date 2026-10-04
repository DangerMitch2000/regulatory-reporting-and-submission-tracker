# Regulatory Tracker 1.14.0

[Live demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/) · [Version 1.14.0 release](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/v1.14.0) · [Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/v1.14.0/regulatory-tracker-1.14.0.0.pbiviz)

Import the updated package into Power BI. The stable visual GUID preserves upgrade identity. This is an uncertified preview; verify the import in your report. Public demo records are fictional.

## Change initiation and country assessments — version 1.14.0

Select **Group by → Change initiation** for **Change ID → Event → Application → RO → Submission**. One change can contain several events; shared applications and submissions remain under each relevant event. **Other regulatory events** stays at the bottom and missing historical references are normal, not data-quality errors.

The hierarchy heading reverses natural numeric identifier order at every level together. Parent-child groups remain intact. All three grouping modes support expand/collapse. The new Change status dropdown lists Completed, In Progress and Not recorded independently. Totals count distinct **Change IDs → Events → Applications → ROs → Submissions** in the current filtered/search results.

### New optional mappings

| Visual field | Source |
| --- | --- |
| Event QMS reference | Event related_change_control_number__rim |
| Change ID | Change Assessment Initiation: Change ID |
| Change Project ID | Change Project ID |
| Change QMS reference | Initiation QMS reference |
| Change status | Initiation Status |
| Change created | Initiation Created |
| Planned Implementation Date | Initiation Planned Implementation Date |
| Response Due Date | Initiation Response Due Date |
| Change response count | Your recorded response-count field; do not sum duplicated membership rows |
| Change Assessment Response Countries | Country on the response, separate from submission Country |
| Change Assessment Response Timeline | Surveyed timeline on that same response |
| MOH filing requirement | Recorded filing requirement/reason on that response |
| Required documentation | Country-specific documentation text on that response |

Use your existing model relationships to deliver real event/change/submission/response rows. The visual accepts a Change ID only when its nonblank QMS reference and the event QMS reference match after trimming and case normalization. It does not split compound CR references, infer historical links or join Agile. Normalize composite references in the model using a verified mapping table where necessary. Change IDs and event names must identify their respective records uniquely.

### Surveyed approval range

The thin magenta band above the submission milestones is sourced from **Change Impact Assessment Tool — SharePoint**. Match on Change ID and assessment country (trimmed, case-insensitive, exact country name). Use one country per response row. Standard LM preparation and historical approval estimates remain separate.

Durations accept positive days, weeks and months, including ranges such as **6–8 months** or **6 to 8 months**; months use 30 days and weeks use 7 days. The working interpretation is dispatch-to-approval. Actual dispatch takes priority, then latest planned dispatch, then original planned dispatch. Invalid/conflicting dates do not silently fall back. Missing anchors, reversed/invalid/conflicting durations, unmatched countries and multiple change/country estimates withhold the combined band and remain visible in Details. A single duration is a narrow marker. This is a survey estimate, not a guaranteed forecast.

Every selectable hierarchy level has relevant linked IDs, state, own dates and country-assessment details. Planned implementation is the change's own milestone; no estimated implementation time is added. MOH filing values are preserved as supplied, including blank, Not required, Product not commercialized and Unregulated; they do not automatically remove submissions. Required documentation is displayed as plain multiline text. Response counts are recorded values, not totals summed across repeated joined rows.


## Shift+scroll fix — version 1.13.1

Shift+wheel now zooms without also scrolling the submission rows. Ordinary wheel scrolling and Ctrl+wheel panning remain available. No new field mappings are required.

## Separate state filters and mouse controls — version 1.13.1

Four alphabetical dropdowns independently filter **Application state**, **RO state**, **Submission state** and **Event state**. All 29 supplied options are separate: Active/Planned, In Progress/Ready For Submission and Sent To Health Authority/Distributed are no longer combined. Values within a field use OR; selections across fields combine with AND. Parents summarize only matching linked children. State evidence is resolved across delivered entity rows before local filters; conflicting and missing values have explicit options when present. Additional source states appear separately rather than being silently omitted. No additional fields are required.

Every distinct known state has a colour; identical state names share a consistent colour across record types. Record names, status labels, bars and filter swatches match, with readable light/dark shades. Other labels remain neutral. Unknown states retain a neutral colour with their original label.

Top totals are ordered **Events → Applications → ROs → Submissions**, counted distinctly within current membership, state and search filters. Unlinked work is not an event; appearances beneath several events do not inflate totals. The top-right hierarchy label includes Event.

**Mouse controls:** drag empty timeline background to pan; **Ctrl+wheel** pans in small steps proportional to the visible range; **Shift+wheel** zooms gently around the date beneath the pointer. No new zoom buttons. Zoom is bounded from one day to 100 years. Existing preset buttons remain available.

## Regulatory event grouping — version 1.12.0

On Timeline, keep **Group by: Application** for the usual view, or select **Regulatory event** for **Event → Application → RO → Submission**. Click the **Event ↑/↓** table heading to reverse natural numeric event order. **No linked event** always stays last. Country and product memberships, existing milestones, preparation bars and approval estimates remain available.

Map these four additional optional roles from the Event table through your existing Event–RO/submission relationship:

| Visual field | Source field |
| --- | --- |
| Regulatory event name / number | Event name (name__v) |
| Regulatory event state | Event state (state__v) |
| Event planned start | planned_start_date__rim |
| Event planned completion | planned_completion_date__rim |

One event may affect many applications, and one application or submission may belong to several events. Each event shows only its linked work; the top totals count distinct records rather than event appearances. Blank links are normal. Event names/numbers must uniquely identify events. Preserve a row per real event–submission link; do not create an unfiltered cross-join.

Event dates are optional. Both valid, consistent dates are needed for the event's own dashed planned span. Missing, conflicting, invalid or reversed dates withhold that span and Details explains why; child timelines remain visible. Event state remains independent from child states. Application grouping and comparison retain their existing behavior.

After replacing the Power BI visual, map the four fields. If an existing visual instance does not pick up the updated layout, insert a fresh instance and remap its fields. Public demo examples are fictional.

## LM dossier preparation — version 1.11.0
Map just one new optional field: **LM Dossier Preparation Timeline** (`LMPrepDuration`) from the country survey, related through the application lead-market country. Each child inherits its application standard. Values such as `1 month`, `2 months`, `3 weeks` or `45 days` are accepted; months use **30 calendar days**, weeks use 7 days. These are planning allowances, not actual preparation time or statistical confidence ranges. Purple bars end at latest planned dispatch, falling back to original only when latest is blank or unmapped. Existing source milestones, parent lifecycle bars and approval estimates are unchanged. Missing, invalid or conflicting durations/dispatch targets withhold the estimate; explicit Dispatch required=False draws no preparation bar. Details explains unavailable estimates. No new country or start/end date role is required.

If both dispatch plans are missing, Details retains the preparation duration but no dated bar is drawn. Import the new package and map this one additional field; no other new mappings are required.

## New in 1.10.3: Dispatch details

Each submission now shows original, latest and actual dispatch dates, source submission status and calendar days until or past its dispatch target in Details. A blank latest plan falls back to the original; invalid or conflicting dates are withheld. Completed submissions, later milestone evidence and unknown dispatch requirements prompt confirmation instead of claiming dispatch is pending. Actual preparation time is unavailable without a reliable actual start date; creation dates are not used. The Gantt layout is unchanged.

## New in 1.10.2: Submission and RO states

Data quality no longer flags a blank actual approval date solely because the submission state is Completed. A submission can be completed while its regulatory objective remains In Progress. Submission and RO states remain independent; neither state is used to invent approval evidence. Invalid, conflicting and genuinely reversed recorded dates are still checked.

## New in 1.10.1: Calendar-day data quality checks

Data quality compares the recorded calendar day for dispatch, submission and approval dates, ignoring time of day and ISO timezone offsets. Same-day milestones and duplicate timestamps are accepted; genuinely earlier days, differing recorded days and invalid dates remain flagged. Original source values and CSV evidence are preserved. Power BI Date objects use their UTC calendar day. Registration expiry, timeline and prediction calculations are unchanged.

## New in 1.10.0: Dispatch requirement

Map the Submission Dispatch required field to the optional Dispatch required (DispatchRequired) role. True means required, False means not required, and blank remains unknown. A top All-default filter applies to Timeline and Data quality, including CSV export. Details and the worklist show the recorded requirement. Conflicting or invalid values never become False, and missing mappings stay explicit. Resolve the value across all delivered rows for each submission before local filters. Explicit False suppresses overdue dispatch-plan warnings only; source milestone dates, submission/approval checks and historical approval training remain unchanged. Unmapped visuals retain their previous behaviour.

## Updated visual downloads

Map your **Submission dispatch required c** source field to **Dispatch required** in each updated visual. Keep the True / False / blank values; no calculated replacement field is needed.

| Visual | Download | Demo |
| --- | --- | --- |
| Regulatory Tracker 1.14.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/v1.14.0/regulatory-tracker-1.14.0.0.pbiviz) | [Tracker](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/) |
| Registration Overview / Roadmap 1.4.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/roadmap-2026-v1.4.0/roadmap-2026-1.4.0.0.pbiviz) | [Roadmap](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/roadmap-preview.html) |
| IVDR Overview 1.2.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/ivdr-overview-v1.2.0/ivdr-registration-overview-1.2.0.0.pbiviz) | [IVDR](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/ivdr-preview.html) |
| Key Submissions 1.1.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/key-submissions-2026-v1.1.0/key-submissions-2026-1.1.0.0.pbiviz) | [Key submissions](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/key-preview.html) |
| Site Regulatory Plan 1.1.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-plan-2026-v1.1.0/site-regulatory-plan-2026-1.1.0.0.pbiviz) | [Site plan](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-plan-preview.html) |

Roadmap shows False separately as **Dispatch not required**, retaining recorded dispatch reference dates. Records without a usable dispatch month but with current-year actual submission/approval evidence are shown separately outside the monthly chart. Blanks remain unknown; they are not assumed to mean False. An unmapped field retains the earlier classification behavior.

## New in 1.9.1: Open-ended registration dates

Registration end dates after 31 December 2100 mean no registration end date. These source-system placeholders no longer appear as Data quality errors.

## Dark and Light themes (1.9.0)

Use **Theme** at the top-right to change the whole visual: timeline, filters, menus, Details, tooltips and Data quality. **Dark is the default** for each new instance. Light uses darker text and state-colour variants for contrast. Switching keeps filters, pins, selection and timeline position; refresh, resize and switching views keep the chosen theme. The choice is local to this instance and is not saved across reopening or in report bookmarks.

## New in 1.8.0: Planned submission forecasts and date filtering

- Approval estimates can use a planned submission date when no actual submission date is recorded: actual submission first, then latest planned submission, then original planned submission. The displayed estimate identifies its anchor. Invalid or conflicting higher-priority dates are not silently skipped.
- The top **Submission date** filter starts at **All dates**. Choose a year from the received data, an inclusive custom From/To range, or **No usable date**. It combines with existing filters and also applies to the Data quality worklist and export.
- Future planned submission dates through 2100 are allowed. Approval history still uses valid completed actual dates from January 2020 through today; local date filtering does not reduce that historical cohort.

## New in 1.7.1: Historical approval ranges alongside plans

- Pending submissions can show a country-based approval estimate even when an original or latest approval plan is recorded. Plans and actual dates remain unchanged; invalid or conflicting plans are flagged independently.
- Valid completed submissions can show a **Historical approval benchmark** based on at least 10 other qualifying submissions. The completed record itself is excluded from its benchmark history.
- Only `Country`, `ActualSubmission` and `ActualApproval` are required prediction mappings. Approval planning fields are optional for this calculation. The same source-date and country checks still apply.

## New in 1.7.0: Data quality

Switch to **Data quality** for a remediation worklist grouped and sorted by Site (LM). Existing Business Unit, Site, Product, Country and Submission Type filters combine across the same received membership rows. The issue category and worklist search narrow results further. Timeline state filters and timeline search do not limit this worklist.

Select a submission to see the affected field, received value, reason and suggested check. Errors distinguish invalid or conflicting dates and reversed sequences from review items such as overdue plans. Missing-information flags apply only to mapped fields; blank optional planning dates are not automatically errors. These are checks on delivered data, not proof that every unflagged value is correct.

Totals count distinct issues and affected submission IDs. Repeated membership rows do not inflate counts. An issue for a submission shared by multiple sites appears once under each matching site; the CSV uses the same explicit site entries. Filter to one site to send its worklist to a colleague. Records without a submission ID remain outside this submission-based worklist.

Checks use all delivered rows for matching submission IDs, so filtering by one product cannot hide a conflicting value on another membership row. **Export worklist** exports all matching entries, including other pages. CSV cells are quoted and formula-like source values are escaped for spreadsheet safety. Power BI uses its download service and optional ExportContent privilege; tenant settings or consent may block download, in which case a selectable/copyable CSV is offered. Source records are unchanged; no workflow statuses or remediation tracking are added.

State checkboxes show matching records plus ancestor context. Parent summaries and details retain all children within membership/search filters, rather than silently changing their meaning. Ctrl+wheel moves dates; use Fit/Year/Quarter/Month and arrow buttons for scale/navigation. No Pan dates slider is included.

## New in 1.6.2

- Submission comparison uses full stage headings and explicit day units. Waiting time appears in its current stage column, separate from completed durations; full approval variances are in Details.

- Today has a compact badge instead of a contrasting full-width bottom strip; row-navigation controls remain available.
- Removed the top-right legal-manufacturer explanation.
- Registration end dates after 31 December 2100 (UTC), including placeholder years 8900 and 9999, mean no registration end date. They produce no data-quality error and are excluded from expiry markers and Fit all. Ordinary dates through 2100 and invalid-date checks remain unchanged; source data is preserved.

## New in 1.6.1

- Short footer notes replace the state-filter, comparison and predicted-approval explanations above the chart. Removed the duplicated totals inside the timeline; the top summary is the single count display.

- The header includes distinct regulatory objective (RO) totals alongside submissions and applications. These totals follow the same membership and text-search filters; repeated membership rows do not increase the RO total.

## New in 1.6

- **Business Unit filter:** map the source `business_unit__c` column to the `BusinessUnit` field well. The filter starts at All and supports multiple selections alongside Site, Product, Country and Type. Source columns do not need renaming.
- **Product search:** open the filter and type at least two characters. The list renders at most 50 matching options at a time; refine the search to find more. Selected products remain separately accessible, and Business Unit and Site narrow the available choices. Opening the filter no longer creates a checkbox for every product.
- **Approval estimates:** an amber hollow diamond and shaded historical range appear on eligible submission rows. Select the row to see the estimate, supporting country history and exclusion reasons in the selectable Details panel. Recorded dates and parent summary bars are unchanged.

## Submission date filter

The filter uses one resolved submission date per distinct submission ID, with the same **ActualSubmission → LatestSubmission → OriginalSubmission** priority as the forecast anchor. Resolution examines all delivered membership rows for that submission, so choosing a product or site cannot hide a conflicting source date. Year choices come from usable resolved dates in the received data. **All dates** keeps dated and undated submissions; **No usable date** finds submissions whose date is missing, unmapped, invalid, conflicting or after 31 December 2100.

Date filtering has a broader window than forecasting: valid dates before 2020 and future actual submission dates remain filterable so they can be reviewed. They cannot anchor an approval estimate or contribute to its historical cohort. Future planned submission dates from 2020 through 2100 can anchor a forecast when the higher-priority fields are genuinely blank.

Custom **From** and **To** bounds are inclusive. Leave either blank for an open-ended range. Date filtering combines with Business Unit, Site, Product, Country and Submission Type, and limits the Timeline, Data quality worklist and its full filtered CSV export. It does not remove records from the local historical approval model. Power BI report-level filters can still limit the rows available to that model.

## Approval estimates, benchmarks and source requirements

Map `Country`, `ActualSubmission` and `ActualApproval` to their corresponding field wells, in addition to the required identifiers. Map `LatestSubmission` and `OriginalSubmission` for planned-date fallback. Use raw Date or DateTime columns, not Date hierarchies. An unmapped field is not treated as a genuinely blank source value: the selected anchor must be mapped, and any higher-priority submission fields must be mapped and blank before fallback is allowed. Missing required prediction mappings suppress estimates while the ordinary tracker can still display available data. `OriginalApproval` and `LatestApproval` remain available for displaying and comparing approval plans, but are optional for this calculation.

With a blank actual approval, an eligible submission shows an **Approval estimate**, including when either approval plan is recorded. It uses a valid actual submission date first; only when that field is genuinely blank does it try the latest planned submission, then the original planned submission. Actual submission dates must fall from **1 January 2020 through today**. Planned submission dates may fall from **1 January 2020 through 31 December 2100**, including future dates. A populated invalid, conflicting or out-of-window higher-priority date blocks fallback rather than being replaced by a lower-priority value. A single country and sufficient qualifying history are required.

A valid completed submission shows a **Historical approval benchmark** instead, anchored to its actual submission date. Planned submission dates never replace actual dates in completed benchmarks or historical training records. Invalid, conflicting, future or reversed actual approval dates remain withheld; no estimate is substituted for an unreliable actual approval. Invalid or conflicting **approval plans** do not block a separate historical range, but remain flagged in Details and Data quality. No source dates are changed or replaced.

The historical cohort uses distinct submissions for the same country. Both actual submission and actual approval must be valid dates from **1 January 2020 through today**, with approval on or after submission. Repeated product or other membership rows do not increase the sample. Missing, invalid, future, pre-2020, reversed or conflicting actual dates are excluded. Records attributed to multiple countries do not contribute to a country model; the model does not guess which country approved them. Products and submission types are not additional grouping requirements in this version.

Pending estimates require at least **10 qualifying distinct submissions**. A completed record is excluded from its own benchmark cohort, which must still contain at least **10 other qualifying submissions**. The estimate date is the resolved actual or planned submission anchor plus the cohort’s median submission-to-approval duration; a completed benchmark always uses the actual submission anchor. The shaded range uses the historical 25th and 75th percentiles—the **empirical middle 50%**, not a confidence interval or a guarantee of approval. Unusually long but otherwise valid durations remain included and are flagged for review. A pending estimate that has already passed is labelled as such; it is not moved into the future. Completed benchmarks are retrospective comparisons using currently available history, not backtested forecasts or pending-approval warnings.

Supporting history is calculated before this visual’s local filters, including Submission date, using **only the rows delivered by Power BI**. Report filters, model relationships, security and data-delivery limits can reduce that history. The Details panel shows the qualifying count, excluded count and reasons. An insufficient cohort, missing source dates or ambiguous country attribution produces an unavailable estimate or benchmark instead of an invented date. These checks reject obvious errors but cannot establish that every valid-looking source date is correct. Country-based ranges are descriptive and have not been validated as a forecasting model.

# Historical versions

## Previous Power BI visual — 1.4 preview

[Download the installable .pbiviz](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/powerbi-v1.4.0-preview.1/regulatory-timeline-1.4.0.0.pbiviz) · [Installation guide, source and previews](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/powerbi-v1.4.0-preview.1)

This custom Power BI visual carries over the demo's dark interface, styled search and filters, comparison controls, and selectable HTML details. Import the `.pbiviz` through Power BI's **Visualizations (…) → Import a visual from a file**, then map source columns to the named field wells. Start with AppID, ROID and SubID; map dates as raw Date columns, not Date hierarchies. You do not need Deneb or field renaming for this version.

Built using Microsoft's official tools. Type checks and browser tests of the actual visual class passed, including data refresh, resizing and multiple instances. This is an uncertified preview; actual Power BI Desktop/Service import and tenant compatibility still need verification. Clipboard depends on the host; details text remains selectable. Local selections do not filter other report visuals or persist across reopening.

The existing browser demo and Deneb 1.3 files remain available below. The custom visual source is generated by `powerbi-visual.build.cjs`; verification is in `powerbi-visual.verify.cjs`, and the full generated project with locked dependencies is included in the release source archive.

## Historical Deneb files — version 1.3

[Open live demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/) · [Download release](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/v1.3)

An interactive dark Vega timeline with entirely fictional data. No private source mappings, real records, photos or organizational branding are included.

## Explore and compare

Expand Application → RO → Submission using parent labels/bars. Selection is separate: select a submission, parent subtitle or membership count, then open Details. Scroll rows with wheel, scrollbar, buttons or arrow/page keys after focusing the chart. Ctrl+wheel pans the calendar in 1.5; presets and earlier/later buttons also work. The anchored viewport retains the clicked parent; bottom expansion reveals its first child.

View → Compare shows equivalent Applications, ROs or Submissions. Pin/unpin with ◇/◆, then select Pinned rows only. Parent context stays visible. Submissions can use elapsed days with resolved actual dispatch as Day 0; missing/conflicting dispatch produces no plot and an explicit label. Actual D→S and S→A durations exclude missing/reversed/conflicting endpoints. Open stage age remains separate. Approval Δ O / L compares actual approval with Original / Latest dates; positive means later. Full milestone variances appear in browser details. Duration sorts are meaningful only for submissions.

Colours encode each entity's **own state**, never a child's inferred state. Blue Active/Planned; cyan In Progress/Ready For Submission; purple Sent To Health Authority/Distributed; teal HA Received; green Completed; amber Deferred/On Hold By Mah; red Rejected; grey Inactive/Withdrawn/Archived and unrecognized/conflicting values. Original is dotted/hollow, Latest dashed, Actual solid. Dispatch circle, submission diamond, approval square, registration start down triangle, registration end up triangle. State text stays visible.

Registration end is off initially and is excluded from the fit range until enabled. Toggling it refits the axis; it never changes processing durations. Registration start remains a distinct marker.

## Search, membership and details

Genuine HTML search supports caret editing, paste and normal selection. Top search covers IDs/product/country/type and retains all delivered membership rows of matching submissions. Business Unit, Site (legal manufacturer), Product, Country and Type are searchable multiselect filters: OR within a list, AND across delivered rows. Product search requires two characters and shows at most 50 matches at a time. Singleton LM/country names display directly; multiple memberships use counts, with full independent lists in Details. No fabricated product–country pairings. Application counts use distinct filtered ROs/submissions.

Details starts collapsed, grows to its content up to a cap, and uses selectable HTML text. It includes relationships, approval record/estimate/history cards, an expandable date matrix and processing history, registration dates, durations/variances, full paged/searchable memberships and separate data issues. Copy details includes full membership lists regardless of current page/search. Unknown dates read Not recorded; invalid/conflicting values are withheld.

## Power BI

The retained **historical Deneb 1.3** files are `deneb.vega.json` for current Deneb or `deneb-legacy.vega.json` for legacy host sizing; `deneb-comparison.vega.json` starts with submission comparison. These files contain no embedded records and use generic aliases. AppStatus, SubmissionType and RegistrationEnd were new in 1.3; Country remains optional for that version. The 1.6 Business Unit filter and approval prediction engine belong to the installable visual and browser demo, not those historical Deneb files. Browser `timeline.json` supplies a host stub and is not a Deneb import.

The Deneb specs contain genuine native HTML signal bindings; the broken drawn-text imitation is removed. Browser HTML details are not part of Deneb. For report copying, follow [POWER-BI-DETAILS.md](POWER-BI-DETAILS.md) and the supplied generic Power Query helper. Selection in this aggregate chart is internal; companion tables use an explicit native submission selector. No automatic table filtering or aggregate drillthrough is claimed. Installed Power BI/Deneb and the helper's Power Query refresh require local verification. Recommended native visual 900 × 850 with overflow enabled as needed.

Deneb host rebuilds can reset expansion, pins, query, selection, scroll and zoom. Optional patching has documented limits; there is no promise of 30,000-row host-state retention. See [Deneb dataset documentation](https://deneb.guide/docs/dataset) and [documented HTML bindings](https://deneb.guide/docs/changelog).

## Run and validation

Serve this directory with any static server; all runtime assets are local. GitHub Pages serves the main branch root. No analytics or data uploads. Dark responsive layout; narrow screens scroll the chart horizontally.

Real Vega parsing/rendering and functional tests cover state grain, distinct counts, full memberships, search, comparison level/pins, Day 0, expiry domains, date conflicts/reversals, exact duration/variance, sorts, anchored expansion and 30,000 fictional membership rows. Drawn rows are capped at60; aggregation still processes all delivered data. Browser tests check genuine controls, copying, filters and responsive layout. Actual Power BI cannot be verified in the standalone browser.

Vega 5.33.0 is bundled under BSD-3-Clause; see VEGA-LICENSE.txt.
