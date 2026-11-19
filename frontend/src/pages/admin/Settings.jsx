import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import BannersEditor from './BannersEditor.jsx'

const SECTIONS = [
  { title: 'Shipping & Cash on Delivery', note: 'Changes apply to new carts and orders straight away.', fields: [
    ['free_shipping_above', 'Free shipping from (₹, after coupon)', 'num'], ['shipping_fee', 'Shipping fee below that (₹)', 'num'],
    ['cod_fee', 'COD handling fee (₹)', 'num'], ['cod_max_order', 'Largest COD order (₹)', 'num'],
    ['shop_pin', 'Shop PIN code (for delivery dates)', 'pin'], ['dispatch_days', 'Days to pack before courier pickup', 'num'],
  ] },
  { title: 'Shop contact details', note: 'Shown on the Contact page, footer, packing slips and every WhatsApp button. Blank fields are hidden.', fields: [
    ['whatsapp', 'WhatsApp number (10 digits)', 'tel'], ['phone', 'Phone (as shown to customers)', 'text'],
    ['email', 'Shop email (also receives new-order alerts)', 'email'], ['address', 'Shop address', 'text'],
    ['hours', 'Store hours', 'text', 'Mon–Sat 10:00 am – 8:00 pm'], ['instagram', 'Instagram page link', 'url', 'https://instagram.com/yourpage'],
  ] },
  { title: 'Announcement bar', note: 'The purple strip at the top of every page. Leave blank for the automatic free-shipping message. Keep it short (fits one line on phones).', fields: [
    ['announcement', 'Announcement text', 'text', 'Diwali sale: 10% off with code FESTIVE10'],
  ] },
]

export default function Settings() {
  const call = useAuthedApi()
  const [f, setF] = useState(null)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    call('/api/admin/settings').then((s) => setF({ ...s, whatsapp: (s.whatsapp || '').replace(/^91(?=\d{10}$)/, '') }))
      .catch((e) => setMsg({ type: 'error', text: e.message }))
  }, [call])

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg({ type: '', text: '' })
    try {
      const saved = await call('/api/admin/settings', { method: 'PUT', body: f })
      setF({ ...saved, whatsapp: (saved.whatsapp || '').replace(/^91(?=\d{10}$)/, '') })
      try { localStorage.removeItem('lpc_settings_v1') } catch { /* ignore */ }
      setMsg({ type: 'ok', text: 'Saved. The shop shows the new settings now (customers see them on their next page load).' })
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    setBusy(false)
  }

  if (!f) return msg.text ? <p className="alert alert-error">{msg.text}</p> : <div className="skeleton-block" />
  const set = (k, kind) => (e) => {
    let v = e.target.value
    if (kind === 'num') v = v.replace(/\D/g, '')
    if (kind === 'pin') v = v.replace(/\D/g, '').slice(0, 6)
    if (kind === 'tel') v = v.replace(/\D/g, '').slice(0, 10)
    setF({ ...f, [k]: v })
  }

  return (
    <form onSubmit={save} noValidate>
      <h1 className="admin-h">Store settings</h1>
      {SECTIONS.map((s) => (
        <fieldset key={s.title} className="card">
          <legend>{s.title}</legend>
          <p className="small muted">{s.note}</p>
          <div className="settings-grid">
            {s.fields.map(([k, label, kind, ph]) => (
              <div className="field" key={k}>
                <label htmlFor={`s-${k}`}>{label}</label>
                {k === 'whatsapp' ? (
                  <div className="prefix-input"><span>+91</span><input id={`s-${k}`} type="tel" inputMode="numeric" value={f[k] ?? ''} onChange={set(k, kind)} /></div>
                ) : (
                  <input id={`s-${k}`} type={kind === 'email' ? 'email' : kind === 'url' ? 'url' : 'text'} inputMode={['num', 'pin'].includes(kind) ? 'numeric' : undefined}
                    value={f[k] ?? ''} placeholder={ph} onChange={set(k, kind)} maxLength={k === 'announcement' ? 140 : undefined} />
                )}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <BannersEditor banners={f.banners || []} onChange={(banners) => setF({ ...f, banners })} />
      {msg.text && <p className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</p>}
      <div className="sticky-save"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
    </form>
  )
}
