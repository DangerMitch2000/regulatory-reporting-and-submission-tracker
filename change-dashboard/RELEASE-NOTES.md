# Change Dashboard 1.8.0 — diagrams, anchored filters and consistent resizing

- Selecting an event, change or application by its main-list name or row opens Related items in Diagram view. Enter on a focused record name works too.
- Diagram columns fill the available visual width, with aligned connecting lines after resizing. Narrow visuals scroll horizontally within the diagram and retain readable node sizes.
- Country evidence remains below the diagram. Selecting another parent resets the previous diagram search and selection.
- Manual collapse and List mode remain available and survive refresh/resize. Selecting a main-list record opens Diagram again, without jumping the page or worklist scroll position.
- Top filters use searchable menus anchored inside the visual. Scaled layouts, narrow frames, scrolling, refresh and resize no longer leave an open menu detached from its control.
- Responsive breakpoints and bounded base text sizes follow the visual width instead of the browser window. This improves layout consistency; Power BI's whole-page scaling remains controlled by its page-view settings.
- The default business unit remains ID. Counts, dates, country scope, source links, state colours, the visual identity and all 70 field roles are unchanged.

Import **change-dashboard-1.8.0.0.pbiviz**, replacing the existing Change Dashboard. No field remapping is required.

Validation covers mouse, touch and keyboard controls, selection across all three views, repeated selection, manual collapse, refresh/resize, narrow and wide layouts, scaled menu positioning, connector alignment and packaged-runtime behaviour. Tests use synthetic records and a browser host harness; they do not replace checking your published report's page-view settings in Power BI Service.

## Change Dashboard 1.7.3 — default business unit ID

- Starts with **Business unit = ID**.
- Keeps your chosen business unit through refresh, resize and grouping changes, including empty and partial deliveries.
- **All** and other business units remain selectable. **Clear filters** clears to All; **Reset table** only resets table sorting and column filters.
- Uses All when a nonempty delivery has no BusinessUnit mapping, keeping those records accessible.

Import **change-dashboard-1.7.3.0.pbiviz**, replacing Change Dashboard. The visual identity and all **70 field roles** are preserved; no remapping is required. Counting, dates, hierarchy and source-link rules are unchanged.

Validation covers default ID, mixed business units, no matching ID rows, empty/partial delivery, user selection retention, unmapped fields and reset behaviour in the source and actual packaged visual. The broader logic, relationship and host/browser checks also run before publication.
