# Regulatory Tracker 1.15.0

[Live demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/) · [Version 1.15.0 release](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/v1.15.0) · [Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/v1.15.0/regulatory-tracker-1.15.0.0.pbiviz)

Import the updated package into Power BI. The stable visual GUID preserves upgrade identity. This is an uncertified preview; verify the import in your report. Public demo records are fictional.

## Site Submission Outlook — independent state filters in 1.2.0

[Download Site Submission Outlook 1.2.0](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-submission-outlook-v1.2.0/site-submission-outlook-1.2.0.0.pbiviz) · [Live preview](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-submission-outlook/preview.html) · [Field mappings and instructions](site-submission-outlook/README.md)

Shows the **current and following month** for **ABO, ADJ, ADK, AJG, ARDG and SCR**. Each month's planned submissions split into **In process** and **Submitted**, using distinct submission IDs and actual submission dates. The planned date determines the column, including submissions completed early. Click a column to inspect its records. Includes totals, optional business-unit filtering, light/dark themes and screenshot mode.

**Overdue backlog** appears beneath each site and in the summary. It counts submissions planned before the first displayed month with no actual submission date. For October–November, that means everything planned before 1 October, including earlier years. Click a backlog count for the relevant submissions, oldest first. Backlog stays separate from the monthly plan totals and completion percentage; the cutoff advances automatically, and recorded actual submission dates clear completed items.

The **Business unit** dropdown starts at All and filters the monthly plan, backlog and their details together. Map the existing Business unit field to enable it; until then the dropdown shows a mapping prompt. Blank units remain separately selectable as Not recorded.

**Submission state**, **RO state** and **Application state** now have separate multiselect filters and details columns. Each starts at All, with every delivered state independently selectable, including inactive, cancelled, archived and withdrawn records. Nothing is excluded automatically. The filters apply to both the monthly plan and backlog. Blank mapped states are Not recorded; multiple recorded values remain visible. Actual submission dates alone determine Submitted. Selections are saved and shown in screenshot mode.

The visual identity and four required mappings are unchanged: Submission ID, Site, Initial planned submission date and Actual submission date. Business unit remains optional. **Add the three optional state fields**, using each record's own state column, to enable the new filters. **Keep earlier planned dates included in report/page/visual filters** so Power BI delivers the backlog rows. No change-response fields are required. Calculation, browser and packaged-runtime checks cover combined filters, missing mappings, duplicates, conflicts, rollover and 10,000 distinct submissions. Preview data is fictional; verify the imported visual against your report.

## Country response IDs and dispatch progress — version 1.15.0

Open a Change ID's **Details → Country progress** to see expected countries, assessment responses, linked submissions, dispatch progress, attention reasons and required documentation. The list is searchable and sorts by attention or country. It covers all delivered records for that change, including countries without a returned response or a linked submission. Local Gantt filters do not remove its expected-country list; report/model filters still limit the records delivered to the visual.

### Three additional optional mappings

| Source column | Visual field |
| --- | --- |
| Expected Responses: Unique Identifier | Expected response ID |
| Expected Responses: Impacted Countries | Expected response country |
| Change Assessment Response: Unique Identifier (per Country) | Response ID (per country) |

Keep the existing response Countries, Timeline, MOH filing requirement and Required documentation mappings. Keep the submission Country field as well. The IDs establish response identity; expected-country names label the list and connect its entries to submission countries. Do not replace the country field with the identifier string.

The expected and received IDs match within the same Change ID after trimming and case normalization. IDs are opaque: the visual does not extract country names or CR numbers from them. Different response-country spellings can use the expected-country label when the IDs match. A conflicting expected country for one ID, a missing key, or an unmatched key is shown for review and cannot silently fall back to a country-only join. Reports without these identifiers retain the existing country-based behavior.

Use the existing model route **Change Assessment Initiation → Expected Responses → Change Assessment Response**, with the response join on the two unique-identifier fields. Deliver expected-country rows even when no response exists. Parent-only assessment rows carrying Change ID can now supply evidence to that change's linked submissions; they do not need invented application, RO or submission IDs. Records excluded by the model query cannot be restored by this visual. Validate a table containing both IDs, Change ID, expected country and response fields before mapping the visual. [Microsoft's relationship guidance](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema) explains how keys establish relationships between tables.

### Progress and priorities

