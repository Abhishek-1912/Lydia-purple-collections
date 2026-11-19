import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link, useNavigate } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import { WhatsAppIcon } from '../components/Icons.jsx'
import { useCart } from '../context/CartContext.jsx'
import { api } from '../lib/api.js'
import { rupees } from '../lib/config.js'
import { addonLabels, addonPayload, lineKey } from '../lib/addons.js'
import { cartWhatsApp, lineLabel, useStoreRules, useTitle } from '../lib/store.js'

export default function Cart() {
  useTitle('Your cart')
  const { items, setQty, remove, add } = useCart()
  const [params, setParams] = useSearchParams()
  const [restored, setRestored] = useState('')
  // "Restore my cart" link from a WhatsApp reminder: /cart?restore=<draft id>
  const restoreDone = useRef(false)
  useEffect(() => {
    const id = params.get('restore')
    if (!id || restoreDone.current) return
    restoreDone.current = true // run once, even if React starts the page twice
    api(`/api/checkout/draft/${id}/items`).then((lines) => {
      lines.forEach((l) => { if (!items.some((i) => i.key === lineKey(l.variant_id, l.addons))) add({ variant_id: l.variant_id, addons: l.addons }, l.qty) })
      setRestored('Your saved cart is back. Prices and stock are checked again below.')
    }).catch((e) => setRestored(e.message)).finally(() => setParams({}, { replace: true }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rules = useStoreRules()
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')

  const key = items.map((i) => `${i.key}:${i.qty}`).join(',')
  useEffect(() => {
    if (!items.length) { setQuote(null); return }
    let alive = true
    api('/api/cart/quote', { method: 'POST', body: { items: items.map(({ variant_id, qty, addons }) => ({ variant_id, qty, addons: addonPayload(addons) })) } })
      .then((q) => { if (alive) { setQuote(q); setError('') } })
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [key])

  if (!items.length) {
    return (
      <section className="container page-narrow center">
        <h1>Your cart is empty</h1>
        {restored && <p className="alert alert-error" role="status">{restored}</p>}
        <p className="display">A beautiful saree is waiting for you.</p>
        <Link to="/collections/sarees" className="btn btn-primary">Shop sarees</Link>
      </section>
    )
  }

  const lineFor = (k) => quote?.lines.find((l) => l.key === k)
  const subtotal = quote?.subtotal ?? items.reduce((n, i) => n + i.price * i.qty, 0)
  const remaining = quote?.free_shipping_remaining ?? Math.max(0, rules.free_shipping_above - subtotal)
  const pct = Math.min(100, Math.round(((rules.free_shipping_above - remaining) / rules.free_shipping_above) * 100))
  const waLines = items.map((i) => { const l = lineFor(i.key); return { ...i, name: l?.name || i.name, color: l?.color ?? i.color, size: l?.size ?? i.size, price: l?.unit_price ?? i.price, extras: addonLabels(i.addons) } })

  return (
    <section className="container section">
      <h1>Your cart</h1>
      {restored && <p className="alert alert-ok" role="status">{restored}</p>}

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
            const l = lineFor(i.key)
            const extras = addonLabels(i.addons)
            return (
              <li key={i.key} className="cart-line">
                <Link to={`/products/${l?.slug || i.slug || ''}`} className="cart-thumb" tabIndex={-1} aria-hidden="true">
                  <ProductImage src={l?.image || i.image} alt="" />
                </Link>
                <div className="cart-info">
                  <Link to={`/products/${l?.slug || i.slug || ''}`} className="cart-name">{l?.name || i.name}</Link>
                  {lineLabel(l || i) && <p className="small muted">{lineLabel(l || i)}</p>}
                  {extras.length > 0 && <ul className="addon-list small">{extras.map((x) => <li key={x}>+ {x}</li>)}</ul>}
                  <p className="price">{rupees(l?.unit_price ?? i.price)}</p>
                  {l?.error && <p className="line-error" role="alert">{l.error}</p>}
                  <div className="cart-controls">
                    <div className="qty">
                      <button type="button" onClick={() => setQty(i.key, i.qty - 1)} disabled={i.qty <= 1} aria-label={`Decrease quantity of ${i.name}`}>−</button>
                      <input value={i.qty} readOnly aria-label={`Quantity of ${i.name}`} />
                      <button type="button" onClick={() => setQty(i.key, i.qty + 1)} disabled={i.qty >= 10} aria-label={`Increase quantity of ${i.name}`}>+</button>
                    </div>
                    <button className="link-btn" onClick={() => remove(i.key)}>Remove</button>
                  </div>
                </div>
                <p className="cart-line-total">{rupees(l?.line_total ?? i.price * i.qty)}</p>
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
