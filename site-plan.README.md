# Site Regulatory Plan — 2026

Separate Power BI visual for compact site-update slides: **H1 and H2 side by side**, three milestone rows, coloured latest-estimate bars and outlined original plans. Selected site name is always visible. No changes to Tracker, Roadmap, IVDR or Key Submissions.

## Install and map

Import `site-regulatory-plan-2026-1.1.0.0.pbiviz` as a custom visual. Add to a report page and map the following raw columns (not date hierarchies):

| Field well | Source |
|---|---|
| SubID | Unique submission ID |
| Site | Your site/legal-manufacturer field |
| BusinessUnit (optional) | Business unit |
| DispatchRequired (optional) | Submission **Dispatch required** field containing True / False / blanks |
| OriginalDispatch | Initial/original planned dispatch date |
| LatestDispatch | Current/latest planned dispatch date |
| OriginalSubmission | Initial planned submission date |
| LatestSubmission | Current/latest planned submission date |
| OriginalApproval | Initial planned approval date |
| LatestApproval | Current/latest planned approval date |

Map SubID, Site and all six date fields. A mapped column may contain blanks; an unmapped column prompts for setup rather than silently displaying zeros. Source columns do not need renaming. Dates accept raw Date objects or ISO calendar strings; ambiguous display-formatted date strings are rejected. Exact physical source names are not assumed.

## Counts

- Fixed to **2026**, H1 January–June, H2 July–December. Each milestone uses its **own** planned date. No actual completion dates or submission status filters are used.
- **Dispatch required** starts at **All**. Its options distinguish True, False, Blank, Conflicting / invalid, and Field not mapped. The selected filter is printed inside the chart and remains visible in Screenshot mode.
- Only an explicit False flag excludes a submission from **dispatch** plan counts and missing dispatch-plan checks. Under All, its submission and approval counts stay unchanged. Raw recorded dates remain intact and conflicting date diagnostics remain available.
- The chart's **not required with 2026 plan dates** count uses distinct False submissions with at least one valid original/latest milestone plan in 2026. Wholly undated and other-year records cannot enter this count. It follows the selected site, business unit and dispatch filter.
- Flags resolve across every delivered membership row for each SubID before filtering by business unit or site. Boolean values and case-insensitive True/False text are recognised; blanks, an unmapped field, unknown labels and True/False conflicts never become False. Optional unmapped fields preserve existing counts. Conflicts/invalid flags are counted in the expandable data checks.
- Original plan counts use original dates. Latest estimates use latest dates, falling back to original **only when latest is blank**. Fallback use is reported in expandable all-year data checks. Both blank means missing, not zero-date placement.
- Each SubID counts once per milestone, half-year and plan. Product or country join duplicates do not inflate totals. One submission can have dispatch in H1 and approval in H2. An original date and revised date can fall in different halves or years.
- Conflicting/invalid dates are flagged and omitted for the affected series. An invalid latest date does not fall back. A valid latest can count when its original is invalid.
- Site choices are derived from delivered data, allowing your six main sites to be selected without inventing a fixed list. Optional Business unit filters both chart and site choices. All units is the default. Internal selections do not filter other Power BI visuals.
- For IDs associated with several sites, all associations are retained and counted once in **Multiple sites (unallocated)**, never duplicated across named sites. Missing sites are **Unassigned**. Missing IDs are reported separately. Confirm relationships if you expect exactly one site per submission.
- H1 and H2 share one scale fitted to the selected site, including original and latest plans. Scales differ between sites; compare count labels, not bar lengths.
- Counts reflect delivered records. Partial delivery warnings remain visible, including in screenshot mode.

## Screenshot workflow

1. Select the site, optional Business unit and Dispatch required filter in normal mode.
2. Open Power BI focus/full-screen mode, then choose **Screenshot mode**.
3. The chart uses a fixed wide aspect ratio; all text and bars scale together. Empty margins may appear to preserve its shape. Snip the white chart area closely.
4. Resize the image proportionally in PowerPoint. **Escape** while the visual is focused returns to controls.

The SVG chart is crisp at the rendered size, but a Snipping Tool capture is still a raster screenshot. Enlarging before capture helps resolution; it does not eliminate the need to check final text size. At approximately 550×204 pixels the principal 26–34-unit labels appear around 14–19 pixels. At smaller sizes readability will decrease. No claim of readability at arbitrary sizes.

Hover/focus a bar for both exact counts. Outlines show originals; bold labels show latest estimates. The chart footer describes only January–December 2026. All-year diagnostics are in expandable data checks, labelled by scope; undated records cannot be assigned to a year. Partial-delivery warnings remain visible in screenshot mode. The public demo includes small/full-size preview buttons; these are demonstration controls outside the Power BI visual.

## Build and verification

Include the shared `dispatch-required.js`, then run `node site-plan.build.cjs` and `node site-plan-demo.cjs`. Install pinned tools in `site-plan`, run type checking, and package using `pbiviz package`. The release workflow runs calculation, compiled host and actual-browser tests before publishing. It verifies dispatch-only exclusion, optional mapping and conflict handling, two half-year panels, selections retained on resize, screenshot filter labels and Escape, and proportional SVG scaling at slide and full-screen sizes. Public data is fictional.

Uncertified preview: import into real Power BI, data relationships and tenant compatibility still require testing. No network permission is requested by the visual.
