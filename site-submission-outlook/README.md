# Site Submission Outlook — 1.6.0

A separate Power BI visual showing **last month, this month and next month** for **ABO, ADJ, ADK, AJG, ARDG and SCR**. Each month's planned submissions are split by their latest delivered progress. The visual has its own identity and does not replace the Regulatory Tracker.

[Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-submission-outlook-v1.6.0/site-submission-outlook-1.6.0.0.pbiviz) · [Interactive fictional preview](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-submission-outlook/preview.html) · [Release files](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/site-submission-outlook-v1.6.0)

## What's new

- Three months in a full-width chart, with a compact summary strip instead of a tall side panel.
- Shorter text beneath the chart; detailed rules are in **How counts work**. Data checks and incomplete-delivery notices remain accessible.
- **Yesterday** drives both the As of label and date-based checks. Months still follow the viewer's current calendar month.
- Optional **Product** and **Commercial region** filters, plus **Country** using the existing country mappings.
- A clickable Submitted evidence breakdown: actual date, qualifying Submission state, or linked Registration approval. Each submission appears in one evidence category.
- More compact Details, sortable/filterable columns, Days overdue and expandable secondary record information.
- Strict day/month/year date parsing, including timestamps, and review flags for conflicting registration states or RO/application associations.

## Import and map

Import `site-submission-outlook-1.6.0.0.pbiviz` through **Visualizations → … → Import a visual from a file**. Replace the existing Site Submission Outlook visual when prompted. The visual GUID and existing 19 roles are unchanged; the two new roles are optional.

| Field well | Source column |
|---|---|
| **Submission ID** | The unique submission ID used in the tracker; blank values are allowed |
| **Site (legal manufacturer)** | The field containing the site codes |
| **Planned submission date** | Initial/original planned submission date, matching the reference slide |
| **Actual submission date** | Actual authority submission date, not dispatch or approval |
| Business unit (optional) | Existing business-unit field |
| Submission state (optional) | The related submission's recorded state |
| RO state (optional) | The related regulatory objective's recorded state |
| Application state (optional) | The related application's recorded state |
| Dispatch required (optional) | Submission dispatch-required flag; Yes/No or True/False; blanks remain unknown |
| Planned dispatch date (optional) | Planned internal dispatch date |
| Actual dispatch date (optional) | Recorded actual internal dispatch date |
| Registration ID (optional) | ID/code on the Registration record linked through this submission's RO |
| Registration country (optional) | Country name on that Registration record |
| Registration state (optional) | State on the same Registration record |
| Registration start date (optional) | Start date on that Registration record |
| Registration end date (optional) | End date on that Registration record |
| Secondary country (optional) | Related country name, used when no Registration country is recorded |
| RO ID (optional) | Regulatory objective ID associated with this source row |
| Application ID (optional) | Application ID associated with this source row |
| **Product (optional, new)** | Related product name; repeated product joins do not multiply submissions |
| **Commercial region (optional, new)** | Separate commercial-region field, not a guessed registration-region replacement |

Use raw date columns, not Date hierarchies, and do not summarize the columns. Map the state from the correct table even when several source fields have the same name. If a revised plan is preferred, map that date instead: the visual uses the supplied plan and does not invent a fallback. No new required fields, change IDs, events or assessment-response fields are needed.

The two new filter wells are optional; unmapped filters are disabled and do not affect counts. Country requires no new role. It resolves the distinct Registration countries for a submission first, then Secondary country only if no primary country is recorded. A Registration ID is not required merely to display a country. Multiple countries are retained.

## Calendar and progress

The displayed months are **previous, current, next**. In November 2026, these are October, November and December. Earlier-plan backlog stops at **1 October 2026**, so those backlog records cannot also be in October's monthly bar. January and December rollovers follow the same rule.

**As of** is the previous calendar day in the viewer's local calendar. Actual dates must be on or before that date; due dates must be strictly earlier than it to be overdue. For example, on 11 November, the reference is 10 November. A due date of 9 November is overdue; one of 10 November is not yet overdue under this convention. A recorded actual date of 11 November needs review; independent qualifying Submission state or Registration approval evidence can still establish Submitted. The label is a reporting reference, not a measured data-refresh timestamp.

Source dates are treated as calendar dates, without shifting the visible day for a time-zone offset. Native dates, ISO dates/timestamps and strict **DD/MM/YYYY** dates with optional time are accepted. Slash dates always mean day/month/year: `08/09/2026` is **8 Sep 2026**. Invalid dates such as `31/02/2026` are rejected. Displayed full dates use day, three-letter month and four-digit year.

Each monthly bar is a **planned cohort**, not a count of filings made that month. A next-month plan already submitted appears as Submitted in next month's bar. Last month's progress uses the latest delivered states and dates; it is **not a reconstructed month-end snapshot**.

A submission is **Submitted** if any of these applies:

1. Its resolved actual submission date is valid and on or before the reference date.
2. Its Submission state is **Completed, HA Received, Sent To Health Authority or Rejected**.
3. A linked record has a nonblank **Registration ID** and **Approved or Conditionally Approved** state on that same record.

For the evidence breakdown only, priority is **actual date → Submission state → Registration approval**. A record meeting all three rules counts once in Submitted and once under Actual date. All evidence remains visible in Details.

**Distributed** is internal distribution and does not establish authority submission. Registration Canceled, Expired, Planned, Rejected and Withdrawn do not establish submission by themselves; neither does a Registration ID or registration date alone. Those states do not erase separate valid submission evidence. Registration approval preserves the agreed completion rule even when its start/end dates or source statuses need review. The visual never invents an actual filing date.

**RO Health Authority Approved** excludes the submission from overdue work but does not by itself turn the monthly bar into Submitted. This is intentionally separate from the qualifying Submission and Registration states.

