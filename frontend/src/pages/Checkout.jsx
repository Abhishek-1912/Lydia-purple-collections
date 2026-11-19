import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { rupees, SHOP_NAME } from '../lib/config.js'
import { STATES } from '../lib/india.js'
import { loadRazorpay } from '../lib/razorpay.js'
import { sessionId } from '../lib/session.js'
import { track } from '../lib/track.js'
import { lineLabel, useStoreRules, useTitle } from '../lib/store.js'

const SAVED = 'lpc_checkout_v1'
const EMPTY = { name: '', phone: '', email: '', line1: '', line2: '', landmark: '', city: '', state: '', pin: '' }

function loadSaved() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(SAVED)) } } catch { return EMPTY }
}

function validate(f) {
  const e = {}
  if (f.name.trim().length < 2) e.name = 'Please enter your full name.'
  if (!/^[6-9]\d{9}$/.test(f.phone)) e.phone = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.'
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.email = 'This email doesn’t look right.'
  if (f.line1.trim().length < 3) e.line1 = 'Please enter your house / street address.'
  if (f.city.trim().length < 2) e.city = 'Please enter your city or town.'
  if (!f.state) e.state = 'Please choose your state.'
  if (!/^[1-9]\d{5}$/.test(f.pin)) e.pin = 'Enter a valid 6-digit PIN code.'
  return e
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  )
}

