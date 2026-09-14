# Keyless public data sources

LiveWorld Map uses public, keyless sources only where their documented access model, attribution requirements, and request limits fit the application. A source being keyless does not mean it is unrestricted.

## Sources in this release

| Source | Purpose | Access / attribution notes |
| --- | --- | --- |
| DWD | German weather warnings | Official public warning data; attribute Deutscher Wetterdienst (DWD). |
| GDACS | Supplementary disaster observations | Used as corroborating context. Existing USGS, NASA FIRMS, NASA EONET and weather events remain the primary visible paths where they already cover the same event type. |
| NASA GIBS | True-color and aerosol raster imagery | Visual map context only. NASA FIRMS remains the active-fire event source. |
| Open-Meteo Marine | On-demand marine forecasts | Keyless public endpoint for non-commercial use; commercial deployments must use an appropriate Open-Meteo customer plan/API. |
| Open-Meteo Flood / GloFAS | On-demand river-discharge forecasts | Model guidance, not an official local flood warning or gauge. WSV Pegelonline remains primary for German federal-waterway gauges. Keyless public endpoint is non-commercial. |
| OpenStreetMap / Overpass | Hospitals, fire stations and shelters | © OpenStreetMap contributors, ODbL. Uses the existing bounded `/api/osm-infrastructure` endpoint: small viewports, cached responses, serialized upstream requests, and no arbitrary Overpass proxy. |
| GTFS.de Realtime | German transit ServiceAlerts and delayed TripUpdates | DELFI / gtfs.de, CC BY-SA 4.0. VehiclePositions are intentionally not ingested. |

## Request policy

- Check upstream HTTP status before parsing.
- Distinguish a valid empty result from an upstream failure.
- Apply timeouts, cache repeated requests, and avoid aggressive polling.
- Prefer structured public formats over HTML scraping.
- Do not bypass login requirements, paywalls, CAPTCHAs, robots controls, or anti-bot measures.
- Keep source attribution and usage restrictions visible in `src/lib/source-registry.ts`.
- Do not introduce a second map layer for the same real-world event when an existing source already provides it; attach the additional source as corroborating evidence instead.

## Deliberately excluded in this release

- **MET Norway:** not added because the existing weather stack already covers the intended use and another provider would add duplication without a clear map-level benefit.
- **Tagesschau RSS:** not enabled as a persistent incident source because its usage, redistribution, and archival constraints are not a good fit for the current ingestion/history model.
