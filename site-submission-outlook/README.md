# Site Submission Outlook — 1.0.0

A separate Power BI custom visual showing **the current and following calendar month** for **ABO, ADJ, ADK, AJG, ARDG and SCR**. Each month's planned submissions are split into **In process** and **Submitted**. The package has its own visual identity and does not replace the Regulatory Tracker.

[Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-submission-outlook-v1.0.0/site-submission-outlook-1.0.0.0.pbiviz) · [Live preview with fictional data](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-submission-outlook/preview.html) · [Release files](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/site-submission-outlook-v1.0.0)

## Import and map

Import `site-submission-outlook-1.0.0.0.pbiviz` using **Visualizations → … → Import a visual from a file**. Add the visual and map these columns:

| Field well | Source column |
|---|---|
| Submission ID | The unique submission ID used in the tracker |
| Site (legal manufacturer) | The field containing ABO, ADJ, ADK, AJG, ARDG and SCR |
| Planned submission date | **Initial/original planned submission date**, matching the reference slide |
| Actual submission date | The actual submission date, not dispatch or approval |
| Business unit (optional) | The existing business-unit field |

Map raw columns, not Date hierarchies. A mapped date field can contain blanks. No event, change-initiation or response fields are needed. If you prefer a revised plan, map the latest planned submission date instead; the visual always uses the date column supplied and does not silently fall back to another date.

## How counts work

- **Planned month determines the column.** Within that month's planned cohort, a valid actual submission date on or before today means Submitted. A blank actual date means In process.
- This is progress against a plan, **not submissions made during the calendar month**. An item planned for next month but already submitted appears in next month's Submitted segment. An item submitted this month with a plan outside the two displayed months is outside this chart.
- Each SubID counts once. Repeated source rows from product, country or other relationships do not increase counts.
- Future, conflicting or invalid actual submission dates produce **Check date** rather than a guessed progress status. When present, this is a separate amber segment; Planned = In process + Submitted + Check date.
- Missing, conflicting or invalid planned dates cannot be placed in a month and appear in Data checks. The checks are explicitly scoped; some concern records outside the displayed months.
- **Overdue** means still In process with a planned date before today, within the two-month plan. Older backlog is outside this view.
- The visual does not infer submission from lifecycle status or dispatch. Apply Power BI report/visual filters to remove any inactive, withdrawn, cancelled or otherwise out-of-scope work according to your reporting policy. A blank actual submission date remains In process among the delivered records.
- A submission associated with multiple different sites is unallocated and listed in Data checks. It is not duplicated into several named sites. Blank-site records and rows without SubID are also reported. Site names are matched after trimming and ignoring case; different codes such as ABO and ABON are not silently equated.
- The same calendar window is used for all sites. December correctly pairs with January of the next year. Today/current month use the viewer's local calendar; source date columns are treated as calendar dates. The view updates when data updates and at the next date change while open.
- Sites start with the confirmed main six. The Sites menu allows up to six other delivered site values, retains zero-count sites and saves the chosen list in the report. Business-unit and site controls affect this visual only. Power BI filters also affect the delivered rows.
- Only records delivered by Power BI can be counted. Additional segments are requested with the supported fetch-more-data API; partial-delivery notices remain visible in screenshot mode.

## Use the visual

Click or keyboard-activate a monthly column to see its submission IDs, planned dates, actual dates and progress. Search and pagination give access to every record in that column. Data checks open the affected records separately.

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

The included tests check count rules, duplicate rows, month rollover, dates, six-site focus, optional mappings, host delivery, keyboard interaction, screenshots and 10,000 distinct submissions. `preview.html` uses explicitly fictional data. The published screenshot uses a fixed October 2026 example; the live visual and demo advance with the current month.

This is an uncertified custom visual. Package/browser tests do not validate your actual Power BI data relationships or your organisation's import policy. Verify the imported result against a standard Power BI table containing the same four source columns.

The visual requests no network or export privileges. It uses Power BI's [visual lifecycle](https://learn.microsoft.com/en-us/power-bi/developer/visuals/visual-api) and [segmented data delivery](https://learn.microsoft.com/en-us/power-bi/developer/visuals/fetch-more-data).
