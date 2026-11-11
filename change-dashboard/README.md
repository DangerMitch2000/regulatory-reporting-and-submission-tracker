# Change Dashboard 1.7.0

[Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/change-dashboard-v1.7.0/change-dashboard-1.7.0.0.pbiviz) · [Interactive demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/change-dashboard/preview.html) · [Release](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/change-dashboard-v1.7.0)

A separate daily worklist with **Event (default), Change ID and Application views**, preserving the Regulatory Tracker's existing **69 field roles** and adding one optional **Commercial region** role. Filter by manufacturing site, product, business unit, commercial region, country and record state. Select a summary count, an event/change/application, then a country to inspect the evidence and linked source records. The existing Tracker and Registration Coverage Map remain separate visuals.

**Preview release:** package version **1.7.0.0**, API 5.11.0. This visual is not Microsoft-certified. The demo and screenshots use fictional records, fixed as of 09 Nov 2026. Production uses the previous calendar day in Europe/Dublin. This is an as-of reference, **not a measurement of source refresh time**.

## Bug fixes retained from 1.6.1

- Country rows stay beneath the sticky column titles, including dimmed rows and open header filters. The header remains clickable in Dark and Light themes.
- Paging keeps Details on a record from the visible page. Selecting a row preserves list scroll position; keyboard focus stays on row, sort and paging controls.
- Diagram and List controls retain focus, search caret and scroll position. Country selection reveals matching List records, including later pages.
- Selecting or searching an event cannot highlight another event's ROs/submissions through a shared application. Highlighted paths must be delivered together in a contiguous source-row segment; a missing intermediate ID breaks that path.
- Missing/conflicting country records remain visible for review and included in their applicable record counts. Conflicting lifecycle states retain all source evidence instead of silently dropping the inactive side.
- Country filters combine case/whitespace variants and keep scope after a case-only refresh. Commercial-region scope preserves the unknown-country bucket. Inactive application-only records follow the inactive toggle. **Clear filters** also clears detail-table filters.

Validation covers the real visual lifecycle and packaged browser runtime, long scrolling country lists, keyboard/touch interaction, shared-record paths, conflicting and missing source records, all three grouping modes, 10,000 submissions, 20,000 graph rows and 64,000 delivered rows. These synthetic-data checks validate visual behavior; they do not independently reconcile your private Velocity database or Power BI relationships.

## Install and map existing fields

1. Download the `.pbiviz` above. In Power BI Desktop, use **Visualizations (…) → Import a visual from a file**.
2. For an existing Change Dashboard, confirm replacement on import: its visual identity and all 69 existing field roles are unchanged. Add your separate Commercial region source column to the new **Commercial region** well (CommercialRegion). This is the only new mapping; it does not use Registration region or a country-to-region lookup. For a new instance, map the same source columns used in the Tracker into the matching named wells; Power BI does not automatically copy another visual's mappings.
3. Map **EventName** for Event view, **AppID** for Application view and **ChangeID** for Change ID view. Each view works independently of the other parent IDs. If EventName is unmapped on first load, the visual starts with the available Application or Change ID mapping. Include the country/RO and filing identifiers below. Add status and date evidence before interpreting the action counts. Keep identifiers as text; select **Don't summarize** and raw date columns, not date hierarchies.
4. Validate a few known changes against Velocity, including a pending country, an overdue dispatch, a submitted filing and an approved registration. Save and publish your report as usual.