export default function Checkout() {
  useTitle('Checkout')
  const { items, clear } = useCart()
  const { getToken, profile, user } = useAuth()
  const rules = useStoreRules()
  const navigate = useNavigate()
  const [form, setForm] = useState(loadSaved)
  const [errors, setErrors] = useState({})
  const [method, setMethod] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState('')
  const [gift, setGift] = useState('')
  const [giftInput, setGiftInput] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [optIn, setOptIn] = useState(false)
  const [quote, setQuote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const placing = useRef(false)
  useEffect(() => { if (items.length) track('checkout') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fill blanks from the signed-in profile (saved browser address wins)
  useEffect(() => {
    if (!profile) return
    const a = profile.address || {}
    setForm((f) => {
      const fill = { name: profile.full_name, phone: profile.phone, email: user?.email, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pin: a.pin }
      const next = { ...f }
      for (const [k, v] of Object.entries(fill)) if (!next[k] && v) next[k] = v
      return next
    })
  }, [profile, user])

  const payMethod = method || (rules.razorpay_enabled ? 'razorpay' : 'cod')
  const key = items.map((i) => `${i.variant_id}:${i.qty}`).join(',')

  // Save an unfinished-checkout draft once a valid mobile is entered (so the shop can help if it isn't completed)
  useEffect(() => {
    const sid = sessionId()
    if (!sid || !/^[6-9]\d{9}$/.test(form.phone) || !items.length || placing.current) return
    const t = setTimeout(() => {
      api('/api/checkout/draft', { method: 'POST', body: {
        session_id: sid, name: form.name.trim(), phone: form.phone, email: form.email.trim(),
        items: items.map((i) => ({ variant_id: i.variant_id, qty: i.qty, name: i.name || '', price: i.price || 0 })),
      } }).catch(() => {})
    }, 1500)
    return () => clearTimeout(t)
  }, [form.phone, form.name, form.email, key]) // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (!items.length) return
    api('/api/cart/quote', { method: 'POST', body: { items: items.map(({ variant_id, qty }) => ({ variant_id, qty })), coupon_code: coupon || null, payment_method: payMethod, gift_code: gift || null } })
      .then(setQuote)
      .catch((e) => setNotice(e.message))
  }, [key, coupon, payMethod, gift])

  // If COD is over the limit, switch to online when possible
  useEffect(() => {
    if (quote && payMethod === 'cod' && !quote.cod_allowed && rules.razorpay_enabled) setMethod('razorpay')
  }, [quote, payMethod, rules.razorpay_enabled])

  if (!items.length && !placing.current) {
    return (
      <section className="container page-narrow center">
        <h1>Your cart is empty</h1>
        <Link to="/shop" className="btn btn-primary">Continue shopping</Link>
      </section>
    )
  }

  const set = (k) => (e) => {
    let v = e.target.value
    if (k === 'phone') v = v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '').slice(0, 10)
    if (k === 'pin') v = v.replace(/\D/g, '').slice(0, 6)
    setForm({ ...form, [k]: v })
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }
  const aria = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  function applyCoupon(e) {
    e.preventDefault()
    setCoupon(couponInput.trim().toUpperCase())
  }

  async function placeOrder(e) {
    e.preventDefault()
    setNotice('')
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(Object.keys(errs)[0])?.focus()
      return
    }
    if (quote?.coupon && !quote.coupon.ok) { setNotice('Please remove the coupon that can’t be applied.'); return }
    if (quote?.gift && !quote.gift.ok) { setNotice('Please remove the gift card that can’t be used.'); return }
    try { localStorage.setItem(SAVED, JSON.stringify(form)) } catch { /* ignore */ }

    setBusy(true)
    const body = {
      name: form.name, phone: form.phone, email: form.email || null,
      address: { line1: form.line1, line2: form.line2 || null, landmark: form.landmark || null, city: form.city, state: form.state, pin: form.pin },
      items: items.map(({ variant_id, qty }) => ({ variant_id, qty })),
      coupon_code: coupon || null,
      payment_method: payMethod,
      session_id: sessionId(),
      gift_code: gift || null,
      whatsapp_opt_in: optIn,
    }
    let order
    try {
      order = await api('/api/orders', { method: 'POST', body, token: await getToken() })
    } catch (err) {
      setBusy(false)
      setNotice(err.message)
      if (err.data?.detail?.field) setErrors({ [err.data.detail.field]: err.message })
      return
    }

    if (order.payment_method === 'cod' || order.payment_method === 'gift') {
      placing.current = true
      clear()
      navigate(`/order/${order.id}`, { replace: true })
      return
    }

    const ok = await loadRazorpay()
    if (!ok) {
      await api(`/api/orders/${order.id}/abandon`, { method: 'POST', body: { razorpay_order_id: order.razorpay.order_id } }).catch(() => {})
      setBusy(false)
      setNotice('Could not open the payment window. Check your internet, or choose Cash on Delivery.')
      return
    }
    const rp = order.razorpay
    const rzp = new window.Razorpay({
      key: rp.key_id, order_id: rp.order_id, amount: rp.amount, currency: rp.currency,
      name: SHOP_NAME, description: `Order LPC${order.order_no}`, prefill: rp.prefill,
      theme: { color: '#5E1A73' },
      handler: async (resp) => {
        placing.current = true
        clear()
        try {
          await api(`/api/orders/${order.id}/verify-payment`, { method: 'POST', body: resp })
        } catch { /* webhook will still confirm it; confirmation page shows live status */ }
        navigate(`/order/${order.id}`, { replace: true })
      },
      modal: {
        ondismiss: async () => {
          if (placing.current) return
          await api(`/api/orders/${order.id}/abandon`, { method: 'POST', body: { razorpay_order_id: rp.order_id } }).catch(() => {})
          setBusy(false)
          setNotice('Payment was cancelled. Your cart is still here — try again or choose Cash on Delivery.')
        },
      },
    })
    rzp.on('payment.failed', (r) => setNotice(r.error?.description || 'Payment failed. Please try again.'))
    rzp.open()
  }

  const codBlocked = quote && !quote.cod_allowed

  return (
    <section className="container section">
      <h1>Checkout</h1>
      <form className="checkout" onSubmit={placeOrder} noValidate>
        <div className="checkout-main">
          <fieldset className="card">
            <legend>Contact</legend>
            <Field id="name" label="Full name" error={errors.name}>
              <input id="name" type="text" autoComplete="name" value={form.name} onChange={set('name')} {...aria('name')} />
            </Field>
            <Field id="phone" label="Mobile number" error={errors.phone} hint="We’ll send order updates on WhatsApp. If checkout isn’t finished, we may message you once to help.">
              <div className="prefix-input"><span>+91</span>
                <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={set('phone')} {...aria('phone')} />
              </div>
            </Field>
            <label className="check optin"><input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} /> Send me new arrivals and offers on WhatsApp (you can stop anytime)</label>
            <Field id="email" label="Email (optional)" error={errors.email}>
              <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} {...aria('email')} />
            </Field>
          </fieldset>

          <fieldset className="card">
            <legend>Delivery address</legend>
            <Field id="line1" label="House no., building, street" error={errors.line1}>
              <input id="line1" type="text" autoComplete="address-line1" value={form.line1} onChange={set('line1')} {...aria('line1')} />
            </Field>
            <Field id="line2" label="Area, locality (optional)">
              <input id="line2" type="text" autoComplete="address-line2" value={form.line2} onChange={set('line2')} />
            </Field>
            <Field id="landmark" label="Landmark (optional)">
              <input id="landmark" type="text" value={form.landmark} onChange={set('landmark')} />
            </Field>
            <div className="field-row">
              <Field id="city" label="City / town" error={errors.city}>
                <input id="city" type="text" autoComplete="address-level2" value={form.city} onChange={set('city')} {...aria('city')} />
              </Field>
              <Field id="pin" label="PIN code" error={errors.pin}>
                <input id="pin" type="text" inputMode="numeric" autoComplete="postal-code" value={form.pin} onChange={set('pin')} {...aria('pin')} />
              </Field>
            </div>
            <Field id="state" label="State" error={errors.state}>
              <select id="state" autoComplete="address-level1" value={form.state} onChange={set('state')} {...aria('state')}>
                <option value="">Choose state</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </fieldset>

          <fieldset className="card">
            <legend>Payment</legend>
            {quote?.full_gift ? <p className="alert alert-ok">🎁 Your gift card covers the whole order — nothing to pay.</p> : <>
            {rules.razorpay_enabled && (
              <label className={`pay-option ${payMethod === 'razorpay' ? 'active' : ''}`}>
                <input type="radio" name="pay" checked={payMethod === 'razorpay'} onChange={() => setMethod('razorpay')} />
                <span><strong>Pay online</strong><small>UPI (GPay, PhonePe, Paytm, BHIM), cards, net banking</small></span>
              </label>
            )}
            <label className={`pay-option ${payMethod === 'cod' ? 'active' : ''} ${codBlocked ? 'disabled' : ''}`}>
              <input type="radio" name="pay" checked={payMethod === 'cod'} disabled={codBlocked} onChange={() => setMethod('cod')} />
              <span><strong>Cash on Delivery</strong><small>{codBlocked ? quote.cod_message : `+ ${rupees(rules.cod_fee)} handling fee`}</small></span>
            </label>
            </>}
          </fieldset>
        </div>

        <aside className="summary" aria-label="Order summary">
          <h2 className="h-sm">Order summary</h2>
          <ul className="sum-lines">
            {(quote?.lines || []).map((l) => (
              <li key={l.variant_id}>
                <span>{l.name}{lineLabel(l) && <small> · {lineLabel(l)}</small>} × {l.qty}{l.error && <em className="line-error"> — {l.error}</em>}</span>
                <span>{l.line_total ? rupees(l.line_total) : ''}</span>
              </li>
            ))}
          </ul>

          <div className="coupon">
            {coupon ? (
              <div className={`coupon-applied ${quote?.coupon?.ok ? 'ok' : 'bad'}`} role="status">
                <span><strong>{coupon}</strong> — {quote?.coupon?.message || 'Checking…'}</span>
                <button type="button" className="link-btn" onClick={() => { setCoupon(''); setCouponInput('') }}>Remove</button>
              </div>
            ) : (
              <div className="coupon-form">
                <label htmlFor="coupon" className="sr-only">Coupon code</label>
                <input id="coupon" type="text" placeholder="Coupon code" value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(e) }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={applyCoupon} disabled={!couponInput.trim()}>Apply</button>
              </div>
            )}
          </div>

          <div className="coupon">
            {gift ? (
              <div className={`coupon-applied ${quote?.gift?.ok ? 'ok' : 'bad'}`} role="status">
                <span>🎁 <strong>{gift}</strong> — {quote?.gift?.message || 'Checking…'}</span>
                <button type="button" className="link-btn" onClick={() => { setGift(''); setGiftInput('') }}>Remove</button>
              </div>
            ) : giftOpen ? (
              <div className="coupon-form">
                <label htmlFor="gift" className="sr-only">Gift card code</label>
                <input id="gift" type="text" placeholder="Gift card code (LPC-XXXX-XXXX)" value={giftInput}
                  onChange={(e) => setGiftInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setGift(giftInput.trim()) } }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setGift(giftInput.trim())} disabled={!giftInput.trim()}>Apply</button>
              </div>
            ) : <button type="button" className="link-btn" onClick={() => setGiftOpen(true)}>🎁 Have a gift card?</button>}
          </div>

          {quote && (
            <>
              <div className="sum-row"><span>Subtotal</span><span>{rupees(quote.subtotal)}</span></div>
              {quote.discount > 0 && <div className="sum-row save"><span>Discount</span><span>−{rupees(quote.discount)}</span></div>}
              <div className="sum-row"><span>Shipping</span><span>{quote.shipping_fee ? rupees(quote.shipping_fee) : 'Free'}</span></div>
              {quote.cod_fee > 0 && <div className="sum-row"><span>COD handling</span><span>{rupees(quote.cod_fee)}</span></div>}
              <div className="sum-row total"><span>Total</span><span>{rupees(quote.total)}</span></div>
              {quote.gift_amount > 0 && <div className="sum-row save"><span>Gift card</span><span>−{rupees(quote.gift_amount)}</span></div>}
              {quote.gift_amount > 0 && <div className="sum-row total"><span>To pay</span><span>{rupees(quote.due)}</span></div>}
            </>
          )}

          {notice && <p className="alert alert-error" role="alert">{notice}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !quote?.ok}>
            {busy ? 'Please wait…' : quote?.full_gift ? 'Place order · paid by gift card' : payMethod === 'cod' ? `Place order${quote ? ` · ${rupees(quote.due ?? quote.total)}` : ''}` : `Pay${quote ? ` ${rupees(quote.due ?? quote.total)}` : ''}`}
          </button>
          {quote && !quote.ok && <p className="small line-error">Some items changed. <Link to="/cart">Review your cart</Link>.</p>}
          <p className="small muted center">Prices include GST. Secure payments by Razorpay.</p>
        </aside>
      </form>
    </section>
  )
}
