"""Create a reproducible January 2026 snapshot from the two permitted Elexon streams."""

from __future__ import annotations

import gzip
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
OUT = Path(__file__).resolve().parents[1] / "data" / "january_2026.json.gz"


def fetch_day(dataset: str, day: datetime) -> list[dict]:
    query = urlencode({
        "publishDateTimeFrom": day.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "publishDateTimeTo": (day + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    url = f"{BASE}/{dataset}/stream?{query}"
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={"User-Agent": "wind-decision-pilot/1.0"}), timeout=60) as response:
                value = json.load(response)
            if not isinstance(value, list):
                raise ValueError(f"Unexpected {dataset} response on {day.date()}")
            return value
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def main() -> None:
    forecasts: dict[tuple[str, str], dict] = {}
    actuals: dict[tuple[str, str], dict] = {}
    first = datetime(2025, 12, 31, tzinfo=timezone.utc)
    last = datetime(2026, 2, 3, tzinfo=timezone.utc)
    day = first
    while day < last:
        if day <= datetime(2026, 1, 31, tzinfo=timezone.utc):
            for item in fetch_day("WINDFOR", day):
                if item.get("startTime") and item.get("publishTime") and item.get("generation") is not None:
                    forecasts[(item["publishTime"], item["startTime"])] = {
                        "publishTime": item["publishTime"],
                        "startTime": item["startTime"],
                        "generation": item["generation"],
                    }
        if day >= datetime(2026, 1, 2, tzinfo=timezone.utc):
            for item in fetch_day("FUELHH", day):
                if item.get("fuelType") == "WIND" and item.get("startTime") and item.get("generation") is not None:
                    key = (item.get("publishTime", ""), item["startTime"])
                    actuals[key] = {
                        "publishTime": item.get("publishTime"),
                        "startTime": item["startTime"],
                        "generation": item["generation"],
                    }
        print(day.date(), len(forecasts), len(actuals), flush=True)
        day += timedelta(days=1)
    payload = {
        "source": "Elexon Insights API /datasets/WINDFOR/stream and /datasets/FUELHH/stream",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "forecastPublishRange": ["2025-12-31", "2026-01-31"],
        "actualPublishRange": ["2026-01-02", "2026-02-02"],
        "forecasts": sorted(forecasts.values(), key=lambda r: (r["startTime"], r["publishTime"])),
        "actuals": sorted(actuals.values(), key=lambda r: (r["startTime"], r.get("publishTime") or "")),
    }
    OUT.parent.mkdir(exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8", compresslevel=9) as file:
        json.dump(payload, file, separators=(",", ":"))
    print(f"Saved {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
