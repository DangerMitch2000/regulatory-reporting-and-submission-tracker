# Change Dashboard 1.1.0

[Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/change-dashboard-v1.1.0/change-dashboard-1.1.0.0.pbiviz) · [Interactive demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/change-dashboard/preview.html) · [Release](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/change-dashboard-v1.1.0)

A separate daily worklist with **Event (default), Change ID and Application views**, using the Regulatory Tracker's existing **69 field roles**. Filter by manufacturing site, product, business unit, country and change state. Select a summary count, an event/change/application, then a country to inspect the evidence and linked source records. The existing Tracker and Registration Coverage Map remain separate visuals.

**Preview release:** package version **1.1.0.0**, API 5.11.0. This visual is not Microsoft-certified. The demo and screenshots use fictional records, fixed as of 09 Nov 2026. Production uses the previous calendar day in Europe/Dublin. This is an as-of reference, **not a measurement of source refresh time**.

## Install and map existing fields

1. Download the `.pbiviz` above. In Power BI Desktop, use **Visualizations (…) → Import a visual from a file**.
2. For an existing Change Dashboard, confirm replacement on import: its visual identity and all 69 field roles are unchanged. For a new instance, map the same source columns used in the Tracker into the matching named wells; Power BI does not automatically copy another visual's mappings.
3. Map **EventName** for Event view, **AppID** for Application view and **ChangeID** for Change ID view. Each view works independently of the other parent IDs. If EventName is unmapped on first load, the visual starts with the available Application or Change ID mapping. Include the country/RO and filing identifiers below. Add status and date evidence before interpreting the action counts. Keep identifiers as text; select **Don't summarize** and raw date columns, not date hierarchies.
4. Validate a few known changes against Velocity, including a pending country, an overdue dispatch, a submitted filing and an approved registration. Save and publish your report as usual.

| Purpose | Existing field roles |
| --- | --- |
| Change identity and context | `ChangeID`, `ChangeStatus`, `ChangeProjectID`, `ChangeQMS`, `ChangeCreated`, `ChangePlannedImplementation` |
| Expected assessments | `ExpectedResponseID`, `ExpectedResponseCountry`, `ChangeResponseDue`, `ChangeResponseCount` |
| Returned assessments | `AssessmentResponseID`, `AssessmentCountry`, `AssessmentTimeline`, `AssessmentMOHFiling`, `AssessmentDocumentation` |
| Existing record links | `EventName`, `EventState`, `EventQMS`, `AppID`, `ROID`, `SubID`, `RegistrationID` |
| Source states | `AppStatus`, `ROStatus`, `SubStatus`, `RegistrationState` |
| Scope filters | `Manufacturer`, `RegistrationManufacturingSite`, `Product`, `BusinessUnit`, `Country` |
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

The assessment queue uses **linked SharePoint response records**. In Event/Application views, only responses matching a country already present in the linked RO/application scope are included. Missing assessment links say **Assessment not linked**; zero in this queue does not establish that an unlinked event needs no assessment. Native EventState is shown but is not interpreted as a country-by-country response checklist.

## What the counts mean

Each card counts **distinct events, Change IDs or applications**, according to View by. It never counts raw product/catalog rows. One record can appear in several cards because its countries can be at different stages. Selecting a card shows every matching record, including approval/assessment work not yet overdue. **Needs attention** includes overdue actions, rejection follow-up and missing/conflicting evidence; **All changes** also includes ordinary progress.

| Card | Rule |
| --- | --- |
| Awaiting assessment | An expected response is delivered but a matching response has not been delivered. Response IDs match within the change; if neither ID role has values, the existing tracker country fallback applies. Conflicting or unmatched IDs/countries require review. |
| Overdue internal dispatch | Dispatch is explicitly required, no usable actual dispatch or later submission/approval evidence exists, and the planned dispatch date is before the as-of day. |
| Overdue authority submission | Actual dispatch exists, or dispatch is explicitly not required; no submission/approval evidence exists, and the planned submission date is before the as-of day. |
| Awaiting approval | Submission evidence exists, but approval evidence does not. It need not be overdue; a past approval target is highlighted in Details. |

Latest planned dates take precedence. Original dates are used only when latest dates are absent. Invalid/conflicting latest dates do not silently fall back to old targets. **Missing dates are review issues, never inferred overdue dates.** Actual dates after the as-of day are flagged for review. Dates display as **DD MMM YYYY**; explicit invalid raw values remain in source evidence. Workflow dates outside 1900–2100 are unusable for timing. Registration validity dates do not determine queues.

**Submission evidence:** a usable actual submission date, Submission state **Completed**, **HA Received**, **Sent To Health Authority**, or HA **Rejected**; approval evidence also implies submission. **Distributed** is internal only. Rejected filings receive rejection follow-up, not an overdue-submission label. Completed alone means submitted, **not approved**. The visual does not manufacture actual milestone dates from state evidence.

**Approval evidence:** a usable actual approval date; RO state **Health Authority Approved** or **Conditionally Approved**; or a Registration ID with state **Approved** or **Conditionally Approved**, unambiguously linked to this submission and RO, with no country contradiction. Registration existence, Planned, Expired, Canceled, Rejected or Withdrawn does not itself supply approval evidence. Missing registration country is tolerated only when the record's single submission and RO links are unambiguous and filing country is known. Conflicting filing countries, record links, lifecycle states require review instead of inferred progress. A supplied change/event QMS mismatch also requires review in Change ID view; it does not suppress independent native Event/Application progress.

The country fraction means **delivered countries whose linked active work all has approval evidence**, without unresolved assessment or review issues. In Event and Application views, countries come from the linked ROs/applications and their lead-market `Country` values. An RO remains visible without a Submission ID; an unambiguous Health Authority Approved or Conditionally Approved RO can supply approval evidence itself. An unapproved RO without a submission is review work, not an invented late submission. It is not percentage implementation complete. The selected record's source state remains separate: ChangeStatus, EventState or AppStatus. Closed/inactive records with incomplete linked work are flagged. Assessment documentation is source text, not a checklist proving each document was completed. Source response counts are displayed for context, not converted into unnamed countries or used as the progress denominator. Filing-requirement text is displayed for review; this initial version does not automatically interpret free-text “no filing required” responses as country completion.

## Filters and missing data

- Site matches either legal-manufacturer site or registration manufacturing site. Site, product and business unit must match the **same delivered membership row**. They select an event, change or application, after which country progress retains that record's delivered country scope. The Country filter explicitly narrows that scope. This prevents a product filter from silently hiding another expected country.
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
npm --prefix powerbi run typecheck
node host-browser-test.cjs
node prepare-preview.cjs
cd powerbi
npm run package -- --no-stats
cd ..
node verify-package.cjs
```

The CI workflow pins Ubuntu 24.04 and dependency versions, tests the actual Visual class and packaged JavaScript, publishes a separate versioned GitHub preview release, and verifies downloaded release assets against the staged files. Tests cover duplicate data, expected-response matching, conflicting countries/links/states, missing/future dates, state evidence, 10,000 submissions plus 64,000 delivered rows with only eight Change IDs, pagination, resize, partial delivery, Dark/Light/high contrast, safe links and clipboard/export fallback. The runtime has no external service dependency; `ExportContent` is optional.
