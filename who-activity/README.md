# Submissions & Approvals 1.0.1

Compare actual submissions and RO approvals across two calendar years. Previously named WHO Submissions & Approvals; version 1.0.1 keeps the same visual identity and field mappings so it replaces the existing visual on import. The visual opens with **Commercial region = WHO**, **Business unit = ID**, the six standard sites and unassigned sites. Years default to the previous and current calendar years; the current year is year to date.

[Download the Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/who-activity-v1.0.1/submissions-approvals-1.0.1.0.pbiviz) · [Interactive demo with fictional data](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/who-activity/preview.html) · [All visuals](../README.md)

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
| Business unit | Business unit | Defaults to ID when mapped. |
| Product | Product name | Optional filter and Details. |
| Submission type | Submission type | Optional filter. |
| Application ID / Registration ID | Linked record IDs | Optional Details and reconciliation. |
| Data as-of date | One consistent extraction/reference date | Optional; otherwise yesterday is clearly labelled as a reference date, not a refresh timestamp. |
| Submission URL / RO URL / Registration URL | Corresponding platform URLs | Optional HTTPS links in Details. |

An unmapped ID or date makes its metric **Unavailable**, rather than presenting a misleading zero. Map the ID and actual date for each metric you want to measure. The other metric can work independently.

## What is counted

- **Submissions:** distinct Submission IDs with usable actual submission dates in the selected year.
- **Approvals:** distinct RO IDs with usable actual approval dates in the selected year. Joined registrations, products and submission rows do not multiply approvals.
- The metrics are independent. A submission in 2025 with an approval in 2026 contributes to different years. A 2026 approval can count even when its submission occurred before the two-year window.
- Existing actual dates remain historical evidence even when a record is now closed or archived. States never manufacture an approval date or year.
- Dates are resolved across all delivered rows for each identity before local filters are applied. Conflicting or invalid actual dates are excluded from that metric and listed for review; an independent valid metric can still count.
- A RO can legitimately have several child submissions. Different dates on those submissions do not invalidate its approval.
- Actual dates after the reference date are excluded and flagged. Dates display as `20 Nov 2026`; day-first source text and ISO dates are supported without guessing ambiguous month-first input.

## WHO scope, missing sites and regions

The default recognises explicit WHO commercial-region values, including `WHO`, `WHO (Multi-country)` and `World Health Organization`. Other source values can be selected explicitly. Selecting another region or all regions changes the scope label; it does not silently call those records WHO.

**Blank Commercial region is not evidence of WHO activity.** Such records are flagged for review and can be inspected by selecting **Not recorded** or all regions. They do not enter the default WHO totals.

**Blank sites on identified WHO records remain included by default**, in a separate **Unassigned site** group and in Data checks. No site is inferred from a product, country or similar name. The standard six sites remain available in the picker: ABO, ADJ, ADK, AJG, ARDG and Abbott Diagnostics Scarborough, Inc. Conflicting multiple assignments use a separate review bucket so totals remain additive.

Only sites with actual activity in either selected year are drawn. Three active sites produce three rows; the matching site order is retained on both charts, including zero bars for the other metric. The coverage label counts the standard sites separately from unassigned activity. **All delivered sites** includes other source sites too.

## Use the visual

Four cards show previous/current-year submissions and approvals. Paired horizontal bars compare years, with a common numeric scale across the two charts. Select a card or bar to inspect its matching record IDs and dates. Search Details, copy IDs, and open supplied platform links to reconcile the number in Velocity.

Switch grouping between Site and Commercial region. Filters apply to scope, business unit, sites, products and submission type. Selecting multiple dimensions requires matching evidence on a delivered source row; unrelated joined values are not treated as a valid combination. Filter selections persist in the report. The subtitle shows the selected commercial-region scope beneath the fixed Submissions & Approvals title.

Data checks expose missing links/IDs, blank site/region values, unusable dates and conflicting assignments. Loading messages remain visible while Power BI supplies additional rows; partial counts are not presented as complete.

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
