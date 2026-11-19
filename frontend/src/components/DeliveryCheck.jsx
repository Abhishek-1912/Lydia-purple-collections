import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const KEY = 'lpc_pin'
const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

function savedPin() {
  try {
    return localStorage.getItem(KEY) || JSON.parse(localStorage.getItem('lpc_checkout_v1') || '{}').pin || ''
  } catch { return '' }
}

export default function DeliveryCheck({ codAvailable = true }) {
  const [pin, setPin] = useState(savedPin)
  const [est, setEst] = useState(null)
  const [error, setError] = useState('')

  async function check(p = pin) {
    setError('')
    if (!/^[1-9]\d{5}$/.test(p)) { setError('Enter a valid 6-digit PIN code.'); setEst(null); return }
    try {
      setEst(await api(`/api/delivery-estimate?pin=${p}`))
      try { localStorage.setItem(KEY, p) } catch { /* ignore */ }
    } catch (e) { setError(e.message); setEst(null) }
  }

  useEffect(() => { if (/^[1-9]\d{5}$/.test(pin)) check(pin) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="delivery">
      <form className="delivery-form" onSubmit={(e) => { e.preventDefault(); check() }}>
        <label htmlFor="pin-check">Check delivery date</label>
        <div className="coupon-form">
          <input id="pin-check" type="text" inputMode="numeric" placeholder="Your PIN code" value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setEst(null) }} aria-describedby="pin-result" />
          <button className="btn btn-outline btn-sm">Check</button>
        </div>
      </form>
      <div id="pin-result" aria-live="polite">
        {error && <p className="field-error">{error}</p>}
        {est && (
          <p className="small delivery-result">
            🚚 Delivery by <strong>{fmt(est.from)} – {fmt(est.to)}</strong> to {est.pin}
            {codAvailable && <> · Cash on Delivery available</>}
            {est.zone === 'remote' && <><br /><span className="muted">Remote area — may take a little longer.</span></>}
          </p>
        )}
      </div>
    </div>
  )
}
