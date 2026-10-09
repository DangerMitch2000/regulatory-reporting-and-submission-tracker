# Site Submission Outlook — 1.3.1

A separate Power BI custom visual showing **the current and following calendar month** for **ABO, ADJ, ADK, AJG, ARDG and SCR**. Each month's planned submissions are split into **In process** and **Submitted**. The package has its own visual identity and does not replace the Regulatory Tracker.

[Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-submission-outlook-v1.3.1/site-submission-outlook-1.3.1.0.pbiviz) · [Live preview with fictional data](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-submission-outlook/preview.html) · [Release files](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/site-submission-outlook-v1.3.1)

## New in 1.3.1: Selectable counts and highlighted issues

Click **overdue within the two-month plan** to open only the overdue submissions planned for the two displayed months. It uses the existing dispatch/submission due-date rules and excludes earlier backlog, later submission plans and records without a submission plan.

All summary counts now open their matching Details: Planned, In process, Submitted, Check date and the submitted percentage. The percentage opens the Submitted records and explains the numerator and denominator. The totals above monthly bars open the complete site/month list; the coloured segments and their numbers open only that segment's records. Existing backlog and overdue-action cards remain selectable. The record counts below the chart also open their included/excluded records, including source rows without an ID. Dates, axis tick marks and pagination labels remain reference information.

Each count opens a fresh list with detail search, page, progress, dispatch-stage and site filters reset, while keeping the chart's business-unit, lifecycle and selected-site scope. Details scrolls into view and receives keyboard focus. Enter or Space activates a focused count. Clicking a count in Screenshot mode exits that mode and opens Details. Zero counts open an empty list. Copy IDs continues to include all matching pages.

**Main issue / next action** appears beside each submission ID with a coloured label, the recorded evidence and a suggested follow-up. It highlights internal dispatch delays, late authority filing, recorded holds or inactive/paused states, health-authority rejection, and missing/conflicting data. A submitted or approved record is marked accordingly. The explanation uses source evidence and does not guess a missing document or a root cause. Highlighting does not change counts or automatically exclude records. You can search the issue wording as well as IDs and states.

Data checks include source rows with no submission ID so their displayed count can be inspected. Such rows remain uncounted as distinct submissions; no replacement ID is invented, and Copy IDs skips them. The three coverage counts show records outside selected sites, outside the month plan/backlog, or missing an ID.

**No new mappings are required for 1.3.1.** Keep the existing submission, status, business-unit and dispatch mappings.

## Dispatch and submission delays

Add the three optional mappings **Dispatch required**, **Planned dispatch date** and **Actual dispatch date**. The monthly columns keep their In process/Submitted split. Details now show the dispatch stage, requirement and both dispatch dates; use **Dispatch stage** to separate work still pending internally from work awaiting submission to the authority.

The new **Overdue by next action** section separates three groups. Its **Total overdue** counts each submission once:

| Overdue group | Rule |
|---|---|
| Internal dispatch | Dispatch required is Yes, the mapped actual dispatch date is blank, and the planned dispatch date is before today. |
| Authority submission | A valid actual dispatch date is on/before today, or dispatch required is No, and the planned submission date is before today. |
| Check dispatch data | The submission plan is past due, but the dispatch stage or required dispatch due date cannot be established. The submission stays included in total overdue for review. |

For example, dispatch planned for 5 October and submission planned for 20 October counts as **Internal dispatch overdue** on 7 October. Recording dispatch on 7 October removes it from that group. It only becomes a **Late authority submission** after 20 October if it remains unsubmitted. Due today is not overdue. Dispatch alone, including Submission state Distributed, never means submitted to the authority.

Submitted records and **RO state Health Authority Approved** are excluded from all overdue groups, even without actual submission dates. The monthly Submitted calculation remains unchanged. An approved RO is labelled **RO approved** in dispatch Details; it is not counted as an authority-submission delay.

**All overdue work covers all delivered dates**, including the historical backlog, the two-month plan, and internal dispatch already due for a later or missing submission plan. The backlog and monthly overdue counts are subsets of this total: do not add them to it. A missing submission plan still appears in Data checks and cannot be assigned to a monthly column. A required dispatch planned in the future is not overdue, even if the submission plan is older; reversed planned dates are flagged for review.

