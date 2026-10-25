# Wind Decision Desk

A January 2026 pilot for a GB electricity buyer. The dashboard reconstructs the wind generation forecast available at a chosen day-ahead decision time and compares it with Elexon wind outturn. It is a **historical decision aid**, not an automated trading or purchase-volume calculator.

## What the product does

- Choose a purchase decision date from **1–31 January 2026** and a decision cutoff in UK local time. Delivery is the following calendar day, **2 January–1 February 2026**.
- For each delivery hour, take the latest `WINDFOR` value whose `publishTime` is at or before the cutoff. Forecasts published afterward are never used in that decision snapshot.
- Compare it with the mean of the two corresponding half-hour `FUELHH` records where `fuelType` is `WIND`. January WINDFOR targets are hourly; FUELHH actual targets are half-hourly. This alignment avoids inventing half-hour forecasts or dropping half the actuals.
- Show the daily profile, publication time, coverage, and a retrospective January backtest: mean absolute error (MAE), signed bias (`forecast − actual`), root mean square error (RMSE, API), 90th percentile absolute error, and weighted absolute percentage error (WAPE = total absolute error / total actual generation).

The cutoff defaults to **11:00 UTC** as an illustrative buyer decision time, **not a claim about any specific auction gate closure**. The client should set it to its actual workflow. All dates in scope fall in UK winter time, so UK local time equals UTC.

An overforecast of wind can imply an additional power requirement elsewhere. Actual purchase quantity cannot be calculated from these datasets because customer demand, existing contracts, other generation, and the utility's own position are not included. Elexon's forecast covers operationally metered wind visible to the system operator; the pilot should not be read as a forecast of every UK wind asset. This is a retrospective analysis: actuals and the full-month accuracy figures were not known at the original purchase time.

## Start the application

### Docker (recommended)

```sh
docker compose up --build
```

Open <http://localhost:8000>. The image builds React and serves the compiled app and FastAPI from one container.

### Local development

```sh
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to FastAPI. API docs are at <http://localhost:8000/docs>.

## Data and refresh

The checked-in `data/january_2026.json.gz` snapshot contains only the fields needed from Elexon's public [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) and [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream). Elexon's [developer portal](https://developer.data.elexon.co.uk/) explains that historical dataset endpoints preserve earlier publications. The snapshot includes forecast publications from 31 December 2025 through 31 January 2026 and actual publications from 2 January through 2 February 2026. Its `retrievedAt` timestamp appears in the UI. Contains BMRS data © Elexon Limited copyright and database right 2026. The required attribution and terms are in Elexon's [BMRS open data licence](https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/).

To refresh the snapshot (public API, no key required):

```sh
python scripts/fetch_elexon.py
```

The script fetches one publication day at a time with retries, filters WIND actuals, keeps forecast publication versions, and writes the compact snapshot. Missing hours stay missing and are excluded from error metrics; coverage is always reported. Actual revisions are resolved by latest `publishTime` available in the snapshot.

## Files and directories

| Path | Purpose |
| --- | --- |
| `backend/main.py` | FastAPI routes, validation, and serving the built React app |
| `backend/analysis.py` | As-of forecast selection, hourly actual alignment, and error metrics |
| `backend/requirements.txt`, `requirements.txt` | Python runtime dependencies |
| `frontend/src/main.jsx` | React dashboard, interactions, SVG chart, and daily drill-down |
| `frontend/src/style.css` | Responsive visual design |
| `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.js` | Frontend dependencies and development proxy |
| `data/january_2026.json.gz` | Reproducible Elexon pilot snapshot |
| `scripts/fetch_elexon.py` | Public API ingestion and snapshot regeneration |
| `tests/test_analysis.py` | Forecast vintage, hourly alignment, and metrics checks |
| `Dockerfile`, `docker-compose.yml` | Container build and local run |
| `pyproject.toml`, `vercel.json` | Vercel FastAPI entrypoint and frontend build |
| `docs/demo-guide.md` | Customer and technical-lead video run sheet |

## Verification

```sh
python -m unittest discover -s tests -v
cd frontend && npm run build
```

The API endpoints are `GET /api/health` and `GET /api/dashboard?date=2026-01-15&cutoff=11:00`.

## Deployment

**Live application:** Pending publication. Vercel supports FastAPI as a Python function and the repo includes its entrypoint and React build command. Alternatively the supplied Dockerfile can run on a container host. Add the verified public application URL here before submission.

## AI assistance

**AI tools were used.** OpenAI Codex assisted with domain research, implementation, tests, interface design, and documentation. Dataset selection, timing rules, formulas, and outputs were checked against Elexon records and local verification.
