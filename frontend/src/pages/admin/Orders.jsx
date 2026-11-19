import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth, useAuthedApi } from '../../context/AuthContext.jsx'
import { config, rupees, whatsappLink } from '../../lib/config.js'
import { orderNo, PAYMENT_LABEL, STATUS_LABEL } from '../../lib/india.js'
import { MEASURE_FIELDS } from '../../lib/addons.js'

const MEASURE_LABEL = { ...Object.fromEntries(MEASURE_FIELDS.map(([k, l]) => [k, l])), note: 'Note' }

const FILTERS = [['', 'All'], ['confirmed', 'To pack'], ['packed', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['pending_payment', 'Awaiting payment'], ['cancelled', 'Cancelled']]
const COURIERS = ['India Post', 'DTDC', 'Delhivery', 'Blue Dart', 'Professional Couriers', 'ST Courier', 'Xpressbees', 'Ekart']

function OrderRow({ o, onChange, onPhoneBlocked, integ = {} }) {
  const call = useAuthedApi()
  const { isPacker } = useAuth()
  const [open, setOpen] = useState(false)
  const [courier, setCourier] = useState(o.courier || '')
  const [tracking, setTracking] = useState(o.tracking_number || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const a = o.address || {}
  const when = new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

  async function courierAction(path, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); setMsg('')
    try {
      const r = await call(`/api/admin/orders/${o.id}/${path}`, { method: 'POST', body: {} })
      onChange(r)
      if (r.label_url) window.open(r.label_url, '_blank', 'noopener')
      setMsg(path === 'shiprocket' ? `Booked with ${r.courier || 'courier'} · AWB ${r.tracking_number || '—'}` : `Status: ${r.courier_status || 'no update yet'}`)
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  async function refundOnline() {
    const max = o.total - (o.gift_amount || 0) - (o.refund_amount || 0)
    const v = window.prompt(`Refund how much via Razorpay? (up to ₹${max}). Leave as is for a full refund.`, String(max))
    if (v === null) return
    const amount = parseInt(v, 10)
    setBusy(true); setMsg('')
    try { onChange(await call(`/api/admin/orders/${o.id}/refund`, { method: 'POST', body: { amount: amount || null, note: `Refund for ${orderNo(o.order_no)}` } })); setMsg('Refund sent to Razorpay. The customer gets it in 5–7 working days.') }
    catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  async function toggleBlock() {
    const block = !o.cod_blocked
    const reason = block ? window.prompt(`Block Cash on Delivery for +91 ${o.phone}? They can still pay online.\nReason (optional):`, 'Refused delivery') : null
    if (block && reason === null) return
    setBusy(true); setMsg('')
    try {
      await call(`/api/admin/blocked-phones/${o.phone}`, { method: 'PUT', body: { blocked: block, reason } })
      onPhoneBlocked(o.phone, block)
      setMsg(block ? 'COD blocked for this number.' : 'COD allowed again for this number.')
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  async function act(action, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); setMsg('')
    try {
      onChange(await call(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { action, courier, tracking_number: tracking } }))
      if (action === 'tracking') setMsg('Saved.')
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  const waText = o.status === 'shipped'
    ? `Hi ${o.customer_name}, your Lydia Purple order ${orderNo(o.order_no)} has been shipped via ${o.courier || ''}. Tracking: ${o.tracking_number || ''}.`
    : `Hi ${o.customer_name}, this is Lydia Purple Collections about your order ${orderNo(o.order_no)}.`

  return (
    <li className={`order-row ${o.needs_review ? 'review' : ''}`}>
      <button className="order-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="order-no">{orderNo(o.order_no)}</span>
        <span className="order-who">{o.customer_name}<small> · {when}</small></span>
        <span className={`pill pill-${o.status}`}>{STATUS_LABEL[o.status]}{o.cod_blocked && ' · COD blocked'}</span>
        <span className="order-total">{rupees(o.total)}<small>{o.payment_method === 'cod' ? ' COD' : o.payment_method === 'gift' ? ' 🎁' : ''}</small></span>
      </button>
      {open && (
        <div className="order-detail">
          {o.needs_review && <p className="alert alert-error">Paid after the order had expired and stock was released. Check stock by hand, then mark reviewed.</p>}
          <div className="detail-grid">
            <div>
              <h3>Ship to</h3>
              <p>{o.customer_name}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.landmark && <>Near {a.landmark}<br /></>}{a.city}, {a.state} – {a.pin}<br />
                <a href={`tel:+91${o.phone}`}>+91 {o.phone}</a>{o.email && <><br />{o.email}</>}</p>
              <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(`${o.customer_name}\n${a.line1}${a.line2 ? ', ' + a.line2 : ''}\n${a.landmark ? 'Near ' + a.landmark + '\n' : ''}${a.city}, ${a.state} - ${a.pin}\nPh: ${o.phone}`)}>Copy address</button>
            </div>
            <div>
              <h3>Items</h3>
              <ul className="plain">
                {o.order_items.map((it, i) => <li key={i}>{it.name}{(it.color || it.size) && ` (${[it.color, it.size].filter(Boolean).join(' / ')})`} × {it.qty} — {rupees(it.price * it.qty)}{it.addons?.length > 0 && <><br /><small>+ {it.addons.map((x) => `${x.label} ${rupees(x.amount)}`).join(', ')}</small></>}</li>)}
              </ul>
              {o.measurements && (
                <details className="measure-view no-print">
                  <summary>✂️ Blouse measurements (inches)</summary>
                  <dl>{Object.entries(o.measurements).map(([k, v]) => <div key={k}><dt>{MEASURE_LABEL[k] || k}</dt><dd>{v}</dd></div>)}</dl>
                </details>
              )}
              <p className="small">Subtotal {rupees(o.subtotal)}{o.discount ? ` · Discount −${rupees(o.discount)} (${o.coupon_code})` : ''} · Shipping {rupees(o.shipping_fee)}{o.cod_fee ? ` · COD ${rupees(o.cod_fee)}` : ''}</p>
              {(o.courier_status || o.refund_amount) && <p className="small">{o.courier_status && <>🚚 {o.courier_status}</>}{o.refund_amount ? ` · Refunded ₹${o.refund_amount}` : ''}</p>}
              {o.gift_amount > 0 && <p className="small">🎁 Gift card {o.gift_code}: −{rupees(o.gift_amount)}{o.payment_method === 'cod' && <> · <strong>collect {rupees(o.total - o.gift_amount)}</strong></>}</p>}
              <p className="small">Payment: <strong>{PAYMENT_LABEL[o.payment_status]}</strong>{o.razorpay_payment_id && <> · {o.razorpay_payment_id}</>}</p>
            </div>
          </div>

          {['confirmed', 'packed', 'shipped'].includes(o.status) && (
            <div className="track-row">
              <label><span className="small">Courier</span>
                <input list="couriers" value={courier} onChange={(e) => setCourier(e.target.value)} />
              </label>
              <label><span className="small">Tracking number</span>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </label>
              <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act('tracking')}>Save</button>
            </div>
          )}

          <div className="action-row">
            {integ.shiprocket && ['confirmed', 'packed'].includes(o.status) && !o.shipment_id && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => courierAction('shiprocket', 'Book this order with Shiprocket? A courier and AWB number will be assigned.')}>🚚 Book courier</button>}
            {integ.shiprocket && o.tracking_number && o.shipment_id && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => courierAction('track')}>Refresh tracking</button>}
            {o.status === 'confirmed' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('pack')}>Mark packed</button>}
            {['confirmed', 'packed'].includes(o.status) && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('ship')}>Mark shipped</button>}
            {o.status === 'shipped' && !isPacker && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('deliver')}>Mark delivered</button>}
            {o.needs_review && !isPacker && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act('review')}>Mark reviewed</button>}
            {!isPacker && integ.refunds && o.payment_status === 'paid' && o.payment_method === 'razorpay' && <button className="btn btn-outline btn-sm danger" disabled={busy} onClick={refundOnline}>Refund via Razorpay</button>}
            {!isPacker && o.payment_status === 'paid' && o.payment_method === 'razorpay' && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act('refund', 'Mark as refunded? Do the actual refund in the Razorpay dashboard.')}>Mark refunded</button>}
            {!isPacker && ['pending_payment', 'confirmed', 'packed'].includes(o.status) && <button className="btn btn-outline btn-sm danger" disabled={busy} onClick={() => act('cancel', `Cancel ${orderNo(o.order_no)}? Stock goes back to the shop.${o.payment_status === 'paid' ? ' Refund it in Razorpay too.' : ''}`)}>Cancel order</button>}
            <Link className="btn btn-outline btn-sm" to={`/admin/print?id=${o.id}`}>Print slip</Link>
            {!['pending_payment', 'cancelled'].includes(o.status) && <Link className="btn btn-outline btn-sm" to={`/admin/invoice/${o.id}`}>Invoice</Link>}
            {!isPacker && <button className="btn btn-outline btn-sm danger" disabled={busy} onClick={toggleBlock}>{o.cod_blocked ? 'Unblock COD' : 'Block COD'}</button>}
            <a className="btn btn-wa btn-sm" href={whatsappLink(waText).replace(/wa\.me\/\d+/, `wa.me/91${o.phone}`)} target="_blank" rel="noreferrer">WhatsApp customer</a>
          </div>
          {msg && <p className="small" role="status">{msg}</p>}
        </div>
      )}
    </li>
  )
}

