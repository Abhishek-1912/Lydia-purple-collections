import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'

const STEPS = [['view', 'Viewed a saree'], ['cart', 'Added to cart'], ['checkout', 'Started checkout'], ['order', 'Placed an order']]

export default function Analytics() {
  const call = useAuthedApi()
  const [days, setDays] = useState(30)
  const [a, setA] = useState(null)
  useEffect(() => { setA(null); call(`/api/admin/analytics?days=${days}`).then(setA).catch(() => setA(false)) }, [call, days])
  if (a === false) return <p className="alert alert-error">Could not load analytics.</p>
  const f = a?.funnel
  const max = f ? Math.max(1, f.sessions.view) : 1
  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-h">Analytics</h1>
        <div className="chips">{[7, 30, 90].map((d) => <button key={d} className={`chip ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d} days</button>)}</div>
      </div>
      <p className="small muted">Anonymous visitors (no names or phones). Counting started when this was switched on, so numbers grow over time.</p>
      {!a ? <div className="skeleton-block" /> : (
        <>
          <div className="stat-grid three">
            <div className={`stat ${f.checkout_to_order >= 45 ? '' : 'hot'}`}><span className="stat-value">{f.checkout_to_order}%</span><span className="stat-label">Checkout → order (goal 45%)</span></div>
            <div className="stat"><span className="stat-value">{a.repeat_rate}%</span><span className="stat-label">Repeat customers ({a.repeat_customers} of {a.customers})</span></div>
            <div className="stat"><span className="stat-value">{a.cod_share}%</span><span className="stat-label">Orders paid by COD</span></div>
          </div>
          <section className="card">
            <h2 className="h-sm">From visit to order</h2>
            <ul className="funnel">
              {STEPS.map(([k, label], i) => (
                <li key={k}>
                  <span className="funnel-label">{label}</span>
                  <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(f.sessions[k] / max) * 100}%` }} /></span>
                  <span className="funnel-n">{f.sessions[k]}</span>
                  {i > 0 && <span className="funnel-pct">{[f.view_to_cart, f.cart_to_checkout, f.checkout_to_order][i - 1]}%</span>}
                </li>
              ))}
            </ul>
            <p className="small muted">{f.overall}% of visitors who viewed a saree went on to order.</p>
          </section>
          <section className="card">
            <h2 className="h-sm">Most viewed sarees</h2>
            {a.products.length ? (
              <table className="an-table">
                <thead><tr><th>Product</th><th>Viewed</th><th>Added to cart</th><th>Sold</th></tr></thead>
                <tbody>{a.products.map((p) => (
                  <tr key={p.slug}><td><a href={`/products/${p.slug}`} target="_blank" rel="noreferrer">{p.name}</a></td><td>{p.views}</td><td>{p.carts}{p.views ? ` (${Math.round((p.carts / p.views) * 100)}%)` : ''}</td><td>{p.sold}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="muted small">No views recorded yet.</p>}
            <p className="small muted">Many views but few carts? Try better photos, a video, or a price check.</p>
          </section>
        </>
      )}
    </>
  )
}
