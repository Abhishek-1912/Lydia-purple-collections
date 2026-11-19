import { useState } from 'react'
import { WhatsAppIcon } from '../components/Icons.jsx'
import { api } from '../lib/api.js'
import { config, whatsappLink } from '../lib/config.js'
import { useTitle } from '../lib/store.js'

export default function Contact() {
  useTitle('Contact us', 'WhatsApp, call or visit Lydia Purple Collections. We reply quickly.')
  const [f, setF] = useState({ name: '', phone: '', email: '', message: '', website: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => {
    let v = e.target.value
    if (k === 'phone') v = v.replace(/\D/g, '').slice(0, 10)
    setF({ ...f, [k]: v })
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (f.name.trim().length < 2) errs.name = 'Please enter your name.'
    if (!/^[6-9]\d{9}$/.test(f.phone)) errs.phone = 'Enter a 10-digit mobile number.'
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) errs.email = 'This email doesn’t look right.'
    if (f.message.trim().length < 5) errs.message = 'Please write a short message.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true); setStatus({ type: '', text: '' })
    try {
      await api('/api/contact', { method: 'POST', body: { ...f, email: f.email || null } })
      setStatus({ type: 'ok', text: 'Thank you! We’ll get back to you soon.' })
      setF({ name: '', phone: '', email: '', message: '', website: '' })
    } catch (err) { setStatus({ type: 'error', text: err.message }) }
    setBusy(false)
  }

  const err = (k) => errors[k] && <p className="field-error" id={`c-${k}-err`} role="alert">{errors[k]}</p>
  const aria = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `c-${k}-err` : undefined })

  return (
    <section className="container section">
      <h1>Contact us</h1>
      <p className="display muted">The quickest way to reach us is WhatsApp — ask for photos in daylight or a live video.</p>
      <div className="contact-grid">
        <div className="card contact-info">
          <a className="btn btn-wa btn-block" href={whatsappLink('Hi! I have a question.')} target="_blank" rel="noreferrer"><WhatsAppIcon /> Chat on WhatsApp</a>
          <dl>
            {config.phone && <><dt>Phone</dt><dd><a href={`tel:${config.phone.replace(/\s/g, '')}`}>{config.phone}</a></dd></>}
            {config.email && <><dt>Email</dt><dd><a href={`mailto:${config.email}`}>{config.email}</a></dd></>}
            {config.address && <><dt>Visit us</dt><dd>{config.address}</dd></>}
            {config.hours && <><dt>Store hours</dt><dd>{config.hours}</dd></>}
            {config.instagram && <><dt>Instagram</dt><dd><a href={config.instagram} target="_blank" rel="noreferrer">Follow us</a></dd></>}
          </dl>
        </div>
        <form className="card" onSubmit={submit} noValidate>
          <h2 className="h-sm">Send us a message</h2>
          <div className="field"><label htmlFor="c-name">Name</label><input id="c-name" type="text" autoComplete="name" value={f.name} onChange={set('name')} {...aria('name')} />{err('name')}</div>
          <div className="field"><label htmlFor="c-phone">Mobile number</label><input id="c-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={set('phone')} {...aria('phone')} />{err('phone')}</div>
          <div className="field"><label htmlFor="c-email">Email (optional)</label><input id="c-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} {...aria('email')} />{err('email')}</div>
          <div className="field"><label htmlFor="c-msg">Message</label><textarea id="c-msg" rows={5} value={f.message} onChange={set('message')} {...aria('message')} />{err('message')}</div>
          <div className="hp" aria-hidden="true"><label htmlFor="c-web">Website</label><input id="c-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
          {status.text && <p className={`alert ${status.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{status.text}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
        </form>
      </div>
    </section>
  )
}
