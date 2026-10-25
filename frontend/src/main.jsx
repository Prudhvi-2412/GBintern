import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const int = (n) => n == null ? '—' : Math.round(n).toLocaleString('en-GB')
const signed = (n) => n == null ? '—' : `${n > 0 ? '+' : ''}${int(n)}`
const fmtDate = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const stamp = (s) => s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : 'No eligible publication'

function Icon({ name, size = 20 }) {
  const paths = {
    wind: <><path d="M3 8h12a3 3 0 1 0-3-3"/><path d="M2 12h18a2 2 0 1 1-2 2"/><path d="M4 16h7a3 3 0 1 1-3 3"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m6 15 4-4 3 2 6-7"/></>,
    check: <><path d="m4 12 5 5L20 6"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
    arrow: <path d="m5 12 14 0m-6-6 6 6-6 6"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function LineChart({ rows }) {
  const [hover, setHover] = useState(null)
  const values = rows.flatMap(r => [r.forecast, r.actual]).filter(v => v != null)
  if (!values.length) return <div className="empty">No comparable observations for this decision date.</div>
  const min = Math.floor(Math.min(...values) / 2000) * 2000
  const max = Math.ceil(Math.max(...values) / 2000) * 2000 || 2000
  const width = 880, height = 270, left = 58, right = 16, top = 16, bottom = 36
  const x = i => left + i * (width - left - right) / 23
  const y = v => top + (max - v) * (height - top - bottom) / (max - min || 1)
  const segments = key => {
    const result = []; let current = []
    rows.forEach((r, i) => {
      if (r[key] == null) { if (current.length) result.push(current); current = [] }
      else current.push(`${x(i)},${y(r[key])}`)
    })
    if (current.length) result.push(current)
    return result.map((pts, i) => <polyline key={i} points={pts.join(' ')} fill="none" stroke={key === 'forecast' ? '#72d5ee' : '#f6bb80'} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)
  }
  const ticks = [0, .25, .5, .75, 1].map(f => min + (max - min) * f)
  return <div className="chart-wrap">
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Hourly wind forecast and actual generation in MW">
      {ticks.map(t => <g key={t}><line x1={left} x2={width-right} y1={y(t)} y2={y(t)} stroke="#26384b" strokeDasharray="4 6"/><text x={left-12} y={y(t)+4} textAnchor="end" fill="#8fa5b8" fontSize="12">{int(t/1000)}k</text></g>)}
      {[0,4,8,12,16,20,23].map(i => <text key={i} x={x(i)} y={height-7} textAnchor="middle" fill="#8fa5b8" fontSize="12">{rows[i].label}</text>)}
      {segments('forecast')}{segments('actual')}
      {hover != null && <g><line x1={x(hover)} x2={x(hover)} y1={top} y2={height-bottom} stroke="#b6cad8" strokeDasharray="3 5" opacity=".7"/>{['forecast','actual'].map(k => rows[hover][k] != null && <circle key={k} cx={x(hover)} cy={y(rows[hover][k])} r="5" fill={k === 'forecast' ? '#72d5ee' : '#f6bb80'} stroke="#0d1b2b" strokeWidth="2"/>)}</g>}
      <rect x={left} y={top} width={width-left-right} height={height-top-bottom} fill="transparent" onMouseMove={e => { const p = e.currentTarget.ownerSVGElement.createSVGPoint(); p.x=e.clientX;p.y=e.clientY;const svgP=p.matrixTransform(e.currentTarget.ownerSVGElement.getScreenCTM().inverse());setHover(Math.max(0,Math.min(23,Math.round((svgP.x-left)/(width-left-right)*23)))) }} onMouseLeave={() => setHover(null)}/>
    </svg>
    {hover != null && <div className="chart-tooltip"><strong>{rows[hover].label} UTC</strong><span><i className="dot forecast"/>Forecast {int(rows[hover].forecast)} MW</span><span><i className="dot actual"/>Actual {int(rows[hover].actual)} MW</span><small>Published {stamp(rows[hover].publishTime)}</small></div>}
  </div>
}

function App() {
  const [date, setDate] = useState('2026-01-15')
  const [cutoff, setCutoff] = useState('11:00')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('chart')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    fetch(`/api/dashboard?date=${date}&cutoff=${cutoff}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error((await r.json()).detail || 'Could not load data'); return r.json() })
      .then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [date, cutoff])
  const selected = data?.selected, overview = data?.overview
  const newest = useMemo(() => selected?.rows.reduce((best, row) => row.publishTime && (!best || row.publishTime > best) ? row.publishTime : best, null), [selected])
  const forecastGwh = selected?.rows.reduce((s,r) => s + (r.forecast ?? 0) / 1000, 0)
  const actualGwh = selected?.rows.reduce((s,r) => s + (r.actual ?? 0) / 1000, 0)
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Icon name="wind" size={25}/></div><div><strong>WIND<span>DESK</span></strong><small>Decision intelligence</small></div></div>
      <div className="side-label">PILOT WORKSPACE</div>
      <div className="side-link active"><Icon name="chart" size={18}/> Overview <span className="active-pip"/></div>
      <div className="side-divider"/>
      <div className="side-label">DECISION CONTEXT</div>
      <label className="field-label" htmlFor="decision-date">Purchase decision</label>
      <input id="decision-date" type="date" min="2026-01-01" max="2026-01-31" value={date} onChange={e => setDate(e.target.value)}/>
      <label className="field-label" htmlFor="cutoff">Decision cutoff · UK time</label>
      <input id="cutoff" type="time" value={cutoff} onChange={e => setCutoff(e.target.value)}/>
      <p className="side-note"><Icon name="info" size={16}/> Select the time by which your team must commit its day-ahead purchase.</p>
      <div className="side-bottom"><span className="source-dot"/> Elexon data snapshot<br/><small>January 2026 pilot</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Wind generation <span>/</span> <b>Overview</b></div><div className="top-status"><span className="pulse"/> HISTORICAL PILOT</div></header>
      <div className="content">
        <div className="hero"><div><div className="eyebrow">DAY-AHEAD WIND INTELLIGENCE <span className="eyebrow-line"/></div><h1>Know the wind.<br/><em>Price the uncertainty.</em></h1><p>See the forecast your team actually had at decision time, then measure how it performed against generation outturn.</p></div><div className="hero-art" aria-hidden="true"><div className="art-circle c1"/><div className="art-circle c2"/><div className="art-circle c3"/><div className="art-wind"><Icon name="wind" size={83}/></div></div></div>
        {error && <div className="alert">{error}</div>}
        {loading && <div className="loading">Loading Elexon snapshot…</div>}
        {selected && !loading && <>
          <div className="section-heading"><div><div className="section-kicker">DECISION SNAPSHOT</div><h2>{fmtDate(selected.deliveryDate)} <span>delivery</span></h2></div><div className="asof"><Icon name="clock" size={18}/> As known by <strong>{cutoff} UTC · {fmtDate(date)}</strong></div></div>
          <div className="kpi-grid">
            <div className="kpi feature"><span className="kpi-label">Forecast wind energy</span><div className="kpi-value">{selected.forecastCoverage === 24 ? forecastGwh.toFixed(1) : '—'} <small>GWh</small></div><div className="kpi-sub">{selected.forecastCoverage === 24 ? 'Sum of 24 hourly forecasts' : 'Full-day total unavailable: missing hours'}</div><div className="kpi-decoration"><Icon name="wind" size={58}/></div></div>
            <div className="kpi"><span className="kpi-label">Latest publication used</span><div className="kpi-value smaller">{newest ? new Date(newest).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}) : '—'} <small>UTC</small></div><div className="kpi-sub">{newest ? fmtDate(newest.slice(0,10)) : 'No eligible forecast'}</div></div>
            <div className="kpi"><span className="kpi-label">Forecast coverage</span><div className="kpi-value">{selected.forecastCoverage}<small> / 24</small></div><div className="kpi-sub">Hourly delivery periods</div></div>
            <div className="kpi"><span className="kpi-label">Actual wind energy</span><div className="kpi-value">{selected.actualCoverage === 24 ? actualGwh.toFixed(1) : '—'} <small>GWh</small></div><div className="kpi-sub">{selected.actualCoverage === 24 ? 'Shown for retrospective review' : 'Full-day total unavailable: missing hours'}</div></div>
          </div>
          <div className="insight-strip"><div className="insight-icon"><Icon name="info" size={20}/></div><p><strong>How to read this:</strong> A forecast above actual wind means less generation arrived than expected, increasing the power requirement elsewhere. Hourly forecasts are compared with the mean of two half-hour actuals. This pilot cannot calculate your utility’s purchase volume without demand and existing contracts.</p></div>
          <div className="panel chart-panel"><div className="panel-header"><div><div className="section-kicker">DELIVERY PROFILE</div><h3>Forecast vs. actual generation</h3><p>Every hour on {fmtDate(selected.deliveryDate)} · MW</p></div><div className="legend"><span><i className="dot forecast"/>Selected forecast</span><span><i className="dot actual"/>Actual outturn</span></div></div><div className="tabs"><button className={tab==='chart'?'selected':''} onClick={()=>setTab('chart')}>Chart view</button><button className={tab==='table'?'selected':''} onClick={()=>setTab('table')}>Data table</button></div>{tab==='chart'?<LineChart rows={selected.rows}/>:<div className="table-scroll"><table><thead><tr><th>Hour UTC</th><th>Forecast MW</th><th>Actual MW</th><th>Error MW</th><th>Forecast published UTC</th></tr></thead><tbody>{selected.rows.map(r=><tr key={r.startTime}><td>{r.label}</td><td>{int(r.forecast)}</td><td>{int(r.actual)}</td><td className={r.error>0?'positive':'negative'}>{signed(r.error)}</td><td>{stamp(r.publishTime)}</td></tr>)}</tbody></table></div>}</div>
          <div className="lower-grid"><div className="panel"><div className="section-kicker">JANUARY BACKTEST</div><h3>Forecast accuracy</h3><p className="panel-intro">All purchase decisions in January, scored against the next day’s outturn at the selected {cutoff} cutoff.</p><div className="metric-list"><div><span>Mean absolute error</span><strong>{int(overview.metrics.mae)} <small>MW</small></strong></div><div><span>Bias · forecast minus actual</span><strong className={overview.metrics.bias>0?'positive':'negative'}>{signed(overview.metrics.bias)} <small>MW</small></strong></div><div><span>90th percentile absolute error</span><strong>{int(overview.metrics.p90AbsoluteError)} <small>MW</small></strong></div><div><span>Weighted absolute error</span><strong>{overview.metrics.wape ?? '—'}<small>%</small></strong></div></div><div className="coverage"><Icon name="check" size={17}/>{int(overview.metrics.count)} matched of {int(overview.expectedPeriods)} hours</div></div><div className="panel"><div className="section-kicker">DAILY PERFORMANCE</div><h3>Where forecasts missed</h3><p className="panel-intro">Mean absolute error by purchase date · MW. Select a day to inspect its profile.</p><div className="day-grid">{overview.days.map(d=><button key={d.decisionDate} title={`${d.decisionDate}: ${int(d.metrics.mae)} MW MAE, ${d.metrics.count}/24 matched`} className={d.decisionDate===date?'current':''} onClick={()=>setDate(d.decisionDate)} style={{'--intensity':d.metrics.mae ? Math.min(1,d.metrics.mae/3500):0}}><span>{Number(d.decisionDate.slice(-2))}</span></button>)}</div><div className="scale"><span>Lower error</span><div className="scale-bar"/><span>Higher error</span></div><p className="heat-note">Each square is a January purchase decision. Missing hours are excluded from accuracy metrics.</p></div></div>
          <footer className="footer"><span><a href="https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/" target="_blank" rel="noreferrer">Contains BMRS data © Elexon Limited copyright and database right 2026.</a> WINDFOR and FUELHH (WIND)</span><span>Snapshot retrieved {stamp(overview.retrievedAt)} · All times UTC (UK winter time)</span></footer>
        </>}
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
