import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'
import Charts from './Charts.jsx'
import LowStock from './LowStock.jsx'

export default function Dashboard() {
  const call = useAuthedApi()
  const [s, setS] = useState(null)
  const [error, setError] = useState('')
  const load = () => call('/api/admin/stats').then(setS).catch((e) => setError(e.message))
  useEffect(() => { load() }, [call]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="alert alert-error">{error}</p>
  if (!s) return <div className="skeleton-block" />
  const tiles = [
    { label: 'Orders today', value: s.orders_today, to: '/admin/orders' },
    { label: 'Sales today', value: rupees(s.sales_today), to: '/admin/orders' },
    { label: 'To pack', value: s.to_pack, to: '/admin/orders?status=confirmed', hot: s.to_pack > 0 },
    { label: 'To ship', value: s.to_ship, to: '/admin/orders?status=packed', hot: s.to_ship > 0 },
    { label: 'Needs review', value: s.needs_review, to: '/admin/orders?review=1', hot: s.needs_review > 0 },
    { label: 'Abandoned carts (7 days)', value: s.abandoned ?? 0, to: '/admin/abandoned', hot: s.abandoned > 0 },
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
      <p className="small muted stat-note">“Today” is counted in Indian time. Cancelled and unpaid orders are not counted.</p>
      <Charts />
      <LowStock items={s.low_stock} threshold={s.low_stock_threshold ?? 2} onChange={load} />
    </>
  )
}