Blank actual dates without completion evidence remain In process. Invalid, conflicting or after-reference actual dates without independent completion evidence appear as **Check date**. Planned = In process + Submitted + Check date. Missing/conflicting/invalid plans cannot be assigned to a month and appear in Data checks. Independent completion evidence can still establish Submitted while date issues remain flagged.

## Overdue groups

| Group | Rule for a submission without completion evidence |
|---|---|
| Internal dispatch | Dispatch is required, actual dispatch is blank and planned dispatch is before the reference date |
| Authority submission | Dispatch was recorded on/before the reference date, or explicitly not required, and planned submission is before the reference date |
| Check dispatch data | Submission plan is past due but the dispatch stage or applicable dispatch due date cannot be established |

The groups are exclusive. **Total overdue** includes all delivered dates, including already-due internal dispatch for later or missing submission plans. **Overdue within the three-month plan** and **earlier-plan backlog** are separate subsets; do not add these subsets to Total overdue. A required dispatch with a future due date is not overdue merely because the submission plan is older; reversed dates are flagged.

Submitted records and Health Authority Approved ROs are excluded from all overdue groups. Actual dates needing review are not silently treated as blank to inflate confirmed backlog. With dispatch fields unmapped, the original submission-plan overdue behavior remains available.

## Filters, distinct IDs and coverage

Sites, business unit, product, commercial region, country and lifecycle-state filters affect this visual only. Report/page/visual filters also restrict which rows Power BI delivers. The initial site list is the confirmed six; up to six delivered site codes can be selected. Zero-count selected sites remain visible. Dark is the default for a new visual; existing saved Light selections remain respected.

Each nonblank Submission ID counts once. Business unit, product, commercial region and lifecycle selections must match together on a delivered source row, preventing artificial combinations across unrelated joins. Completion evidence, dates and related identifiers are resolved across **all delivered rows for that Submission ID before local selections**, so a filter cannot conceal an approval or a conflicting date. Country matches the resolved country set. Site conflicts are unallocated for review rather than duplicated into several sites.

A reused Registration ID with conflicting states or multiple linked RO/application IDs receives a review flag. These warnings do not silently change the agreed rule that a valid Approved/Conditionally Approved registration supplies completion evidence. Review your model links: the visual cannot determine whether an older registration was incorrectly joined to a newer filing.

Rows without a Submission ID remain inspectable through the missing-ID coverage count and Data checks. Exact repeated unidentified rows remain separate because the visual cannot establish whether they are distinct future submissions or repeated joins. RO, Application and Registration IDs are never substituted for Submission IDs. These rows are excluded from distinct submission totals. Their original related ID pairs remain visible even if registration is blank.

The visual requests additional data segments through Power BI's supported API. Loading/partial-delivery warnings remain visible, including Screenshot mode. Only delivered records can be counted. A standard Power BI table using the same source fields and report filters is the right reconciliation check when records are absent or relationships fail.

## Details and compact layout

Click a summary count, submitted percentage, evidence count, bar total/segment, overdue card, backlog count or coverage count to open its matching records. Keyboard Enter/Space works too. Zero counts open an empty list. Chart scope remains selected; local Details filters reset for the newly selected count.

Details provides search, column sorting/filtering and pagination. Days overdue uses the applicable next-action due date and yesterday's reference. Secondary fields expand per record so the main table stays compact. All dates, lifecycle states, dispatch fields, registration records and related IDs remain available. Main issue / next action explains recorded evidence and a suggested follow-up; it does not claim to know an unrecorded root cause.

**Copy IDs**, **Copy RO IDs** and **Copy application IDs** operate on all matching pages after Details filters. They copy only real recorded IDs of the named type. IDs are also selectable for manual copying; a selectable text fallback is available if the host blocks clipboard access.

The chart has three bars per selected site. At narrow widths, its chart area scrolls horizontally to preserve readable text. **How counts work** holds the longer explanation below the concise as-of/filter/coverage line. Screenshot mode hides the controls; press **Escape** to return. Clicking a count exits Screenshot mode and opens Details. Partial-data notices are not hidden.

## Build and verification

Source: `submissions.logic.mjs`, `submissions.ui.mjs`, `submissions.css`, `visual.ts`, `build.cjs`.

```sh
node build.cjs
node prepare-preview.cjs
npm --prefix powerbi install
npm --prefix powerbi run typecheck
cd powerbi
npx playwright install chromium
cd ..
node logic-test.mjs
node dispatch-test.mjs
node attention-test.mjs
node registration-test.mjs
node identity-test.mjs
node prepare-tests.cjs
node browser-test.cjs
node copy-test.cjs
node dispatch-browser-test.cjs
node metrics-browser-test.cjs
node registration-browser-test.cjs
node identity-browser-test.cjs
npm --prefix powerbi run package -- --no-stats
unzip -o 'powerbi/dist/*1.6.0.0.pbiviz' -d package-check
node package-test.cjs
```

On Windows, extract the PBIVIZ as ZIP with an archive tool and set `TRACKER_BROWSER_CHANNEL=msedge` to use installed Edge. GitHub Actions runs source calculations, type checks, browser interactions and the **actual packaged runtime** before publishing a separate prerelease with the package, demo, preview, source archive and SHA-256 checksums.

Checks include three-month/year boundaries, yesterday cutoffs, planned/backlog separation, duplicate joins, all completion rules, mutually exclusive evidence counts, missing IDs, optional and unmapped filters, registration conflicts, state selections, copying across pages, keyboard controls, resize behavior, 10,000-submission data, and packaged field mappings. The preview uses fictional data. Local/browser tests do not validate your actual Power BI relationships or your organization's import policy. This is an uncertified custom visual and requests no network or export privileges.


