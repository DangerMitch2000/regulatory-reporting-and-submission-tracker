# Site Submission Outlook — 1.2.0

A separate Power BI custom visual showing **the current and following calendar month** for **ABO, ADJ, ADK, AJG, ARDG and SCR**. Each month's planned submissions are split into **In process** and **Submitted**. The package has its own visual identity and does not replace the Regulatory Tracker.

[Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-submission-outlook-v1.2.0/site-submission-outlook-1.2.0.0.pbiviz) · [Live preview with fictional data](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-submission-outlook/preview.html) · [Release files](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/site-submission-outlook-v1.2.0)

## New in 1.2.0: separate lifecycle state filters

Map **Submission state (optional)**, **RO state (optional)** and **Application state (optional)** to the recorded state on each respective record. Three independent dropdowns appear at the top, each starting at **All**. Every delivered state is listed separately; Cancelled, Inactive, Archived, Withdrawn and any additional source values remain available. There are no automatic lifecycle exclusions. Use the checkboxes to include or exclude states deliberately; **All** restores the complete delivered list and **None** selects no values.

Selections apply to the monthly bars, totals, backlog and its lists, and the scope of Data checks. Several values within one field use OR; selections across fields and Business unit use AND. A submission is included when at least one of its source rows satisfies the combined selection. Its dates and site are still resolved across all its delivered rows, so a filter cannot hide conflicting data or a recorded actual submission date. A repeated SubID still counts once.

Each details table includes **Submission state**, **RO state** and **Application state** alongside the date-based progress. Source labels are retained after trimming whitespace. Blank mapped values are **Not recorded**; an unmapped field is **Not mapped**. Different recorded states for the same submission are displayed together as **Multiple: …**, rather than silently choosing one. States are searchable in the details list. Only a valid actual submission date on or before today establishes Submitted; Completed, Cancelled or an RO/application state does not substitute for that date.

The new mappings are optional. Until one is supplied, its filter stays disabled with a **Map field** prompt; any saved selection for that unmapped field is ignored. Existing report mappings keep working. State selections are saved in the report and printed in the chart footer, including screenshot mode.

## Overdue backlog

The orange count beneath each site shows submissions planned **before the first displayed month** that still have **no recorded actual submission date**. The summary includes a total for all selected sites. For October–November 2026, the cutoff is before **1 October 2026**, including any earlier year. When the chart advances to November–December, the cutoff advances to 1 November.

Click a site's backlog count, or the total, to see the relevant submissions, oldest planned date first. The list supports search and pagination. Backlog remains separate from the two monthly bars, planned total and completion percentage. Recording an actual submission date removes that submission from the backlog at the next data update, even if it was submitted late.

**Keep earlier planned dates included in the Power BI data delivered to this visual.** A report, page or visual filter restricted to October–November would remove the rows needed to count the backlog. The visual selects the two displayed months itself; it cannot restore rows filtered out by Power BI. Business-unit, site and lifecycle state filters apply to the backlog as well as the monthly plan.

Import 1.2.0 over the existing Site Submission Outlook visual. The visual identity and four required mappings are unchanged; add the three optional state mappings to enable the new filters.

## Business-unit filter

Map your business-unit column to **Business unit (optional)**. The **Business unit** dropdown at the top starts at **All** and lists each delivered business unit separately, with **Not recorded** for blank values. Selecting a unit filters both monthly bars, their totals and details, and the overdue backlog counts and lists. **All** restores every delivered unit. The selection is saved in the report.

The control stays visible while unmapped and reads **Map Business unit field** until that field is supplied. Screenshot mode hides controls but prints the selected unit in the chart footer; press Escape to restore the controls. Power BI report filters can further restrict which units and records are delivered.

## Import and map

Import `site-submission-outlook-1.2.0.0.pbiviz` using **Visualizations → … → Import a visual from a file**. Add the visual and map these columns:

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

Map raw columns, not Date hierarchies. A mapped date field can contain blanks. No event, change-initiation or response fields are needed. If you prefer a revised plan, map the latest planned submission date instead; the visual always uses the date column supplied and does not silently fall back to another date.

Use the state from the correct source table for each field, even if all three columns are called `state__v`. These are recorded lifecycle states, not the calculated In process/Submitted progress or a dispatch-required flag. Power BI must be able to combine them with Submission ID through your existing relationships. If a standard table containing the same columns reports a relationship error, resolve that model query first; the custom visual cannot reconstruct rows Power BI has not delivered.

