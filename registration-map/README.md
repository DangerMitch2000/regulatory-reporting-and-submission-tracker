# Registration Coverage Map 1.0.1

A separate Power BI visual for exploring registration coverage by country. Filter products, legal or registration manufacturing sites, business units, registration states, countries and expiry dates. Select a country to inspect registrations, copy their IDs or export the filtered list.

[Download the Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/registration-map-v1.0.1/registration-coverage-map-1.0.1.0.pbiviz) · [Interactive demo](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/registration-map/preview.html) · [Release notes](RELEASE-NOTES.md)

The demo uses fictional data. This is an uncertified preview, with a separate visual identity from the Regulatory Tracker and other repository visuals. Its world geometry is bundled; the map makes no runtime requests to a map provider and requires no API key.

## What the map counts

- New visual instances start with business unit **ID** and the registration states **Approved** and **Conditionally Approved**. A country’s colour represents distinct matching registration IDs, with numeric ranges in the legend. Change the unit or state filters to inspect other records.
- **Coverage follows the recorded registration state.** An Approved record with a past end date or future start date stays visible and is flagged for review. It is not silently reclassified. No matching records means none in the delivered and filtered data; it does not establish absence of legal registration or market authorization.
- Duplicate product, site and catalog rows do not multiply registration totals. Combined product/site/business-unit filters must match a real source membership row; the visual does not invent combinations across joined rows.
- Registration country takes priority. Secondary Country is used only when registration country is blank. Conflicting or unrecognized primary countries are withheld from map placement and remain in Review; they are not guessed from a secondary country.
- Registrations without a usable country remain included in the matching registration total, with an unplaced-count notice. Rows without Registration ID are retained in Review, identified by linked IDs where available, and excluded from registration counts. Review counts are entries, including individual source rows missing an ID; they are not additional registrations.
- Review spans all states, while respecting membership, country, expiry and search filters. State or country conflicts are assessed from all delivered rows before interactive filtering, so a filter cannot hide conflicting evidence.

## Import and map fields

1. Download **registration-coverage-map-1.0.1.0.pbiviz**.
2. In Power BI Desktop, use **Visualizations (…) → Import a visual from a file** and select the package. Add **Registration Coverage Map** to a report page.
3. Map **Registration ID**, **Registration country** and **Registration state**. Map Product, Site and Business Unit fields to enable the requested filters. Use the source columns; their source names do not need changing.
4. Add other fields from the table below as available. Date fields must use raw Date/DateTime columns, not automatic Date hierarchies. Use **Don’t summarize** for identifiers.
5. Save and publish the report. Your tenant must allow this custom visual and any optional export capability you want to use.

| Visual field | Source information / use |
| --- | --- |
| RegistrationID | Stable registration record ID or name; required for distinct counts |
| RegistrationCountry | Country on the registration; common names or ISO alpha-2/alpha-3/numeric codes |
| RegistrationState | Recorded registration lifecycle state |
| Product | Product name, used for product filtering and Details |
| ProductID | Optional stable product ID; used if product name is blank |
| Manufacturer | Legal manufacturer site |
| RegistrationManufacturingSite | Manufacturing site on the registration; both site sources are filterable and distinguished in Details |
| BusinessUnit | Business unit |
| RegistrationStart | Registration start date |
| RegistrationEnd | Registration end date |
| RegistrationNumber | Authorization/registration number, distinct from the record ID |
| Country | Optional secondary country when RegistrationCountry is blank |
| AppID / ROID / SubID | Related application, regulatory objective and submission IDs for Details and search |
| CatalogNumber | Catalog number, preserving its source product association |
| RegistrationHolder | Registration holder |
| RegistrationURL | Optional complete HTTP/HTTPS source URL; opened only on an explicit click |

Use relationships that deliver real registration/product/site memberships. Do not turn on **Show items with no data** to manufacture combinations. This visual receives the rows Power BI supplies; it cannot repair an ambiguous model relationship or recover rows excluded by report filters.

## Interactions

- Select a country on the map or in the country table to list its registrations. Click a registration ID for Details, linked IDs, source memberships and review notes.
- Search IDs, registration numbers, products, catalog numbers or countries. Filters support multiple selections and searchable choice lists. **All business units** removes the ID restriction; **Reset filters** clears the unit restriction and restores the default approved states.
- Summary counts open their relevant list. **Expiring · 90 days** applies that expiry filter. **Needs review** opens the review list across all states.
- Use **Copy IDs** or **CSV** for the whole filtered list, not only the visible page. If the host blocks clipboard/export, selectable text is provided. CSV protects formula-like values and includes product/catalog associations.
- Use +/−, **World**, dragging, or Ctrl+wheel to move around the map. Tiny-country targets and the country table make small jurisdictions accessible. Country shapes also support keyboard focus and Enter/Space.
- Dark and Light themes, high-contrast support and responsive layouts are included. At narrow sizes, the registration list moves below the map. Controls retain readable text rather than shrinking indefinitely.

Local map selections affect this visual only; they do not cross-filter other report visuals. Power BI’s own report filters still feed the visual. Local filters and zoom survive resize/data refresh but are not saved in bookmarks or across reopening. An ID or other unit selection remains visible through empty and partial deliveries, including mapped data with no matching unit. A nonempty delivery without a Business Unit field mapping falls back to All so its records remain accessible.

## Dates and loading

Expiry uses calendar days: **Next 90 days** includes today through today + 90 days; **Past end date** excludes today. Invalid/conflicting dates and end years beyond 2100 are excluded from expiry calculations. Far-future source dates are retained in Details as placeholders for review, without asserting that a registration never expires. Missing/sentinel end dates appear under **Missing / beyond 2100**; invalid or conflicting dates are highlighted in Review.

Displayed dates use **DD MMM YYYY**. ISO source dates and Date objects are supported; ambiguous localized text and numeric Excel serials should be converted in the model. The source’s written calendar day is used for ISO timestamps; raw source evidence remains available.

Windowed Power BI data delivery is supported. Loading or host limits show an explicit partial-data notice; totals reflect loaded rows only. Resize does not refetch data. Filters and Details are computed locally after data has been delivered. Model query time and network refresh are separate from visual rendering time.

## Development

From the repository root, first run `cd registration-map`. Run `node build.cjs`, install dependencies in `powerbi/`, and run `node prepare-preview.cjs`. Verification commands: `node --test logic-test.mjs`, `node geography-test.cjs`, `node host-test.cjs`, `node browser-test.cjs` and `node host-browser-test.cjs`. The release workflow also typechecks, builds and inspects the packaged visual; publishing requires a manual run with **publish** enabled. Synthetic tests do not substitute for testing the report’s actual source model and tenant configuration.

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for pinned Natural Earth geometry and public-domain provenance. Boundaries follow that dataset’s published cartographic view; country colouring reflects supplied records.
