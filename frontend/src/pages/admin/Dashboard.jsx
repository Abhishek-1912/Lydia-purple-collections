import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'
import Charts from './Charts.jsx'

export default function Dashboard() {
  const call = useAuthedApi()
  const [s, setS] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { call('/api/admin/stats').then(setS).catch((e) => setError(e.message)) }, [call])

  if (error) return <p className="alert alert-error">{error}</p>
  if (!s) return <div className="skeleton-block" />
  const tiles = [
    { label: 'Orders today', value: s.orders_today, to: '/admin/orders' },
    { label: 'Sales today', value: rupees(s.sales_today), to: '/admin/orders' },
    { label: 'To pack', value: s.to_pack, to: '/admin/orders?status=confirmed', hot: s.to_pack > 0 },
    { label: 'To ship', value: s.to_ship, to: '/admin/orders?status=packed', hot: s.to_ship > 0 },
    { label: 'Needs review', value: s.needs_review, to: '/admin/orders?review=1', hot: s.needs_review > 0 },
  ]
  return (
    <>
      <h1 className="admin-h">Dashboard</h1>
      <Link to="/admin/add" className="easy-cta">
        <span className="easy-big">➕📸</span>
        <span><strong>Add a new product</strong><br /><small>Take photos, tap the type, price and colours — done in a minute</small></span>
      </Link>
      <div className="stat-grid">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className={`stat ${t.hot ? 'hot' : ''}`}>
            <span className="stat-value">{t.value}</span>
            <span className="stat-label">{t.label}</span>
          </Link>
        ))}
      </div>
      <Charts />
      <h2 className="admin-h2">Low stock (2 or fewer)</h2>
      {s.low_stock.length ? (
        <ul className="low-list">
          {s.low_stock.map((v, i) => (
            <li key={i}>
              <Link to={`/admin/products/${v.product_id}`}>{v.name}</Link>
              <span className="muted"> {[v.color, v.size].filter(Boolean).join(' / ')}</span>
              <span className={`pill ${v.stock === 0 ? 'pill-red' : 'pill-amber'}`}>{v.stock === 0 ? 'Sold out' : `${v.stock} left`}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted">All stocked up.</p>}
      <p className="small muted">“Today” is counted in Indian time. Cancelled and unpaid orders are not counted.</p>
    </>
  )
}