Progress is **distinct linked submissions with a valid recorded Actual Dispatch Date / distinct linked submissions** for that country and change. For example, 3 of 5 dispatched means two linked submissions have no qualifying dispatch date. A planned date, Completed state, actual submission or actual approval never substitutes for actual dispatch. Duplicate product memberships and repeated event appearances do not increase the count. Invalid, conflicting, future dispatch dates or ambiguous submission countries are flagged for review.

Attention sorting puts data that needs checking and overdue dispatch/response targets first, followed by awaiting responses, absent submission links, remaining dispatch work and fully dispatched countries. Dispatch-overdue indicators use the existing confirmed dispatch requirement and open-submission rules. Every row explains its reason; this is a workflow prompt, not a regulatory-risk score. A missing response means no matching response was delivered to the visual, not proof that none exists in SharePoint.

Required documentation is preserved as supplied, including line breaks. Dispatch progress indicates that the linked submissions were sent. The source has no document-by-document completion field, so the visual does not claim individual documents are missing, received or approved. MOH filing reasons remain informational and do not hide submissions.

### Corrected survey timeline basis

The response timeline means **submission to approval**, not dispatch to approval. A surveyed range starts from Actual Submission Date; if blank, it uses latest planned submission, then original planned submission, explicitly labelled as a forecast. Invalid or conflicting higher-priority dates do not fall back. Actual Approval Date remains the recorded outcome alongside the surveyed range. A dispatch date alone cannot anchor it. Months continue to mean 30 days, weeks 7 days. Blank/N/A, invalid, reversed or conflicting durations remain in Details without a range. Source: **Change Impact Assessment Tool — SharePoint**.

The release tests include separate expected/received rows, absent responses, mismatched IDs, cross-change isolation, duplicate memberships, exact dispatch progress, both themes, country filtering, sorting/selection and 10,000 submissions. Power BI model delivery still needs verification against your report.

## Country assessment matching — version 1.14.3

Submission estimates and assessment Details now select the response for that submission's country within its linked change. Responses for other countries no longer block a valid estimate or show another country's documents. Change and event Details retain all their country responses.

Map these existing visual fields from the country response table; the source columns do not need renaming:

| Source column | Visual field |
| --- | --- |
| Countries | Change Assessment Response Countries |
| Timeline | Change Assessment Response Timeline |
| If No MoH Filing Required | MOH filing requirement |
| Country response documentation text | Required documentation |

Use the country, timeline, filing requirement and documents from the same response record. Keep submission Country mapped separately. The response must arrive with its correct Change ID and existing event/QMS links. Use the optional expected/received ID mappings above for identifier-based matching; country names remain labels and submission-country links. Response counts alone do not supply response details. Keep recorded counts unsummed across repeated country and membership rows.

Blank timelines and N/A remain in Details with filing requirements and documentation, but do not create a range. Supported examples include 1 month, 4 months, 30 days and 6–8 months. Months use 30 days. Missing or ambiguous submission countries, conflicting durations for the same change/country, conflicting submission dates and multiple matching changes still withhold a combined band. The visual does not guess a country, split country lists or infer a missing response. It can only use records delivered by the Power BI model.

No new mappings are introduced by this patch. The new regression fixture covers multiple countries per change, duplicate memberships, all three grouping modes, both themes, country-specific documentation, blank/N/A timelines and rendered ranges. The existing 10,000-submission and retained-record checks remain in the release suite.

## Complete record visibility — version 1.14.2

Named records delivered to the visual are retained at every level: **Change ID, Regulatory Event, Application, RO and Submission**. An application or RO no longer needs a submission to appear. An event can appear without applications, ROs or submissions, and a Change ID can appear without any linked event. Missing or unusable dates suppress only the corresponding bar, not the record row or Details.

Submissions with missing parent identifiers remain accessible beneath **Application not recorded** and/or **RO not recorded** containers. These labels are not invented records and are excluded from named-record totals. Parent-only records do not create placeholder submissions. Counts remain distinct across duplicate memberships and overlapping events.

All delivered Change IDs are listed in Change initiation grouping. An event nests under a change only when its existing QMS references match; absent or conflicting references do not fabricate a link. Those events remain under **Other regulatory events**. Search includes standalone Change IDs and events, and every retained row has selectable Details.

**Expand/collapse defaults are unchanged.** The visual still respects deliberate filters and grouping. This does not recover records that the Power BI model, relationships, report filters or data delivery omit. To include independent records, the model must supply real rows for those identifiers, including parent-only rows where appropriate; do not create artificial cross-joins. Rows with no identifier at any level cannot be identified as named records. A host delivery-limit notice remains visible if Power BI refuses additional rows.

