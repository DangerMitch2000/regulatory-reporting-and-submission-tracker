# Change Dashboard 1.5.0 — preview

- Colour diagram items by their **own source state**, using the Regulatory Tracker palette: soft fills, coloured borders/dots and readable labels.
- Keep the selection outline and path highlighting separate from state colour. List view uses the same state colours.
- Add state hover text, explicit selected-state labels and a compact **State colours** legend. Missing/unknown values remain neutral; conflicting states are clearly identified.
- Preserve Dark, Light and host high-contrast modes. All relationship links, counts, filters and completion rules remain unchanged.

Import **change-dashboard-1.5.0.0.pbiviz** and replace Change Dashboard. All 70 existing field mappings and the visual identity are preserved; **no new fields are required**.

Tests cover every record type, parent/child state isolation, missing/unknown/conflicting states, case/whitespace normalization, safe rendering, legend persistence, theme changes, keyboard/touch interaction and the packaged browser runtime. This is an uncertified preview; demo data is fictional.
