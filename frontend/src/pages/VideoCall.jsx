import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { WhatsAppIcon } from '../components/Icons.jsx'
import { api } from '../lib/api.js'
import { whatsappLink } from '../lib/config.js'
import { useTitle } from '../lib/store.js'

export default function VideoCall() {
  useTitle('Book a video call', 'See sarees live on a video call before you buy — choose a time that suits you.')
  const [params] = useSearchParams()
  const productSlug = params.get('product') || ''
  const [data, setData] = useState(null)
  const [product, setProduct] = useState(null)
  const [day, setDay] = useState(0)
  const [slot, setSlot] = useState(null)
  const [f, setF] = useState({ name: '', phone: '', email: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const load = () => api('/api/video-calls/slots').then(setData).catch(() => setData({ enabled: false, days: [] }))
  useEffect(() => { load() }, [])
  useEffect(() => { if (productSlug) api(`/api/products/${productSlug}`).then(setProduct).catch(() => {}) }, [productSlug])

  async function submit(e) {
    e.preventDefault(); setError('')
    if (!slot) return setError('Please choose a time.')
    if (f.name.trim().length < 2) return setError('Please enter your name.')
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setError('Enter a 10-digit mobile number.')
    setBusy(true)
    try {
      await api('/api/video-calls', { method: 'POST', body: { ...f, email: f.email || null, note: f.note || null, slot: slot.start, product_slug: productSlug || null } })
      setDone(slot)
    } catch (err) { setError(err.message); setSlot(null); load() }
    setBusy(false)
  }

  if (!data) return <section className="container page-narrow"><div className="skeleton-block" /></section>
  if (!data.enabled) {
    return (
      <section className="container page-narrow center">
        <h1>Video call</h1>
        <p className="display">Message us on WhatsApp and we’ll show you any saree live on a video call.</p>
        <a className="btn btn-wa" href={whatsappLink('Hi! I would like a video call to see sarees.')} target="_blank" rel="noreferrer"><WhatsAppIcon /> Ask on WhatsApp</a>
      </section>
    )
  }
  if (done) {
    const dayLabel = data.days.find((d) => d.slots.some((s) => s.start === done.start))?.label
    return (
      <section className="container page-narrow center">
        <div className="easy-big">📹</div>
        <h1>Request sent!</h1>
        <p className="display">{dayLabel}, {done.label}</p>
        <p>We’ll confirm on WhatsApp at +91 {f.phone} and send you the video-call link.</p>
        <Link to="/shop" className="btn btn-primary">Keep browsing</Link>
      </section>
    )
  }
  const d = data.days[day]
  return (
    <section className="container page-narrow">
      <h1>Book a video call</h1>
      <p className="display muted">See the real colours, zari and drape live before you buy — perfect for bridal shopping. About {data.slot_minutes} minutes, free.</p>
      {product && <p className="vc-product">For: <strong>{product.name}</strong></p>}
      <form onSubmit={submit} noValidate>
        <fieldset className="card">
          <legend>1. Choose a day</legend>
          <div className="easy-chips">
            {data.days.map((x, k) => (
              <button type="button" key={x.date} className={`easy-chip sm ${k === day ? 'on' : ''}`} onClick={() => { setDay(k); setSlot(null) }}
                disabled={!x.slots.some((s) => s.free)}>{x.label}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="card">
          <legend>2. Choose a time</legend>
          {d && d.slots.some((s) => s.free) ? (
            <div className="vc-slots">
              {d.slots.map((s) => (
                <button type="button" key={s.start} disabled={!s.free} className={`vc-slot ${slot?.start === s.start ? 'on' : ''}`} onClick={() => setSlot(s)} aria-pressed={slot?.start === s.start}>{s.label}</button>
              ))}
            </div>
          ) : <p className="muted">No times left on this day — please pick another.</p>}
        </fieldset>
        <fieldset className="card">
          <legend>3. Your details</legend>
          <div className="field"><label htmlFor="vc-name">Name</label><input id="vc-name" type="text" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="vc-phone">WhatsApp number</label><div className="prefix-input"><span>+91</span><input id="vc-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div></div>
          <div className="field"><label htmlFor="vc-note">What would you like to see? (optional)</label><textarea id="vc-note" rows={2} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Bridal Kanjivaram in red and gold, budget around ₹25,000" /></div>
        </fieldset>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Booking…' : slot ? `Request ${d?.label}, ${slot.label}` : 'Request video call'}</button>
      </form>
    </section>
  )
}