export default function Orders() {
  const call = useAuthedApi()
  const { getToken, isPacker } = useAuth()
  const [params, setParams] = useSearchParams()
  const [orders, setOrders] = useState(null)
  const [q, setQ] = useState(() => params.get('q') || '')
  const [error, setError] = useState('')
  const status = params.get('status') || ''
  const review = params.get('review') === '1'
  const search = params.get('q') || ''

  useEffect(() => {
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    if (review) qs.set('needs_review', 'true')
    if (search) qs.set('q', search)
    setOrders(null)
    call(`/api/admin/orders?${qs}`).then(setOrders).catch((e) => setError(e.message))
  }, [call, status, review, search])

  const [exporting, setExporting] = useState(false)
  const [integ, setInteg] = useState({})
  useEffect(() => { call('/api/admin/integrations').then(setInteg).catch(() => {}) }, [call])
  async function exportCsv() {
    setExporting(true); setError('')
    try {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      const token = await getToken()
      const res = await fetch(`${config.apiUrl}/api/admin/orders/export?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Could not export orders. Please try again.')
      const url = URL.createObjectURL(await res.blob())
      const a = Object.assign(document.createElement('a'), { href: url, download: `lydia-orders-${new Date().toISOString().slice(0, 10)}${status ? '-' + status : ''}.csv` })
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e.message) }
    setExporting(false)
  }

  const setFilter = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n, { replace: true }) }

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-h">Orders</h1>
        <div className="row-gap">
          <Link className="btn btn-outline btn-sm" to="/admin/print?status=confirmed">Print slips (to pack)</Link>
          {!isPacker && <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting}>{exporting ? 'Preparing…' : 'Download CSV'}</button>}
        </div>
      </div>
      <datalist id="couriers">{COURIERS.map((c) => <option key={c} value={c} />)}</datalist>
      <form className="search" onSubmit={(e) => { e.preventDefault(); setFilter('q', q.trim()) }}>
        <label htmlFor="oq" className="sr-only">Search orders</label>
        <input id="oq" type="search" placeholder="Order no. (LPC1001), phone or name" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setFilter('q', '') }} />
        <button className="btn btn-primary btn-sm">Search</button>
      </form>
      <div className="chips">
        {FILTERS.map(([v, l]) => <button key={l} className={`chip ${status === v && !review ? 'active' : ''}`} onClick={() => { const n = new URLSearchParams(); if (v) n.set('status', v); setParams(n, { replace: true }) }}>{l}</button>)}
        <button className={`chip ${review ? 'active' : ''}`} onClick={() => setParams(review ? {} : { review: '1' }, { replace: true })}>Needs review</button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {!orders ? <div className="skeleton-block" /> : orders.length ? (
        <ul className="order-list">
          {orders.map((o) => <OrderRow key={o.id} o={o} onChange={(n) => setOrders((all) => all.map((x) => x.id === n.id ? n : x))}
            integ={integ}
            onPhoneBlocked={(phone, blocked) => setOrders((all) => all.map((x) => x.phone === phone ? { ...x, cod_blocked: blocked } : x))} />)}
        </ul>
      ) : <p className="muted">No orders here.</p>}
    </>
  )
}
