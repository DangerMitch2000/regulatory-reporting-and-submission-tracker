# Regulatory reporting visuals

<!-- Keep the Table of visuals directly below the title. Update its versions and links in place; put release history in each visual's guide or docs/history/. -->

## Table of visuals

| Visual | Download | Demo |
| --- | --- | --- |
| [Submissions & Approvals 1.1.2](who-activity/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/who-activity-v1.1.2/submissions-approvals-1.1.2.0.pbiviz) | [Two-year activity](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/who-activity/preview.html) |
| [Change Dashboard 1.9.1](change-dashboard/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/change-dashboard-v1.9.1/change-dashboard-1.9.1.0.pbiviz) | [Change Dashboard](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/change-dashboard/preview.html) |
| [Registration Coverage Map 1.0.3](registration-map/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/registration-map-v1.0.3/registration-coverage-map-1.0.3.0.pbiviz) | [World map](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/registration-map/preview.html) |
| [Regulatory Tracker 1.18.3](regulatory-tracker/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/v1.18.3/regulatory-tracker-1.18.3.0.pbiviz) | [Tracker](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/) |
| [Registration Overview / Roadmap 1.5.1](roadmap/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/roadmap-2026-v1.5.1/roadmap-2026-1.5.1.0.pbiviz) | [Roadmap](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/roadmap-preview.html) |
| [IVDR Overview 1.2.1](ivdr-overview/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/ivdr-overview-v1.2.1/ivdr-registration-overview-1.2.1.0.pbiviz) | [IVDR](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/ivdr-preview.html) |
| [Key Submissions 1.1.1](key-submissions/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/key-submissions-2026-v1.1.1/key-submissions-2026-1.1.1.0.pbiviz) | [Key submissions](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/key-preview.html) |
| [Site Regulatory Plan 1.1.1](site-regulatory-plan/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-plan-2026-v1.1.1/site-regulatory-plan-2026-1.1.1.0.pbiviz) | [Site plan](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-plan-preview.html) |
| [Site Submission Outlook 1.6.5](site-submission-outlook/README.md) | [Power BI package](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases/download/site-submission-outlook-v1.6.5/site-submission-outlook-1.6.5.0.pbiviz) | [Previous, current and next month](https://dangermitch2000.github.io/regulatory-reporting-and-submission-tracker/site-submission-outlook/preview.html) |

Select a visual name for its setup guide, field mappings and build instructions. The demos use fictional data; install the Power BI package to use your own report data.

All visuals use **Wallace Sans**, with **Wallace Sans Light** for their main titles. These fonts must be installed on the viewer's device; otherwise Segoe UI, Arial or sans-serif is used. No font files are bundled or downloaded.

## Install or update

1. Download the relevant **Power BI package** from the table.
2. In Power BI Desktop, choose **Visualizations (…) → Import a visual from a file** and select the `.pbiviz` file. Confirm replacement when updating an existing visual.
3. Follow that visual's field-mapping guide. Use Date/DateTime columns rather than automatic date hierarchies.
4. Check the report, save it and republish to update Power BI Service.

These packages are uncertified previews. Download links point to versioned releases; import the updated package to receive changes to a visual.

## Repository layout

Each visual has its own folder containing its source, tests, demo and README:

```text
change-dashboard/          Change and event worklist
registration-map/          Registration coverage by country
regulatory-tracker/        Hierarchy, timeline and record details
roadmap/                   Registration overview by year
ivdr-overview/             IVDR comparison
key-submissions/           Key submission planning
site-regulatory-plan/      Site regulatory planning
site-submission-outlook/   Previous, current and next month
who-activity/              Submissions and RO approvals by year
shared/                   Common dispatch-requirement logic
docs/                     Development guide and archived history
```

The small HTML files at the root preserve existing public demo links. Generated build folders, dependencies and packages are excluded from source control; downloadable packages remain under [Releases](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/releases).

## Development and history

- [Build, test and release guidance](docs/development.md)
- [Documentation index and archived release history](docs/README.md)
- [Report an issue](https://github.com/DangerMitch2000/regulatory-reporting-and-submission-tracker/issues)
