import { useEffect, useState } from 'react'
import { useAuth, useAuthedApi } from '../../context/AuthContext.jsx'
import { config } from '../../lib/config.js'

export default function Broadcast() {
  const call = useAuthedApi()
  const { getToken } = useAuth()
  const [a, setA] = useState(null)
  const [f, setF] = useState({ template: '', params: '', test_phone: '' })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { call('/api/admin/broadcast/audience').then(setA).catch(() => setA({ count: 0, enabled: false })) }, [call])

  async function download() {
    const res = await fetch(`${config.apiUrl}/api/admin/broadcast/audience?format=csv`, { headers: { Authorization: `Bearer ${await getToken()}` } })
    const url = URL.createObjectURL(await res.blob())
    Object.assign(document.createElement('a'), { href: url, download: 'whatsapp-opt-in.csv' }).click()
    URL.revokeObjectURL(url)
  }
  async function send(test) {
    if (!f.template.trim()) return setMsg({ type: 'error', text: 'Enter the approved template name.' })
    if (test && !/^[6-9]\d{9}$/.test(f.test_phone)) return setMsg({ type: 'error', text: 'Enter your own 10-digit number for the test.' })
    if (!test && !window.confirm(`Send to ${a.count} customer${a.count === 1 ? '' : 's'}? WhatsApp charges per message.`)) return
    setBusy(true); setMsg({ type: '', text: '' })
    try {
      const r = await call('/api/admin/broadcast', { method: 'POST', body: { template: f.template.trim(), params: f.params.split('|').map((x) => x.trim()).filter(Boolean), test_phone: test ? f.test_phone : null } })
      setMsg({ type: 'ok', text: `Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ''}.` })
    } catch (e) { setMsg({ type: 'error', text: e.message }) }
    setBusy(false)
  }

  if (!a) return <div className="skeleton-block" />
  return (
    <>
      <h1 className="admin-h">WhatsApp broadcast</h1>
      <p className="small muted">Only customers who ticked “Send me new arrivals on WhatsApp” at checkout are included — WhatsApp and Indian privacy law require their permission.</p>
      <div className="stat-grid three">
        <div className="stat"><span className="stat-value">{a.count}</span><span className="stat-label">Customers who said yes</span></div>
      </div>
      <section className="card">
        <h2 className="h-sm">Free way (works now)</h2>
        <p className="small">Download the list, then in the <strong>WhatsApp Business app</strong> make a Broadcast List with these numbers. Messages reach people who have your number saved.</p>
        <button className="btn btn-outline btn-sm" onClick={download} disabled={!a.count}>⬇ Download list (CSV)</button>
      </section>
      <section className="card">
        <h2 className="h-sm">Automatic (WhatsApp Cloud API)</h2>
        {a.enabled ? (
          <>
            <p className="small muted">Use a <strong>Marketing</strong> template approved by Meta. Write values for its blanks separated by “|”, and use {'{name}'} for the customer’s name.</p>
            <div className="field"><label htmlFor="bc-t">Template name</label><input id="bc-t" type="text" value={f.template} onChange={(e) => setF({ ...f, template: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} placeholder="new_arrivals" /></div>
            <div className="field"><label htmlFor="bc-p">Template values</label><input id="bc-p" type="text" value={f.params} onChange={(e) => setF({ ...f, params: e.target.value })} placeholder="{name} | Diwali collection is here | lydiapurple.in/new-arrivals" /></div>
            <div className="field-row">
              <div className="field"><label htmlFor="bc-ph">Your number (send a test first)</label><input id="bc-ph" type="tel" inputMode="numeric" value={f.test_phone} onChange={(e) => setF({ ...f, test_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
            </div>
            <div className="row-gap">
              <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => send(true)}>Send test to me</button>
              <button className="btn btn-primary btn-sm" disabled={busy || !a.count} onClick={() => send(false)}>Send to {a.count}</button>
            </div>
          </>
        ) : <p className="small muted">Switched off. To send automatically, set up WhatsApp Cloud API (Meta Business) and add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Railway. Until then, use the free way above.</p>}
        {msg.text && <p className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</p>}
      </section>
    </>
  )
}