Click a coloured overdue card or **Total overdue** to open its IDs, oldest applicable due date first. Filter these lists by site, dispatch stage or search; **Copy IDs** includes every matching page. Earlier-plan backlog counts remain below each site and use the same next-action rules.

Required accepts Yes/No, true/false, 1/0 or Required/Not required, ignoring case and whitespace. Blanks, unmapped fields and unrecognized values are never assumed to mean No. A mapped blank actual dispatch is different from an unmapped field. Invalid/future/conflicting dispatch dates and contradictory requirements remain reviewable. If dispatch evidence is missing, a past-due submission plan remains in Check dispatch data rather than being labelled a confirmed authority delay. Entirely blank optional dispatch data does not flood Data checks; its overdue records are accessible in the check-dispatch group.

Dates, dispatch requirements and filing/approval evidence are resolved across **all delivered rows for the same Submission ID**, before local filters. A business-unit or status selection cannot hide a recorded dispatch or completion, or resolve a conflicting requirement by discarding another row. All three new mappings are optional; existing report mappings continue to work.

## Previous-day data label

The **As of** label shows the previous calendar day to match the daily data refresh: for example, on 8 October it reads **As of 07 Oct 2026**. It updates automatically and appears in both the wide summary and compact footer, including screenshot mode. It is a rolling previous-day label based on the viewer's local calendar, not a timestamp read from Power BI refresh metadata. The current-and-next-month window and counting rules are unchanged.

## Copy submission IDs from Details

Open a monthly column, a backlog count, an overdue-action card or **Data checks** to show its Details list.

- **One ID:** click the Submission ID cell, then press **Ctrl+C** (**Cmd+C** on Mac). The whole ID is selected, including hyphens. Keyboard users can tab to the ID cell and copy it.
- **All matching IDs:** click **Copy IDs**. This copies distinct IDs from every matching page, one per line, so pasting into Excel places one ID on each row. It respects the selected site, month/backlog/overdue/checks list, business unit, lifecycle states, search, submission-progress and dispatch-stage filters. It is not limited to the 50 visible rows.
- If automatic copying is unavailable, the read-only **Submission IDs to copy** box stays selected. Press **Ctrl+C**, then paste where needed. **Select all IDs** restores the selection; **Hide ID list** closes the box. A success message appears only when automatic copying succeeds.

The copy list contains IDs only, without dates, headings or status text. Empty lists cannot be copied. Only records delivered by Power BI can be included. No additional fields, privileges or mapping changes are needed, and IDs are not sent to a server.

## Filing states count as Submitted

**Submission states Completed, HA Received, Sent To Health Authority and Rejected count as Submitted**, even when the actual submission date is blank. This updates the monthly Submitted segment, In process count, completion percentage and details. A valid actual submission date on or before today still establishes Submitted independently. Each Submission ID counts once when either or both forms of evidence exist.

Details name the evidence, such as **Submitted · HA Received state** or **Submitted · Rejected state**, when progress is established by state without a qualifying actual date. The source actual date stays blank or retains its original value; no date is invented. Invalid, future or conflicting actual dates still appear in Data checks even if a qualifying state establishes progress.

| Submission state | Counts as Submitted without a qualifying actual date? |
|---|---|
| Completed | Yes |
| HA Received | Yes |
| Sent To Health Authority | Yes |
| Rejected | Yes: confirmed to mean rejected by the health authority after filing |
| Distributed | No: confirmed to mean internal distribution |
| Deferred, In Progress, Inactive, Planned, Ready For Submission, Withdrawn | No |
| Not recorded / unmapped / other source values | No |

**Submitted means filing progress, not approval or a successful outcome.** Rejected remains visible as the recorded state and can still need follow-up; it is excluded from the unsubmitted backlog. Withdrawn and other nonqualifying states still count as Submitted when a valid actual submission date establishes filing. Use the state filters to control reporting scope; a filter selection alone does not establish filing.

### Submitted and approved records leave overdue backlog

