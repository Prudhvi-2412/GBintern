"""As-of forecast selection and retrospective scoring. Times are UTC (UK winter time)."""

from __future__ import annotations

import gzip
import json
import math
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "january_2026.json.gz"
UTC = timezone.utc


def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = (len(ordered) - 1) * p
    low = math.floor(rank)
    high = math.ceil(rank)
    return ordered[low] + (ordered[high] - ordered[low]) * (rank - low)


def metrics(rows: list[dict]) -> dict:
    errors = [r["forecast"] - r["actual"] for r in rows if r["forecast"] is not None and r["actual"] is not None]
    if not errors:
        return {"count": 0, "mae": None, "bias": None, "rmse": None, "p90AbsoluteError": None, "wape": None}
    matched = [r for r in rows if r["forecast"] is not None and r["actual"] is not None]
    actual_sum = sum(abs(r["actual"]) for r in matched)
    return {
        "count": len(errors),
        "mae": round(sum(map(abs, errors)) / len(errors)),
        "bias": round(sum(errors) / len(errors)),
        "rmse": round(math.sqrt(sum(e * e for e in errors) / len(errors))),
        "p90AbsoluteError": round(percentile([abs(e) for e in errors], 0.9)),
        "wape": round(100 * sum(map(abs, errors)) / actual_sum, 1) if actual_sum else None,
    }


class WindAnalysis:
    def __init__(self, path: Path = DATA_PATH):
        with gzip.open(path, "rt", encoding="utf-8") as file:
            data = json.load(file)
        self.retrieved_at = data["retrievedAt"]
        self.forecasts = defaultdict(list)
        self.actuals = {}
        for row in data["forecasts"]:
            self.forecasts[parse_utc(row["startTime"])].append((parse_utc(row["publishTime"]), row["generation"]))
        for versions in self.forecasts.values():
            versions.sort()
        for row in data["actuals"]:
            start = parse_utc(row["startTime"])
            published = parse_utc(row["publishTime"]) if row.get("publishTime") else datetime.min.replace(tzinfo=UTC)
            if start not in self.actuals or published >= self.actuals[start][0]:
                self.actuals[start] = (published, row["generation"])

    def day(self, decision_date: date, cutoff: time) -> dict:
        cutoff_dt = datetime.combine(decision_date, cutoff, UTC)
        delivery_date = decision_date + timedelta(days=1)
        start = datetime.combine(delivery_date, time(0, 0), UTC)
        rows = []
        for period in range(24):
            target = start + timedelta(hours=period)
            eligible = [v for v in self.forecasts.get(target, []) if v[0] <= cutoff_dt]
            selected = eligible[-1] if eligible else None
            actual_first = self.actuals.get(target)
            actual_second = self.actuals.get(target + timedelta(minutes=30))
            actual = (actual_first[1] + actual_second[1]) / 2 if actual_first and actual_second else None
            rows.append({
                "startTime": target.isoformat().replace("+00:00", "Z"),
                "label": target.strftime("%H:%M"),
                "forecast": selected[1] if selected else None,
                "actual": actual,
                "publishTime": selected[0].isoformat().replace("+00:00", "Z") if selected else None,
                "error": selected[1] - actual if selected and actual is not None else None,
            })
        return {
            "decisionDate": decision_date.isoformat(),
            "deliveryDate": delivery_date.isoformat(),
            "cutoff": cutoff_dt.isoformat().replace("+00:00", "Z"),
            "rows": rows,
            "metrics": metrics(rows),
            "forecastCoverage": sum(r["forecast"] is not None for r in rows),
            "actualCoverage": sum(r["actual"] is not None for r in rows),
        }

    def overview(self, cutoff: time) -> dict:
        days = [self.day(date(2026, 1, 1) + timedelta(days=i), cutoff) for i in range(31)]
        all_rows = [row for day in days for row in day["rows"]]
        return {
            "metrics": metrics(all_rows),
            "days": [{key: day[key] for key in ("decisionDate", "deliveryDate", "metrics", "forecastCoverage", "actualCoverage")} for day in days],
            "expectedPeriods": 31 * 24,
            "forecastCoverage": sum(day["forecastCoverage"] for day in days),
            "actualCoverage": sum(day["actualCoverage"] for day in days),
            "retrievedAt": self.retrieved_at,
        }
