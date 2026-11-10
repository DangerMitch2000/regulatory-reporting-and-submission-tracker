# Change Dashboard 1.1.0 — preview

**Event is now the default view.** Switch between Event, Change ID and Application without requiring a SharePoint Change ID on every record.

- Event view groups native Velocity events and the affected countries of their linked ROs/applications.
- Application view includes applications without either an event or a Change ID.
- The existing Country mapping supplies application lead-market countries. No new fields are required.
- ROs remain visible before a submission exists; unambiguous RO approval can contribute country approval evidence.
- Counts, source-state filters, copies, CSV headers and missing-parent review follow the selected view.
- Missing-parent review separates raw delivered rows from distinct applications.
- SharePoint assessment responses remain tied to real Change IDs and matching country scope; missing assessment links are stated explicitly.
- Tested with 64,000 synthetic rows containing only eight Change IDs, plus existing date/state and packaged-browser checks.

Download **change-dashboard-1.1.0.0.pbiviz** and confirm replacement of your existing Change Dashboard visual. The visual identity and all 69 roles are unchanged, so existing mappings are retained. Map **EventName**, **ROID**, **AppID** and **Country** for the Event country breakdown. Keep SubID and status/date fields for filing progress. The Tracker and Map remain separate visuals.

This is an uncertified preview. Demo records are fictional; verify representative events and applications against Velocity using the same scope and refresh date. See **CHANGE-DASHBOARD-INSTALL.md** for all rules and limitations.
