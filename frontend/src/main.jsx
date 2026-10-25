import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const number = value => value == null ? '—' : Math.round(value).toLocaleString('en-GB')
const signed = value => value == null ? '—' : `${value > 0 ? '+' : ''}${number(value)}`
const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
})
const shortDate = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC'
})
const timestamp = value => value ? new Date(value).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
}) : 'No eligible publication'

function initialTheme() {
  try {
    const saved = localStorage.getItem('winddesk-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* private browsing may disable storage */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function Icon({ name, size = 20 }) {
  const paths = {
    wind: <><path d="M3 8h12a3 3 0 1 0-3-3"/><path d="M2 12h18a2 2 0 1 1-2 2"/><path d="M4 16h7a3 3 0 1 1-3 3"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m6 15 4-4 3 2 6-7"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function LineChart({ rows }) {
  const [hover, setHover] = useState(null)
  const values = rows.flatMap(row => [row.forecast, row.actual]).filter(value => value != null)
  if (!values.length) return <div className="empty">No comparable observations for this delivery day.</div>
  const min = Math.floor(Math.min(...values) / 2000) * 2000
  const max = Math.ceil(Math.max(...values) / 2000) * 2000 || 2000
  const width = 880, height = 290, left = 58, right = 18, top = 18, bottom = 42
  const x = index => left + index * (width - left - right) / 23
  const y = value => top + (max - value) * (height - top - bottom) / (max - min || 1)
  const lines = key => {
    const segments = []
    let current = []
    rows.forEach((row, index) => {
      if (row[key] == null) {
        if (current.length) segments.push(current)
        current = []
      } else current.push(`${x(index)},${y(row[key])}`)
    })
    if (current.length) segments.push(current)
    return segments.map((points, index) => <polyline key={index} points={points.join(' ')} className={`series ${key}`} />)
  }
  const ticks = [0, .25, .5, .75, 1].map(fraction => min + (max - min) * fraction)
  return <div className="chart-wrap">
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Hourly wind forecast and actual generation in megawatts">
      {ticks.map(tick => <g key={tick}>
        <line className="grid-line" x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} />
        <text className="axis-label" x={left-12} y={y(tick)+4} textAnchor="end">{number(tick/1000)}k</text>
      </g>)}
      {[0,4,8,12,16,20,23].map(index => <text key={index} className="axis-label" x={x(index)} y={height-9} textAnchor="middle">{rows[index].label}</text>)}
      {lines('forecast')}{lines('actual')}
      {hover != null && <g>
        <line className="hover-line" x1={x(hover)} x2={x(hover)} y1={top} y2={height-bottom} />
        {['forecast','actual'].map(key => rows[hover][key] != null && <circle key={key} className={`chart-point ${key}`} cx={x(hover)} cy={y(rows[hover][key])} r="5" />)}
      </g>}
      <rect x={left} y={top} width={width-left-right} height={height-top-bottom} fill="transparent"
        onMouseMove={event => {
          const svg = event.currentTarget.ownerSVGElement
          const point = svg.createSVGPoint()
          point.x = event.clientX; point.y = event.clientY
          const local = point.matrixTransform(svg.getScreenCTM().inverse())
          setHover(Math.max(0, Math.min(23, Math.round((local.x-left)/(width-left-right)*23))))
        }}
        onMouseLeave={() => setHover(null)} />
    </svg>
    {hover != null && <div className="chart-tooltip">
      <strong>{rows[hover].label} UTC</strong>
      <span><i className="dot forecast"/>Forecast {number(rows[hover].forecast)} MW</span>
      <span><i className="dot actual"/>Actual {number(rows[hover].actual)} MW</span>
      <small>Published {timestamp(rows[hover].publishTime)}</small>
    </div>}
  </div>
}

function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [date, setDate] = useState('2026-01-15')
  const [cutoff, setCutoff] = useState('11:00')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('chart')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('winddesk-theme', theme) } catch { /* storage is optional */ }
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`/api/dashboard?date=${date}&cutoff=${cutoff}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json()).detail || 'Could not load the Elexon snapshot')
        return response.json()
      })
      .then(setData)
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [date, cutoff])

  const selected = data?.selected
  const overview = data?.overview
  const calibration = data?.calibration
  const newest = useMemo(() => selected?.rows.reduce((best, row) =>
    row.publishTime && (!best || row.publishTime > best) ? row.publishTime : best, null), [selected])
  const forecastGwh = selected?.rows.reduce((sum, row) => sum + (row.forecast ?? 0) / 1000, 0)
  const actualGwh = selected?.rows.reduce((sum, row) => sum + (row.actual ?? 0) / 1000, 0)
  const historicalBand = calibration?.metrics.p90AbsoluteError
  const bias = calibration?.metrics.bias

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Icon name="wind" size={24}/></div><div><strong>Winddesk</strong><small>Decision intelligence</small></div></div>
      <div className="side-section">WORKSPACE</div>
      <div className="side-link active"><Icon name="chart" size={18}/> Wind outlook</div>
      <div className="side-section controls-title">DECISION CONTEXT</div>
      <label className="field-label" htmlFor="decision-date">Purchase date</label>
      <input id="decision-date" type="date" min="2026-01-01" max="2026-01-31" value={date} onChange={event => setDate(event.target.value)}/>
      <label className="field-label" htmlFor="cutoff">Decision cutoff · UK time</label>
      <input id="cutoff" type="time" value={cutoff} onChange={event => setCutoff(event.target.value)}/>
      <p className="side-note"><Icon name="info" size={16}/> The forecast is reconstructed as it stood at this cutoff.</p>
      <div className="sidebar-foot"><span className="status-dot"/> January 2026 pilot <small>Elexon snapshot · UK national wind</small></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="breadcrumb">Workspace <span>/</span> <b>Wind outlook</b></div>
        <div className="top-actions"><span className="pilot-badge"><span className="status-dot"/> Historical pilot</span>
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18}/>
          </button>
        </div>
      </header>
      <div className="content">
        <div className="page-heading">
          <div><div className="eyebrow"><span className="eyebrow-dot"/> DAY-AHEAD WIND INTELLIGENCE</div>
            <h1>Wind outlook</h1>
            <p>See the wind forecast available when the purchase decision was made, and the historical error known at that time.</p>
          </div>
          <div className="heading-art" aria-hidden="true"><Icon name="wind" size={44}/></div>
        </div>
        {error && <div className="alert" role="alert">{error}</div>}
        {loading && <div className="loading" role="status">Loading Elexon snapshot…</div>}
        {selected && !loading && <>
          <div className="section-heading">
            <div><div className="section-kicker">DECISION SNAPSHOT</div><h2>{dateLabel(selected.deliveryDate)} <span>delivery</span></h2></div>
            <div className="asof"><Icon name="clock" size={17}/> As known by <strong>{cutoff} UTC · {shortDate(date)}</strong></div>
          </div>
          <div className="kpi-grid">
            <div className="kpi feature"><span className="kpi-label">Forecast wind energy</span><div className="kpi-value">{selected.forecastCoverage === 24 ? forecastGwh.toFixed(1) : '—'} <small>GWh</small></div><div className="kpi-sub">{selected.forecastCoverage === 24 ? '24 hourly forecast periods' : 'Full-day total unavailable · missing hours'}</div><Icon name="wind" size={44}/></div>
            <div className="kpi"><span className="kpi-label">Latest publication used</span><div className="kpi-value compact">{newest ? new Date(newest).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'UTC' }) : '—'} <small>UTC</small></div><div className="kpi-sub">{newest ? shortDate(newest.slice(0,10)) : 'No eligible forecast'}</div></div>
            <div className="kpi"><span className="kpi-label">Forecast coverage</span><div className="kpi-value">{selected.forecastCoverage}<small> / 24</small></div><div className="kpi-sub">Hourly delivery periods</div></div>
            <div className="kpi"><span className="kpi-label">Actual wind energy</span><div className="kpi-value">{selected.actualCoverage === 24 ? actualGwh.toFixed(1) : '—'} <small>GWh</small></div><div className="kpi-sub">Retrospective review only</div></div>
          </div>

          <div className="decision-panel">
            <div className="decision-icon"><Icon name="chart" size={21}/></div>
            <div className="decision-copy"><div className="section-kicker">KNOWN AT DECISION TIME</div><h3>Historical error reference</h3>
              {calibration.metrics.count ? <p>Based on {calibration.metrics.count} matched hours from complete delivery days through {shortDate(calibration.lastDeliveryDate)}.</p>
                : <p>No complete prior January delivery day is available at this cutoff.</p>}
            </div>
            <div className="decision-stats">
              <div><span>90% of past hourly misses within</span><strong>{historicalBand == null ? '—' : `±${number(historicalBand)}`} <small>MW</small></strong></div>
              <div><span>Average forecast bias</span><strong>{signed(bias)} <small>MW</small></strong></div>
            </div>
          </div>
          <p className="decision-note"><Icon name="info" size={15}/> Historical reference only; the ± value is an empirical 90th percentile, not a predictive guarantee. Positive bias means the forecast exceeded actual wind.</p>

          <div className="panel chart-panel">
            <div className="panel-header"><div><div className="section-kicker">DELIVERY PROFILE</div><h3>Forecast vs. actual generation</h3><p>Hourly profile for {dateLabel(selected.deliveryDate)} · MW</p></div>
              <div className="legend"><span><i className="dot forecast"/>Selected forecast</span><span><i className="dot actual"/>Actual outturn</span></div>
            </div>
            <div className="tabs" role="tablist" aria-label="Delivery profile view">
              <button role="tab" aria-selected={tab === 'chart'} className={tab === 'chart' ? 'selected' : ''} onClick={() => setTab('chart')}>Chart view</button>
              <button role="tab" aria-selected={tab === 'table'} className={tab === 'table' ? 'selected' : ''} onClick={() => setTab('table')}>Data table</button>
            </div>
            {tab === 'chart' ? <LineChart rows={selected.rows}/> : <div className="table-scroll"><table>
              <thead><tr><th>Hour UTC</th><th>Forecast MW</th><th>Actual MW</th><th>Error MW</th><th>Published UTC</th></tr></thead>
              <tbody>{selected.rows.map(row => <tr key={row.startTime}><td>{row.label}</td><td>{number(row.forecast)}</td><td>{number(row.actual)}</td><td className={row.error > 0 ? 'error-up' : 'error-down'}>{signed(row.error)}</td><td>{timestamp(row.publishTime)}</td></tr>)}</tbody>
            </table></div>}
          </div>

          <div className="lower-grid">
            <div className="panel"><div className="section-kicker">JANUARY BACKTEST · RETROSPECTIVE</div><h3>Forecast accuracy</h3>
              <p className="panel-intro">All January purchase decisions scored against next-day outturn at the {cutoff} cutoff. Later outcomes are included here for review.</p>
              <div className="metric-list">
                <div><span>Mean absolute error</span><strong>{number(overview.metrics.mae)} <small>MW</small></strong></div>
                <div><span>Bias · forecast minus actual</span><strong>{signed(overview.metrics.bias)} <small>MW</small></strong></div>
                <div><span>90th percentile absolute error</span><strong>{number(overview.metrics.p90AbsoluteError)} <small>MW</small></strong></div>
                <div><span>Weighted absolute error</span><strong>{overview.metrics.wape ?? '—'} <small>%</small></strong></div>
              </div>
              <div className="coverage"><span className="status-dot"/>{number(overview.metrics.count)} matched of {number(overview.expectedPeriods)} hours</div>
            </div>
            <div className="panel"><div className="section-kicker">DAILY PERFORMANCE · RETROSPECTIVE</div><h3>Where forecasts missed</h3>
              <p className="panel-intro">Mean absolute error by purchase date · MW. Select a day to inspect its profile.</p>
              <div className="day-grid">{overview.days.map(day => <button key={day.decisionDate} type="button"
                title={`${day.decisionDate}: ${number(day.metrics.mae)} MW MAE, ${day.metrics.count}/24 matched`}
                aria-label={`January ${Number(day.decisionDate.slice(-2))}: ${number(day.metrics.mae)} MW mean absolute error`}
                aria-current={day.decisionDate === date ? 'date' : undefined}
                className={day.decisionDate === date ? 'current' : ''}
                onClick={() => setDate(day.decisionDate)}
                style={{ '--intensity': day.metrics.mae ? Math.min(1, day.metrics.mae / 3500) : 0 }}><span>{Number(day.decisionDate.slice(-2))}</span></button>)}</div>
              <div className="scale"><span>Lower error</span><div className="scale-bar"/><span>Higher error</span></div>
              <p className="heat-note">Missing hours are excluded from accuracy metrics.</p>
            </div>
          </div>
          <footer className="footer"><span><a href="https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/" target="_blank" rel="noreferrer">Contains BMRS data © Elexon Limited copyright and database right 2026.</a> WINDFOR and FUELHH (WIND)</span><span>Snapshot retrieved {timestamp(overview.retrievedAt)} · All times UTC (UK winter time)</span></footer>
        </>}
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
