import gzip
import json
import tempfile
import unittest
from datetime import date, time
from pathlib import Path

from backend.analysis import WindAnalysis, metrics


class AnalysisTests(unittest.TestCase):
    def test_asof_selection_and_hourly_alignment(self):
        payload = {
            "retrievedAt": "2026-02-02T00:00:00Z",
            "forecasts": [
                {"publishTime": "2026-01-15T08:00:00Z", "startTime": "2026-01-16T00:00:00Z", "generation": 100},
                {"publishTime": "2026-01-15T10:30:00Z", "startTime": "2026-01-16T00:00:00Z", "generation": 120},
                {"publishTime": "2026-01-15T12:30:00Z", "startTime": "2026-01-16T00:00:00Z", "generation": 999},
            ],
            "actuals": [
                {"publishTime": "2026-01-16T01:00:00Z", "startTime": "2026-01-16T00:00:00Z", "generation": 80},
                {"publishTime": "2026-01-16T01:00:00Z", "startTime": "2026-01-16T00:30:00Z", "generation": 100},
            ],
        }
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
            path = Path(folder) / "sample.gz"
            with gzip.open(path, "wt", encoding="utf-8") as file:
                json.dump(payload, file)
            model = WindAnalysis(path)
            before_day = model.day(date(2026, 1, 15), time(11))
            before = before_day["rows"][0]
            after = model.day(date(2026, 1, 15), time(13))["rows"][0]
        self.assertEqual(before["forecast"], 120)
        self.assertEqual(before["actual"], 90)
        self.assertEqual(before["error"], 30)
        self.assertEqual(before_day["newestForecastAgeMinutes"], 30)
        self.assertEqual(before_day["oldestForecastAgeMinutes"], 30)
        self.assertEqual(after["forecast"], 999)
        self.assertEqual(len(model.day(date(2026, 1, 15), time(11))["rows"]), 24)

    def test_metrics_skip_unmatched_hours(self):
        scored = metrics([
            {"forecast": 120, "actual": 100},
            {"forecast": None, "actual": 100},
            {"forecast": 80, "actual": 100},
        ])
        self.assertEqual(scored["count"], 2)
        self.assertEqual(scored["mae"], 20)
        self.assertEqual(scored["bias"], 0)
        self.assertEqual(scored["p90WindShortfall"], 18)
        self.assertEqual(scored["overforecastShare"], 50)
        self.assertEqual(scored["wape"], 20)

    def test_calibration_excludes_future_days_and_late_actual_revisions(self):
        payload = {
            "retrievedAt": "2026-02-02T00:00:00Z",
            "forecasts": [
                {"publishTime": "2026-01-01T09:00:00Z", "startTime": "2026-01-02T00:00:00Z", "generation": 120},
                {"publishTime": "2026-01-02T09:00:00Z", "startTime": "2026-01-03T00:00:00Z", "generation": 500},
            ],
            "actuals": [
                {"publishTime": "2026-01-02T00:30:00Z", "startTime": "2026-01-02T00:00:00Z", "generation": 80},
                {"publishTime": "2026-01-02T01:00:00Z", "startTime": "2026-01-02T00:30:00Z", "generation": 100},
                {"publishTime": "2026-01-05T00:00:00Z", "startTime": "2026-01-02T00:00:00Z", "generation": 0},
                {"publishTime": "2026-01-03T00:30:00Z", "startTime": "2026-01-03T00:00:00Z", "generation": 0},
                {"publishTime": "2026-01-03T01:00:00Z", "startTime": "2026-01-03T00:30:00Z", "generation": 0},
            ],
        }
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
            path = Path(folder) / "sample.gz"
            with gzip.open(path, "wt", encoding="utf-8") as file:
                json.dump(payload, file)
            model = WindAnalysis(path)
            early = model.calibration(date(2026, 1, 2), time(11))
            current = model.calibration(date(2026, 1, 3), time(11))
        self.assertEqual(early["metrics"]["count"], 0)
        self.assertEqual(current["eligibleDays"], 1)
        self.assertEqual(current["metrics"]["count"], 1)
        self.assertEqual(current["metrics"]["bias"], 30)
        self.assertEqual(current["metrics"]["p90WindShortfall"], 30)
        self.assertEqual(current["metrics"]["overforecastShare"], 100)

    def test_unknown_actual_publication_is_retrospective_only(self):
        payload = {
            "retrievedAt": "2026-02-02T00:00:00Z",
            "forecasts": [
                {"publishTime": "2026-01-01T09:00:00Z", "startTime": "2026-01-02T00:00:00Z", "generation": 100},
            ],
            "actuals": [
                {"startTime": "2026-01-02T00:00:00Z", "generation": 80},
                {"startTime": "2026-01-02T00:30:00Z", "generation": 100},
            ],
        }
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
            path = Path(folder) / "sample.gz"
            with gzip.open(path, "wt", encoding="utf-8") as file:
                json.dump(payload, file)
            model = WindAnalysis(path)
            retrospective = model.day(date(2026, 1, 1), time(11))
            decision_reference = model.calibration(date(2026, 1, 3), time(11))
        self.assertEqual(retrospective["rows"][0]["actual"], 90)
        self.assertEqual(decision_reference["metrics"]["count"], 0)


if __name__ == "__main__":
    unittest.main()
