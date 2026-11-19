import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'

export default function Customers() {
  const call = useAuthedApi()
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { call('/api/admin/customers').then(setList).catch((e) => setError(e.message)) }, [call])

  async function toggleBlock(c) {
    const block = !c.cod_blocked
    const reason = block ? window.prompt(`Block Cash on Delivery for +91 ${c.phone}?\nReason (optional):`, 'Refused delivery') : null
    if (block && reason === null) return
    await call(`/api/admin/blocked-phones/${c.phone}`, { method: 'PUT', body: { blocked: block, reason } })
    setList((all) => all.map((x) => x.phone === c.phone ? { ...x, cod_blocked: block } : x))
  }

  const t = q.trim().toLowerCase()
  const shown = (list || []).filter((c) => !t || (c.name || '').toLowerCase().includes(t) || c.phone.includes(t) || (c.email || '').toLowerCase().includes(t))
  const repeat = (list || []).filter((c) => c.orders > 1).length

  return (
    <>
      <h1 className="admin-h">Customers</h1>
      {list && <p className="small muted">{list.length} customers · {repeat} repeat ({list.length ? Math.round((repeat / list.length) * 100) : 0}%) · grouped by phone number</p>}
      <div className="search">
        <label htmlFor="cq" className="sr-only">Search customers</label>
        <input id="cq" type="search" placeholder="Name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {!list ? <div className="skeleton-block" /> : shown.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>No customers yet.</p> : (
        <ul className="coupon-list" style={{ marginTop: 12 }}>
          {shown.map((c) => (
            <li key={c.phone} className="card">
              <div>
                <strong>{c.name}</strong>{c.has_account && <span className="pill">Account</span>}{c.cod_blocked && <span className="pill pill-red">COD blocked</span>}
                <p className="small muted">+91 {c.phone}{c.email ? ` · ${c.email}` : ''}{c.city ? ` · ${c.city}` : ''}</p>
                <p className="small">{c.orders} order{c.orders === 1 ? '' : 's'} · {rupees(c.spent)} spent{c.cancelled ? ` · ${c.cancelled} cancelled` : ''} · last {new Date(c.last_order).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="row-gap">
                <Link className="btn btn-outline btn-sm" to={`/admin/orders?q=${c.phone}`}>Orders</Link>
                <a className="btn btn-wa btn-sm" href={`https://wa.me/91${c.phone}`} target="_blank" rel="noreferrer">WhatsApp</a>
                <button className="btn btn-outline btn-sm danger" onClick={() => toggleBlock(c)}>{c.cod_blocked ? 'Unblock COD' : 'Block COD'}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