| Purpose | Existing field roles |
| --- | --- |
| Planning dates | `ChangePlannedImplementation`, `EventPlannedCompletion` |
| Change identity and context | `ChangeID`, `ChangeStatus`, `ChangeProjectID`, `ChangeQMS`, `ChangeCreated`, `ChangePlannedImplementation` |
| Expected assessments | `ExpectedResponseID`, `ExpectedResponseCountry`, `ChangeResponseDue`, `ChangeResponseCount` |
| Returned assessments | `AssessmentResponseID`, `AssessmentCountry`, `AssessmentTimeline`, `AssessmentMOHFiling`, `AssessmentDocumentation` |
| Existing record links | `EventName`, `EventState`, `EventQMS`, `AppID`, `ROID`, `SubID`, `RegistrationID` |
| Source states | `AppStatus`, `ROStatus`, `SubStatus`, `RegistrationState` |
| Scope filters | `Manufacturer`, `RegistrationManufacturingSite`, `Product`, `BusinessUnit`, `Country`, new optional `CommercialRegion` |
| Dispatch | `DispatchRequired`, `OriginalDispatch`, `LatestDispatch`, `ActualDispatch` |
| Authority submission | `OriginalSubmission`, `LatestSubmission`, `ActualSubmission` |
| Approval | `OriginalApproval`, `LatestApproval`, `ActualApproval` |
| Registration evidence | `RegistrationID`, `RegistrationState`, `RegistrationCountry`; RO and Submission links must identify the same record |
| Platform links | `ApplicationURL`, `RegulatoryObjectiveURL`, `SubmissionURL`, `RegistrationURL` |

The complete, exact role names and descriptions are in [fields.json](fields.json). Other tracker fields remain available in **Linked records & source fields**, including catalog numbers, registration validity/renewal dates, product family, documentation and site information. There is no invented change-description field: the dashboard displays the supplied Change ID and project/QMS references.

Use the model's existing **real relationships** to deliver the associated records. A flat table of unrelated applications, assessments and submissions cannot be repaired inside a visual. `Country` is the **application's lead-market country**, as already mapped in the Tracker; registration country provides supporting evidence, not a substitute for an ambiguous filing country. Map expected countries even if no submission exists yet, so those countries remain visible. No filing is invented when a country has no linked submission.

## View by and country scope

- **Event (default):** one row per EventName, using its associated ROs and application lead-market countries. No SharePoint Change ID is required.
- **Change ID:** one row per SharePoint ChangeID, retaining expected country-assessment responses and linked Velocity records.
- **Application:** one row per AppID, including applications with neither an event nor a Change ID.

Labels, state filter, counts, copied IDs, CSV headers and missing-ID review follow the chosen view. Country/RO/filing evidence remains attached to its delivered associations; the visual does not manufacture missing parent links. The same application may belong to multiple events, so totals across view modes are not additive.

The **Awaiting assessment summary card remains hidden**. Existing assessment fields and detailed checks are retained for possible later use; no replacement assessment card is added. Assessment Details use **linked SharePoint response records**. In Event/Application views, only responses matching a country already present in the linked RO/application scope are included. Missing assessment links say **Assessment not linked**; a missing link does not establish that an event needs no assessment. Native EventState is shown but is not interpreted as a country-by-country response checklist.

## Interactive related-record diagram

Open **Related items**, or click an App/RO/Sub/Reg count in the worklist, to see **Change ID → Event → Application → RO → Submission → Registration** as connected columns.

- Lines connect adjacent identifiers supplied together in the same scoped Power BI row. Repeated product/catalog rows produce one node and one line. Independent lists are never paired by position, and missing intermediate IDs do not produce a guessed shortcut. Disconnected records stay visible. Correct source relationships are still required.
- **State colours** use the existing Regulatory Tracker palette for each item's own Change, Event, Application, RO, Submission or Registration state. A coloured border, dot, label and soft tint remain distinct from the selection outline. Diagram and List views use the same palette. Hover a node for its state, select it for the full label, or expand **State colours** for the legend of currently shown items.
- Case and whitespace variants of the same state resolve together. Missing or unknown states are neutral grey, with the supplied unknown label retained. Conflicting source states use the Tracker's conflict colour and say **Conflicting states**; no arbitrary state is chosen. Colour never inherits from a parent/child or changes the dashboard's completion rules: a Completed submission can be green while its RO is still awaiting approval. High-contrast mode uses the host colours with textual state labels.
- Click a node, or focus it and press Enter, to highlight its upstream and downstream paths while dimming unrelated branches. Shared ancestors do not cause all sibling branches to highlight. The selection strip shows the full ID, delivered country and state; **Copy ID** preserves the clipboard fallback. **Clear selection** restores all lines. Diagram selections do not change the worklist counts or country evidence selection.
- **Find ID** searches within the selected record and retains connected context. **List** provides a compact alternative with selectable/copyable IDs. **Copy linked IDs** still copies the complete scoped set.
- The diagram follows the top Country, Commercial region and inactive-work scope. It loads only when expanded and keeps selection/open state while inspecting the same parent. Selecting another parent resets the diagram selection. The existing column mappings and 70-role identity are unchanged.
- Nodes and connectors share one scroll area, with columns sized for the visual. The diagram stays at a maximum 280px viewport height. Large groups show 40 records per column page; column arrows access the rest. A **+** indicates additional links outside the displayed view. At most 1,500 visible lines are drawn at once; a notice appears if further links need an ID search. These display limits never change the source counts or exports.

