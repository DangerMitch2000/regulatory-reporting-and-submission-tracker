# Submissions & Approvals 1.1.2

Compare submissions and RO approvals across two calendar years using **Actual**, **Initial plan**, or **LBE plan** dates. LBE means Latest Best Estimate for both submissions and approvals. Previously named WHO Submissions & Approvals; version 1.1.2 keeps the same visual identity and remaining field mappings so it replaces the earlier visual on import. The visual opens on **Actuals**, **Commercial region = WHO**, **Business unit = ID**, the six standard sites and unassigned sites. Country and current-state filters default to All. Years default to the previous and current calendar years; Actuals use year-to-date activity, while plan views cover the full selected years.

[Download the Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/who-activity-v1.1.2/submissions-approvals-1.1.2.0.pbiviz) · [Interactive demo with fictional data](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/who-activity/preview.html) · [All visuals](../README.md)

## Install and map fields

Import the `.pbiviz` through **Visualizations → Import a visual from a file** in Power BI Desktop. Confirm replacement when updating the original WHO visual. Map raw columns, not automatic date hierarchies, and use **Do not summarize**.

| Field well | Map this source column | Purpose |
| --- | --- | --- |
| Commercial region (WHO classification) | The Commercial region field containing `WHO` | Required for scope; a separate WHO classification field is not needed. |
| Site (legal manufacturer) | Legal manufacturer/site | Required for grouping. Blank values are retained as **Unassigned site**. |
| Submission ID | Unique Submission ID | Distinct submission count. |
| Actual submission date | Actual authority submission date | Determines the submission year. |
| Regulatory Objective (RO) ID | Unique RO ID | Distinct approval count. |
| Actual RO approval date | Actual approval date for that RO | Determines the approval year. Do not use planned approval or registration start. |
| Initial planned submission date | Original/initial planned submission date | Optional; tracker role `OriginalSubmission`. |
| LBE planned submission date | Latest Best Estimate submission date | Optional; tracker role `LatestSubmission`. |
| Initial planned RO approval date | Original/initial planned approval date for the RO | Optional; tracker role `OriginalApproval`. |
| LBE planned RO approval date | Latest Best Estimate approval date for the RO | Optional; tracker role `LatestApproval`. |
| Submission state | Current submission state | Optional multi-select filter and Details; tracker role `SubStatus`. |
| RO state | Current RO state | Optional multi-select filter and Details; tracker role `ROStatus`. |
| Application state | Current application state | Optional multi-select filter and Details; tracker role `AppStatus`. |
| Business unit | Business unit | Defaults to ID when mapped. |
| Product | Product name | Optional filter and Details. |
| Country | The tracker's Country field: application's lead-market country | Optional filter and Details; separate from Commercial region. |
| Submission type | Submission type | Optional filter. |
| Application ID / Registration ID | Linked record IDs | Optional Details and reconciliation. |
| Submission URL / RO URL | Corresponding platform URLs | Optional HTTPS links opened by clicking the submission or RO ID in Details. |
| Registration URL | Registration platform URL | Retained as an optional mapping for compatibility; the activity table opens submission and RO records. |

An unmapped ID or selected date field makes its metric **Unavailable**, rather than presenting a misleading zero. Map the ID and date for each metric/basis you want to measure. The other metric can work independently. Existing reports can keep the mappings for retained fields; add the eight optional country, state and planned-date fields to enable the new controls and Details values.

## What is counted in Actuals

- **Submissions:** distinct Submission IDs with usable actual submission dates in the selected year.
- **Approvals:** distinct RO IDs with usable actual approval dates in the selected year. Joined registrations, products and submission rows do not multiply approvals.
- The metrics are independent. A submission in 2025 with an approval in 2026 contributes to different years. A 2026 approval can count even when its submission occurred before the two-year window.
- Existing actual dates remain historical evidence even when a record is now closed or archived. States never manufacture an approval date or year.
- Dates are resolved across all delivered rows for each identity before local filters are applied. Conflicting or invalid actual dates are excluded from that metric and listed for review; an independent valid metric can still count.
- A RO can legitimately have several child submissions. Different dates on those submissions do not invalidate its approval.
- Yesterday is always the reference date. Actual dates after yesterday are excluded and flagged. The footer labels this as a previous-day reference, not a source refresh timestamp. No Data as-of date field needs to be mapped; this optional field was removed in 1.1.2, and legacy values do not override the reference.
- Dates display as `20 Nov 2026`; day-first source text and ISO dates are supported without guessing ambiguous month-first input.

## Initial plan and LBE plan

The **Date basis** selector switches the cards, charts and matching Details records between Actual, Initial plan and LBE plan. Initial plan uses the original baseline; LBE uses the latest best estimate. Each selected field determines its own calendar year, with no fallback between fields. A blank LBE stays unrecorded even when Initial plan exists. Invalid or conflicting plans stay reviewable and do not invalidate an independent usable actual date.

Submission plans count distinct Submission IDs. Approval plans count distinct RO IDs, even when several submissions are linked to the same RO. Plans after the reference date remain eligible within the selected calendar years; only Actuals are restricted to recorded dates through that reference. Planned-only records therefore appear in the appropriate plan view. Details shows **Initial**, **LBE**, and **Actual** together for the selected milestone.

The views compare annual volumes, not a fixed completion cohort: a record can be planned for one year and completed in another. No completion percentage is inferred by dividing actual-year totals by planned-year totals.

## Current-state and country filters

Open **More options** for Application state, RO state and Submission state. Each filter supports several values, All, and Not recorded. They describe current delivered states, not the states those records held in the reporting year. All is the default, so completed historical activity remains visible even when records are now closed, inactive or archived. Missing state mappings do not silently apply a saved state restriction.

