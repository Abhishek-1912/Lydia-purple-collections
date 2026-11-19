import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'

// Lightweight CSS/SVG charts (no chart library → admin stays fast on phones).
function Bars({ days }) {
  const max = Math.max(1, ...days.map((d) => d.sales))
  const W = 600, H = 160, bw = W / days.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="bars" role="img" aria-label="Sales per day">
      {days.map((d, i) => {
        const h = Math.round((d.sales / max) * H)
        const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        return (
          <g key={d.date}>
            <rect x={i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={Math.max(h, d.sales ? 2 : 0)} rx="2" className="bar">
              <title>{`${label}: ${rupees(d.sales)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`}</title>
            </rect>
            {(i % Math.ceil(days.length / 6) === 0) && <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" className="bar-label">{label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function HBars({ rows, value, label, fmt = (v) => v }) {
  const max = Math.max(1, ...rows.map(value))
  if (!rows.length) return <p className="small muted">No data yet.</p>
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={label(r)}>
          <span className="hbar-name">{label(r)}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(value(r) / max) * 100}%` }} /></span>
          <span className="hbar-val">{fmt(value(r))}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Charts() {
  const call = useAuthedApi()
  const [days, setDays] = useState(30)
  const [c, setC] = useState(null)
  useEffect(() => { setC(null); call(`/api/admin/stats/charts?days=${days}`).then(setC).catch(() => setC(false)) }, [call, days])
  if (c === false) return null

  const totalPay = c ? c.payment.cod + c.payment.razorpay : 0
  return (
    <section className="charts">
      <div className="admin-title-row">
        <h2 className="admin-h2">Sales</h2>
        <div className="chips">{[7, 30, 90].map((d) => <button key={d} className={`chip ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d} days</button>)}</div>
      </div>
      {!c ? <div className="skeleton-block" /> : (
        <>
          <div className="stat-grid three">
            <div className="stat"><span className="stat-value">{rupees(c.total_sales)}</span><span className="stat-label">Sales</span></div>
            <div className="stat"><span className="stat-value">{c.total_orders}</span><span className="stat-label">Orders</span></div>
            <div className="stat"><span className="stat-value">{rupees(c.avg_order)}</span><span className="stat-label">Average order</span></div>
          </div>
          <div className="card"><Bars days={c.days} /></div>
          <div className="chart-grid">
            <div className="card">
              <h3 className="h-sm">Top products</h3>
              <HBars rows={c.top_products} value={(r) => r.sales} label={(r) => r.name} fmt={rupees} />
            </div>
            <div className="card">
              <h3 className="h-sm">Orders by state</h3>
              <HBars rows={c.states} value={(r) => r.orders} label={(r) => r.state} />
            </div>
            <div className="card">
              <h3 className="h-sm">Payment method</h3>
              <HBars rows={[{ k: 'Cash on Delivery', v: c.payment.cod }, { k: 'Online', v: c.payment.razorpay }]} value={(r) => r.v} label={(r) => r.k}
                fmt={(v) => `${v}${totalPay ? ` (${Math.round((v / totalPay) * 100)}%)` : ''}`} />
              <p className="small muted">{c.cancelled} cancelled in this period.</p>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