## Connected country list

- Select a country in the detail table to open Related items and highlight that country's delivered records and connecting lines. The diagram clears its ID search and reveals the first matching record on each column's page. Other branches stay visible but dimmed; counts, dashboard filters and exports are unchanged.
- Select a diagram item (or a record in List view) to highlight its countries below. A single-country item selects that country's evidence and scrolls the country list to its row. For an item shared by several countries, the current evidence stays only if it belongs to that item; otherwise choose one of the highlighted countries.
- Country-table filters remain in place. If they hide a related country, **Show related countries** clears only those table filters. It does not clear the dashboard's Country, Commercial region or other scope filters.
- **Clear selection** restores the full diagram and removes the country-link highlight, retaining the country evidence you were inspecting. Selecting another parent resets the link selection; refresh removes selections for records no longer delivered.
- Countries use the existing application lead-market **Country** role and the existing Change-view fallback for assessment-only records. Missing countries remain explicit. No country is guessed from the order of parallel lists, and highlighting a shared parent never lights an unrelated country's links.

## Commercial region and event-list context

- **Commercial region** uses the separate supplied source field, never Registration region or inferred geography. If it is unmapped, the filter shows **Not mapped** and the existing worklist still works. When mapped, **Not recorded** lets you inspect missing region values.
- Selecting a region narrows the delivered country/filing work within each matching event, change or application. Country progress, next action, summary cards, Related items, copied linked IDs, export and **Worklist** counts follow that scope. **Loaded** counts remain the unfiltered delivered population. Source state/date conflicts are checked before scoping so a filter cannot conceal conflicting completion evidence.
- **Related items** shows distinct **Apps, ROs, Subs and Regs**, plus the linked **Change ID** where available. Repeated catalog/product memberships count once. Click a count to open the full selectable IDs in Details; use **Copy linked IDs** to copy them. ROs without submissions remain visible. The column sorts by the combined number of linked Apps/ROs/Subs/Regs and searches counts, labels and all linked IDs.
- `Implementation / event completion` shows `Change implementation` and `Event planned completion` separately in the same column. Map the source `planned_change_implementation_date__c` to `Planned Implementation Date` (ChangePlannedImplementation), and the regulatory event's `planned_completion_date__rim` to `Event planned completion` (EventPlannedCompletion). These existing roles are retained; no new field role is added.
- Both dates display as `DD MMM YYYY`. The two planning fields accept ISO dates/timestamps, three-letter-month dates, and the verified `DD/MM/YYYY` source format with optional time, such as `16/11/2026 00:00:00`. Slash dates in these two fields mean day/month/year. Native Power BI date columns work too; use raw dates, not Date hierarchies or numeric serials. Dispatch, submission, approval and response-date parsing is unchanged.
- Sorting uses a usable change implementation date first, otherwise a usable event planned completion date. Both values remain visible; a fallback never relabels an event date as a change implementation date. Missing values say `Not recorded`, unmapped roles say `Not mapped`, and unusable sources retain an explicit error. Undated rows stay last in either direction. Header filters search both dates and their labels.
- Hover a date or expand `Planning dates` in Details to inspect all source values. Multiple distinct dates show `Multiple dates` in the list rather than choosing one arbitrarily. CSV retains the original implementation-date column and appends a separate `Event planned completion date` column. These display/sort dates do not alter dispatch, submission or approval queues.
- Related items and both planning dates are available in Event, Change ID and Application views. The compact list supports sorting, text filters and **Reset table**, with horizontal table scrolling on smaller visuals.


