# Regulatory Tracker 1.6

[Live demo](https://dangermitch2000.github.io/regulatory-timeline-demo/) · [Version 1.6 release](https://github.com/DangerMitch2000/regulatory-timeline-demo/releases/tag/v1.6) · [Download the Power BI visual](https://github.com/DangerMitch2000/regulatory-timeline-demo/releases/download/v1.6/regulatory-tracker-1.6.0.0.pbiviz)

The installable visual and browser demo share the updated layout. Import `regulatory-tracker-1.6.0.0.pbiviz` into Power BI; the stable visual GUID preserves upgrade identity. This remains an uncertified preview requiring validation in your Power BI report. All public sample data is fictional; that note appears in the demo footer, not in the Power BI visual. The interface has one main “Regulatory Tracker” title.

State checkboxes show matching records plus ancestor context. Parent summaries and details retain all children within membership/search filters, rather than silently changing their meaning. Ctrl+wheel moves dates; use Fit/Year/Quarter/Month and arrow buttons for scale/navigation. No Pan dates slider is included.

## New in 1.6

- **Business Unit filter:** map the source `business_unit__c` column to the `BusinessUnit` field well. The filter starts at All and supports multiple selections alongside Site, Product, Country and Type. Source columns do not need renaming.
- **Product search:** open the filter and type at least two characters. The list renders at most 50 matching options at a time; refine the search to find more. Selected products remain separately accessible, and Business Unit and Site narrow the available choices. Opening the filter no longer creates a checkbox for every product.
- **Approval estimates:** an amber hollow diamond and shaded historical range appear on eligible submission rows. Select the row to see the estimate, supporting country history and exclusion reasons in the selectable Details panel. Recorded dates and parent summary bars are unchanged.

## Approval estimates and source requirements

Map `Country`, `ActualSubmission`, `ActualApproval`, `OriginalApproval` and `LatestApproval` to their corresponding field wells, in addition to the required identifiers. Use raw Date or DateTime columns, not Date hierarchies. If a required prediction field is unmapped, estimates are suppressed while the ordinary tracker can still display available data. An unmapped approval field is not treated as a genuinely blank source value.

An estimate is shown only when **ActualApproval, OriginalApproval and LatestApproval are all blank**, the actual submission date is valid, and enough country history is available. A populated approval field, even if invalid or conflicting, blocks the estimate. Dates are not written back to the source, and predictions do not replace original plans, latest estimates or actual approvals.

The historical cohort uses distinct submissions for the same country. Both actual submission and actual approval must be valid dates from **1 January 2020 through today**, with approval on or after submission. Repeated product or other membership rows do not increase the sample. Missing, invalid, future, pre-2020, reversed or conflicting actual dates are excluded. Records attributed to multiple countries do not contribute to a country model; the model does not guess which country approved them. Products and submission types are not additional grouping requirements in this version.

At least **10 qualifying distinct submissions** are required. The predicted date is the current record’s actual submission date plus the country’s median submission-to-approval duration. The shaded range uses the historical 25th and 75th percentiles—the **empirical middle 50%**, not a confidence interval or a guarantee of approval. Unusually long but otherwise valid durations remain included and are flagged for review. A historical estimate that has already passed is labelled as such; it is not moved into the future.

Supporting history is calculated before this visual’s local filters, using **only the rows delivered by Power BI**. Report filters, model relationships, security and data-delivery limits can reduce that history. The Details panel shows the qualifying count, excluded count and reasons. Fewer than 10 qualifying records, missing source dates or ambiguous country attribution produce an unavailable estimate instead of an invented date. These checks reject obvious errors but cannot establish that every valid-looking source date is correct. Country-based estimates are descriptive and have not been validated as a forecasting model.

# Historical versions

## Previous Power BI visual — 1.4 preview

[Download the installable .pbiviz](https://github.com/DangerMitch2000/regulatory-timeline-demo/releases/download/powerbi-v1.4.0-preview.1/regulatory-timeline-1.4.0.0.pbiviz) · [Installation guide, source and previews](https://github.com/DangerMitch2000/regulatory-timeline-demo/releases/tag/powerbi-v1.4.0-preview.1)

This custom Power BI visual carries over the demo's dark interface, styled search and filters, comparison controls, and selectable HTML details. Import the `.pbiviz` through Power BI's **Visualizations (…) → Import a visual from a file**, then map source columns to the named field wells. Start with AppID, ROID and SubID; map dates as raw Date columns, not Date hierarchies. You do not need Deneb or field renaming for this version.

Built using Microsoft's official tools. Type checks and browser tests of the actual visual class passed, including data refresh, resizing and multiple instances. This is an uncertified preview; actual Power BI Desktop/Service import and tenant compatibility still need verification. Clipboard depends on the host; details text remains selectable. Local selections do not filter other report visuals or persist across reopening.

The existing browser demo and Deneb 1.3 files remain available below. The custom visual source is generated by `powerbi-visual.build.cjs`; verification is in `powerbi-visual.verify.cjs`, and the full generated project with locked dependencies is included in the release source archive.

## Historical Deneb files — version 1.3

[Open live demo](https://dangermitch2000.github.io/regulatory-timeline-demo/) · [Download release](https://github.com/DangerMitch2000/regulatory-timeline-demo/releases/tag/v1.3)

An interactive dark Vega timeline with entirely fictional data. No private source mappings, real records, photos or organizational branding are included.

## Explore and compare

Expand Application → RO → Submission using parent labels/bars. Selection is separate: select a submission, parent subtitle or membership count, then open Details. Scroll rows with wheel, scrollbar, buttons or arrow/page keys after focusing the chart. Ctrl+wheel pans the calendar in 1.5; presets and earlier/later buttons also work. The anchored viewport retains the clicked parent; bottom expansion reveals its first child.

View → Compare shows equivalent Applications, ROs or Submissions. Pin/unpin with ◇/◆, then select Pinned rows only. Parent context stays visible. Submissions can use elapsed days with resolved actual dispatch as Day 0; missing/conflicting dispatch produces no plot and an explicit label. Actual D→S and S→A durations exclude missing/reversed/conflicting endpoints. Open stage age remains separate. Approval Δ O / L compares actual approval with Original / Latest dates; positive means later. Full milestone variances appear in browser details. Duration sorts are meaningful only for submissions.

Colours encode each entity's **own state**, never a child's inferred state. Blue Active/Planned; cyan In Progress/Ready For Submission; purple Sent To Health Authority/Distributed; teal HA Received; green Completed; amber Deferred/On Hold By Mah; red Rejected; grey Inactive/Withdrawn/Archived and unrecognized/conflicting values. Original is dotted/hollow, Latest dashed, Actual solid. Dispatch circle, submission diamond, approval square, registration start down triangle, registration end up triangle. State text stays visible.

Registration end is off initially and is excluded from the fit range until enabled. Toggling it refits the axis; it never changes processing durations. Registration start remains a distinct marker.

## Search, membership and details

Genuine HTML search supports caret editing, paste and normal selection. Top search covers IDs/product/country/type and retains all delivered membership rows of matching submissions. Business Unit, Site (legal manufacturer), Product, Country and Type are searchable multiselect filters: OR within a list, AND across delivered rows. Product search requires two characters and shows at most 50 matches at a time. Singleton LM/country names display directly; multiple memberships use counts, with full independent lists in Details. No fabricated product–country pairings. Application counts use distinct filtered ROs/submissions.

Details starts collapsed, grows to its content up to a cap, and uses selectable HTML text. It includes relationships, approval record/estimate/history cards, an expandable date matrix and processing history, registration dates, durations/variances, full paged/searchable memberships and separate data issues. Copy details includes full membership lists regardless of current page/search. Unknown dates read Not recorded; invalid/conflicting values are withheld.

## Power BI

The retained **historical Deneb 1.3** files are `deneb.vega.json` for current Deneb or `deneb-legacy.vega.json` for legacy host sizing; `deneb-comparison.vega.json` starts with submission comparison. These files contain no embedded records and use generic aliases. AppStatus, SubmissionType and RegistrationEnd were new in 1.3; Country remains optional for that version. The 1.6 Business Unit filter and approval prediction engine belong to the installable visual and browser demo, not those historical Deneb files. Browser `timeline.json` supplies a host stub and is not a Deneb import.

The Deneb specs contain genuine native HTML signal bindings; the broken drawn-text imitation is removed. Browser HTML details are not part of Deneb. For report copying, follow [POWER-BI-DETAILS.md](POWER-BI-DETAILS.md) and the supplied generic Power Query helper. Selection in this aggregate chart is internal; companion tables use an explicit native submission selector. No automatic table filtering or aggregate drillthrough is claimed. Installed Power BI/Deneb and the helper's Power Query refresh require local verification. Recommended native visual 900 × 850 with overflow enabled as needed.

Deneb host rebuilds can reset expansion, pins, query, selection, scroll and zoom. Optional patching has documented limits; there is no promise of 30,000-row host-state retention. See [Deneb dataset documentation](https://deneb.guide/docs/dataset) and [documented HTML bindings](https://deneb.guide/docs/changelog).

## Run and validation

Serve this directory with any static server; all runtime assets are local. GitHub Pages serves the main branch root. No analytics or data uploads. Dark responsive layout; narrow screens scroll the chart horizontally.

Real Vega parsing/rendering and functional tests cover state grain, distinct counts, full memberships, search, comparison level/pins, Day 0, expiry domains, date conflicts/reversals, exact duration/variance, sorts, anchored expansion and 30,000 fictional membership rows. Drawn rows are capped at60; aggregation still processes all delivered data. Browser tests check genuine controls, copying, filters and responsive layout. Actual Power BI cannot be verified in the standalone browser.

Vega 5.33.0 is bundled under BSD-3-Clause; see VEGA-LICENSE.txt.


