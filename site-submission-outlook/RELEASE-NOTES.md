# Site Submission Outlook 1.6.3

Updates the visual's typography to prefer Wallace Sans.

- The title prefers **Wallace Sans Light** at weight **300**.
- Chart labels, filters, buttons, Details and the selectable copy-text panel use **Wallace Sans**.
- Segoe UI, Arial and the browser's sans-serif font remain fallbacks when Wallace Sans is unavailable.
- The fictional preview uses the same font choices.

Fonts are resolved from the viewer's device. No font files are bundled and no external font service is contacted, so each viewer's font availability determines whether Wallace Sans or a fallback is shown.

Import `site-submission-outlook-1.6.3.0.pbiviz` to replace the existing Site Submission Outlook. The visual identity and field mappings are unchanged; the Details scroll-position fix from 1.6.2 is retained.
