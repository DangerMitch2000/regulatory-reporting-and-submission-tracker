# Change Dashboard 1.0.0

[Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/change-dashboard-v1.0.0/change-dashboard-1.0.0.0.pbiviz) · [Interactive demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/change-dashboard/preview.html) · [Release](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/tag/change-dashboard-v1.0.0)

A separate daily worklist using the Regulatory Tracker's existing **69 field roles**. Filter by manufacturing site, product, business unit, country and change state. Select a summary count, a Change ID, then a country to inspect the evidence and linked source records. The existing Tracker and Registration Coverage Map remain separate visuals.

**Preview release:** package version **1.0.0.0**, API 5.11.0. This visual is not Microsoft-certified. The demo and screenshots use fictional records, fixed as of 09 Nov 2026. Production uses the previous calendar day in Europe/Dublin. This is an as-of reference, **not a measurement of source refresh time**.

## Install and map existing fields

1. Download the `.pbiviz` above. In Power BI Desktop, use **Visualizations (…) → Import a visual from a file**.
2. Add the new **Change Dashboard** visual. Its unique identity does not replace the Tracker. Map the same source columns used in the Tracker into the matching named wells; Power BI does not automatically copy an existing visual's mappings.
3. Begin with **ChangeID** and the assessment/country and filing identifiers below. Add status and date evidence before interpreting the action counts. Keep identifiers as text; select **Don't summarize** and raw date columns, not date hierarchies.
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

Use the model's existing **real relationships** to deliver the associated records. A flat table of unrelated applications, assessments and submissions cannot be repaired inside a visual. `Country` is the filing's country; registration country provides supporting evidence, not a substitute for an ambiguous filing country. Map expected countries even if no submission exists yet, so those countries remain visible. No filing is invented when a country has no linked submission.

## What the counts mean

Each card counts **distinct Change IDs**, not submissions, countries, products or catalog rows. A change can appear in more than one card because its countries can be at different stages. Selecting a card shows all changes in that queue, including those not yet overdue. **Needs attention** includes overdue actions, rejection follow-up and missing/conflicting evidence; **All changes** also includes ordinary progress.

| Card | Rule |
| --- | --- |
| Awaiting assessment | An expected response is delivered but a matching response has not been delivered. Response IDs match within the change; if neither ID role has values, the existing tracker country fallback applies. Conflicting or unmatched IDs/countries require review. |
| Overdue internal dispatch | Dispatch is explicitly required, no usable actual dispatch or later submission/approval evidence exists, and the planned dispatch date is before the as-of day. |
| Overdue authority submission | Actual dispatch exists, or dispatch is explicitly not required; no submission/approval evidence exists, and the planned submission date is before the as-of day. |
| Awaiting approval | Submission evidence exists, but approval evidence does not. It need not be overdue; a past approval target is highlighted in Details. |

Latest planned dates take precedence. Original dates are used only when latest dates are absent. Invalid/conflicting latest dates do not silently fall back to old targets. **Missing dates are review issues, never inferred overdue dates.** Actual dates after the as-of day are flagged for review. Dates display as **DD MMM YYYY**; explicit invalid raw values remain in source evidence. Workflow dates outside 1900–2100 are unusable for timing. Registration validity dates do not determine queues.

**Submission evidence:** a usable actual submission date, Submission state **Completed**, **HA Received**, **Sent To Health Authority**, or HA **Rejected**; approval evidence also implies submission. **Distributed** is internal only. Rejected filings receive rejection follow-up, not an overdue-submission label. Completed alone means submitted, **not approved**. The visual does not manufacture actual milestone dates from state evidence.

**Approval evidence:** a usable actual approval date; RO state **Health Authority Approved** or **Conditionally Approved**; or a Registration ID with state **Approved** or **Conditionally Approved**, unambiguously linked to this submission and RO, with no country contradiction. Registration existence, Planned, Expired, Canceled, Rejected or Withdrawn does not itself supply approval evidence. Missing registration country is tolerated only when the record's single submission and RO links are unambiguous and filing country is known. Conflicting filing countries, record links, lifecycle states or supplied change/event QMS references require review instead of inferred progress.

The country fraction means **delivered countries whose linked active submissions all have approval evidence**, without unresolved assessment or review issues. It is not percentage implementation complete. Source change state remains separate; a closed change with incomplete linked work is flagged. Assessment documentation is source text, not a checklist proving each document was completed. Source response counts are displayed for context, not converted into unnamed countries or used as the progress denominator. Filing-requirement text is displayed for review; this initial version does not automatically interpret free-text “no filing required” responses as country completion.

## Filters and missing data

- Site matches either legal-manufacturer site or registration manufacturing site. Site, product and business unit must match the **same delivered membership row**. They select a change, after which country progress retains that change's delivered country scope. The Country filter explicitly narrows that scope. This prevents a product filter from silently hiding another expected country.
- Blank/unknown dispatch flags require review. Explicit `true`/`false` Boolean or text values are supported; other labels are not guessed.
- Inactive, archived, withdrawn, canceled/cancelled or deferred filing work is excluded from action queues. Use **Include inactive / withdrawn work and closed changes in queues** to inspect excluded country records and to include closed changes' otherwise-active work in queues. Inactive filings themselves never become overdue work merely by selecting this option.
- Missing Change ID rows stay in a separate, paginated review with Application, RO, Submission and Registration IDs. They are not counted as changes. That review covers all delivered rows, before dashboard filters, and its row count may include product/catalog duplicates.
- Copy change IDs or linked IDs; export the filtered country/action details as CSV. If browser clipboard or Power BI export permission is unavailable, selectable text is provided. Source links open only on explicit clicks and must be HTTP/HTTPS without embedded credentials.
- Dashboard selections are internal to this visual; they do not cross-filter other report visuals. External Power BI report filters are respected because they change the delivered data.

## Data delivery and reconciliation

The visual requests 30,000-row windows and asks Power BI for accumulated additional data. Counts remain clearly marked as partial while loading or if the host refuses additional rows. Local filters apply **after** Power BI has fetched data; narrow report filters to reduce source queries. The dashboard cannot see rows omitted by report filters, relationships, source permissions or platform limits.

To reconcile, compare **distinct Change IDs** in the same source population, then expected countries and distinct Submission IDs for several selected changes. Match site/product/business-unit/country selections, state exclusions and source refresh date. Export details to inspect any discrepancy. Registrations and catalog numbers can repeat a submission in the dataset without increasing its count. This build has automated browser and package checks; it has not been verified against your authenticated Velocity or Power BI Service tenant.

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

The CI workflow pins Ubuntu 24.04 and dependency versions, tests the actual Visual class and packaged JavaScript, publishes a separate versioned GitHub preview release, and verifies downloaded release assets against the staged files. Tests cover duplicate data, expected-response matching, conflicting countries/links/states, missing/future dates, state evidence, 10,000 submissions, pagination, resize, partial delivery, Dark/Light/high contrast, safe links and clipboard/export fallback. The runtime has no external service dependency; `ExportContent` is optional.