An older planned submission is excluded from overdue backlog when **Submission state is Completed, HA Received, Sent To Health Authority or Rejected, OR RO state is Health Authority Approved**, even if its actual submission date is blank. Any one condition is sufficient. This applies automatically to each site's backlog count, the total and the backlog details list.

The rule uses the existing optional **Submission state** and **RO state** mappings. Map both to apply both conditions; if only one is mapped, its condition still applies. Unmapped or blank values cannot establish completion. Labels are compared ignoring letter case and extra whitespace. Other states, including Conditionally Approved, Archived, Cancelled and Inactive, do not automatically trigger this particular rule. Application state does not establish backlog completion.

All delivered rows for the same SubID are checked: any qualifying submission state or Health Authority Approved RO state excludes that ID once. Local state or business-unit filters cannot hide that evidence and reintroduce it to backlog. Conflicting date/site data still remains in Data checks. No actual date is invented.

**RO state Health Authority Approved supplies the overdue exclusion**; it does not itself mark a monthly record Submitted. The four qualifying Submission states supply both Submitted progress and the overdue exclusion. Other RO states and Application states do not establish monthly Submitted progress. Version 1.3.0 introduced the three optional dispatch mappings; they are retained in 1.3.1.

## Separate lifecycle state filters

Map **Submission state (optional)**, **RO state (optional)** and **Application state (optional)** to the recorded state on each respective record. Three independent dropdowns appear at the top, each starting at **All**. Every delivered state is listed separately; Cancelled, Inactive, Archived, Withdrawn and any additional source values remain available. Use the checkboxes to include or exclude states deliberately; **All** restores the complete delivered list and **None** selects no values. Backlog additionally applies the completion rule above, even with all filters set to All.

Selections apply to the monthly bars, totals, backlog and its lists, and the scope of Data checks. Several values within one field use OR; selections across fields and Business unit use AND. A submission is included when at least one of its source rows satisfies the combined selection. Its dates and site are still resolved across all its delivered rows, so a filter cannot hide conflicting data or a recorded actual submission date. A repeated SubID still counts once.

Each details table includes **Submission state**, **RO state** and **Application state** alongside progress. Source labels are retained after trimming whitespace. Blank mapped values are **Not recorded**; an unmapped field is **Not mapped**. Different recorded states for the same submission are displayed together as **Multiple: …**, rather than silently choosing one. States are searchable in the details list. Submitted is established by a qualifying actual date or one of the four qualifying Submission states above.

The state mappings are optional. Until one is supplied, its filter stays disabled with a **Map field** prompt; any saved selection for that unmapped field is ignored. Existing report mappings keep working. State selections are saved in the report and printed in the chart footer, including screenshot mode.

## Overdue backlog

The orange count beneath each site shows submissions planned **before the first displayed month** whose next action is overdue under the dispatch/submission rules above. Records established as Submitted and records with **RO state Health Authority Approved** are excluded. Unknown dispatch stages with past-due submission plans remain included for review. The summary includes a total for all selected sites. For October–November 2026, the submission-plan cutoff is before **1 October 2026**, including any earlier year. When the chart advances to November–December, the cutoff advances to 1 November.

Click a site's backlog count, or the total, to see the relevant submissions, oldest planned date first. The list supports search and pagination. Backlog remains separate from the two monthly bars, planned total and completion percentage. Recording an actual submission date, a qualifying Submission state or a Health Authority Approved RO state removes that submission from the backlog at the next data update.

**Keep earlier planned dates included in the Power BI data delivered to this visual.** A report, page or visual filter restricted to October–November would remove the rows needed to count the backlog. The visual selects the two displayed months itself; it cannot restore rows filtered out by Power BI. Business-unit, site and lifecycle state filters apply to the backlog as well as the monthly plan.

Import 1.3.1 over the existing Site Submission Outlook visual. The visual identity and mappings from 1.2.0 are unchanged. Ensure Submission state and RO state are mapped to apply both completion conditions.

## Business-unit filter