## Table controls and record coverage

- **Next due defaults to most recently overdue first.** Upcoming dated work follows overdue work; undated work stays last. Click Next due to switch to oldest overdue first. For records with several outstanding actions, the representative next action follows that overdue ordering.
- Click any header in the main worklist, country breakdown or missing-parent table to sort. Click it again to reverse the order. IDs sort naturally (2 before 10); country approval progress sorts by approval fraction. Blank values stay last.
- Use the filter button beside each header for a case-insensitive text filter. Multiple column filters combine. Date searches use displayed text, such as **Nov 2026**, **overdue** or **Not recorded**; progress accepts a fraction such as **1/4**. Main record/product searches include names, IDs, sites, source state and project/QMS references.
- Main column filters affect worklist rows, summary cards, copied IDs, CSV and Worklist counts. Country and missing-parent table filters affect only their own detail tables. The top Country and Commercial region filters narrow the overall worklist scope.
- **Reset table** clears table sorting and column filters while preserving View by and the top scope filters. Switching View by clears main column filters so an event-ID search cannot accidentally hide applications.
- Top-right **Worklist** counts show distinct Change IDs, Events, Applications, ROs, Submissions and Registrations represented by matching worklist records across all pages, respecting country, commercial-region and inactive-work scope. **Loaded** counts show all delivered records before dashboard filters. Repeated memberships do not inflate either count. Differences can reflect intentional filters or missing parent links, not necessarily missing source records. Both remain limited to what Power BI delivered.
- Dark mode uses the Regulatory Tracker's charcoal surfaces, muted blue links and selection colours. Light and high-contrast support remain available.

## What the counts mean

Each card counts **distinct events, Change IDs or applications**, according to View by. It never counts raw product/catalog rows. One record can appear in several cards because its countries can be at different stages. Selecting a card shows every matching record, including approval work not yet overdue. **Needs attention** includes overdue actions, rejection follow-up and missing/conflicting evidence; **All changes** also includes ordinary progress.

| Card | Rule |
| --- | --- |
| Overdue internal dispatch | Dispatch is explicitly required, no usable actual dispatch or later submission/approval evidence exists, and the planned dispatch date is before the as-of day. |
| Overdue authority submission | Actual dispatch exists, or dispatch is explicitly not required; no submission/approval evidence exists, and the planned submission date is before the as-of day. |
| Awaiting approval | Submission evidence exists, but approval evidence does not. It need not be overdue; a past approval target is highlighted in Details. |

Latest planned dates take precedence. Original dates are used only when latest dates are absent. Invalid/conflicting latest dates do not silently fall back to old targets. **Missing dates are review issues, never inferred overdue dates.** Actual dates after the as-of day are flagged for review. Dates display as **DD MMM YYYY**; explicit invalid raw values remain in source evidence. Workflow dates outside 1900–2100 are unusable for timing. Registration validity dates do not determine queues.

**Submission evidence:** a usable actual submission date, Submission state **Completed**, **HA Received**, **Sent To Health Authority**, or HA **Rejected**; approval evidence also implies submission. **Distributed** is internal only. Rejected filings receive rejection follow-up, not an overdue-submission label. Completed alone means submitted, **not approved**. The visual does not manufacture actual milestone dates from state evidence.

**Approval evidence:** a usable actual approval date; RO state **Health Authority Approved** or **Conditionally Approved**; or a Registration ID with state **Approved** or **Conditionally Approved**, unambiguously linked to this submission and RO, with no country contradiction. Registration existence, Planned, Expired, Canceled, Rejected or Withdrawn does not itself supply approval evidence. Missing registration country is tolerated only when the record's single submission and RO links are unambiguous and filing country is known. Conflicting filing countries, record links, lifecycle states require review instead of inferred progress. A supplied change/event QMS mismatch also requires review in Change ID view; it does not suppress independent native Event/Application progress.

