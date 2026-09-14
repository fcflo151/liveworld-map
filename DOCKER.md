# Self-Hosting LiveWorld Map with Docker

LiveWorld Map ships as a self-contained Next.js standalone build. This guide covers
running it with Docker / Docker Compose, deploying it as a [CasaOS](https://casaos.io)
app, and configuring the optional API keys.

> **TL;DR:** LiveWorld Map runs fully **without any API keys**. All core feeds
> (aviation, satellites, fires, earthquakes, weather, news, CVEs) use public
> keyless sources. Keys only matter for the optional RECON scanner backend and
> for raising rate limits on a few feeds.

---

## 1. Docker Compose (recommended)

```bash
git clone https://github.com/fcflo151/liveworld-map.git
cd liveworld-map

# optional: configure keys / scanner backend
cp .env.example .env         # then edit .env

docker compose up -d
```

Open <http://localhost:3000>.

What the compose file does:

- **`build:`** — compose builds the image locally from the `Dockerfile`, so
  you always run the LiveWorld Map code you just cloned.
- **`env_file: .env` (`required: false`)** — if a `.env` file exists its
  values are injected into the container; if it's missing, LiveWorld Map still starts
  with the keyless feeds.
- **`ports: ${LIVEWORLD_PORT:-${OSIRIS_PORT:-3000}}:3000`** — the web UI. The
  container always listens on 3000; set `LIVEWORLD_PORT` in `.env` to remap
  the published host port. `OSIRIS_PORT` remains accepted for existing installs.
- **`restart: unless-stopped`** — survives reboots.

Common commands:

```bash
docker compose logs -f          # follow logs
docker compose up -d --build    # rebuild locally after pulling new code
docker compose down             # stop & remove
```

### Plain `docker run`

```bash
docker build -t liveworld-map:latest .
docker run -d --name liveworld-map -p 3000:3000 --env-file .env --restart unless-stopped liveworld-map:latest
```

### Image details

Multi-stage build on `node:22-alpine`, runs as a non-root user (`nextjs`,
uid 1001), serves Next.js standalone via `node server.js` on port 3000.
Final image is ~220 MB. Build excludes `node_modules`, `.next`, `.git` and the
repo's large `*.diff` artifacts via `.dockerignore`.

---

## 2. CasaOS

The compose file includes an `x-casaos:` metadata block (title, description,
icon, port map, env descriptions) that plain Docker Compose ignores but CasaOS
reads.

**Install:**

1. On the CasaOS host, clone the repo somewhere persistent (e.g.
   `/DATA/AppData/liveworld-map`).
2. CasaOS dashboard → **`+`** → **Install a customized app** → paste the
   contents of `docker-compose.yml`.
   *(or simply run `docker compose up -d` from the cloned directory).*
3. LiveWorld Map appears on the dashboard with its icon, reachable on host port
   `3000` (or whatever `LIVEWORLD_PORT` you set in `.env`).

The app icon is the gold Eye-of-Horus mark in
`public/casaos-icon.png` (512×512 PNG), referenced by the `icon:` URL in the
metadata.

> CasaOS stores imported compose files under `/var/lib/casaos/apps/`, so a
> relative `build:` context may not resolve there. If importing the YAML
> directly, build/tag `liveworld-map:latest` first
> (`docker build -t liveworld-map:latest /path/to/liveworld-map`) and use the
> image name in the compose file.

---

## 3. API keys & data sources

Copy `.env.example` to `.env` and fill in only what you need.

### What the code actually reads today

| Variable | Purpose | Required for |
|----------|---------|--------------|
| `SCANNER_URL` | RECON scanner backend base URL (e.g. `http://scanner:7700`) | RECON toolkit (quick/ssl/headers/rdns/subdomains/tech/whois/geoloc/vuln) |
| `SCANNER_KEY` | Shared secret; **must equal the backend's `OSIRIS_KEY`** | RECON toolkit |
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with `Account · Radar · Read` | Internet outage and L3 attack-origin layers |
| `ENTSOE_API_TOKEN` | ENTSO-E Web API Security Token | Cross-border power-flow and generation-outage layers |
| `ICAO_API_KEY` | ICAO API Data Service key | Operational NOTAM alert layer |

Without `SCANNER_URL`/`SCANNER_KEY` the RECON endpoints return `503` and the
rest of LiveWorld Map works normally. Generate a key with `openssl rand -hex 32`.

### Optional provider enhancements

The public feeds remain available without these credentials. Add a key only
when you want the associated enhancement: in particular, `N2YO_API_KEY` is
used server-side for a once-per-minute live ISS position correction.

| Variable | Service | How to get it (all free) |
|----------|---------|--------------------------|
| `FIRMS_API_KEY` | NASA FIRMS active fires | Enter an email at <https://firms.modaps.eosdis.nasa.gov/api/map_key/> — the `MAP_KEY` is emailed instantly. Limit 5000 req / 10 min. |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | OpenSky aviation | Create an account at <https://opensky-network.org/>, open **Account → API client**, create a client and copy id/secret. **OAuth2 only since March 2025** (username/password auth removed). |
| `N2YO_API_KEY` | N2YO live ISS position correction (other satellites use CelesTrak/SGP4) | Register at <https://www.n2yo.com/login/register/>, then **Profile → generate API key**. Limit 1000 req / hour; key can't be regenerated. |
| `AIS_API_KEY` | aisstream.io maritime | Sign up at <https://aisstream.io/>, create a key on the **API Keys** page. Used over `wss://stream.aisstream.io/v0/stream`. |

The keyless grid-frequency layer uses Fraunhofer ISE Energy-Charts. Gas
pipelines and LNG terminals use Global Energy Monitor's GGIT data (CC BY 4.0).
ENTSO-E API access is requested after registering on the Transparency Platform;
the token remains server-side and is never returned to the browser.
The public SDR directory and ADS-B GNSS-integrity anomaly layer are keyless.
`OSIRIS_NOTAM_LOCATIONS` can override the default monitored ICAO locations with
up to ten comma-separated FIR or aerodrome codes.

> Keep `.env` out of version control — it is already in `.gitignore`. Only
> `.env.example` (no secrets) is committed.

### Optional runtime overrides

| Variable | Purpose | Default |
|----------|---------|---------|
| `OSIRIS_TELEGRAM_CHANNELS` | Comma-separated list of public Telegram channel usernames (no `@`) to scrape for the **Telegram OSINT** map layer. Overrides the curated default set. | `osintdefender,insiderpaper,aljazeeraenglish,nexta_live,war_monitor` |
| `OSIRIS_NOTAM_LOCATIONS` | Up to ten comma-separated ICAO FIR/aerodrome codes monitored by the NOTAM layer. | `EDGG,EDMM,EDWW,EPWW,UKBV,UKDV,LCCC,LTAA,OIIX,LLBG` |
| `OSIRIS_PORT` | Host port the compose file publishes (container itself always listens on 3000). | `3000` |

### Keyless sources (no configuration needed)

Aviation → `adsb.lol` · Satellites → `celestrak.org` (TLE) · Fires →
NASA FIRMS open-data CSV · Earthquakes → USGS · Weather → NASA EONET · Space
weather → NOAA SWPC · CVEs → NVD · News → public RSS / HLS streams · CCTV →
public traffic-authority feeds · Crypto (BTC) → `blockstream.info` · Crypto
(ETH) → `eth.blockscout.com` ([Blockscout](https://github.com/blockscout/blockscout)
open-source explorer) · OFAC SDN sanctions → [OpenSanctions](https://www.opensanctions.org)
mirror (CC-BY 4.0) · Telegram OSINT → public `t.me/s/<channel>` web preview.