The three states remain independent: a completed submission does not establish an approved RO. Multiple linked child records can legitimately have different states; conflicting states for one identity are reviewable. Country defaults to All and includes Not recorded. The Country field remains separate from WHO classification in Commercial region.

## WHO scope, missing sites and regions

The default recognises explicit WHO commercial-region values, including `WHO`, `WHO (Multi-country)` and `World Health Organization`. Other source values can be selected explicitly. Selecting another region or all regions changes the scope label; it does not silently call those records WHO.

**Blank Commercial region is not evidence of WHO activity.** Such records are flagged for review and can be inspected by selecting **Not recorded** or all regions. They do not enter the default WHO totals.

**Blank sites on identified WHO records remain included by default**, in a separate **Unassigned site** group and in Data checks. No site is inferred from a product, country or similar name. The standard six sites remain available in the picker: ABO, ADJ, ADK, AJG, ARDG and Abbott Diagnostics Scarborough, Inc. Conflicting multiple assignments use a separate review bucket so totals remain additive.

Only sites with activity under the selected date basis in either selected year are drawn. Three active sites produce three rows; the matching site order is retained on both charts, including zero bars for the other metric. The coverage label counts the standard sites separately from unassigned activity. **Sites → All** includes other source sites too.

## Use the visual

Four cards show previous/current-year submissions and approvals. Paired horizontal bars compare years, with a common numeric scale across the two charts. Select a card or bar to inspect its matching record IDs and dates. Search Details, copy IDs, or click a record ID to open its supplied platform page. IDs without a usable link remain plain text. The compact Details table has no Source or Platform columns.

Switch grouping between Site and Commercial region. Filters apply to commercial-region scope, business unit, sites, products, country, submission type and current states. Selecting multiple dimensions requires matching evidence on a delivered source row; unrelated joined values are not treated as a valid combination. Filter selections and date basis persist in the report. The subtitle shows the selected scope and date basis beneath the fixed Submissions & Approvals title.

Data checks expose missing links/IDs, blank site/region values, unusable dates and conflicting assignments. Loading messages remain visible while Power BI supplies additional rows; partial counts are not presented as complete.

## Review all dates and states

Data checks examine all six mapped Actual, Initial plan and LBE dates for submissions and RO approvals, plus the three current-state fields. Changing the chart's Date basis does not hide checks for the other date fields. Field coverage shows which dates and states can actually be checked; unmapped fields or missing identity mappings are identified explicitly. There is no check or mapping requirement for a Data as-of date field.

**Needs review** includes invalid or conflicting dates, actual dates after the previous-day reference, conflicting states for the same record ID, and supported state/date inconsistencies. A clearly completed submission or approved RO without its actual date needs review. **Information** includes missing plans or states and missing actual dates without conclusive completion evidence. Clearly pending work is labelled as such. These checks never invent dates, replace missing values, or change the activity-counting rules. Future planned dates are valid. Closed or archived records can legitimately retain historical actual dates.

The totals distinguish **check entries** from **distinct identified records**. One record can have several checks, and anonymous source rows cannot establish distinct records. Checks cover delivered data in the applicable filter scope across all years, including undated records; they are not a count of excluded records from the two chart years. Blank region and site coverage checks can also remain visible separately from the chart's counted groups.

Open **Data checks**, choose **All**, **Needs review** or **Information**, then search or sort the list. Expand **Source evidence** to see mapped fields, raw values, states and linked IDs. **Copy checks** copies the complete searched/filtered checklist across all pages as a spreadsheet-friendly table; **Copy IDs** copies distinct displayed IDs only. Neither action changes the source data. To verify a finding, compare the exact record and field in Velocity and then check the corresponding Power BI mapping and relationships.

Dark is the default; Light is available. Typography uses Wallace Sans and Wallace Sans Light for the title, with Segoe UI/Arial fallbacks. No font files are bundled. The layout stacks charts on narrower visuals and accommodates the full Scarborough site name. Screenshot mode hides controls for a clean capture while retaining scope and quality notices.

These are **records delivered from Velocity**, not independently validated company totals. Reconcile the IDs with source owners and local trackers before external reporting; this version does not silently merge supplemental spreadsheets.

## PowerPoint and PDF

This package is an **uncertified custom visual**. Screenshot mode changes its layout; it does not enable Power BI's native PowerPoint/PDF export. Microsoft documents these restrictions for [PowerPoint](https://learn.microsoft.com/en-us/power-bi/collaborate-share/end-user-powerpoint#considerations-and-limitations) and [PDF](https://learn.microsoft.com/en-us/power-bi/collaborate-share/end-user-pdf#considerations-and-limitations). Use a screen capture or PowerPoint's supported live Power BI add-in workflow when available in your environment. A snapshot can have lower image quality than live mode.

## Build and test

Use Node 22 from this directory:

```text
node build.cjs
npm --prefix powerbi install
node prepare-preview.cjs
node logic-test.mjs
npm --prefix powerbi run typecheck
node prepare-tests.cjs
node browser-test.cjs
npm --prefix powerbi run package -- --no-stats
```

Extract the resulting PBIVIZ ZIP into `package-check/`, then run `node package-test.cjs` to exercise the actual packaged runtime. Local Windows browser tests can use `WHO_BROWSER_CHANNEL=msedge`; CI installs Chromium. Generated projects, screenshots and packages are ignored by Git.

The [release workflow](../.github/workflows/who-activity.yml) runs the checks, packages a versioned PBIVIZ, verifies uploaded draft assets byte for byte and only then publishes the preview release. [Release notes](RELEASE-NOTES.md).
