import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'

const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} day${m < 2880 ? '' : 's'} ago`
}

function Row({ d, onChange, onRemove }) {
  const call = useAuthedApi()
  const site = window.location.origin
  const first = d.items[0]?.name || 'your saree'
  const more = d.items.length > 1 ? ` and ${d.items.length - 1} more` : ''
  const msg = `Hi ${d.name || ''}! This is Lydia Purple Collections. You left ${first}${more} in your cart. Your cart is saved here: ${site}/cart?restore=${d.id}\nNeed a live video, a different colour, or help with payment? Just reply here.`
  async function remind() {
    window.open(`https://wa.me/91${d.phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    onChange(await call(`/api/admin/abandoned/${d.id}`, { method: 'PATCH', body: { contacted: true } }))
  }
  return (
    <li className="card ab-row">
      <div className="ab-main">
        <div><strong>{d.name || 'No name given'}</strong> <span className="muted small">· +91 {d.phone}{d.email ? ` · ${d.email}` : ''}</span></div>
        <ul className="plain small">{d.items.map((i, k) => <li key={k}>{i.name || 'Item'} × {i.qty}{i.price ? ` — ${rupees(i.price * i.qty)}` : ''}</li>)}</ul>
        <p className="small muted">Cart {rupees(d.subtotal)} · left {ago(d.updated_at)}{d.contacted_at && ` · reminded ${ago(d.contacted_at)}`}{d.auto_reminded_at && ' · auto-reminded'}</p>
      </div>
      <div className="row-gap">
        <button type="button" className="btn btn-wa btn-sm" onClick={remind}>{d.contacted_at ? 'Message again' : 'Send WhatsApp reminder'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={async () => { await call(`/api/admin/abandoned/${d.id}`, { method: 'DELETE' }); onRemove(d.id) }}>Dismiss</button>
      </div>
    </li>
  )
}

export default function Abandoned() {
  const call = useAuthedApi()
  const [show, setShow] = useState('open')
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { setList(null); call(`/api/admin/abandoned?show=${show}`).then(setList).catch((e) => setError(e.message)) }, [call, show])
  const total = (list || []).reduce((n, d) => n + d.subtotal, 0)
  return (
    <>
      <h1 className="admin-h">Abandoned carts</h1>
      <p className="small muted">People who entered their mobile at checkout but didn’t place the order (30 min to 14 days ago). The reminder opens WhatsApp with a message and a link that refills their cart.</p>
      <div className="chips">
        <button className={`chip ${show === 'open' ? 'active' : ''}`} onClick={() => setShow('open')}>Not yet reminded</button>
        <button className={`chip ${show === 'all' ? 'active' : ''}`} onClick={() => setShow('all')}>All</button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {list && list.length > 0 && <p className="small"><strong>{list.length}</strong> cart{list.length === 1 ? '' : 's'} worth <strong>{rupees(total)}</strong></p>}
      {!list ? <div className="skeleton-block" /> : list.length ? (
        <ul className="coupon-list">{list.map((d) => <Row key={d.id} d={d} onChange={(n) => setList((all) => all.map((x) => x.id === n.id ? n : x).filter((x) => show === 'all' || !x.contacted_at))} onRemove={(id) => setList((all) => all.filter((x) => x.id !== id))} />)}</ul>
      ) : <p className="muted">No abandoned carts right now. 🎉</p>}
    </>
  )
}
