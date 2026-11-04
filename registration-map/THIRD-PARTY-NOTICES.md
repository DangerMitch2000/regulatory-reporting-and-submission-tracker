# Map geography

Made with Natural Earth. `geography.json` is derived from the Natural Earth [**1:50m Admin 0 Countries** dataset, version **5.1.1**](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/). Natural Earth makes its raster and vector map data available in the **public domain**, including modification and commercial use. See the [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/).

The source is the Natural Earth project repository maintained by Nathaniel Vaughn Kelso, one of the project's primary authors. This build pins its exact input:

- Repository: [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector).
- Revision: [`9380cca83db5f9aef52d5e762765100745f84b27`](https://github.com/nvkelso/natural-earth-vector/commit/9380cca83db5f9aef52d5e762765100745f84b27), 13 May 2022, “v5.1.1 DBF var char length fix”.
- Input: [`geojson/ne_50m_admin_0_countries.geojson`](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_50m_admin_0_countries.geojson).
- SHA-256: `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`.

## Derivation and scope

The bundled file contains 241 source map features: countries and territories, including source representations of disputed areas. Only Antarctica is omitted. It keeps Natural Earth's individual feature boundaries; Hong Kong, Macao, Taiwan, Kosovo, and other separately represented source features remain separate. Displaying these source features does not add a position on sovereignty or legal status. This small-scale basemap is intended for a coverage overview, not boundary adjudication.

The build projects the source using **Natural Earth I** into the fixed SVG viewBox `0 0 1000 520`, with 14 units of padding. Projected rings undergo Douglas-Peucker simplification at a tolerance of 0.12 viewBox units, then coordinates are rounded to one decimal place. Every source polygon ring is retained. Small geometries may appear subpixel at the default map scale; the visual can use `cx` and `cy` as accessible marker anchors. These anchors come from Natural Earth's `LABEL_X` and `LABEL_Y`, so archipelagos and antimeridian-crossing countries retain useful locations.

Display names come from the source `NAME_EN`, falling back to `NAME_LONG` and `ADMIN`. Aliases use `NAME`, `NAME_LONG`, `ADMIN`, `FORMAL_EN`, `NAME_CIAWF`, and `NAME_ALT`. Ambiguous names and aliases are omitted; sovereign names are not applied to constituent territories. The original names represent the pinned dataset's edition.

ISO alpha and numeric codes come from the source `ISO_A2`, `ISO_A3`, and `ISO_N3`, with valid `*_EH` fallback values. Numeric IDs preserve leading zeros. Missing numeric values use the namespaced source identity `NE-<ADM0_A3>`. Kosovo retains the source's user-assigned `XK` alpha-2 code and has no fabricated ISO alpha-3 or numeric code. The separate source features “Indian Ocean Territories” and “Ashmore and Cartier Islands” share Australia's code in the source; this derived file gives them `NE-IOA` / `NE-ATC` IDs and empty ISO fields so they cannot ambiguously resolve an `AU` / `AUS` registration. Remaining source features without ISO values keep empty ISO fields and their unique source IDs.

## Reproduce and validate

From the parent tracker folder:

```powershell
node registration-map/generate-geography.cjs
node registration-map/geography-test.cjs
```

The build uses Node.js 20 or later and the existing build dependency `d3-geo` **3.1.1** from `powerbi-visual/node_modules` (with its normal transitive dependencies). It verifies the input SHA-256 before writing the runtime asset. With no cached source it downloads the pinned public URL. Pass `--download` to fetch it again. The raw source cache is stored at `output/registration-map-geography/ne_50m_admin_0_countries.geojson` and is not a publication asset.

The shipped visual imports only the precomputed JSON. It needs no runtime d3 dependency, external tile provider, API key, or network request. `d3-geo` is used solely as a build tool and its code is not copied into the geography asset. Its [ISC license](https://github.com/d3/d3-geo/blob/v3.1.1/LICENSE) remains with the installed dependency.
