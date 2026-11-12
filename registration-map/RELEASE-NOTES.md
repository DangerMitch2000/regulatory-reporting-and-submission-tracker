# Registration Coverage Map 1.0.1

New visual instances now start with business unit **ID**, alongside the existing **Approved** and **Conditionally Approved** registration states.

- Choose another business unit or **All business units** at any time. **Reset filters** clears the unit restriction and restores the approved-state defaults.
- Unit choices survive refresh, resize, empty deliveries and mapped batches without matching values. The selected unit remains visible, including when ID has no matches.
- A nonempty table without the Business Unit field mapped falls back to All, keeping delivered registrations accessible.
- The visual identity, 18 field roles, distinct registration counts, date handling and offline map remain unchanged.

Import **registration-coverage-map-1.0.1.0.pbiviz** to update the existing visual. The demo uses fictional mixed-business-unit records. This remains an uncertified preview.

## Registration Coverage Map 1.0.0

New standalone Power BI visual showing registration coverage on a world map. It has a separate visual identity and does not replace the Regulatory Tracker.

- Approved and Conditionally Approved registrations selected by default.
- Product, legal/registration manufacturing site, business-unit, registration-state, country and expiry filters.
- Clickable countries, distinct registration counts, searchable registration lists, Details, linked record IDs, catalog associations, copyable IDs and CSV export.
- Review list for missing IDs, unplaced countries, contradictory states/dates and other source issues. Duplicate membership rows do not inflate registration counts.
- Bundled offline geography, tiny-country targets, zoom/pan, keyboard navigation, responsive layout, Dark/Light and high-contrast support.
- Power BI windowed data loading with partial-count notices and unchanged filters on resize/refresh.

Import **registration-coverage-map-1.0.0.0.pbiviz** in Power BI Desktop. Start with Registration ID, Registration country and Registration state; add product/site/business-unit fields for filtering. Full mapping and interpretation rules are in the README.

This is an uncertified preview. Public demonstration records are fictional. Geography is bundled from Natural Earth; no map API key or runtime map-service access is required.
