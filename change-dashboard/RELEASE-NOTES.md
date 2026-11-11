# Change Dashboard 1.4.0 — preview

- Turn Related items into an interactive diagram connecting Change IDs, Events, Applications, ROs, Submissions and Registrations using the delivered row associations.
- Select a node to highlight its upstream/downstream path, view its full ID/country/state and copy the ID. Unrelated branches dim; missing links remain unconnected.
- Add ID search with connected context, Diagram/List switching and bounded column paging for larger groups. Counts, filters and complete copied/exported IDs are unchanged.
- Keep the diagram compact, lazy-loaded, keyboard accessible and aligned during scrolling/resizing, including touch-sized nodes. Dark, Light and high-contrast styles are retained.

Import **change-dashboard-1.4.0.0.pbiviz** and replace Change Dashboard. All 70 existing field mappings and the visual identity are preserved; **no new fields are required**.

Tests cover correct per-row links, duplicates, missing parents, path tracing without sibling branches, copy/search/paging, narrow and touch layouts, safe ID rendering, packaged browser behavior and 20,000 graph source rows. This is an uncertified preview; demo data is fictional.
