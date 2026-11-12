# Development and publishing

## Work in the visual's directory

Use **Node 22** and run each visual's commands from its own folder. Each guide lists the required generator and tests. Generators create a separate Power BI project with pinned dependency versions.

| Visual folder | Generator | Generated project |
| --- | --- | --- |
| `change-dashboard/` | `node build.cjs` | `powerbi/` |
| `registration-map/` | `node build.cjs` | `powerbi/` |
| `regulatory-tracker/` | `node powerbi-visual.build.cjs` | `powerbi-visual/` |
| `roadmap/` | `node roadmap-2026.build.cjs` | `roadmap-2026/` |
| `ivdr-overview/` | `node ivdr-comparison.build.cjs` | `ivdr-comparison/` |
| `key-submissions/` | `node key-submissions.build.cjs` | `key-submissions/` |
| `site-regulatory-plan/` | `node site-plan.build.cjs` | `site-plan/` |
| `site-submission-outlook/` | `node build.cjs` | `powerbi/` |

The nested Key Submissions directory is intentional: the outer folder contains maintained source; the inner one is generated. Dependencies, generated projects and release staging directories are ignored by Git.

`shared/dispatch-required.js` supplies common dispatch interpretation to Tracker, Roadmap, IVDR, Key Submissions and Site Regulatory Plan. Keep this sibling directory when using their source archives. The other visuals retain their existing bundled helpers.

## Check changes

Run the affected visual's logic tests, generated-project type checks and host/browser tests. The corresponding [GitHub Actions workflow](../.github/workflows/) is the complete build recipe. Changes to the common dispatch helper trigger all five consumers.

For browser demos, serve the **repository root** over HTTP, then open the relevant visual directory or preview file. Tracker loads the shared helper from a sibling directory. The root HTML redirects preserve older demo URLs, including query strings and fragments.

## Publish a version

Pushes run build/test jobs and upload workflow artifacts. Publishing a GitHub release is explicit: run the visual's workflow manually and enable **publish** only after updating its version, release notes and expected asset names. Leaving it disabled runs validation without changing tags or releases.

After a release succeeds, update its row in the root [Table of visuals](../README.md#table-of-visuals). Keep that table immediately beneath the README title, keep the root overview short, and put detailed changes in the visual's guide or release notes. Preserve existing release downloads and public demo URLs when moving files.

## Repository cleanup

The previous long root README is preserved in [docs/history](history/pre-cleanup-readme.md). No package version or visual identity changed during the reorganization. Existing reports continue to use the same released packages.