The country fraction means **delivered countries whose linked active work all has approval evidence**, without unresolved assessment or review issues. In Event and Application views, countries come from the linked ROs/applications and their lead-market `Country` values. An RO remains visible without a Submission ID; an unambiguous Health Authority Approved or Conditionally Approved RO can supply approval evidence itself. An unapproved RO without a submission is review work, not an invented late submission. It is not percentage implementation complete. The selected record's source state remains separate: ChangeStatus, EventState or AppStatus. Closed/inactive records with incomplete linked work are flagged. Assessment documentation is source text, not a checklist proving each document was completed. Source response counts are displayed for context, not converted into unnamed countries or used as the progress denominator. Filing-requirement text is displayed for review; this initial version does not automatically interpret free-text “no filing required” responses as country completion.

## Filters and missing data

- Site matches either legal-manufacturer site or registration manufacturing site. Site, product and business unit must match the **same delivered membership row**. They select an event, change or application, after which country progress retains that record's delivered country scope. The Country and Commercial region filters explicitly narrow that scope. This prevents a product filter from silently hiding another expected country.
- Blank/unknown dispatch flags require review. Explicit `true`/`false` Boolean or text values are supported; other labels are not guessed.
- Inactive, archived, withdrawn, canceled/cancelled or deferred filing work is excluded from action queues. Use **Include inactive / withdrawn work and closed records in queues** to inspect excluded country records and to include closed changes' otherwise-active work in queues. Inactive filings themselves never become overdue work merely by selecting this option.
- Missing-parent review follows View by: missing EventName, ChangeID or AppID. It shows delivered row count **and distinct application count**, plus Event/Application/RO/Submission/Registration IDs. Rows without Change IDs are ordinary Event/Application records when those IDs exist. Rows without events remain available in Application view. Review covers all delivered rows before dashboard filters; it can include duplicate membership rows.
- Copy change IDs or linked IDs; export the filtered country/action details as CSV. If browser clipboard or Power BI export permission is unavailable, selectable text is provided. Source links open only on explicit clicks and must be HTTP/HTTPS without embedded credentials.
- Dashboard selections are internal to this visual; they do not cross-filter other report visuals. External Power BI report filters are respected because they change the delivered data.

## Data delivery and reconciliation

The visual requests 30,000-row windows and asks Power BI for accumulated additional data. Counts remain clearly marked as partial while loading or if the host refuses additional rows. Local filters apply **after** Power BI has fetched data; narrow report filters to reduce source queries. The dashboard cannot see rows omitted by report filters, relationships, source permissions or platform limits.

To reconcile, compare **distinct IDs for the selected view** in the same source population, then expected countries and distinct Submission IDs for several selected changes. Match site/product/business-unit/country selections, state exclusions and source refresh date. Export details to inspect any discrepancy. Registrations and catalog numbers can repeat a submission in the dataset without increasing its count. This build has automated browser and package checks; it has not been verified against your authenticated Velocity or Power BI Service tenant.

## Build and verify

Use Node 22:

```sh
node build.cjs
cd powerbi
npm install
npx playwright install chromium
cd ..
node logic-test.mjs
node date-input-test.mjs
node relationships-test.mjs
node graph-browser-test.cjs
npm --prefix powerbi run typecheck
node host-browser-test.cjs
node prepare-preview.cjs
cd powerbi
npm run package -- --no-stats
cd ..
node verify-package.cjs
```

The CI workflow pins Ubuntu 24.04 and dependency versions, tests the actual Visual class and packaged JavaScript, publishes a separate versioned GitHub preview release, and verifies downloaded release assets against the staged files. Tests cover duplicate data, expected-response matching, conflicting countries/links/states, missing/future dates, state evidence, 10,000 submissions plus 64,000 delivered rows with only eight Change IDs, pagination, resize, partial delivery, Dark/Light/high contrast, safe links and clipboard/export fallback. The runtime has no external service dependency; `ExportContent` is optional.
