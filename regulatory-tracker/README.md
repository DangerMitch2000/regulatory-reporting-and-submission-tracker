# Regulatory Tracker 1.18.1

[Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/v1.18.1/regulatory-tracker-1.18.1.0.pbiviz) · [Interactive demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/) · [All visuals](../README.md)

Explore linked **Change ID → Event → Application → RO → Submission → Registration** records, their workflow dates and source evidence. Public demo records are fictional.

## Install and map

Import the package through **Visualizations (…) → Import a visual from a file** in Power BI Desktop. For an upgrade, replace the existing package and keep the existing visual instance; version 1.18.1 retains the visual ID and field roles.

Map your source identifiers to `ChangeID`, `EventName`, `AppID`, `ROID`, `SubID` and `RegistrationID` where available. Map states separately for each record type. Dispatch, submission and approval each support Original, Latest and Actual dates. Use Date/DateTime columns rather than date hierarchies, with no summarization.

Optional fields cover sites, products, countries, business units, dispatch requirements, registration validity and renewal, catalog numbers, assessment responses and record URLs. See the [complete mapping reference](../docs/history/pre-cleanup-readme.md#five-optional-field-mappings) and the subsequent versioned field tables. The exact supported role list is maintained in [the project generator](powerbi-visual.build.cjs).

## Current behaviour

- The timeline opens around **Today**. **Fit all** uses workflow dates and excludes long registration-validity periods.
- Names open Details; parent bars and plus/minus controls expand children. Linked-record counts reveal the corresponding records.
- Columns can be resized. Products and sites stay compact, while hover and Details show full values.
- Full dates use `DD MMM YYYY`; the timeline axis keeps shorter labels.
- Estimated LM preparation ends at a valid actual dispatch date, falling back to valid planned dates only when actual dispatch is absent. It remains an estimate, not a recorded preparation start.
- Dark/Light themes, copyable IDs and data-quality review remain available. Missing or conflicting evidence is retained for review.

For detailed rules and previous changes, see the [changelog](CHANGELOG.md), [release notes](RELEASE-NOTES.md) and [archived guide](../docs/history/pre-cleanup-readme.md). Historical Deneb material is retained separately in [POWER-BI-DETAILS.md](POWER-BI-DETAILS.md).

## Build and verify

From the repository root, using Node 22:

```sh
cd regulatory-tracker
node powerbi-visual.build.cjs
node powerbi-visual.verify.cjs
cd powerbi-visual
npm install
npx tsc --noEmit
npm test
npm run package -- --no-stats
```

The generated project is `regulatory-tracker/powerbi-visual/`. The [workflow](../.github/workflows/powerbi-visual.yml) defines the complete unit, host and browser checks. See [development guidance](../docs/development.md) before publishing a release.
