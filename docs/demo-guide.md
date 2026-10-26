# Video guide (maximum 10 minutes total)

Record the running product with clear audio and cursor visibility. The first five minutes are a customer pitch; the next five are a technical review. Replace the URL placeholders after deployment, then publish as an **unlisted** YouTube video and verify it in an incognito window.

## Part 1 — Customer pilot overview (0:00–4:40)

| Time | Screen/action | Key message |
| --- | --- | --- |
| 0:00–0:35 | Dashboard hero and decision controls | "This is the forecast your buyer could see before committing tomorrow's power purchase." |
| 0:35–1:30 | Select 15 January at 11:00; point to delivery date, latest publication, forecast age, 24/24 coverage | Publication timing is preserved; later forecasts do not contaminate the decision view. |
| 1:30–2:25 | Hover forecast and actual lines, then open data table | Each delivery hour is traceable to its forecast publication and later actual outturn. |
| 2:25–3:35 | Show the prior-only wind shortfall reference, then monthly MAE, bias and daily heat map; click a high-error day | The buyer sees what historical shortfall was known at decision time, while the full backtest remains clearly retrospective. |
| 3:35–4:40 | Change decision cutoff and explain scope | Earlier decisions can have older forecasts. The app informs wind risk; demand and existing contracts are needed to calculate the utility's exact purchase volume. |

## Part 2 — Technical-lead overview (4:40–9:30)

| Time | Screen/action | Key message |
| --- | --- | --- |
| 4:40–5:30 | Repository tree and README | React/Vite UI, FastAPI, snapshot ingestion, Docker, tests, Vercel configuration. |
| 5:30–6:30 | `scripts/fetch_elexon.py` and snapshot metadata | Chunked Elexon publication-time fetches; only WINDFOR and WIND FUELHH; deterministic compact snapshot. |
| 6:30–7:40 | `backend/analysis.py` | As-of selection by `publishTime <= cutoff`; hourly WINDFOR aligned with mean of two half-hour actuals; missing data excluded with coverage shown. |
| 7:40–8:30 | `backend/main.py`, API docs, React component | Validated date/cutoff, one dashboard response, forecast freshness and missing-hour warning, no extra data source. |
| 8:30–9:30 | Run tests and build, show Docker/production page | Meaningful tests cover forecast leakage and alignment. Discuss limitations: historical pilot, illustrative default cutoff, and no procurement quantity without demand and contract position. |

Before submitting, verify the deployed app, public GitHub repo, and unlisted video links in an incognito session; update README with the live app URL and submit those links in the specified Microsoft form.
