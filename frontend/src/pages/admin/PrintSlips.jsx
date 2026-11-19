import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { config, rupees, SHOP_NAME } from '../../lib/config.js'
import { orderNo } from '../../lib/india.js'

// Packing slips: /admin/print?id=<order id>  or  /admin/print?status=confirmed (all orders to pack)
export default function PrintSlips() {
  const call = useAuthedApi()
  const [params] = useSearchParams()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const id = params.get('id'), status = params.get('status') || 'confirmed'

  useEffect(() => {
    call(`/api/admin/orders?status=${id ? '' : status}&limit=300`)
      .then((all) => setOrders(id ? all.filter((o) => o.id === id) : all.reverse()))
      .catch((e) => setError(e.message))
  }, [call, id, status])

  if (error) return <p className="alert alert-error">{error}</p>
  if (!orders) return <div className="skeleton-block" />

  return (
    <>
      <div className="no-print admin-title-row">
        <h1 className="admin-h">{orders.length} packing slip{orders.length === 1 ? '' : 's'}</h1>
        <div className="row-gap">
          <Link to="/admin/orders" className="btn btn-outline btn-sm">Back</Link>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!orders.length}>Print</button>
        </div>
      </div>
      {!orders.length && <p className="muted no-print">No orders to pack right now.</p>}
      <div className="slips">
        {orders.map((o) => {
          const a = o.address || {}
          const cod = o.payment_method === 'cod' && o.payment_status !== 'paid'
          const collect = o.total - (o.gift_amount || 0)
          return (
            <article key={o.id} className="slip">
              <header className="slip-head">
                <div><strong>{SHOP_NAME}</strong><br /><small>{[config.address, config.phone].filter(Boolean).join(' · ')}</small></div>
                <div className="slip-no">{orderNo(o.order_no)}<br /><small>{new Date(o.created_at).toLocaleDateString('en-IN')}</small></div>
              </header>
              <div className="slip-to">
                <small>SHIP TO</small>
                <p><strong>{o.customer_name}</strong><br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.landmark && <>Near {a.landmark}<br /></>}{a.city}, {a.state} – <strong>{a.pin}</strong><br />Phone: +91 {o.phone}</p>
              </div>
              <div className={`slip-pay ${cod ? 'cod' : ''}`}>{cod ? `CASH ON DELIVERY — COLLECT ${rupees(collect)}` : 'PREPAID — DO NOT COLLECT CASH'}</div>
              <table className="slip-items">
                <thead><tr><th>Item</th><th>Colour / size</th><th>Qty</th><th>✓</th></tr></thead>
                <tbody>{o.order_items.map((it, i) => <tr key={i}><td>{it.name}</td><td>{[it.color, it.size].filter(Boolean).join(' / ') || '—'}</td><td>{it.qty}</td><td>☐</td></tr>)}</tbody>
              </table>
              {(o.courier || o.tracking_number) && <p className="small">Courier: {o.courier} · {o.tracking_number}</p>}
              <p className="small slip-thanks">Thank you for shopping with {SHOP_NAME}! Questions? WhatsApp {config.whatsapp ? `+${config.whatsapp}` : 'us'}.</p>
            </article>
          )
        })}
      </div>
    </>
  )
}
