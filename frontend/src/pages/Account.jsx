import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import { useAuth, useAuthedApi } from '../context/AuthContext.jsx'
import { rupees } from '../lib/config.js'
import { orderNo, PAYMENT_LABEL, STATES, STATUS_LABEL } from '../lib/india.js'
import { lineLabel, useTitle } from '../lib/store.js'

function ProfileForm({ profile, onSaved }) {
  const call = useAuthedApi()
  const a = profile.address || {}
  const [f, setF] = useState({ full_name: profile.full_name || '', phone: profile.phone || '', line1: a.line1 || '', line2: a.line2 || '', landmark: a.landmark || '', city: a.city || '', state: a.state || '', pin: a.pin || '' })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => {
    let v = e.target.value
    if (k === 'phone') v = v.replace(/\D/g, '').slice(0, 10)
    if (k === 'pin') v = v.replace(/\D/g, '').slice(0, 6)
    setF({ ...f, [k]: v })
  }

  async function save(e) {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    if (f.phone && !/^[6-9]\d{9}$/.test(f.phone)) return setMsg({ type: 'error', text: 'Enter a 10-digit mobile number.' })
    const hasAddr = f.line1 || f.city || f.pin || f.state
    if (hasAddr && (f.line1.trim().length < 3 || f.city.trim().length < 2 || !f.state || !/^[1-9]\d{5}$/.test(f.pin)))
      return setMsg({ type: 'error', text: 'Please complete the address: street, city, state and 6-digit PIN.' })
    setBusy(true)
    try {
      const body = { full_name: f.full_name.trim(), phone: f.phone }
      if (hasAddr) body.address = { line1: f.line1.trim(), line2: f.line2.trim() || null, landmark: f.landmark.trim() || null, city: f.city.trim(), state: f.state, pin: f.pin }
      await call('/api/me', { method: 'PATCH', body })
      await onSaved()
      setMsg({ type: 'ok', text: 'Saved. We’ll fill this in at checkout for you.' })
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    setBusy(false)
  }

  return (
    <form className="card" onSubmit={save} noValidate>
      <h2 className="h-sm">My details</h2>
      <div className="field-row">
        <div className="field"><label htmlFor="a-name">Name</label><input id="a-name" type="text" autoComplete="name" value={f.full_name} onChange={set('full_name')} /></div>
        <div className="field"><label htmlFor="a-phone">Mobile</label><input id="a-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={set('phone')} /></div>
      </div>
      <div className="field"><label htmlFor="a-l1">House no., building, street</label><input id="a-l1" type="text" autoComplete="address-line1" value={f.line1} onChange={set('line1')} /></div>
      <div className="field-row">
        <div className="field"><label htmlFor="a-l2">Area (optional)</label><input id="a-l2" type="text" value={f.line2} onChange={set('line2')} /></div>
        <div className="field"><label htmlFor="a-lm">Landmark (optional)</label><input id="a-lm" type="text" value={f.landmark} onChange={set('landmark')} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="a-city">City</label><input id="a-city" type="text" value={f.city} onChange={set('city')} /></div>
        <div className="field"><label htmlFor="a-pin">PIN code</label><input id="a-pin" type="text" inputMode="numeric" value={f.pin} onChange={set('pin')} /></div>
      </div>
      <div className="field"><label htmlFor="a-state">State</label>
        <select id="a-state" value={f.state} onChange={set('state')}><option value="">Choose state</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {msg.text && <p className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>
    </form>
  )
}

export default function Account() {
  useTitle('My account')
  const { user, profile, loading, signOut, refreshProfile, isAdmin } = useAuth()
  const call = useAuthedApi()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) call('/api/me/orders').then(setOrders).catch((e) => setError(e.message))
  }, [user, call])

  if (loading) return <section className="container page-narrow"><div className="skeleton-block" /></section>
  if (!user) return <Navigate to="/login?next=/account" replace />

  return (
    <section className="container section account">
      <div className="admin-title-row">
        <div>
          <h1>My account</h1>
          <p className="muted small">{user.email}</p>
        </div>
        <div className="row-gap">
          {isAdmin && <Link to="/admin" className="btn btn-outline btn-sm">Admin panel</Link>}
          <button className="btn btn-outline btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div className="account-grid">
        <div>
          <h2 className="h-sm">My orders</h2>
          {error && <p className="alert alert-error">{error}</p>}
          {!orders ? <div className="skeleton-block" /> : orders.length === 0 ? (
            <div className="card"><p>No orders yet.</p><Link to="/shop" className="btn btn-primary btn-sm">Start shopping</Link></div>
          ) : (
            <ul className="my-orders">
              {orders.map((o) => (
                <li key={o.id} className="card">
                  <div className="my-order-head">
                    <Link to={`/order/${o.id}`} className="order-no">{orderNo(o.order_no)}</Link>
                    <span className={`pill pill-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  </div>
                  <p className="small muted">{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {rupees(o.total)} · {PAYMENT_LABEL[o.payment_status]}</p>
                  <ul className="my-order-items">
                    {o.order_items.map((it, i) => (
                      <li key={i}>
                        <span className="mini-thumb"><ProductImage src={it.image_url} alt="" /></span>
                        <span>{it.name}{lineLabel(it) && <small className="muted"> · {lineLabel(it)}</small>} × {it.qty}</span>
                      </li>
                    ))}
                  </ul>
                  {o.tracking_number && <p className="small">🚚 {o.courier}: <strong>{o.tracking_number}</strong></p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {profile && <ProfileForm profile={profile} onSaved={refreshProfile} />}
      </div>
    </section>
  )
}
