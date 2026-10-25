from __future__ import annotations

from datetime import date, time
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .analysis import WindAnalysis

app = FastAPI(title="Wind Decision Desk", version="1.0.0")


@lru_cache(maxsize=1)
def analysis() -> WindAnalysis:
    return WindAnalysis()


def checked_cutoff(value: str) -> time:
    try:
        parsed = time.fromisoformat(value)
        if parsed.tzinfo is not None:
            raise ValueError
        return parsed
    except ValueError:
        raise HTTPException(status_code=422, detail="Cutoff must be HH:MM in UK local time") from None


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "snapshotRetrievedAt": analysis().retrieved_at}


@app.get("/api/dashboard")
def dashboard(
    decision_date: date = Query(default=date(2026, 1, 15), alias="date"),
    cutoff: str = "11:00",
) -> dict:
    if not date(2026, 1, 1) <= decision_date <= date(2026, 1, 31):
        raise HTTPException(status_code=422, detail="Decision date must be in January 2026")
    cutoff_time = checked_cutoff(cutoff)
    return {
        "selected": analysis().day(decision_date, cutoff_time),
        "calibration": analysis().calibration(decision_date, cutoff_time),
        "overview": analysis().overview(cutoff_time),
    }


DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    def index_response() -> FileResponse:
        # The HTML points at versioned Vite assets; always recheck it after a deploy.
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-store"})

    @app.get("/{path:path}")
    def spa(path: str):
        candidate = DIST / path
        if path and candidate.is_file() and candidate.resolve().is_relative_to(DIST.resolve()):
            return FileResponse(candidate)
        return index_response()