Map your business-unit column to **Business unit (optional)**. The **Business unit** dropdown at the top starts at **All** and lists each delivered business unit separately, with **Not recorded** for blank values. Selecting a unit filters both monthly bars, their totals and details, and the overdue backlog counts and lists. **All** restores every delivered unit. The selection is saved in the report.

The control stays visible while unmapped and reads **Map Business unit field** until that field is supplied. Screenshot mode hides controls but prints the selected unit in the chart footer; press Escape to restore the controls. Power BI report filters can further restrict which units and records are delivered.

## Import and map

Import `site-submission-outlook-1.3.1.0.pbiviz` using **Visualizations → … → Import a visual from a file**. Add the visual and map these columns:

| Field well | Source column |
|---|---|
| Submission ID | The unique submission ID used in the tracker |
| Site (legal manufacturer) | The field containing ABO, ADJ, ADK, AJG, ARDG and SCR |
| Planned submission date | **Initial/original planned submission date**, matching the reference slide |
| Actual submission date | The actual submission date, not dispatch or approval |
| Business unit (optional) | The existing business-unit field |
| Submission state (optional) | The related submission's recorded status/state, for example Submission `state__v` |
| RO state (optional) | The related regulatory objective's recorded status/state, for example Regulatory Objective `state__v` |
| Application state (optional) | The related application's recorded status/state, for example Application `state__v` |
| Dispatch required (optional) | The submission's dispatch-required flag, for example Submission `dispatch_required__c` / **Submission dispatch required c** |
| Planned dispatch date (optional) | The submission's planned internal dispatch date, for example `planned_dispatch_date__c` |
| Actual dispatch date (optional) | The submission's recorded actual internal dispatch date, for example `dispatch_date__rim` |

Map raw columns, not Date hierarchies. A mapped date field can contain blanks. No event, change-initiation or response fields are needed. If you prefer a revised plan, map the latest planned submission date instead; the visual always uses the date column supplied and does not silently fall back to another date.

Use the state from the correct source table for each field, even if all three columns are called `state__v`. These are recorded lifecycle states, not the calculated In process/Submitted progress or a dispatch-required flag. Power BI must be able to combine them with Submission ID through your existing relationships. If a standard table containing the same columns reports a relationship error, resolve that model query first; the custom visual cannot reconstruct rows Power BI has not delivered.

## How counts work

- **Planned month determines the column.** Within that month's planned cohort, a valid actual submission date on or before today **or Submission state Completed, HA Received, Sent To Health Authority or Rejected** means Submitted. A blank actual date without a qualifying Submission state means In process.
- This is progress against a plan, **not submissions made during the calendar month**. An item planned for next month but already submitted appears in next month's Submitted segment. An item submitted this month with a plan outside the two displayed months is outside this chart.
- Each SubID counts once. Repeated source rows from product, country or other relationships do not increase counts.
- Future, conflicting or invalid actual submission dates produce **Check date** when no qualifying Submission state establishes progress. A qualifying state still counts as Submitted, with the actual-date issue retained in Data checks. Check date is a separate amber segment when present; Planned = In process + Submitted + Check date.
- Missing, conflicting or invalid planned dates cannot be placed in a month and appear in Data checks. The checks are explicitly scoped; some concern records outside the displayed months.
- **Overdue within the two-month plan** uses the applicable next-action due date for those monthly cohorts. **Overdue backlog** covers older submission plans under the same rules. These subsets do not overlap; both are included in **Total overdue**, which also covers already-due dispatch for later/missing submission plans. Submitted records and Health Authority Approved ROs are excluded.
- Backlog uses the same mapped planned-date column as the monthly bars. Submitted records, records completed under the state rule, future plans, missing/invalid/conflicting planned dates, and records needing actual-date review are not counted as confirmed backlog. Invalid, future or conflicting actual dates remain in Data checks; the visual does not assume they are blank. Distinct IDs are resolved before local filters, so repeated source rows cannot inflate backlog or hide conflicting dates/sites or completion evidence.
- The four qualifying Submission states establish Submitted progress without inferring an actual date. Other states, internal distribution and dispatch do not establish that progress. All delivered states are included by default in the monthly plan. Use the separate state dropdowns, or Power BI report/visual filters, to choose the scope according to your reporting policy. Backlog additionally excludes Health Authority Approved ROs.
- A submission associated with multiple different sites is unallocated and listed in Data checks. It is not duplicated into several named sites. Blank-site records and rows without SubID are also reported. Site names are matched after trimming and ignoring case; different codes such as ABO and ABON are not silently equated.
- The same calendar window is used for all sites. December correctly pairs with January of the next year. Today/current month use the viewer's local calendar; source date columns are treated as calendar dates. The view updates when data updates and at the next date change while open.
- Sites start with the confirmed main six. The Sites menu allows up to six other delivered site values, retains zero-count sites and saves the chosen list in the report. Business-unit, site and state controls affect this visual only. Power BI filters also affect the delivered rows.
- Only records delivered by Power BI can be counted. Additional segments are requested with the supported fetch-more-data API; partial-delivery notices remain visible in screenshot mode.

