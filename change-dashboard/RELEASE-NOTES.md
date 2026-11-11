# Change Dashboard 1.6.0 — preview

- Connect the country list and Related items diagram in both directions. Country selection highlights its exact delivered records and links; selecting an item highlights its countries and shows the matching evidence.
- Handle records shared by several countries without leaving unrelated country evidence on screen. Missing countries remain explicit, and shared ancestors do not highlight sibling-country branches.
- Reveal country branches on later diagram pages, preserve country-table filters with an explicit **Show related countries** action, and keep Diagram/List, keyboard and state colours consistent.
- Keep worklist counts, dashboard filters, copied IDs and exports independent of local highlighting. Refresh and parent changes clear stale linked selections.
- Normalize equivalent country spellings by case and whitespace so duplicate source memberships remain one country and retain their linked rows.

Import **change-dashboard-1.6.0.0.pbiviz** and replace Change Dashboard. All **70 field mappings** and the visual identity are retained; **no new fields are required**.

Validation includes graph and country logic, 20,000-row graph construction, 10,000-submission worklists, browser interaction and the browser runtime extracted from the packaged visual. This is an uncertified preview; demo data is fictional.
