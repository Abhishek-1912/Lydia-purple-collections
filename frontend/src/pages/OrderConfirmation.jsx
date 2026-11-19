import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WhatsAppIcon, Lotus } from '../components/Icons.jsx'
import { api } from '../lib/api.js'
import { rupees, whatsappLink } from '../lib/config.js'
import { orderNo, PAYMENT_LABEL, STATUS_LABEL } from '../lib/india.js'
import { lineLabel, useTitle } from '../lib/store.js'

export default function OrderConfirmation() {
  const { id } = useParams()
  const [o, setO] = useState(null)
  const [error, setError] = useState('')
  useTitle(o ? `Order ${orderNo(o.order_no)}` : 'Your order')

  useEffect(() => {
    let tries = 0, timer
    const load = () => api(`/api/orders/${id}`).then((d) => {
      setO(d)
      // Payment may still be confirming via webhook — poll briefly
      if (d.status === 'pending_payment' && tries++ < 10) timer = setTimeout(load, 3000)
    }).catch((e) => setError(e.message))
    load()
    return () => clearTimeout(timer)
  }, [id])

  if (error) return <section className="container page-narrow center"><p className="alert alert-error">{error}</p><Link to="/" className="btn btn-primary">Home</Link></section>
  if (!o) return <section className="container page-narrow"><div className="skeleton-block" /></section>

  const ok = o.status !== 'cancelled' && o.status !== 'pending_payment'
  const a = o.address
  return (
    <section className="container page-narrow">
      <div className="center">
        <div className="gold"><Lotus size={56} /></div>
        <h1>{ok ? 'Thank you!' : o.status === 'cancelled' ? 'Order cancelled' : 'Confirming payment…'}</h1>
        <p className="display">
          {ok ? <>Your order <strong>{orderNo(o.order_no)}</strong> is confirmed.</>
            : o.status === 'cancelled' ? <>Order {orderNo(o.order_no)} was cancelled.</>
            : <>We’re waiting for the bank to confirm order {orderNo(o.order_no)}. This page updates on its own.</>}
        </p>
      </div>

      <div className="card order-card">
        <div className="sum-row"><span>Order</span><strong>{orderNo(o.order_no)}</strong></div>
        <div className="sum-row"><span>Status</span><span>{STATUS_LABEL[o.status]}</span></div>
        <div className="sum-row"><span>Payment</span><span>{PAYMENT_LABEL[o.payment_status]}</span></div>
        {o.tracking_number && <div className="sum-row"><span>Tracking</span><span>{o.courier} · {o.tracking_number}</span></div>}
        <ul className="sum-lines">
          {o.order_items.map((it, i) => (
            <li key={i}><span>{it.name}{lineLabel(it) && <small> · {lineLabel(it)}</small>} × {it.qty}</span><span>{rupees(it.price * it.qty)}</span></li>
          ))}
        </ul>
        <div className="sum-row"><span>Subtotal</span><span>{rupees(o.subtotal)}</span></div>
        {o.discount > 0 && <div className="sum-row save"><span>Discount{o.coupon_code && ` (${o.coupon_code})`}</span><span>−{rupees(o.discount)}</span></div>}
        <div className="sum-row"><span>Shipping</span><span>{o.shipping_fee ? rupees(o.shipping_fee) : 'Free'}</span></div>
        {o.cod_fee > 0 && <div className="sum-row"><span>COD handling</span><span>{rupees(o.cod_fee)}</span></div>}
        <div className="sum-row total"><span>{o.payment_method === 'cod' ? 'To pay on delivery' : 'Total'}</span><span>{rupees(o.total)}</span></div>
        <p className="small muted">Delivering to {o.customer_name}, {[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(', ')} – {a.pin}. Phone +91 {o.phone}</p>
      </div>

      <div className="stack">
        <a className="btn btn-wa btn-block" href={whatsappLink(`Hi! About my order ${orderNo(o.order_no)}.`)} target="_blank" rel="noreferrer">
          <WhatsAppIcon /> Message us about this order
        </a>
        <Link to="/shop" className="btn btn-outline btn-block">Continue shopping</Link>
      </div>
      <p className="small muted center">Bookmark this page to check your order status anytime.</p>
    </section>
  )
}
