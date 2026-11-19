import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import { WhatsAppIcon } from '../components/Icons.jsx'
import { useCart } from '../context/CartContext.jsx'
import { api } from '../lib/api.js'
import { rupees } from '../lib/config.js'
import { cartWhatsApp, lineLabel, useStoreRules, useTitle } from '../lib/store.js'

export default function Cart() {
  useTitle('Your cart')
  const { items, setQty, remove } = useCart()
  const rules = useStoreRules()
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')

  const key = items.map((i) => `${i.variant_id}:${i.qty}`).join(',')
  useEffect(() => {
    if (!items.length) { setQuote(null); return }
    let alive = true
    api('/api/cart/quote', { method: 'POST', body: { items: items.map(({ variant_id, qty }) => ({ variant_id, qty })) } })
      .then((q) => { if (alive) { setQuote(q); setError('') } })
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [key])

  if (!items.length) {
    return (
      <section className="container page-narrow center">
        <h1>Your cart is empty</h1>
        <p className="display">A beautiful saree is waiting for you.</p>
        <Link to="/collections/sarees" className="btn btn-primary">Shop sarees</Link>
      </section>
    )
  }

  const lineFor = (vid) => quote?.lines.find((l) => l.variant_id === vid)
  const subtotal = quote?.subtotal ?? items.reduce((n, i) => n + i.price * i.qty, 0)
  const remaining = quote?.free_shipping_remaining ?? Math.max(0, rules.free_shipping_above - subtotal)
  const pct = Math.min(100, Math.round(((rules.free_shipping_above - remaining) / rules.free_shipping_above) * 100))
  const waLines = items.map((i) => ({ ...i, price: lineFor(i.variant_id)?.price ?? i.price }))

  return (
    <section className="container section">
      <h1>Your cart</h1>

      <div className="ship-bar" aria-live="polite">
        <p>{remaining > 0 ? <>Add <strong>{rupees(remaining)}</strong> more for <strong>free shipping</strong></> : <>🎉 You've unlocked <strong>free shipping</strong></>}</p>
        <div className="ship-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Free shipping progress">
          <div className="ship-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <div className="cart-layout">
        <ul className="cart-lines">
          {items.map((i) => {
            const l = lineFor(i.variant_id)
            return (
              <li key={i.variant_id} className="cart-line">
                <Link to={`/products/${i.slug}`} className="cart-thumb" tabIndex={-1} aria-hidden="true">
                  <ProductImage src={l?.image || i.image} alt="" />
                </Link>
                <div className="cart-info">
                  <Link to={`/products/${i.slug}`} className="cart-name">{l?.name || i.name}</Link>
                  {lineLabel(i) && <p className="small muted">{lineLabel(i)}</p>}
                  <p className="price">{rupees(l?.price ?? i.price)}</p>
                  {l?.error && <p className="line-error" role="alert">{l.error}</p>}
                  <div className="cart-controls">
                    <div className="qty">
                      <button type="button" onClick={() => setQty(i.variant_id, i.qty - 1)} disabled={i.qty <= 1} aria-label={`Decrease quantity of ${i.name}`}>−</button>
                      <input value={i.qty} readOnly aria-label={`Quantity of ${i.name}`} />
                      <button type="button" onClick={() => setQty(i.variant_id, i.qty + 1)} disabled={i.qty >= 10} aria-label={`Increase quantity of ${i.name}`}>+</button>
                    </div>
                    <button className="link-btn" onClick={() => remove(i.variant_id)}>Remove</button>
                  </div>
                </div>
                <p className="cart-line-total">{rupees((l?.price ?? i.price) * i.qty)}</p>
              </li>
            )
          })}
        </ul>

        <aside className="summary" aria-label="Order summary">
          <div className="sum-row"><span>Subtotal</span><span>{rupees(subtotal)}</span></div>
          <div className="sum-row"><span>Shipping</span><span>{quote ? (quote.shipping_fee ? rupees(quote.shipping_fee) : 'Free') : '—'}</span></div>
          <p className="small muted">Coupons and Cash on Delivery are applied at checkout.</p>
          <button className="btn btn-primary btn-block" disabled={!quote?.ok} onClick={() => navigate('/checkout')}>Checkout</button>
          {quote && !quote.ok && <p className="small line-error">Please fix the items marked above to continue.</p>}
          <a className="btn btn-wa btn-block" href={cartWhatsApp(waLines, subtotal)} target="_blank" rel="noreferrer">
            <WhatsAppIcon /> Send this order on WhatsApp
          </a>
        </aside>
      </div>
    </section>
  )
}