## Use the visual

Click or keyboard-activate a monthly column, backlog count or overdue-action card to see its submission IDs, dates, progress, all three recorded lifecycle states and the dispatch requirement, stage and dates. Search, stage/site filters and pagination give access to every record in that count. Data checks open the affected records separately. In normal mode, scroll down to see the overdue-action cards and Details; Screenshot mode fits the full chart to the visual.

Light and dark themes are available. **Screenshot mode** hides controls and fits the chart to the visual's available space; focus the visual and press **Escape** to return. A wide visual around 1000–1400 pixels across works well for six sites. Very small captures reduce text readability. The chart's Submitted label does not imply that every submission was on time.

## Verification and build

Source files are `submissions.logic.mjs`, `submissions.ui.mjs`, `submissions.css`, `visual.ts` and `build.cjs`. From this directory, run:

```sh
node build.cjs
node prepare-preview.cjs
cd powerbi
npm install
npm run typecheck
npx playwright install chromium
cd ..
node logic-test.mjs
node dispatch-test.mjs
node attention-test.mjs
node prepare-tests.cjs
node browser-test.cjs
node copy-test.cjs
node dispatch-browser-test.cjs
node metrics-browser-test.cjs
cd powerbi
npm run package -- --no-stats
cd ..
unzip 'powerbi/dist/*.pbiviz' -d package-check
node package-test.cjs
```

Extract the `.pbiviz` as a ZIP into `package-check` using your platform's archive tool when `unzip` is unavailable. To test with an installed Microsoft Edge browser instead of bundled Chromium, set `TRACKER_BROWSER_CHANNEL=msedge`. GitHub Actions runs the calculation, type, browser and packaged-runtime checks before publishing a separate release with the Power BI package, demo, preview, source archive and checksums. The release source archive includes the generated project's dependency lockfile.

The included tests check count rules, duplicate rows, exclusive backlog cutoff, older years, late completion, independent plan/backlog totals, date/site conflicts, month rollover, sites/business units, all three state filters, combined selections, exact/custom/blank states, unmapped fields, saved selections, host delivery, keyboard interaction, screenshots, backlog pagination/search and 10,000 distinct submissions. Dispatch checks cover separate due dates, no double counting, missing/conflicting flags and dates, omitted mappings, recorded-dispatch transitions, future/missing submission plans, filtering and copying across pages. The same dispatch and selectable-count interaction checks run against the actual packaged runtime. Additional tests cover exact two-month-overdue membership, summary/percentage/segment selection, detail filter reset, all-page ID copying, missing-ID source rows, issue/action highlights, zero counts and keyboard access. `preview.html` uses explicitly fictional data. The published screenshot uses a fixed October 2026 example; the live visual and demo advance with the current month.

This is an uncertified custom visual. Package/browser tests do not validate your actual Power BI data relationships or your organisation's import policy. Verify the imported result against a standard Power BI table containing the same mapped source columns and filters.

The visual requests no network or export privileges. It uses Power BI's [visual lifecycle](https://learn.microsoft.com/en-us/power-bi/developer/visuals/visual-api) and [segmented data delivery](https://learn.microsoft.com/en-us/power-bi/developer/visuals/fetch-more-data).