## How counts work

- **Planned month determines the column.** Within that month's planned cohort, a valid actual submission date on or before today means Submitted. A blank actual date means In process.
- This is progress against a plan, **not submissions made during the calendar month**. An item planned for next month but already submitted appears in next month's Submitted segment. An item submitted this month with a plan outside the two displayed months is outside this chart.
- Each SubID counts once. Repeated source rows from product, country or other relationships do not increase counts.
- Future, conflicting or invalid actual submission dates produce **Check date** rather than a guessed progress status. When present, this is a separate amber segment; Planned = In process + Submitted + Check date.
- Missing, conflicting or invalid planned dates cannot be placed in a month and appear in Data checks. The checks are explicitly scoped; some concern records outside the displayed months.
- **Overdue within this month's plan** means still In process with a planned date before today, within the two-month plan. **Overdue backlog** is the separate count of older planned submissions with a blank actual submission date. These counts do not overlap.
- Backlog uses the same mapped planned-date column as the monthly bars. Submitted records, future plans, missing/invalid/conflicting planned dates, and records needing actual-date review are not counted as confirmed backlog. Invalid, future or conflicting actual dates remain in Data checks; the visual does not assume they are blank. Distinct IDs are resolved before local filters, so repeated source rows cannot inflate backlog or hide conflicting dates/sites.
- The visual does not infer submission from lifecycle status or dispatch. All delivered states are included by default. Use the separate state dropdowns, or Power BI report/visual filters, to choose the scope according to your reporting policy. A blank actual submission date remains In process among the included records, even if its recorded state is Cancelled or Completed.
- A submission associated with multiple different sites is unallocated and listed in Data checks. It is not duplicated into several named sites. Blank-site records and rows without SubID are also reported. Site names are matched after trimming and ignoring case; different codes such as ABO and ABON are not silently equated.
- The same calendar window is used for all sites. December correctly pairs with January of the next year. Today/current month use the viewer's local calendar; source date columns are treated as calendar dates. The view updates when data updates and at the next date change while open.
- Sites start with the confirmed main six. The Sites menu allows up to six other delivered site values, retains zero-count sites and saves the chosen list in the report. Business-unit, site and state controls affect this visual only. Power BI filters also affect the delivered rows.
- Only records delivered by Power BI can be counted. Additional segments are requested with the supported fetch-more-data API; partial-delivery notices remain visible in screenshot mode.

## Use the visual

Click or keyboard-activate a monthly column or backlog count to see its submission IDs, planned dates, actual dates, progress and all three recorded lifecycle states. Search and pagination give access to every record in that count. Data checks open the affected records separately.

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
node prepare-tests.cjs
node browser-test.cjs
cd powerbi
npm run package -- --no-stats
cd ..
unzip 'powerbi/dist/*.pbiviz' -d package-check
node package-test.cjs
```

Extract the `.pbiviz` as a ZIP into `package-check` using your platform's archive tool when `unzip` is unavailable. To test with an installed Microsoft Edge browser instead of bundled Chromium, set `TRACKER_BROWSER_CHANNEL=msedge`. GitHub Actions runs the calculation, type, browser and packaged-runtime checks before publishing a separate release with the Power BI package, demo, preview, source archive and checksums. The release source archive includes the generated project's dependency lockfile.

The included tests check count rules, duplicate rows, exclusive backlog cutoff, older years, late completion, independent plan/backlog totals, date/site conflicts, month rollover, sites/business units, all three state filters, combined selections, exact/custom/blank states, unmapped fields, saved selections, host delivery, keyboard interaction, screenshots, backlog pagination/search and 10,000 distinct submissions. `preview.html` uses explicitly fictional data. The published screenshot uses a fixed October 2026 example; the live visual and demo advance with the current month.

This is an uncertified custom visual. Package/browser tests do not validate your actual Power BI data relationships or your organisation's import policy. Verify the imported result against a standard Power BI table containing the same mapped source columns and filters.

The visual requests no network or export privileges. It uses Power BI's [visual lifecycle](https://learn.microsoft.com/en-us/power-bi/developer/visuals/visual-api) and [segmented data delivery](https://learn.microsoft.com/en-us/power-bi/developer/visuals/fetch-more-data).