Existing field mappings continue to work; **no new fields** are required. For a standalone-record view, at least one of ChangeID, EventName, AppID, ROID or SubID must be mapped. Retained-record checks cover both themes, all three grouping modes, blank dates, missing parents, QMS mismatch, duplicate rows, Details and search. The existing 10,000-submission test remains part of the release checks.

## Performance and grouping stability — version 1.14.1

Survey matching now uses an index rather than scanning every delivered row per submission. Event and change hierarchies reuse shared record indexes. Sorting stores only identifiers and numeric ranks, reuses existing hierarchies, and no longer carries copies of record details through the sort lookup. Switching grouping clears a selection from the previous view while preserving each hierarchy's expansion keys.

The new browser regression test uses **10,000 distinct submissions**, duplicate memberships and overlapping events. It checks 18 group switches, real mouse expansion across groups, six numeric sort reversals, search and repeated host refresh. It verifies unique row keys, stable totals, no stale selection and compact sort records. Existing calculations and field mappings are unchanged.

On the local synthetic browser fixture, loading took approximately **7.3 seconds** and the slowest switch approximately **1.2 seconds**. These measure the visual, not Power BI model/network refresh. A separate 3,000-submission matching/hierarchy benchmark improved from approximately 1.47 seconds to 0.31 seconds with unchanged survey counts. Timings depend on hardware and actual membership/response volume.

Import the updated package; **no additional fields** are needed beyond the change-initiation mappings below.

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
| Change Assessment Response Countries | Response Countries, separate from submission Country |
| Change Assessment Response Timeline | Response Timeline on that same response |
| MOH filing requirement | Response If No MoH Filing Required |
| Required documentation | Country-specific documentation text on that response |

Use your existing model relationships to deliver real event/change/submission/response rows. Every delivered Change ID is retained. Events nest beneath a Change ID only when its nonblank QMS reference and the event QMS reference match after trimming and case normalization. It does not split compound CR references, infer historical links or join Agile. Normalize composite references in the model using a verified mapping table where necessary. Change IDs and event names must identify their respective records uniquely.

### Surveyed approval range

The thin magenta band above the submission milestones is sourced from **Change Impact Assessment Tool — SharePoint**. Match on Change ID and assessment country (trimmed, case-insensitive, exact country name). Use one country per response row. Standard LM preparation and historical approval estimates remain separate.

Durations accept positive days, weeks and months, including ranges such as **6–8 months** or **6 to 8 months**; months use 30 days and weeks use 7 days. The response timeline covers submission-to-approval. Actual submission takes priority, then latest planned submission, then original planned submission; planned anchors are labelled as forecasts. Invalid/conflicting dates do not silently fall back. Missing anchors, reversed/invalid/conflicting durations, unmatched countries and multiple change/country estimates withhold the combined band and remain visible in Details. A single duration is a narrow marker. This is a survey estimate, not a guaranteed forecast.

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

For the Tracker, Roadmap, IVDR, Key Submissions and Site Regulatory Plan, map your **Submission dispatch required c** source field to **Dispatch required**. Keep the True / False / blank values; no calculated replacement field is needed. Site Submission Outlook uses the separate four-field mapping above.

| Visual | Download | Demo |
| --- | --- | --- |
| Regulatory Tracker 1.15.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/v1.15.0/regulatory-tracker-1.15.0.0.pbiviz) | [Tracker](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/) |
| Registration Overview / Roadmap 1.4.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/roadmap-2026-v1.4.0/roadmap-2026-1.4.0.0.pbiviz) | [Roadmap](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/roadmap-preview.html) |
| IVDR Overview 1.2.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/ivdr-overview-v1.2.0/ivdr-registration-overview-1.2.0.0.pbiviz) | [IVDR](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/ivdr-preview.html) |
| Key Submissions 1.1.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/key-submissions-2026-v1.1.0/key-submissions-2026-1.1.0.0.pbiviz) | [Key submissions](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/key-preview.html) |
| Site Regulatory Plan 1.1.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-plan-2026-v1.1.0/site-regulatory-plan-2026-1.1.0.0.pbiviz) | [Site plan](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-plan-preview.html) |
| Site Submission Outlook 1.2.0 | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-submission-outlook-v1.2.0/site-submission-outlook-1.2.0.0.pbiviz) | [Current and next month](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-submission-outlook/preview.html) |

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
