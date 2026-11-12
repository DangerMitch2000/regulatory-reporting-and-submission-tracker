# Change Dashboard 1.7.3 — default business unit ID

- Starts with **Business unit = ID**.
- Keeps your chosen business unit through refresh, resize and grouping changes, including empty and partial deliveries.
- **All** and other business units remain selectable. **Clear filters** clears to All; **Reset table** only resets table sorting and column filters.
- Uses All when a nonempty delivery has no BusinessUnit mapping, keeping those records accessible.

Import **change-dashboard-1.7.3.0.pbiviz**, replacing Change Dashboard. The visual identity and all **70 field roles** are preserved; no remapping is required. Counting, dates, hierarchy and source-link rules are unchanged.

Validation covers default ID, mixed business units, no matching ID rows, empty/partial delivery, user selection retention, unmapped fields and reset behaviour in the source and actual packaged visual. The broader logic, relationship and host/browser checks also run before publication.
