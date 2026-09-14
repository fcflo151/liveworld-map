<div align="center">

# 🌍 LIVEWORLD MAP

### Global Real-Time Intelligence, Infrastructure & Civil Protection Grid

*An advanced multi-domain situational awareness platform — extended and enhanced by **fcflo151**, built upon the open-source **OSIRIS** engine.*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-GPU_Rendered-396CB2?style=for-the-badge)](https://maplibre.org)
[![License](https://img.shields.io/badge/License-MIT-D4AF37?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/LiveWorld_Map-Active-00E5FF?style=for-the-badge)](#)

**A real-time global intelligence dashboard combining live flight tracking, European train stations with live departure boards, Mediterranean cruise & shipping routes, official civil protection & disaster warnings (BBK NINA), federal waterway river gauges (WSV Pegelonline), continental power grid telemetry (ENTSO-E), CCTV networks, seismic activity, and reconnaissance tooling into a unified GPU-accelerated tactical HUD.**

</div>

---

## 🌟 Project Evolution & Credits

**LiveWorld Map** is an extended, next-generation evolution of the original open-source **[OSIRIS](https://github.com/simplifaisoul/osiris)** project.

- **Original Foundation & Core Architecture**: Created by **[simplifaisoul](https://github.com/simplifaisoul)** ([simplifaisoul/osiris](https://github.com/simplifaisoul/osiris)) under the MIT License. Full acknowledgment and gratitude to `simplifaisoul` for the pioneering vision, WebGL GPU rendering pipeline, and foundational OSINT framework.
- **Further Development & Extensions**: Engineered and expanded by **fcflo151**.

---

## 🚀 Key Extensions & New Capabilities (by fcflo151)

LiveWorld Map introduces major new situational awareness layers and intelligence modules:

### 1. 🚆 Rail Intel — Stations & Live Departure Boards
- **Strategic European Stations**: 40+ high-capacity transit hubs across Germany and Europe (Berlin, Frankfurt, Munich, Hamburg, Cologne, Zurich, Vienna, Paris, Amsterdam) with EVA station codes, categories, track counts, and passenger stats.
- **Live Departure Boards**: Real-time stationboards (ICE, IC, RE, S-Bahn) featuring live delay tracking (`+4 min`, `+25 min`), track assignments, intermediate stops, and cancellation badges.
- **High-Speed Rail Corridors**: European high-speed trunk lines visualized on the map with glowing tactical vector styling.
- **Dedicated Rail HUD Panel**: Interactive glassmorphic board with category filters (`ALLE`, `ICE / FERN`, `REGIO`, `S-BAHN`), punctuality rate metric, and 30-second auto-refresh.

### 2. 🚢 Maritime & Cruise Routes (Palma de Mallorca & Western Med)
- **Port of Palma (Mallorca)**: Integrated as a primary Balearic cruise and passenger ferry hub.
- **Dedicated Nautical Corridors**:
  - Palma de Mallorca ↔ Barcelona (~205 km)
  - Palma de Mallorca ↔ Valencia (~260 km)
  - Palma de Mallorca ↔ Ibiza (~130 km)
  - Palma de Mallorca ↔ Mahón / Menorca (~155 km)
  - Western Mediterranean Grand Cruise Loop (Barcelona → Palma → Marseille → Genoa → Civitavecchia → Naples → Barcelona)
- **Interactive Route Dossier**: Distance in km, route category, and primary shipping lines (Baleària, Trasmed, Grimaldi, MSC, Costa).

### 3. ✈️ High-Fidelity Vector Aircraft Silhouettes
- Replaced primitive triangle markers with precision vector silhouettes rendered on HTML5 canvas:
  - **Commercial Airliners**: Swept wings, engine nacelles, winglets, cockpit gleam, and tail fin.
  - **Military Fighters**: Delta-wing planform, LERX strakes, sharp radome, and twin engine exhausts.
  - **Business Jets**: Sleek executive fuselage with aft-mounted twin turbines and T-tail.
  - **High-Contrast Dark Border**: Guarantees razor-sharp silhouette visibility over both deep oceans and bright terrain.

### 4. 🚨 Civil Protection & Emergency Warnings (BBK NINA / MoWaS / KATWARN)
- **Direct Federal Warning Feeds**: Connects directly to the German Federal Office of Civil Protection and Disaster Assistance (`warnung.bund.de`) without requiring any API keys.
- **Multi-Hazard Scope**: Real-time alerts for major industrial fires, toxic smoke clouds, flood evacuations, chemical leaks, drinking water advisories, and unexploded ordnance (WWII bomb disposals).
- **Severity Classification**: Extreme (Stage 4), Severe (Stage 3), Moderate (Stage 2), Minor (Stage 1) with severity-coded pulsing map beacons.
- **Civil Defense Modal**: Emergency dossier featuring official instructions (*Amtliche Handlungsempfehlungen*), issuing agency, and one-click map centering.

### 5. 🌊 Federal Waterways & River Gauges (WSV Pegelonline)
- **Real-Time River Gauging**: Live water level measurements (in cm) across the Rhine, Danube, Elbe, Weser, Mosel, Main, and Oder via the German Federal Waterways and Shipping Administration (WSV).
- **Navigation Safety Classification**:
  - **Hochwassermarke II (HW II)**: Navigation prohibited / waterway closed to commercial shipping.
  - **Hochwassermarke I (HW I)**: Navigational speed restrictions and clearance advisories.
  - **Niedrigwasser (RNW)**: Low water warning / reduced vessel draft and cargo capacity.
  - **Regulärer Wasserstand**: Standard navigable conditions.
- **Waterway Gauge Panel**: Live level readout, trend indication (*rising*, *falling*, *steady*), river kilometer, and direct link to the WSV master data portal.

### 6. ⚡ Power Grid & Energy Infrastructure
- **Continental European 50 Hz Grid**: Live frequency monitoring via Fraunhofer ISE / Energy-Charts.
- **ENTSO-E Cross-Border Flows**: Physical electricity exchange between bidding zones.
- **Generation Outages**: Real-time monitoring of European generation unit unavailability.
- **Pipelines & LNG Terminals**: European natural gas pipelines and LNG import terminals.

---

## 📊 Comprehensive Capabilities Matrix

| Domain | Data Points & Coverage | Primary Feeds & Sources |
|--------|------------------------|-------------------------|
| **Civil Defense & Alerts** | National disaster alerts, chemical spills, evacuations | BBK NINA, MoWaS, KATWARN |
| **Federal Waterways** | Live river gauge levels (cm), flood marks HW I/II, low water | WSV Pegelonline |
| **Rail & Transit** | 40+ strategic European stations, live departures, high-speed lines | Deutsche Bahn / OpenData, Corridors |
| **Aviation** | Commercial, Military, Private Jets with custom vector silhouettes | OpenSky Network |
| **Maritime & Shipping** | Global ports, chokepoints, Mallorca & Mediterranean cruise routes | OpenSeaMap, Static Naval Intel, AIS |
| **Power Grid & Energy** | 50 Hz frequency, cross-border flows, generation outages, LNG | Fraunhofer ISE, ENTSO-E, GEM |
| **CCTV Surveillance** | 17,000+ public traffic & security cameras with live snapshots | TfL, WSDOT, Caltrans, ODOT, MDOT, HK, NZTA + more |
| **Seismic Activity** | Real-time global earthquakes (M2.5+) | USGS Earthquake Hazards |
| **Wildfires** | Active global thermal hotspots | NASA FIRMS |
| **Live Broadcasts** | 24/7 geopolitical and news streams | 25+ Global Broadcasters |
| **Severe Weather** | Extreme storms, cyclones, weather events | NASA EONET |
| **Space & Satellites** | Space weather, satellite constellations (Starlink, GPS, ISS) | NOAA SWPC, N2YO |
| **Cyber Recon & Threats** | CVE vulnerability scanning, port scanning, WHOIS, DNS, TLS | NVD, Custom Recon Scanner |
| **Sanctions & Crypto** | OFAC SDN matching, BTC/ETH address tracing | OpenSanctions, Blockstream, Blockscout |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LIVEWORLD MAP CLIENT                            │
│  ┌──────────────┐  ┌───────────────────┐  ┌─────────────────────────┐  │
│  │ MapLibre GL  │  │  Tactical HUDs    │  │  Specialized Panels     │  │
│  │  (GPU WebGL) │  │  Civil Defense    │  │  Train Departures       │  │
│  │  60 FPS View │  │  River Gauges     │  │  RECON Toolkit          │  │
│  │  Vector Art  │  │  Layer Controls   │  │  Live News & CCTV       │  │
│  └──────────────┘  └───────────────────┘  └─────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                       NEXT.JS 16 API ROUTES                            │
│  /api/civil-protection    /api/waterways         /api/trains/*         │
│  /api/maritime            /api/grid-intel        /api/energy-infra     │
│  /api/flights             /api/earthquakes       /api/cctv             │
│  /api/fires               /api/weather           /api/satellites       │
│  /api/gdelt               /api/scanner           /api/osint/*          │
├────────────────────────────────────────────────────────────────────────┤
│                      INTELLIGENCE DATA FEEDS                           │
│  BBK NINA · WSV Pegelonline · OpenSky · Fraunhofer ISE · ENTSO-E       │
│  USGS · NASA FIRMS · NASA EONET · NOAA SWPC · OpenSanctions · TfL      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Quick Start & Installation

### Prerequisites
- Node.js 20+ or 24+
- npm 10+

### Setup
```bash
# 1. Clone repository
git clone https://github.com/fcflo151/liveworld-map.git
cd liveworld-map

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing & Production Build
```bash
# Run complete Vitest suite (640+ tests across 56 test files)
npm test

# Verify TypeScript types
npx tsc --noEmit

# Compile production bundle
npm run build
```

---

## ▲ Vercel Deployment

LiveWorld Map can be deployed through the Vercel Git integration without a Vercel API key. Import the repository, keep the detected Next.js settings, and set the following environment variable for the Production environment (and Preview if desired):

```bash
NEXT_PUBLIC_SITE_URL=https://your-liveworld-map-domain.example
```

The application works without runtime credentials for its baseline public feeds. Optional variables only unlock or improve specific layers: `CLOUDFLARE_API_TOKEN`, `ENTSOE_API_TOKEN`, `ICAO_API_KEY`, `SCANNER_URL`/`SCANNER_KEY`, and provider-specific rate-limit keys listed in [.env.example](.env.example). Never expose server-side secrets through variables beginning with `NEXT_PUBLIC_`.

---

## 📜 License & Attribution

This project is open-source under the **MIT License**. See [LICENSE](LICENSE) for full legal text.

- **LiveWorld Map** — Extended and maintained by **[fcflo151](https://github.com/fcflo151)**.
- **OSIRIS Engine** — Original design and core architecture by **[simplifaisoul](https://github.com/simplifaisoul)** ([github.com/simplifaisoul/osiris](https://github.com/simplifaisoul/osiris)).
